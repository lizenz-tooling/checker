import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

type CliResult = {
	signal: NodeJS.Signals | null;
	status: number | null;
	stderr: string;
	stdout: string;
};

type DifferentialCase = {
	args: string[];
	fixture?: string;
	name: string;
};

type PairedDifferentialCase = {
	environment?: NodeJS.ProcessEnv;
	legacy: () => { args: string[]; cwd: string };
	name: string;
	target: () => { args: string[]; cwd: string };
};

type ProgrammaticDifferentialCase = {
	legacyOptions: () => Record<string, unknown>;
	name: string;
	targetOptions: () => Record<string, unknown>;
};

const configuredLegacyRoot = process.env.LEGACY_REFERENCE_DIR;
const legacyRoot = configuredLegacyRoot ?? '';
const targetRoot = path.resolve(import.meta.dirname, '..');
const legacyFixtures = path.join(legacyRoot, 'tests/fixtures');
const targetFixtures = path.join(import.meta.dirname, 'fixtures');
const legacyCli = path.join(legacyRoot, 'lib/cli.js');
const targetCli = path.join(targetRoot, 'dist/cli.js');
const temporaryPaths: string[] = [];
let legacyDependencyRoot = '';
let targetDependencyRoot = '';

// These are the only observable-value rewrites permitted by the frozen migration allowlist.
const applyIdentityAllowlist = (legacyText: string): string => {
	if (legacyText === '5.0.1\n') {
		return '0.0.1\n';
	}

	return legacyText
		.replaceAll('license-checker-rseidelsohn@5.0.1', 'license-checker@0.0.1')
		.replaceAll('license-checker-rseidelsohn:log', '@lizenz/checker:log')
		.replaceAll('license-checker-rseidelsohn:error', '@lizenz/checker:error');
};

// Each side operates on an equivalent fixture tree at a different absolute location.
const normalizeExecutionRoots = (text: string, projectRoot: string, fixtureRoot: string): string =>
	text.replaceAll(fixtureRoot, '<FIXTURES>').replaceAll(projectRoot, '<PROJECT>');

const normalizeLegacy = (text: string): string =>
	applyIdentityAllowlist(
		normalizeExecutionRoots(
			text.replaceAll(path.join(legacyRoot, 'tests/config'), '<CONFIG>'),
			legacyRoot,
			legacyFixtures
		).replaceAll(legacyDependencyRoot, '<DEPENDENCY_FIXTURE>')
	);

const normalizeTarget = (text: string): string =>
	normalizeExecutionRoots(
		text.replaceAll(path.join(targetRoot, 'test/config'), '<CONFIG>'),
		targetRoot,
		targetFixtures
	).replaceAll(targetDependencyRoot, '<DEPENDENCY_FIXTURE>');

const runCli = (cli: string, cwd: string, args: string[], environment: NodeJS.ProcessEnv = {}): CliResult => {
	const result = spawnSync(process.execPath, [cli, ...args], {
		cwd,
		encoding: 'utf8',
		env: { ...process.env, DEBUG: '', FORCE_COLOR: '0', NO_COLOR: undefined, ...environment },
		maxBuffer: 20 * 1024 * 1024,
	});

	if (result.error) {
		throw result.error;
	}

	return { signal: result.signal, status: result.status, stderr: result.stderr, stdout: result.stdout };
};

const apiProbe = `
import { pathToFileURL } from 'node:url';
const modulePath = process.argv[1];
const options = JSON.parse(process.argv[2]);
try {
  const api = await import(pathToFileURL(modulePath));
  const pending = api.runLicenseCheck(options);
  const isPromise = pending instanceof Promise;
  const value = await pending;
  console.log(JSON.stringify({ isPromise, ok: true, options, value }));
} catch (error) {
  console.log(JSON.stringify({ error: String(error?.message ?? error), ok: false, options }));
}
`;

const runApi = (modulePath: string, options: Record<string, unknown>): CliResult => {
	const result = spawnSync(
		process.execPath,
		['--input-type=module', '--eval', apiProbe, modulePath, JSON.stringify(options)],
		{
			encoding: 'utf8',
			env: { ...process.env, DEBUG: '', FORCE_COLOR: '0' },
			maxBuffer: 20 * 1024 * 1024,
		}
	);

	if (result.error) {
		throw result.error;
	}

	return { signal: result.signal, status: result.status, stderr: result.stderr, stdout: result.stdout };
};

const compareResults = (legacyResult: CliResult, targetResult: CliResult): void => {
	expect(targetResult.status).toBe(legacyResult.status);
	expect(targetResult.signal).toBe(legacyResult.signal);
	expect(normalizeTarget(targetResult.stdout)).toBe(normalizeLegacy(legacyResult.stdout));
	expect(normalizeTarget(targetResult.stderr)).toBe(normalizeLegacy(legacyResult.stderr));
};

const writePackage = (directory: string, packageJson: Record<string, unknown>, licenseText?: string): void => {
	fs.mkdirSync(directory, { recursive: true });
	fs.writeFileSync(path.join(directory, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`);
	if (licenseText) {
		fs.writeFileSync(path.join(directory, 'LICENSE'), licenseText);
	}
};

const createDependencyFixture = (prefix: string): string => {
	const root = fs.mkdtempSync(path.join(tmpdir(), prefix));
	temporaryPaths.push(root);
	writePackage(root, {
		name: 'differential-root',
		version: '1.0.0',
		license: 'MIT',
		dependencies: { '@scope/scoped': '1.0.0', prod: '1.0.0' },
		devDependencies: { dev: '1.0.0' },
		peerDependencies: { peer: '1.0.0' },
	});
	writePackage(
		path.join(root, 'node_modules/prod'),
		{ name: 'prod', version: '1.0.0', license: 'MIT', dependencies: { transitive: '1.0.0' } },
		'Production license\n'
	);
	writePackage(path.join(root, 'node_modules/transitive'), {
		name: 'transitive',
		version: '1.0.0',
		license: 'Apache-2.0',
	});
	writePackage(path.join(root, 'node_modules/dev'), { name: 'dev', version: '1.0.0', license: 'ISC' });
	writePackage(path.join(root, 'node_modules/peer'), { name: 'peer', version: '1.0.0', license: 'BSD-3-Clause' });
	writePackage(
		path.join(root, 'node_modules/@scope/scoped'),
		{ name: '@scope/scoped', version: '1.0.0', license: '0BSD' },
		'Scoped license\n'
	);
	return root;
};

const sha256File = (filePath: string): string => createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');

const getCwd = (root: string, fixtures: string, fixture?: string): string =>
	fixture ? path.join(fixtures, fixture) : root;

const listFiles = (root: string): string[] => {
	if (!fs.existsSync(root)) {
		return [];
	}

	return fs
		.readdirSync(root, { recursive: true, withFileTypes: true })
		.filter(entry => entry.isFile())
		.map(entry => path.relative(root, path.join(entry.parentPath, entry.name)))
		.sort();
};

const cases: DifferentialCase[] = [
	{ args: ['--help'], name: 'help and option documentation' },
	{ args: ['--version'], fixture: 'custom-license-url', name: 'version' },
	{ args: ['--not-a-real-option'], fixture: 'custom-license-url', name: 'unknown option failure' },
	{ args: [], fixture: 'custom-license-url', name: 'default tree renderer' },
	{ args: ['--json'], fixture: 'custom-license-url', name: 'JSON renderer' },
	{ args: ['--csv'], fixture: 'custom-license-url', name: 'CSV renderer' },
	{ args: ['--markdown'], fixture: 'custom-license-url', name: 'Markdown renderer' },
	{ args: ['--summary'], fixture: 'custom-license-url', name: 'summary renderer' },
	{ args: ['--plainVertical'], fixture: 'custom-license-url', name: 'plain vertical renderer' },
	{ args: ['--angularCli'], fixture: 'custom-license-url', name: 'Angular renderer alias' },
	{ args: ['--json', '--unknown'], fixture: 'license-file-only', name: 'unknown license conversion' },
	{ args: ['--json', '--onlyunknown'], fixture: 'custom-license-url', name: 'only-unknown empty failure' },
	{ args: ['--onlyAllow', 'MIT'], fixture: 'custom-license-url', name: 'only-allow policy failure' },
	{ args: ['--failOn', 'BSD-3-Clause'], fixture: 'includeBSD', name: 'fail-on policy failure' },
	{ args: ['--json', '--includeLicenses', 'BSD-3-Clause'], fixture: 'includeBSD', name: 'include license filter' },
	{ args: ['--json', '--excludeLicenses', 'BSD-3-Clause'], fixture: 'includeBSD', name: 'exclude license filter' },
	{
		args: ['--json', '--limitAttributes', 'name,licenses'],
		fixture: 'includeBSD',
		name: 'attribute limiting',
	},
	{
		args: ['--json', '--relativeModulePath', '--relativeLicensePath'],
		fixture: 'license-file-only',
		name: 'relative paths',
	},
	{ args: ['--json', '--direct=0'], fixture: 'includeBSD', name: 'numeric direct depth' },
	{ args: ['--failOn', 'MIT,ISC'], fixture: 'includeBSD', name: 'comma policy warning' },
];

const pairedCases: PairedDifferentialCase[] = [
	{
		legacy: () => ({ args: ['-h'], cwd: legacyRoot }),
		name: 'help shorthand',
		target: () => ({ args: ['-h'], cwd: targetRoot }),
	},
	{
		legacy: () => ({ args: ['-v'], cwd: legacyRoot }),
		name: 'version shorthand',
		target: () => ({ args: ['-v'], cwd: targetRoot }),
	},
	{
		legacy: () => ({ args: ['--json', '--start', path.join(legacyFixtures, 'includeBSD')], cwd: legacyRoot }),
		name: 'explicit start option',
		target: () => ({ args: ['--json', '--start', path.join(targetFixtures, 'includeBSD')], cwd: targetRoot }),
	},
	{
		environment: { FORCE_COLOR: '1' },
		legacy: () => ({ args: ['--color'], cwd: path.join(legacyFixtures, 'includeBSD') }),
		name: 'forced color output',
		target: () => ({ args: ['--color'], cwd: path.join(targetFixtures, 'includeBSD') }),
	},
	{
		legacy: () => ({ args: ['--csv', '--csvComponentPrefix', 'component'], cwd: legacyDependencyRoot }),
		name: 'CSV component prefix with partial fields',
		target: () => ({ args: ['--csv', '--csvComponentPrefix', 'component'], cwd: targetDependencyRoot }),
	},
	{
		legacy: () => ({
			args: ['--json', '--csv', '--markdown', '--summary', '--plainVertical'],
			cwd: legacyDependencyRoot,
		}),
		name: 'JSON output precedence',
		target: () => ({
			args: ['--json', '--csv', '--markdown', '--summary', '--plainVertical'],
			cwd: targetDependencyRoot,
		}),
	},
	{
		legacy: () => ({ args: ['--csv', '--markdown', '--summary', '--plainVertical'], cwd: legacyDependencyRoot }),
		name: 'CSV output precedence',
		target: () => ({ args: ['--csv', '--markdown', '--summary', '--plainVertical'], cwd: targetDependencyRoot }),
	},
	{
		legacy: () => ({
			args: [
				'--start',
				path.join(legacyFixtures, 'clarifications'),
				'--clarificationsFile',
				path.join(legacyFixtures, 'clarifications/weirdStart/clarification.json'),
				'--customPath',
				path.join(legacyFixtures, 'clarifications/weirdStart/customFormat.json'),
			],
			cwd: legacyRoot,
		}),
		name: 'clarification regions and custom path',
		target: () => ({
			args: [
				'--start',
				path.join(targetFixtures, 'clarifications'),
				'--clarificationsFile',
				path.join(targetFixtures, 'clarifications/weirdStart/clarification.json'),
				'--customPath',
				path.join(targetFixtures, 'clarifications/weirdStart/customFormat.json'),
			],
			cwd: targetRoot,
		}),
	},
	{
		legacy: () => ({
			args: ['--clarificationsFile', path.join(legacyFixtures, 'clarifications/mismatch/clarification.json')],
			cwd: path.join(legacyFixtures, 'clarifications'),
		}),
		name: 'clarification checksum mismatch',
		target: () => ({
			args: ['--clarificationsFile', path.join(targetFixtures, 'clarifications/mismatch/clarification.json')],
			cwd: path.join(targetFixtures, 'clarifications'),
		}),
	},
	{
		legacy: () => ({
			args: [
				'--clarificationsFile',
				path.join(legacyFixtures, 'clarifications/unusedClarification.json'),
				'--clarificationsMatchAll',
			],
			cwd: path.join(legacyFixtures, 'clarifications'),
		}),
		name: 'unused clarification failure',
		target: () => ({
			args: [
				'--clarificationsFile',
				path.join(targetFixtures, 'clarifications/unusedClarification.json'),
				'--clarificationsMatchAll',
			],
			cwd: path.join(targetFixtures, 'clarifications'),
		}),
	},
	...[
		['depth overrides direct', ['--json', '--direct=true', '--depth=0']],
		['development dependency selection', ['--json', '--development']],
		['production dependency selection', ['--json', '--production']],
		['peer dependency exclusion', ['--json', '--nopeer']],
		['direct false normalization', ['--json', '--direct=false']],
		['direct true normalization', ['--json', '--direct=true']],
		['direct invalid normalization', ['--json', '--direct=not-a-number']],
		['direct negative normalization', ['--json', '--direct=-2']],
		['package inclusion', ['--json', '--includePackages', 'prod@1.0.0;dev']],
		['package exclusion', ['--json', '--excludePackages', 'prod@1.0.0;dev']],
		['package prefix exclusion', ['--json', '--excludePackagesStartingWith', '@scope;trans']],
		['multi-license summary sorting', ['--summary']],
		['plain vertical embedded text', ['--plainVertical']],
	].map(([name, args]) => ({
		legacy: () => ({ args: args as string[], cwd: legacyDependencyRoot }),
		name: name as string,
		target: () => ({ args: args as string[], cwd: targetDependencyRoot }),
	})),
	{
		legacy: () => ({ args: ['--json', '--excludePrivatePackages'], cwd: path.join(legacyFixtures, 'privateModule') }),
		name: 'private package exclusion',
		target: () => ({ args: ['--json', '--excludePrivatePackages'], cwd: path.join(targetFixtures, 'privateModule') }),
	},
	{
		legacy: () => ({ args: ['--failOn', 'MIT', '--onlyAllow', 'MIT'], cwd: path.join(legacyFixtures, 'includeBSD') }),
		name: 'mutually exclusive policies',
		target: () => ({ args: ['--failOn', 'MIT', '--onlyAllow', 'MIT'], cwd: path.join(targetFixtures, 'includeBSD') }),
	},
	{
		legacy: () => ({ args: ['--onlyAllow', 'MIT,ISC'], cwd: path.join(legacyFixtures, 'includeBSD') }),
		name: 'only-allow comma warning',
		target: () => ({ args: ['--onlyAllow', 'MIT,ISC'], cwd: path.join(targetFixtures, 'includeBSD') }),
	},
	{
		legacy: () => ({ args: ['--json', '--includePackages', 'does-not-exist'], cwd: legacyDependencyRoot }),
		name: 'empty result after package filtering',
		target: () => ({ args: ['--json', '--includePackages', 'does-not-exist'], cwd: targetDependencyRoot }),
	},
	{
		legacy: () => ({
			args: ['--json', '--excludeLicenses', 'Apache License\\, Version 2.0'],
			cwd: path.join(legacyFixtures, 'excludeWithComma'),
		}),
		name: 'escaped comma license filter',
		target: () => ({
			args: ['--json', '--excludeLicenses', 'Apache License\\, Version 2.0'],
			cwd: path.join(targetFixtures, 'excludeWithComma'),
		}),
	},
	{
		legacy: () => ({ args: ['--json'], cwd: path.join(legacyFixtures, 'custom-license-file') }),
		name: 'custom license file detection',
		target: () => ({ args: ['--json'], cwd: path.join(targetFixtures, 'custom-license-file') }),
	},
	{
		legacy: () => ({ args: ['--json'], cwd: path.join(legacyFixtures, 'excludePublicDomain') }),
		name: 'public domain detection',
		target: () => ({ args: ['--json'], cwd: path.join(targetFixtures, 'excludePublicDomain') }),
	},
	{
		legacy: () => ({ args: ['--start', path.join(legacyFixtures, 'does-not-exist')], cwd: legacyRoot }),
		name: 'dependency read error without stacktrace',
		target: () => ({ args: ['--start', path.join(targetFixtures, 'does-not-exist')], cwd: targetRoot }),
	},
];

const programmaticCases: ProgrammaticDifferentialCase[] = [
	{
		legacyOptions: () => ({ start: legacyDependencyRoot }),
		name: 'sorted dependency result and Promise contract',
		targetOptions: () => ({ start: targetDependencyRoot }),
	},
	...[
		['production selection', { production: true }],
		['development selection', { development: true }],
		['peer exclusion', { nopeer: true }],
		['direct dependency depth', { direct: 0 }],
		['package filters', { excludePackagesStartingWith: '@scope', includePackages: 'prod;transitive' }],
		['license policy rejection', { onlyAllow: 'MIT' }],
	].map(([name, extraOptions]) => ({
		legacyOptions: () => ({ ...(extraOptions as Record<string, unknown>), start: legacyDependencyRoot }),
		name: name as string,
		targetOptions: () => ({ ...(extraOptions as Record<string, unknown>), start: targetDependencyRoot }),
	})),
	{
		legacyOptions: () => ({
			customPath: path.join(legacyRoot, 'tests/config/custom_format_correct.json'),
			start: path.join(legacyFixtures, 'author'),
		}),
		name: 'caller-owned customPath option mutation',
		targetOptions: () => ({
			customPath: path.join(targetRoot, 'test/config/custom_format_correct.json'),
			start: path.join(targetFixtures, 'author'),
		}),
	},
	{
		legacyOptions: () => ({
			clarificationsFile: path.join(legacyRoot, 'clarificationExample.json'),
			customFormat: { email: '', licenseFile: '', licenseText: '', licenses: '', path: '', publisher: '' },
			start: path.join(legacyFixtures, 'clarifications'),
		}),
		name: 'clarification replacement',
		targetOptions: () => ({
			clarificationsFile: path.join(targetRoot, 'clarificationExample.json'),
			customFormat: { email: '', licenseFile: '', licenseText: '', licenses: '', path: '', publisher: '' },
			start: path.join(targetFixtures, 'clarifications'),
		}),
	},
	{
		legacyOptions: () => ({
			clarificationsFile: path.join(legacyFixtures, 'clarifications/mismatch/clarification.json'),
			start: path.join(legacyFixtures, 'clarifications'),
		}),
		name: 'clarification rejection without host exit',
		targetOptions: () => ({
			clarificationsFile: path.join(targetFixtures, 'clarifications/mismatch/clarification.json'),
			start: path.join(targetFixtures, 'clarifications'),
		}),
	},
	{
		legacyOptions: () => ({
			excludeLicenses: 'Apache License\\, Version 2.0',
			start: path.join(legacyFixtures, 'excludeWithComma'),
		}),
		name: 'escaped-comma license filtering',
		targetOptions: () => ({
			excludeLicenses: 'Apache License\\, Version 2.0',
			start: path.join(targetFixtures, 'excludeWithComma'),
		}),
	},
	...['custom-license-file', 'custom-license-url', 'excludePublicDomain', 'unlicensed'].map(fixture => ({
		legacyOptions: () => ({ start: path.join(legacyFixtures, fixture) }),
		name: `${fixture} license detection`,
		targetOptions: () => ({ start: path.join(targetFixtures, fixture) }),
	})),
];

describe.skipIf(!configuredLegacyRoot)('frozen Legacy CLI differential', { timeout: 120_000 }, () => {
	beforeAll(() => {
		expect(fs.existsSync(legacyCli), `Missing frozen Legacy build at ${legacyCli}`).toBe(true);
		expect(sha256File(legacyCli)).toBe('2acd04fe65d7af43ae5095a271cdcef72b2966c37e834c927ba3798d5511242a');
		expect(sha256File(path.join(legacyRoot, 'lib/index.js'))).toBe(
			'ca2a36797184df299b814c84a465df1fc12ee2489fd215966d9b09e2fad3049b'
		);
		expect(sha256File(path.join(legacyRoot, 'package-lock.json'))).toBe(
			'fbe36e011c0ffcdbe374db46fc3123e6d52160a3bb16755f221b28443c4a55e6'
		);
		const legacyPackage = JSON.parse(fs.readFileSync(path.join(legacyRoot, 'package.json'), 'utf8')) as {
			name: string;
			version: string;
		};
		expect(legacyPackage).toMatchObject({ name: 'license-checker-rseidelsohn', version: '5.0.1' });
		legacyDependencyRoot = createDependencyFixture('lizenz-checker-legacy-dependencies-');
		targetDependencyRoot = createDependencyFixture('lizenz-checker-target-dependencies-');
		execFileSync(process.execPath, [path.join(targetRoot, 'node_modules/vite/bin/vite.js'), 'build'], {
			cwd: targetRoot,
			stdio: 'pipe',
		});
	});

	afterAll(() => {
		for (const temporaryPath of temporaryPaths) {
			fs.rmSync(temporaryPath, { force: true, recursive: true });
		}
	});

	it.each(cases)('$name', ({ args, fixture }) => {
		const legacyResult = runCli(legacyCli, getCwd(legacyRoot, legacyFixtures, fixture), args);
		const targetResult = runCli(targetCli, getCwd(targetRoot, targetFixtures, fixture), args);
		compareResults(legacyResult, targetResult);
	});

	it.each(pairedCases)('$name', ({ environment, legacy, target }) => {
		const legacyInvocation = legacy();
		const targetInvocation = target();
		compareResults(
			runCli(legacyCli, legacyInvocation.cwd, legacyInvocation.args, environment),
			runCli(targetCli, targetInvocation.cwd, targetInvocation.args, environment)
		);
	});

	it('allowed log debug namespace rename', () => {
		compareResults(
			runCli(legacyCli, legacyRoot, ['--json', '--start', path.join(legacyFixtures, 'includeBSD')], {
				DEBUG: 'license-checker-rseidelsohn:log',
				DEBUG_HIDE_DATE: '1',
			}),
			runCli(targetCli, targetRoot, ['--json', '--start', path.join(targetFixtures, 'includeBSD')], {
				DEBUG: '@lizenz/checker:log',
				DEBUG_HIDE_DATE: '1',
			})
		);
	});

	it.each(programmaticCases)('programmatic: $name', ({ legacyOptions, targetOptions }) => {
		compareResults(
			runApi(path.join(legacyRoot, 'lib/index.js'), legacyOptions()),
			runApi(path.join(targetRoot, 'dist/index.js'), targetOptions())
		);
	});

	it('matches successful --out filesystem effects and content', () => {
		const legacyDirectory = fs.mkdtempSync(path.join(tmpdir(), 'lizenz-checker-legacy-out-'));
		const targetDirectory = fs.mkdtempSync(path.join(tmpdir(), 'lizenz-checker-target-out-'));
		temporaryPaths.push(legacyDirectory, targetDirectory);
		const legacyOutput = path.join(legacyDirectory, 'nested/output/licenses.json');
		const targetOutput = path.join(targetDirectory, 'nested/output/licenses.json');

		const legacyResult = runCli(legacyCli, path.join(legacyFixtures, 'license-file-only'), [
			'--json',
			'--out',
			legacyOutput,
		]);
		const targetResult = runCli(targetCli, path.join(targetFixtures, 'license-file-only'), [
			'--json',
			'--out',
			targetOutput,
		]);

		compareResults(legacyResult, targetResult);
		expect(fs.existsSync(targetOutput)).toBe(fs.existsSync(legacyOutput));
		expect(normalizeTarget(fs.readFileSync(targetOutput, 'utf8'))).toBe(
			normalizeLegacy(fs.readFileSync(legacyOutput, 'utf8'))
		);
	});

	it('matches programmatic out/files effects', () => {
		const legacyDirectory = fs.mkdtempSync(path.join(tmpdir(), 'lizenz-checker-legacy-api-files-'));
		const targetDirectory = fs.mkdtempSync(path.join(tmpdir(), 'lizenz-checker-target-api-files-'));
		temporaryPaths.push(legacyDirectory, targetDirectory);
		const legacyOut = path.join(legacyDirectory, 'nested/licenses.json');
		const targetOut = path.join(targetDirectory, 'nested/licenses.json');
		const legacyFiles = path.join(legacyDirectory, 'individual');
		const targetFiles = path.join(targetDirectory, 'individual');
		const legacyResult = runApi(path.join(legacyRoot, 'lib/index.js'), {
			files: legacyFiles,
			json: true,
			out: legacyOut,
			start: path.join(legacyFixtures, 'license-file-only'),
		});
		const targetResult = runApi(path.join(targetRoot, 'dist/index.js'), {
			files: targetFiles,
			json: true,
			out: targetOut,
			start: path.join(targetFixtures, 'license-file-only'),
		});
		compareResults(
			{
				...legacyResult,
				stdout: legacyResult.stdout.replaceAll(legacyDirectory, '<OUTPUT>'),
			},
			{
				...targetResult,
				stdout: targetResult.stdout.replaceAll(targetDirectory, '<OUTPUT>'),
			}
		);
		expect(normalizeTarget(fs.readFileSync(targetOut, 'utf8').replaceAll(targetDirectory, '<OUTPUT>'))).toBe(
			normalizeLegacy(fs.readFileSync(legacyOut, 'utf8').replaceAll(legacyDirectory, '<OUTPUT>'))
		);
		const legacyFileList = listFiles(legacyFiles);
		const targetFileList = listFiles(targetFiles);
		expect(targetFileList).toEqual(legacyFileList);
		for (const relativeFile of legacyFileList) {
			expect(fs.readFileSync(path.join(targetFiles, relativeFile), 'utf8')).toBe(
				fs.readFileSync(path.join(legacyFiles, relativeFile), 'utf8')
			);
		}
	});

	it('matches programmatic policy rejection before file effects', () => {
		const legacyDirectory = fs.mkdtempSync(path.join(tmpdir(), 'lizenz-checker-legacy-api-policy-'));
		const targetDirectory = fs.mkdtempSync(path.join(tmpdir(), 'lizenz-checker-target-api-policy-'));
		temporaryPaths.push(legacyDirectory, targetDirectory);
		const legacyOut = path.join(legacyDirectory, 'licenses.json');
		const targetOut = path.join(targetDirectory, 'licenses.json');
		const legacyResult = runApi(path.join(legacyRoot, 'lib/index.js'), {
			failOn: 'BSD-3-Clause',
			out: legacyOut,
			start: path.join(legacyFixtures, 'includeBSD'),
		});
		const targetResult = runApi(path.join(targetRoot, 'dist/index.js'), {
			failOn: 'BSD-3-Clause',
			out: targetOut,
			start: path.join(targetFixtures, 'includeBSD'),
		});
		compareResults(
			{
				...legacyResult,
				stdout: legacyResult.stdout.replaceAll(legacyOut, '<OUTPUT>'),
			},
			{
				...targetResult,
				stdout: targetResult.stdout.replaceAll(targetOut, '<OUTPUT>'),
			}
		);
		expect(fs.existsSync(targetOut)).toBe(false);
		expect(fs.existsSync(legacyOut)).toBe(false);
	});

	it('matches successful --files filesystem effects and content', () => {
		const legacyDirectory = fs.mkdtempSync(path.join(tmpdir(), 'lizenz-checker-legacy-files-'));
		const targetDirectory = fs.mkdtempSync(path.join(tmpdir(), 'lizenz-checker-target-files-'));
		temporaryPaths.push(legacyDirectory, targetDirectory);
		const legacyOutput = path.join(legacyDirectory, 'licenses');
		const targetOutput = path.join(targetDirectory, 'licenses');

		const legacyResult = runCli(legacyCli, path.join(legacyFixtures, 'license-file-only'), ['--files', legacyOutput]);
		const targetResult = runCli(targetCli, path.join(targetFixtures, 'license-file-only'), ['--files', targetOutput]);
		compareResults(
			{
				...legacyResult,
				stderr: legacyResult.stderr.replaceAll(legacyOutput, '<OUTPUT>'),
				stdout: legacyResult.stdout.replaceAll(legacyOutput, '<OUTPUT>'),
			},
			{
				...targetResult,
				stderr: targetResult.stderr.replaceAll(targetOutput, '<OUTPUT>'),
				stdout: targetResult.stdout.replaceAll(targetOutput, '<OUTPUT>'),
			}
		);

		const legacyFiles = listFiles(legacyOutput);
		const targetFiles = listFiles(targetOutput);
		expect(targetFiles).toEqual(legacyFiles);
		for (const relativeFile of legacyFiles) {
			expect(fs.readFileSync(path.join(targetOutput, relativeFile), 'utf8')).toBe(
				fs.readFileSync(path.join(legacyOutput, relativeFile), 'utf8')
			);
		}
	});

	it('matches scoped --files output and missing-license warnings', () => {
		const legacyDirectory = fs.mkdtempSync(path.join(tmpdir(), 'lizenz-checker-legacy-scoped-files-'));
		const targetDirectory = fs.mkdtempSync(path.join(tmpdir(), 'lizenz-checker-target-scoped-files-'));
		temporaryPaths.push(legacyDirectory, targetDirectory);
		const legacyOutput = path.join(legacyDirectory, 'licenses');
		const targetOutput = path.join(targetDirectory, 'licenses');

		const legacyResult = runCli(legacyCli, legacyDependencyRoot, ['--files', legacyOutput]);
		const targetResult = runCli(targetCli, targetDependencyRoot, ['--files', targetOutput]);
		compareResults(
			{
				...legacyResult,
				stderr: legacyResult.stderr.replaceAll(legacyOutput, '<OUTPUT>'),
				stdout: legacyResult.stdout.replaceAll(legacyOutput, '<OUTPUT>'),
			},
			{
				...targetResult,
				stderr: targetResult.stderr.replaceAll(targetOutput, '<OUTPUT>'),
				stdout: targetResult.stdout.replaceAll(targetOutput, '<OUTPUT>'),
			}
		);

		const legacyFiles = listFiles(legacyOutput);
		const targetFiles = listFiles(targetOutput);
		expect(targetFiles).toEqual(legacyFiles);
		expect(targetFiles).toContain('@scope/scoped@1.0.0-LICENSE.txt');
		for (const relativeFile of legacyFiles) {
			expect(fs.readFileSync(path.join(targetOutput, relativeFile), 'utf8')).toBe(
				fs.readFileSync(path.join(legacyOutput, relativeFile), 'utf8')
			);
		}
	});

	it('matches --files behavior when no license file exists', () => {
		const legacyDirectory = fs.mkdtempSync(path.join(tmpdir(), 'lizenz-checker-legacy-missing-files-'));
		const targetDirectory = fs.mkdtempSync(path.join(tmpdir(), 'lizenz-checker-target-missing-files-'));
		temporaryPaths.push(legacyDirectory, targetDirectory);
		const legacyOutput = path.join(legacyDirectory, 'licenses');
		const targetOutput = path.join(targetDirectory, 'licenses');
		const legacyResult = runCli(legacyCli, path.join(legacyFixtures, 'noLicenseFile'), ['--files', legacyOutput]);
		const targetResult = runCli(targetCli, path.join(targetFixtures, 'noLicenseFile'), ['--files', targetOutput]);

		compareResults(
			{
				...legacyResult,
				stderr: legacyResult.stderr.replaceAll(legacyOutput, '<OUTPUT>'),
				stdout: legacyResult.stdout.replaceAll(legacyOutput, '<OUTPUT>'),
			},
			{
				...targetResult,
				stderr: targetResult.stderr.replaceAll(targetOutput, '<OUTPUT>'),
				stdout: targetResult.stdout.replaceAll(targetOutput, '<OUTPUT>'),
			}
		);
		expect(listFiles(targetOutput)).toEqual(listFiles(legacyOutput));
	});

	it('matches the absence of filesystem effects after a policy failure', () => {
		const legacyDirectory = fs.mkdtempSync(path.join(tmpdir(), 'lizenz-checker-legacy-policy-'));
		const targetDirectory = fs.mkdtempSync(path.join(tmpdir(), 'lizenz-checker-target-policy-'));
		temporaryPaths.push(legacyDirectory, targetDirectory);
		const legacyOutput = path.join(legacyDirectory, 'licenses.json');
		const targetOutput = path.join(targetDirectory, 'licenses.json');

		const legacyResult = runCli(legacyCli, path.join(legacyFixtures, 'includeBSD'), [
			'--json',
			'--out',
			legacyOutput,
			'--failOn',
			'BSD-3-Clause',
		]);
		const targetResult = runCli(targetCli, path.join(targetFixtures, 'includeBSD'), [
			'--json',
			'--out',
			targetOutput,
			'--failOn',
			'BSD-3-Clause',
		]);

		compareResults(legacyResult, targetResult);
		expect(fs.existsSync(targetOutput)).toBe(false);
		expect(fs.existsSync(legacyOutput)).toBe(false);
	});
});
