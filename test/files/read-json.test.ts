import { describe, expect, it } from 'vitest';
import { readJson } from '../../src/files/read-json.js';

describe('readJson', () => {
	it('should parse json successfully (File exists + was json)', () => {
		const json = readJson('./test/config/custom_format_correct.json') as Record<string, unknown>;
		expect(json.licenseModified).toBe('no');
		expect(json.licenseText).not.toBe('');
	});

	it('should parse json with errors (File exists + no json)', () => {
		const json = readJson('./test/config/custom_format_broken.json');
		expect(json).toBeInstanceOf(Error);
	});

	it('should parse json with errors (File not found)', () => {
		const json = readJson('./NotExitingFile.json');
		expect(json).toBeInstanceOf(Error);
	});

	it('should parse json with errors (null passed)', () => {
		const json = readJson(null);
		expect(json).toBeInstanceOf(Error);
	});
});
