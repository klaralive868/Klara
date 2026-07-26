// A public bucket (docs/adr/0007-resource-images-public-bucket.md) means
// anything accepted here gets hosted at a stable, indefinitely-public URL —
// the client-supplied filename extension and `file.type` are both just
// strings an authenticated member's request fully controls, not proof of
// what the bytes actually are. Sniffing the real file signature is the only
// check that can't be spoofed by renaming a file or setting an arbitrary
// Content-Type on the multipart part.
export type SniffedImageType = 'png' | 'jpeg' | 'gif' | 'webp';

const SIGNATURES: { type: SniffedImageType; mimeType: string; bytes: number[] }[] = [
	{ type: 'png', mimeType: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
	{ type: 'jpeg', mimeType: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
	{ type: 'gif', mimeType: 'image/gif', bytes: [0x47, 0x49, 0x46, 0x38] }
	// webp is handled separately below — RIFF····WEBP, not a fixed prefix.
];

export interface SniffedImage {
	type: SniffedImageType;
	mimeType: string;
	extension: string;
}

// Deliberately narrow — png/jpeg/gif/webp only, matching the file picker's
// accept="image/*" intent. No svg: unlike a raster format, an SVG's bytes
// are executable markup (can embed <script>), which a public bucket would
// then serve as attacker-controlled, browser-renderable content.
export async function sniffImageType(file: File): Promise<SniffedImage | null> {
	const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());

	for (const signature of SIGNATURES) {
		if (signature.bytes.every((byte, index) => header[index] === byte)) {
			return {
				type: signature.type,
				mimeType: signature.mimeType,
				extension: signature.type === 'jpeg' ? 'jpg' : signature.type
			};
		}
	}

	const isRiff =
		header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46;
	const isWebp =
		header[8] === 0x57 && header[9] === 0x45 && header[10] === 0x42 && header[11] === 0x50;
	if (isRiff && isWebp) {
		return { type: 'webp', mimeType: 'image/webp', extension: 'webp' };
	}

	return null;
}
