import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getNormalizedArguments, knownOptions, setDefaultArguments, shortHands } from '../src/cli/options.js';
import { runLicenseCheck } from '../src/index.js';
import { getFormattedOutput, shouldColorizeOutput } from '../src/output/format-output.js';
import { runBin } from './test-helpers.js';

const repoPath = path.resolve(import.meta.dirname, '..');
const fixturePath = path.join(import.meta.dirname, 'fixtures/includeBSD');

const booleanOptions = [
	'angularCli',
	'clarificationsMatchAll',
	'color',
	'csv',
	'development',
	'excludePrivatePackages',
	'help',
	'json',
	'markdown',
	'nopeer',
	'onlyunknown',
	'plainVertical',
	'production',
	'relativeLicensePath',
	'relativeModulePath',
	'summary',
	'unknown',
	'version',
] as const;

const stringOptions = [
	'csvComponentPrefix',
	'excludeLicenses',
	'excludePackages',
	'excludePackagesStartingWith',
	'failOn',
	'includeLicenses',
	'includePackages',
	'limitAttributes',
	'onlyAllow',
	'start',
] as const;

const pathOptions = ['clarificationsFile', 'customPath', 'files', 'out'] as const;

describe('all CLI options and shorthands', () => {
	it('keeps the exact frozen list of 34 long options', () => {
		expect(Object.keys(knownOptions)).toEqual([
			'angularCli',
			'clarificationsFile',
			'clarificationsMatchAll',
			'color',
			'csv',
			'csvComponentPrefix',
			'customPath',
			'depth',
			'development',
			'direct',
			'excludeLicenses',
			'excludePackages',
			'excludePackagesStartingWith',
			'excludePrivatePackages',
			'failOn',
			'files',
			'help',
			'includeLicenses',
			'includePackages',
			'json',
			'limitAttributes',
			'markdown',
			'nopeer',
			'onlyAllow',
			'onlyunknown',
			'out',
			'plainVertical',
			'production',
			'relativeLicensePath',
			'relativeModulePath',
			'start',
			'summary',
			'unknown',
			'version',
		]);
	});

	it.each(booleanOptions)('parses --%s as a boolean option', option => {
		const parsed = getNormalizedArguments([`--${option}`]);
		expect(parsed[option]).toBe(true);
	});

	it.each(stringOptions)('parses --%s as a string option', option => {
		const parsed = getNormalizedArguments([`--${option}=value`]);
		expect(parsed[option]).toBe('value');
	});

	it.each(pathOptions)('parses --%s as an absolute path option', option => {
		const parsed = getNormalizedArguments([`--${option}=.`]);
		expect(parsed[option]).toBe(repoPath);
	});

	it('parses and normalizes --direct', () => {
		expect(getNormalizedArguments(['--direct=2']).direct).toBe(2);
	});

	it('parses --depth and gives it precedence over direct', () => {
		const parsed = getNormalizedArguments(['--direct=9', '--depth=2']);
		expect(parsed.depth).toBe(2);
		expect(parsed.direct).toBe(2);
	});

	it.each(Object.entries(shortHands))('maps -%s to %s', (shortOption, [longOption]) => {
		expect(getNormalizedArguments([`-${shortOption}`])[longOption.slice(2)]).toBe(true);
	});
});

describe('frozen normalization and renderer edge cases', () => {
	it.each([
		[undefined, Number.POSITIVE_INFINITY],
		[true, Number.POSITIVE_INFINITY],
		[false, 0],
		['true', Number.POSITIVE_INFINITY],
		['false', 0],
		['not-a-number', Number.POSITIVE_INFINITY],
		[-2, 0],
	] as const)('normalizes direct %s to %s', (direct, expected) => {
		expect(setDefaultArguments({ direct, start: repoPath }).direct).toBe(expected);
	});

	it('preserves output format precedence', () => {
		const modules = { 'foo@1.0.0': { licenses: 'MIT', repository: '/foo' } };
		expect(getFormattedOutput(modules, { csv: true, json: true, markdown: true, summary: true })).toMatch(/^\{/);
		expect(getFormattedOutput(modules, { csv: true, markdown: true, summary: true })).toMatch(/^"module name"/);
		expect(getFormattedOutput(modules, { markdown: true, summary: true })).toMatch(/^- \[foo@1\.0\.0\]/);
		expect(getFormattedOutput(modules, { summary: true })).toContain('MIT');
		expect(getFormattedOutput(modules, { plainVertical: true })).toContain('foo 1.0.0\nMIT');
	});

	it('preserves the angularCli spelling mismatch', () => {
		const modules = { 'foo@1.0.0': { licenses: 'MIT' } };
		const documented = getFormattedOutput(modules, { angularCli: true } as never);
		const historicTypo = getFormattedOutput(modules, { angluarCli: true } as never);
		expect(documented).not.toContain('foo 1.0.0\nMIT');
		expect(historicTypo).toContain('foo 1.0.0\nMIT');
	});

	it('preserves color decisions for summary and plain vertical output', () => {
		expect(shouldColorizeOutput({ color: true, summary: true })).toBe(true);
		expect(shouldColorizeOutput({ color: true, plainVertical: true })).toBe(false);
	});

	it('allows package filters to produce an empty successful result', async () => {
		await expect(runLicenseCheck({ includePackages: 'does-not-exist', start: fixturePath })).resolves.toEqual({});
	});

	it('rejects when collection is empty before package filters', async () => {
		await expect(runLicenseCheck({ onlyunknown: true, start: fixturePath })).rejects.toThrow(
			'No packages found in this path...'
		);
	});
});

describe('new debug namespace allowlist', () => {
	it('uses @lizenz/checker:log for successful scans', async () => {
		const result = await runBin(['--json', '--start', fixturePath], { env: { DEBUG: '@lizenz/checker:log' } });
		expect(result.code).toBe(0);
		expect(result.stdout).toContain('@lizenz/checker:log');
	});

	it('uses @lizenz/checker:error for scan failures', async () => {
		const result = await runBin(['--start', path.join(repoPath, 'does-not-exist')], {
			env: { DEBUG: '@lizenz/checker:error' },
		});
		expect(result.code).toBe(1);
		expect(result.stderr).toContain('@lizenz/checker:error');
	});
});
