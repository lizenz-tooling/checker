import { describe, expect, it } from 'vitest';
import { getCopyrightLines } from '../../src/licenses/copyright.js';

describe('getCopyrightLines', () => {
	it('finds copyright paragraphs and removes duplicate first-line repeats', () => {
		const lines = getCopyrightLines(
			'Copyright (c) Alice\n\nCopyright (c) Alice\n\nCopyright notice should be ignored\n\nCopyright (c) Bob'
		);

		expect(lines).toEqual(['Copyright (c) Alice', 'Copyright (c) Bob']);
	});
});
