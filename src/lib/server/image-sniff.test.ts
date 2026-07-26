import { describe, expect, it } from 'vitest';
import { sniffImageType } from './image-sniff';

function fileFromBytes(bytes: number[], name = 'upload', type = 'application/octet-stream'): File {
	return new File([new Uint8Array(bytes)], name, { type });
}

const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
const JPEG_HEADER = [0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0];
const GIF_HEADER = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0, 0, 0];
const WEBP_HEADER = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];

describe('sniffImageType', () => {
	it('recognizes a PNG signature regardless of filename/declared type', () => {
		const file = fileFromBytes(PNG_HEADER, 'evil.exe', 'application/x-msdownload');
		expect(sniffImageType(file)).resolves.toEqual({
			type: 'png',
			mimeType: 'image/png',
			extension: 'png'
		});
	});

	it('recognizes a JPEG signature', async () => {
		const file = fileFromBytes(JPEG_HEADER);
		await expect(sniffImageType(file)).resolves.toEqual({
			type: 'jpeg',
			mimeType: 'image/jpeg',
			extension: 'jpg'
		});
	});

	it('recognizes a GIF signature', async () => {
		const file = fileFromBytes(GIF_HEADER);
		await expect(sniffImageType(file)).resolves.toEqual({
			type: 'gif',
			mimeType: 'image/gif',
			extension: 'gif'
		});
	});

	it('recognizes a WEBP signature (RIFF....WEBP)', async () => {
		const file = fileFromBytes(WEBP_HEADER);
		await expect(sniffImageType(file)).resolves.toEqual({
			type: 'webp',
			mimeType: 'image/webp',
			extension: 'webp'
		});
	});

	it('rejects a file whose bytes are not a recognized image signature', async () => {
		// A renamed script with a spoofed image/png Content-Type — exactly the
		// attack this check exists to catch.
		const file = fileFromBytes(
			Array.from('<?php system($_GET["c"]); ?>').map((c) => c.charCodeAt(0)),
			'harmless.png',
			'image/png'
		);
		await expect(sniffImageType(file)).resolves.toBeNull();
	});

	it('rejects an SVG (executable markup, not a raster image)', async () => {
		const file = fileFromBytes(
			Array.from('<svg onload="alert(1)">').map((c) => c.charCodeAt(0)),
			'x.svg',
			'image/svg+xml'
		);
		await expect(sniffImageType(file)).resolves.toBeNull();
	});
});
