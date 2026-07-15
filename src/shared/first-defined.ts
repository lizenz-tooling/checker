export function firstDefined<T>(...values: T[]): T | undefined {
	for (const value of values) {
		if (typeof value !== 'undefined') {
			return value;
		}
	}
}
