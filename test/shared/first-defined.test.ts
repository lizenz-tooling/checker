import { describe, expect, it } from 'vitest';
import { firstDefined } from '../../src/shared/first-defined.js';

describe('firstDefined', () => {
	it('returns the first value that is not undefined', () => {
		expect(firstDefined(undefined, null, 'fallback')).toBeNull();
		expect(firstDefined(undefined, 'fallback')).toBe('fallback');
		expect(firstDefined(undefined, undefined)).toBeUndefined();
	});
});
