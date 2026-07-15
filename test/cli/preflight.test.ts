import { describe, expect, it, vi } from 'vitest';
import packageJson from '../../package.json' with { type: 'json' };
import { exitProcessOrWarnIfNeeded } from '../../src/cli/preflight.js';

describe('exitProcessOrWarnIfNeeded', () => {
	it('warns when failOn contains commas', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

		exitProcessOrWarnIfNeeded({ parsedArgs: { failOn: 'MIT,ISC' }, unknownArgs: [] });

		expect(warn).toHaveBeenCalledWith(
			'Warning: The --failOn argument takes semicolons as delimeters instead of commas (some license names can contain commas)'
		);
	});

	it('exits and prints version output for version requests', () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.spyOn(process, 'exit').mockImplementation(((code?: string | number | null) => {
			throw new Error(`exit ${code}`);
		}) as never);

		expect(() => exitProcessOrWarnIfNeeded({ parsedArgs: { version: true }, unknownArgs: [] })).toThrow('exit 1');
		expect(console.error).toHaveBeenCalledWith(packageJson.version);
	});
});
