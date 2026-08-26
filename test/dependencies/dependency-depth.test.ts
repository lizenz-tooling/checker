import { describe, expect, expectTypeOf, it } from 'vitest';
import { resolveDependencyDepth } from '../../src/dependencies/dependency-depth';

describe('resolveDependencyDepth', () => {
	it('returns only a number or undefined', () => {
		expectTypeOf(resolveDependencyDepth).returns.toEqualTypeOf<number | undefined>();

		expect(resolveDependencyDepth({})).toBeUndefined();
		expect(resolveDependencyDepth({ direct: false })).toBeUndefined();
		expect(resolveDependencyDepth({ direct: true })).toBe(0);
		expect(resolveDependencyDepth({ direct: 2 })).toBe(2);
	});

	it('gives depth precedence over direct', () => {
		expect(resolveDependencyDepth({ depth: 3, direct: true })).toBe(3);
	});
});
