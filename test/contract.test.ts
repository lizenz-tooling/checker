import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import * as checker from '../src/index.js';
import { type LicenseCheckOptions, runLicenseCheck } from '../src/index.js';

const fixturesPath = path.join(import.meta.dirname, 'fixtures');
const temporaryPaths: string[] = [];

afterEach(() => {
	for (const temporaryPath of temporaryPaths.splice(0)) {
		fs.rmSync(temporaryPath, { force: true, recursive: true });
	}
});

describe('public API contract', () => {
	it('exports only init and runLicenseCheck at runtime', () => {
		expect(Object.keys(checker).sort()).toEqual(['init', 'runLicenseCheck']);
	});

	it('returns a promise of the module information map', async () => {
		const pending = runLicenseCheck({ start: path.join(fixturesPath, 'includeBSD') });
		expect(pending).toBeInstanceOf(Promise);
		await expect(pending).resolves.toHaveProperty('bsd-3-module@0.0.0');
	});

	it('loads customPath into the caller-owned options object', async () => {
		const options: LicenseCheckOptions = {
			customPath: path.join(import.meta.dirname, 'config/custom_format_correct.json'),
			start: path.join(fixturesPath, 'includeBSD'),
		};

		await runLicenseCheck(options);
		expect(options.customFormat).toEqual({
			description: '',
			licenseFile: 'none',
			licenseModified: 'no',
			licenseText: 'none',
			licenses: '',
			name: '',
			version: '',
		});
	});

	it('applies license policy before creating an output file', async () => {
		const outputDirectory = fs.mkdtempSync(path.join(tmpdir(), 'lizenz-checker-contract-'));
		temporaryPaths.push(outputDirectory);
		const outputPath = path.join(outputDirectory, 'licenses.json');

		await expect(
			runLicenseCheck({
				failOn: 'BSD-3-Clause',
				json: true,
				out: outputPath,
				start: path.join(fixturesPath, 'includeBSD'),
			})
		).rejects.toThrow('Found license defined by the --failOn flag: "BSD-3-Clause". Exiting.');
		expect(fs.existsSync(outputPath)).toBe(false);
	});
});
