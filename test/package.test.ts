import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import packageJson from '../package.json' with { type: 'json' };

type PackedFile = { mode: number; path: string; size: number };
type PackResult = { entryCount: number; filename: string; files: PackedFile[]; name: string; version: string };

const repoPath = path.resolve(import.meta.dirname, '..');
const npmCli = process.env.npm_execpath;
const viteCli = path.join(repoPath, 'node_modules/vite/bin/vite.js');
let installDir: string;
let packResult: PackResult;

const runNpm = (args: string[], cwd: string): string => {
	if (!npmCli) {
		throw new Error('npm_execpath is required for package contract tests');
	}

	return execFileSync(process.execPath, [npmCli, ...args], { cwd, encoding: 'utf8' });
};

beforeAll(() => {
	execFileSync(process.execPath, [viteCli, 'build'], { cwd: repoPath, stdio: 'pipe' });
	installDir = fs.mkdtempSync(path.join(tmpdir(), 'lizenz-checker-package-'));
	packResult = JSON.parse(runNpm(['pack', '--json', '--pack-destination', installDir], repoPath))[0] as PackResult;
	fs.writeFileSync(
		path.join(installDir, 'package.json'),
		'{"name":"package-contract","private":true,"type":"module"}\n'
	);
	runNpm(
		['install', '--ignore-scripts', '--no-audit', '--no-fund', path.join(installDir, packResult.filename)],
		installDir
	);
}, 120_000);

afterAll(() => {
	fs.rmSync(installDir, { force: true, recursive: true });
});

describe('package metadata and build contract', () => {
	it('uses the requested private identity, scripts, root export, and binaries', () => {
		expect(packageJson.name).toBe('@lizenz/checker');
		expect(packageJson.version).toBe('0.0.1');
		expect(packageJson.private).toBe(true);
		expect(packageJson.scripts).toEqual({
			build: 'vite build',
			check: 'biome check && tsc --noEmit',
			fix: 'biome check --write',
			'fix-unsafe': 'biome check --write --unsafe',
			test: 'vitest run',
			'test-watch': 'vitest',
		});
		expect(packageJson.bin).toEqual({
			'license-checker': './dist/cli.js',
			'license-checker-rseidelsohn': './dist/cli.js',
		});
		expect(packageJson.exports).toEqual({
			'.': { import: './dist/index.js', types: './dist/index.d.ts' },
		});
	});

	it('matches the frozen public declaration snapshot', () => {
		const declaration = fs.readFileSync(path.join(repoPath, 'dist/index.d.ts'), 'utf8');
		const snapshot = fs.readFileSync(path.join(repoPath, 'test/snapshots/index.d.ts'), 'utf8');
		expect(declaration).toBe(snapshot);
	});

	it('builds an executable CLI with one shebang', () => {
		const cliPath = path.join(repoPath, 'dist/cli.js');
		const cli = fs.readFileSync(cliPath, 'utf8');
		expect(cli.match(/^#!\/usr\/bin\/env node$/gm)).toHaveLength(1);
		expect(fs.statSync(cliPath).mode & 0o111).toBe(0o111);
	});
});

describe('packed artifact contract', () => {
	it('contains only dist and approved package documents', () => {
		const paths = packResult.files.map(file => file.path);
		const declarations = paths.filter(file => file.endsWith('.d.ts'));
		expect(packResult.name).toBe('@lizenz/checker');
		expect(packResult.version).toBe('0.0.1');
		expect(paths).toContain('dist/index.js');
		expect(paths).toContain('dist/index.d.ts');
		expect(paths).toContain('dist/cli.js');
		expect(paths).toContain('README.md');
		expect(paths).toContain('CHANGELOG.md');
		expect(paths).toContain('LICENSE');
		expect(paths).toContain('package.json');
		expect(paths.some(file => file.startsWith('src/'))).toBe(false);
		expect(paths.some(file => file.startsWith('test/'))).toBe(false);
		expect(paths).not.toContain('biome.json');
		expect(paths).not.toContain('tsconfig.json');
		expect(paths).not.toContain('vite.config.ts');
		expect(declarations).toEqual(['dist/index.d.ts']);
		const cli = packResult.files.find(file => file.path === 'dist/cli.js');
		expect(cli?.mode).toBe(0o755);
	});

	it('imports exactly init and runLicenseCheck from the installed package root', () => {
		const output = execFileSync(
			process.execPath,
			[
				'--input-type=module',
				'--eval',
				"import * as checker from '@lizenz/checker'; console.log(Object.keys(checker).join(','));",
			],
			{ cwd: installDir, encoding: 'utf8' }
		);
		expect(output).toBe('init,runLicenseCheck\n');
	});

	it('resolves the installed root types', () => {
		fs.writeFileSync(
			path.join(installDir, 'contract.ts'),
			"import { init, runLicenseCheck, type ModuleInfos } from '@lizenz/checker';\nconst result: Promise<ModuleInfos> = runLicenseCheck({ start: '.' });\nconst callback = (error: Error | null, modules: ModuleInfos): void => { void error; void modules; };\ninit({ start: '.' }, callback);\nvoid result;\n"
		);
		execFileSync(
			process.execPath,
			[
				path.join(repoPath, 'node_modules/typescript/bin/tsc'),
				'--module',
				'NodeNext',
				'--moduleResolution',
				'NodeNext',
				'--target',
				'ES2022',
				'--noEmit',
				'contract.ts',
			],
			{ cwd: installDir, stdio: 'pipe' }
		);
	});

	it.each(['license-checker', 'license-checker-rseidelsohn'])('runs the installed %s binary', binary => {
		const output = execFileSync(path.join(installDir, 'node_modules/.bin', binary), ['--help'], {
			cwd: installDir,
			encoding: 'utf8',
		});
		expect(output).toContain('license-checker@0.0.1');
	});

	it('blocks unsupported deep imports', () => {
		const result = spawnSync(
			process.execPath,
			['--input-type=module', '--eval', "await import('@lizenz/checker/output/renderers.js');"],
			{ cwd: installDir, encoding: 'utf8' }
		);
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('ERR_PACKAGE_PATH_NOT_EXPORTED');
	});
});
