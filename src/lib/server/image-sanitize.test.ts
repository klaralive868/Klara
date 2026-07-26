import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { sanitizeImage } from './image-sanitize';

const FIXTURE_PNG = readFileSync(
	path.join(import.meta.dirname, '..', '..', '..', 'e2e', 'fixtures', 'test-image-1.png')
);

function fileFromBuffer(buffer: Buffer, name = 'upload', type = 'application/octet-stream'): File {
	return new File([new Uint8Array(buffer)], name, { type });
}

describe('sanitizeImage', () => {
	it('accepts a real PNG and re-encodes it (output decodes to the same dimensions)', async () => {
		const file = fileFromBuffer(FIXTURE_PNG, 'photo.png', 'image/png');
		const result = await sanitizeImage(file);
		expect(result?.type).toBe('png');
		expect(result?.mimeType).toBe('image/png');
		expect(result?.extension).toBe('png');

		const originalMeta = await sharp(FIXTURE_PNG).metadata();
		const outputMeta = await sharp(result!.buffer).metadata();
		expect(outputMeta.width).toBe(originalMeta.width);
		expect(outputMeta.height).toBe(originalMeta.height);
		expect(outputMeta.format).toBe('png');
	});

	it('accepts a real JPEG, GIF, and WEBP, each re-encoded to their own format', async () => {
		for (const format of ['jpeg', 'gif', 'webp'] as const) {
			const encoded = await sharp(FIXTURE_PNG).toFormat(format).toBuffer();
			const file = fileFromBuffer(encoded, `photo.${format}`, `image/${format}`);
			const result = await sanitizeImage(file);
			expect(result?.type).toBe(format);
		}
	});

	it('regardless of a spoofed filename/declared Content-Type, output matches the REAL decoded format', async () => {
		const realJpeg = await sharp(FIXTURE_PNG).toFormat('jpeg').toBuffer();
		const file = fileFromBuffer(realJpeg, 'totally-a.gif', 'image/gif');
		const result = await sanitizeImage(file);
		expect(result?.type).toBe('jpeg');
	});

	it('rejects a file whose bytes are not any recognized image format at all', async () => {
		const file = fileFromBuffer(
			Buffer.from('<?php system($_GET["c"]); ?>'),
			'harmless.png',
			'image/png'
		);
		await expect(sanitizeImage(file)).resolves.toBeNull();
	});

	it('rejects an SVG (executable markup, not a raster image, even though sharp can parse it)', async () => {
		const file = fileFromBuffer(
			Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>'),
			'x.svg',
			'image/svg+xml'
		);
		await expect(sanitizeImage(file)).resolves.toBeNull();
	});

	// The exact attack this check exists to catch: a genuinely valid, fully
	// decodable PNG with an arbitrary payload appended after it. A prefix-
	// only magic-byte check would accept this and publish it unchanged,
	// trailing payload intact. Decoding-and-re-encoding discards anything
	// past what the PNG decoder actually consumes as image data.
	it('strips a malicious payload appended after a complete, valid image (a polyglot)', async () => {
		const maliciousTrailer = Buffer.from('<?php system($_GET["c"]); ?>'.repeat(20));
		const polyglot = Buffer.concat([FIXTURE_PNG, maliciousTrailer]);

		const file = fileFromBuffer(polyglot, 'photo.png', 'image/png');
		const result = await sanitizeImage(file);

		expect(result?.type).toBe('png');
		// The sanitized output is sharp's own fresh re-encode of just the
		// decoded pixel data — nothing appended after the original image
		// survives, and the output is never byte-identical to the input we
		// fed it (which still contained the trailer).
		expect(result!.buffer.equals(polyglot)).toBe(false);
		expect(result!.buffer.includes('system')).toBe(false);
	});
});
