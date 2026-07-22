import { error, fail } from '@sveltejs/kit';
import {
	catalogCategoryFromRow,
	catalogItemFromRow,
	type CatalogCategoryRow,
	type CatalogItemImageRow,
	type CatalogItemRow
} from '$lib/catalog/types';
import { parseCatalogItemForm, parseStockQuantities } from '$lib/server/catalog';
import { getActiveOrganizationId } from '$lib/server/organization';
import type { Actions, PageServerLoad } from './$types';

const IMAGE_BUCKET = 'catalog-images';
const SIGNED_URL_EXPIRY_SECONDS = 3600;
const MAX_IMAGE_BYTES = 5_000_000;

export const load: PageServerLoad = async ({ params, locals }) => {
	const [itemResult, categoriesResult, tagsResult, stockResult, imagesResult] = await Promise.all([
		locals.supabase
			.from('catalog_items')
			.select('id, name, description, price_cents, material_type, status')
			.eq('id', params.id)
			.maybeSingle(),
		locals.supabase
			.from('catalog_categories')
			.select('id, name, parent_id')
			.order('created_at', { ascending: true }),
		locals.supabase.from('catalog_item_categories').select('category_id').eq('item_id', params.id),
		locals.supabase.from('catalog_item_stock').select('size, quantity').eq('item_id', params.id),
		locals.supabase
			.from('catalog_item_images')
			.select('id, storage_path, is_primary')
			.eq('item_id', params.id)
			.order('created_at', { ascending: true })
	]);

	if (itemResult.error) {
		console.error('catalog: failed to load item', itemResult.error);
		error(500, 'Could not load this item.');
	}

	// RLS silently excludes another organization's item rather than erroring —
	// a null row means "not found or not yours," both reported as 404.
	if (!itemResult.data) {
		error(404, 'Item not found');
	}

	if (categoriesResult.error) {
		console.error('catalog: failed to load categories', categoriesResult.error);
	}
	if (tagsResult.error) {
		console.error('catalog: failed to load item categories', tagsResult.error);
	}
	if (stockResult.error) {
		console.error('catalog: failed to load item stock', stockResult.error);
	}

	// The reverse of parseStockQuantities' size-key convention: a NULL size
	// (the sizeless case) maps back to the "quantity" key StockSelector uses.
	const stockQuantities: Record<string, number> = {};
	for (const row of stockResult.data ?? []) {
		stockQuantities[row.size ?? 'quantity'] = row.quantity;
	}

	let images: { id: string; isPrimary: boolean; url: string }[] = [];
	if (imagesResult.error) {
		console.error('catalog: failed to load item images', imagesResult.error);
	} else {
		const rows = (imagesResult.data ?? []) as CatalogItemImageRow[];
		const paths = rows.map((row) => row.storage_path);
		const { data: signedUrls, error: signError } =
			paths.length > 0
				? await locals.supabase.storage
						.from(IMAGE_BUCKET)
						.createSignedUrls(paths, SIGNED_URL_EXPIRY_SECONDS)
				: { data: [], error: null };
		if (signError) {
			console.error('catalog: failed to sign item image URLs', signError);
		}
		images = rows.map((row, index) => ({
			id: row.id,
			isPrimary: row.is_primary,
			url: signedUrls?.[index]?.signedUrl ?? ''
		}));
	}

	return {
		item: catalogItemFromRow(itemResult.data as CatalogItemRow),
		categories: ((categoriesResult.data ?? []) as CatalogCategoryRow[]).map(catalogCategoryFromRow),
		categoryIds: (tagsResult.data ?? []).map((row) => row.category_id as string),
		stockQuantities,
		images
	};
};

export const actions: Actions = {
	update: async ({ request, params, locals }) => {
		const formData = await request.formData();
		const parsed = parseCatalogItemForm(formData);
		if (!parsed.ok) {
			return fail(400, { message: parsed.message });
		}

		const categoryIds = formData.getAll('categoryIds').map(String);
		const stockEntries = parseStockQuantities(formData.get('stockQuantities') as string | null);

		const { data, error: updateError } = await locals.supabase
			.from('catalog_items')
			.update({
				name: parsed.value.name,
				description: parsed.value.description,
				price_cents: parsed.value.priceCents,
				material_type: parsed.value.materialType
			})
			.eq('id', params.id)
			.select('id')
			.maybeSingle();

		if (updateError) {
			return fail(500, { message: 'Could not save the item. Please try again.' });
		}
		if (!data) {
			return fail(404, { message: 'Item not found.' });
		}

		// A single RPC call, not two separate delete/insert requests — the
		// function wraps both in one transaction, so a failed insert can't
		// leave the item with its tags deleted and nothing re-applied.
		const { error: tagError } = await locals.supabase.rpc('sync_catalog_item_categories', {
			p_item_id: params.id,
			p_category_ids: categoryIds
		});
		if (tagError) {
			console.error('catalog: failed to sync item categories', tagError);
			return fail(500, { message: 'Item saved, but categories could not be updated.' });
		}

		// Same atomic replace-all reasoning as the category sync above — and
		// this is also what reconciles stock rows when the material type's
		// sizing scheme changed: the client already reset stockQuantities to
		// only the new scheme's sizes, so the full-replace here naturally
		// drops rows for sizes that no longer apply.
		const { error: stockError } = await locals.supabase.rpc('sync_catalog_item_stock', {
			p_item_id: params.id,
			p_entries: stockEntries
		});
		if (stockError) {
			console.error('catalog: failed to sync item stock', stockError);
			return fail(500, { message: 'Item saved, but stock could not be updated.' });
		}

		return { success: true, message: 'Item saved.' };
	},

	publish: async ({ request, params, locals }) => {
		// The categories AND stock quantities checked/entered in the form when
		// Publish is clicked are what get persisted — reading them here
		// (rather than only the DB's prior state) means clicking Publish
		// directly, without clicking Save item first, doesn't silently
		// discard whatever the user just changed. Both buttons submit the
		// same <form>, so both fields are present in this submission too.
		const formData = await request.formData();
		const categoryIds = formData.getAll('categoryIds').map(String);
		const stockEntries = parseStockQuantities(formData.get('stockQuantities') as string | null);

		// Checked before touching anything — the item's existing tags must
		// survive an unpublishable (zero-category) attempt untouched.
		if (categoryIds.length === 0) {
			return fail(400, { message: 'Add at least one category before publishing.' });
		}

		// A single RPC, not two separate writes — the status transition (only
		// a genuinely draft item can be published directly, same precondition
		// pattern as unarchive) and the tag sync happen in one transaction. If
		// the sync fails, the status change rolls back with it, so the item
		// never ends up published-in-the-DB-but-shown-as-draft with no way to
		// retry (the draft-only precondition would 404 every subsequent
		// attempt otherwise).
		const { data: published, error: publishError } = await locals.supabase.rpc(
			'publish_catalog_item',
			{ p_item_id: params.id, p_category_ids: categoryIds }
		);

		if (publishError) {
			return fail(500, { message: 'Could not publish the item. Please try again.' });
		}
		if (!published) {
			return fail(404, { message: 'Item not found or not a draft.' });
		}

		// Stock isn't part of publish_catalog_item's own transaction (it gates
		// on categories, not stock), but still needs syncing here for the same
		// reason categoryIds does — otherwise a Publish click that skipped
		// Save item would leave the just-published item showing stale
		// quantities with no error telling the user why.
		const { error: stockError } = await locals.supabase.rpc('sync_catalog_item_stock', {
			p_item_id: params.id,
			p_entries: stockEntries
		});
		if (stockError) {
			console.error('catalog: failed to sync item stock on publish', stockError);
			return fail(500, { message: 'Item published, but stock could not be updated.' });
		}

		return { success: true, message: 'Item published.' };
	},

	archive: async ({ params, locals }) => {
		const { data, error: updateError } = await locals.supabase
			.from('catalog_items')
			.update({ status: 'archived' })
			.eq('id', params.id)
			.select('id')
			.maybeSingle();

		if (updateError) {
			return fail(500, { message: 'Could not archive the item. Please try again.' });
		}
		if (!data) {
			return fail(404, { message: 'Item not found.' });
		}

		return { success: true, message: 'Item archived.' };
	},

	unarchive: async ({ params, locals }) => {
		// Only a genuinely archived item can be unarchived — without this,
		// a direct POST to a published item would silently demote it to draft
		// (the UI only ever renders this button for archived items).
		const { data, error: updateError } = await locals.supabase
			.from('catalog_items')
			.update({ status: 'draft' })
			.eq('id', params.id)
			.eq('status', 'archived')
			.select('id')
			.maybeSingle();

		if (updateError) {
			return fail(500, { message: 'Could not restore the item. Please try again.' });
		}
		if (!data) {
			return fail(404, { message: 'Item not found or not archived.' });
		}

		return { success: true, message: 'Item restored to draft.' };
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
		// object + DB row) rather than left in place. Without this, a batch
		// upload that fails on file 2 of 3 would silently leave file 1
		// committed — the user sees a failure, retries the whole batch, and
		// gets a duplicate of file 1.
		const committed: { path: string; imageId: string }[] = [];

		async function rollbackCommitted() {
			if (committed.length === 0) return;
			await locals.supabase
				.from('catalog_item_images')
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
				.from('catalog_item_images')
				.insert({ id: imageId, item_id: params.id, storage_path: path });
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

		const { error: rpcError } = await locals.supabase.rpc('mark_catalog_item_image_primary', {
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
			.from('catalog_item_images')
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
			.from('catalog_item_images')
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
			console.error('catalog: failed to remove storage object', storageError);
		}

		return { success: true, message: 'Image removed.' };
	}
};
