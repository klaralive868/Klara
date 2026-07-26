import sharp, { type Sharp, type Metadata } from 'sharp';

// A public bucket (docs/adr/0007-resource-images-public-bucket.md) means
// anything stored here gets hosted at a stable, indefinitely-public URL —
// the client-supplied filename extension and `file.type` are both just
// strings an authenticated member's request fully controls, and a magic-
// byte prefix check alone only proves the file *starts* like an image, not
// that the whole payload is one: a polyglot (valid image header, arbitrary
// content appended or interleaved afterward) would still pass a prefix-only
// check and get published unchanged. Actually decoding the file — and
// storing sharp's own re-encoded output, never the client's original bytes
// — is the only check that can't be bypassed this way: content that isn't
// genuinely part of a valid, fully-decodable image is discarded regardless
// of where in the file it sits, because it's simply not part of what gets
// decoded.
export type SniffedImageType = 'png' | 'jpeg' | 'gif' | 'webp';

const ALLOWED_FORMATS: Record<string, SniffedImageType> = {
	png: 'png',
	jpeg: 'jpeg',
	gif: 'gif',
	webp: 'webp'
};

export interface SanitizedImage {
	type: SniffedImageType;
	mimeType: string;
	extension: string;
	buffer: Buffer;
}

// Deliberately narrow — png/jpeg/gif/webp only, matching the file picker's
// accept="image/*" intent. No svg: unlike a raster format, an SVG's bytes
// are executable markup (can embed <script>), which a public bucket would
// then serve as attacker-controlled, browser-renderable content — sharp can
// decode SVG, but doing so would defeat the point of excluding it.
export async function sanitizeImage(file: File): Promise<SanitizedImage | null> {
	const original = Buffer.from(await file.arrayBuffer());

	let image: Sharp;
	let metadata: Metadata;
	try {
		image = sharp(original, { failOn: 'error' });
		metadata = await image.metadata();
	} catch {
		return null;
	}

	const type = metadata.format ? ALLOWED_FORMATS[metadata.format] : undefined;
	if (!type) {
		return null;
	}

	// Forces a full decode of every pixel, not just the header/metadata
	// sharp already read above — a truncated scan, a corrupted data stream,
	// or a polyglot whose "image" portion doesn't actually decode cleanly
	// all throw here. Re-encoding to the SAME detected format (not
	// converting) and storing that output, rather than `original`, is what
	// actually strips anything appended/interleaved outside the real image
	// data.
	let buffer: Buffer;
	try {
		buffer = await image.toFormat(type).toBuffer();
	} catch {
		return null;
	}

	return {
		type,
		mimeType: `image/${type}`,
		extension: type === 'jpeg' ? 'jpg' : type,
		buffer
	};
}
