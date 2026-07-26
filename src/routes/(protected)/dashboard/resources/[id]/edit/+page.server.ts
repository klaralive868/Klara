import { error, fail } from '@sveltejs/kit';
import { resourceFromRow, type ResourceImage, type ResourceRow } from '$lib/bookings/types';
import { parseResourceForm } from '$lib/server/resources';
import { getResourceSeatCounts } from '$lib/server/bookings';
import { getActiveOrganizationId } from '$lib/server/organization';
import type { Actions, PageServerLoad } from './$types';

const IMAGE_BUCKET = 'resource-images';
const MAX_IMAGE_BYTES = 5_000_000;

interface ResourceImageRow {
	id: string;
	storage_path: string;
	is_primary: boolean;
}

export const load: PageServerLoad = async ({ params, locals }) => {
	const [resourceResult, imagesResult] = await Promise.all([
		locals.supabase
			.from('resources')
			.select(
				'id, name, description, departure_date, return_date, quantity, requires_manual_confirmation, price_cents, status'
			)
			.eq('id', params.id)
			.maybeSingle(),
		locals.supabase
			.from('resource_images')
			.select('id, storage_path, is_primary')
			.eq('resource_id', params.id)
			.order('created_at', { ascending: true })
	]);

	if (resourceResult.error) {
		console.error('resources: failed to load resource', resourceResult.error);
		error(500, 'Could not load this resource.');
	}

	// RLS silently excludes another organization's resource rather than
	// erroring — a null row means "not found or not yours," both 404.
	if (!resourceResult.data) {
		error(404, 'Resource not found');
	}

	const resource = resourceFromRow(resourceResult.data as ResourceRow);

	// Only meaningful when a seat limit is actually set — an uncapped
	// resource has nothing for these counts to track against.
	const seatCounts =
		resource.quantity !== null ? await getResourceSeatCounts(locals.supabase, resource.id) : null;

	let images: ResourceImage[] = [];
	if (imagesResult.error) {
		console.error('resources: failed to load resource images', imagesResult.error);
	} else {
		// resource-images is a public bucket (ADR-0007) — getPublicUrl is a
		// synchronous, local URL construction, not a signed/expiring URL and
		// not an API round trip, unlike Catalog's private-bucket equivalent.
		images = ((imagesResult.data ?? []) as ResourceImageRow[]).map((row) => ({
			id: row.id,
			isPrimary: row.is_primary,
			url: locals.supabase.storage.from(IMAGE_BUCKET).getPublicUrl(row.storage_path).data
				.publicUrl
		}));
	}

	return { resource, seatCounts, images };
};

export const actions: Actions = {
	update: async ({ request, params, locals }) => {
		const formData = await request.formData();
		const parsed = parseResourceForm(formData);
		if (!parsed.ok) {
			return fail(400, { message: parsed.message });
		}

		const { data, error: updateError } = await locals.supabase
			.from('resources')
			.update({
				name: parsed.value.name,
				description: parsed.value.description,
				departure_date: parsed.value.departureDate,
				return_date: parsed.value.returnDate,
				price_cents: parsed.value.priceCents,
				quantity: parsed.value.quantity,
				requires_manual_confirmation: parsed.value.requiresManualConfirmation
			})
			.eq('id', params.id)
			.select('id')
			.maybeSingle();

		if (updateError) {
			return fail(500, { message: 'Could not save the resource. Please try again.' });
		}
		if (!data) {
			return fail(404, { message: 'Resource not found.' });
		}

		return { success: true, message: 'Resource saved.' };
	},

	publish: async ({ params, locals }) => {
		// Only a genuinely draft resource can be published directly — mirrors
		// Catalog's publish precondition (draft -> published only).
		const { data, error: updateError } = await locals.supabase
			.from('resources')
			.update({ status: 'published' })
			.eq('id', params.id)
			.eq('status', 'draft')
			.select('id')
			.maybeSingle();

		if (updateError) {
			return fail(500, { message: 'Could not publish the resource. Please try again.' });
		}
		if (!data) {
			return fail(404, { message: 'Resource not found or not a draft.' });
		}

		return { success: true, message: 'Resource published.' };
	},

	archive: async ({ params, locals }) => {
		// Archive works from either draft or published — no status
		// precondition, mirroring Catalog's archive action.
		const { data, error: updateError } = await locals.supabase
			.from('resources')
			.update({ status: 'archived' })
			.eq('id', params.id)
			.select('id')
			.maybeSingle();

		if (updateError) {
			return fail(500, { message: 'Could not archive the resource. Please try again.' });
		}
		if (!data) {
			return fail(404, { message: 'Resource not found.' });
		}

		return { success: true, message: 'Resource archived.' };
	},

	unarchive: async ({ params, locals }) => {
		// Only a genuinely archived resource can be unarchived — archive is
		// never a dead end, and it always returns to draft (never published).
		const { data, error: updateError } = await locals.supabase
			.from('resources')
			.update({ status: 'draft' })
			.eq('id', params.id)
			.eq('status', 'archived')
			.select('id')
			.maybeSingle();

		if (updateError) {
			return fail(500, { message: 'Could not restore the resource. Please try again.' });
		}
		if (!data) {
			return fail(404, { message: 'Resource not found or not archived.' });
		}

		return { success: true, message: 'Resource restored to draft.' };
	},

	uploadImages: async ({ request, params, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) {
			return fail(401, { message: 'Not authenticated.' });
		}

		const organizationId = await getActiveOrganizationId(locals.supabase, user.id);
		if (!organizationId) {
			return fail(403, { message: 'Could not determine your organization.' });
		}

		const formData = await request.formData();
		const files = formData
			.getAll('images')
			.filter((entry): entry is File => entry instanceof File && entry.size > 0);

		if (files.length === 0) {
			return fail(400, { message: 'Choose at least one image to upload.' });
		}

		const oversized = files.find((file) => file.size > MAX_IMAGE_BYTES);
		if (oversized) {
			return fail(400, {
				message: `"${oversized.name}" is larger than the ${MAX_IMAGE_BYTES / 1_000_000}MB limit per image.`
			});
		}

		// All-or-nothing: if any file in the batch fails partway through, every
		// earlier file committed so far in THIS call is rolled back (storage
		// object + DB row) rather than left in place — same reasoning as
		// Catalog's equivalent action.
		const committed: { path: string; imageId: string }[] = [];

		async function rollbackCommitted() {
			if (committed.length === 0) return;
			await locals.supabase
				.from('resource_images')
				.delete()
				.in(
					'id',
					committed.map((entry) => entry.imageId)
				);
			await locals.supabase.storage.from(IMAGE_BUCKET).remove(committed.map((entry) => entry.path));
		}

		for (const file of files) {
			const imageId = crypto.randomUUID();
			const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
			const path = `${organizationId}/${params.id}/${imageId}.${extension}`;

			const { error: uploadError } = await locals.supabase.storage
				.from(IMAGE_BUCKET)
				.upload(path, file, { contentType: file.type });
			if (uploadError) {
				await rollbackCommitted();
				return fail(500, { message: 'Could not upload one or more images. Please try again.' });
			}

			// Explicit id, matching the filename — keeps the row id and the
			// path's {image_id} segment as the same value, per the documented
			// storage path convention.
			const { error: insertError } = await locals.supabase
				.from('resource_images')
				.insert({ id: imageId, resource_id: params.id, storage_path: path });
			if (insertError) {
				// The DB row is what makes an upload "real" — clean up the
				// now-orphaned storage object rather than leaving it dangling.
				await locals.supabase.storage.from(IMAGE_BUCKET).remove([path]);
				await rollbackCommitted();
				return fail(500, { message: 'Could not save the uploaded image. Please try again.' });
			}

			committed.push({ path, imageId });
		}

		return { success: true, message: 'Images uploaded.' };
	},

	setPrimaryImage: async ({ request, locals }) => {
		const formData = await request.formData();
		const imageId = String(formData.get('imageId') ?? '').trim();
		if (!imageId) {
			return fail(400, { message: 'Missing image id.' });
		}

		const { error: rpcError } = await locals.supabase.rpc('mark_resource_image_primary', {
			p_image_id: imageId
		});
		if (rpcError) {
			return fail(500, { message: 'Could not update the primary image. Please try again.' });
		}

		return { success: true, message: 'Primary image updated.' };
	},

	removeImage: async ({ request, locals }) => {
		const formData = await request.formData();
		const imageId = String(formData.get('imageId') ?? '').trim();
		if (!imageId) {
			return fail(400, { message: 'Missing image id.' });
		}

		const { data: image, error: fetchError } = await locals.supabase
			.from('resource_images')
			.select('storage_path')
			.eq('id', imageId)
			.maybeSingle();
		if (fetchError) {
			return fail(500, { message: 'Could not remove the image. Please try again.' });
		}
		if (!image) {
			return fail(404, { message: 'Image not found.' });
		}

		const { error: deleteError } = await locals.supabase
			.from('resource_images')
			.delete()
			.eq('id', imageId);
		if (deleteError) {
			return fail(500, { message: 'Could not remove the image. Please try again.' });
		}

		// The DB row is the source of truth for what images "exist" — a
		// failure here leaves a harmless orphaned storage object rather than
		// any inconsistent state, so it's logged but doesn't fail the action.
		const { error: storageError } = await locals.supabase.storage
			.from(IMAGE_BUCKET)
			.remove([image.storage_path]);
		if (storageError) {
			console.error('resources: failed to remove storage object', storageError);
		}

		return { success: true, message: 'Image removed.' };
	}
};
