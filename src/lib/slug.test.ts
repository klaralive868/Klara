import { describe, expect, it } from 'vitest';
import { slugify, isValidSlug } from './slug';

describe('slugify', () => {
	it('lowercases and hyphenates a simple business name', () => {
		expect(slugify('Netbreakerz')).toBe('netbreakerz');
	});

	it('collapses runs of whitespace/punctuation into a single hyphen', () => {
		expect(slugify('  Multi   Space  Name  ')).toBe('multi-space-name');
	});

	it('trims leading and trailing hyphens', () => {
		expect(slugify('--Edge Case--')).toBe('edge-case');
	});

	it('strips punctuation entirely rather than leaving stray hyphens', () => {
		expect(slugify("WorldView Travel Service!")).toBe('worldview-travel-service');
	});

	it('returns an empty string for input with no alphanumeric characters', () => {
		expect(slugify('!!!')).toBe('');
	});
});

describe('isValidSlug', () => {
	it('accepts a well-formed slug', () => {
		expect(isValidSlug('worldview-travel')).toBe(true);
	});

	it('accepts a slug with numbers', () => {
		expect(isValidSlug('org-42')).toBe(true);
	});

	it('rejects an empty string', () => {
		expect(isValidSlug('')).toBe(false);
	});

	it('rejects uppercase characters', () => {
		expect(isValidSlug('WorldView')).toBe(false);
	});

	it('rejects spaces', () => {
		expect(isValidSlug('world view')).toBe(false);
	});

	it('rejects a leading hyphen', () => {
		expect(isValidSlug('-worldview')).toBe(false);
	});

	it('rejects a trailing hyphen', () => {
		expect(isValidSlug('worldview-')).toBe(false);
	});

	it('rejects consecutive hyphens', () => {
		expect(isValidSlug('world--view')).toBe(false);
	});

	it('rejects underscores and other punctuation', () => {
		expect(isValidSlug('world_view')).toBe(false);
	});
});
