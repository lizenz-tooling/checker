import { execFile } from 'node:child_process';
import { chmod, copyFile, mkdtemp, rm } from 'node:fs/promises';
import { builtinModules } from 'node:module';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { defineConfig } from 'vitest/config';

import packageJson from './package.json' with { type: 'json' };

const runtimeDependencies = Object.keys(packageJson.dependencies);
const externalBuiltins = new Set([...builtinModules, ...builtinModules.map(moduleName => `node:${moduleName}`)]);
const run = promisify(execFile);
const isExternal = (source: string): boolean =>
	externalBuiltins.has(source) ||
	runtimeDependencies.some(dependency => source === dependency || source.startsWith(`${dependency}/`));

export default defineConfig({
	define: {
		__PACKAGE_VERSION__: JSON.stringify(packageJson.version),
	},

	plugins: [
		{
			name: 'public-declaration',
			async closeBundle() {
				const temporaryDirectory = await mkdtemp(resolve(tmpdir(), 'lizenz-checker-declarations-'));
				try {
					await run(
						process.execPath,
						[
							resolve(import.meta.dirname, 'node_modules/typescript/bin/tsc'),
							'--project',
							resolve(import.meta.dirname, 'tsconfig.declarations.json'),
							'--outDir',
							temporaryDirectory,
						],
						{ cwd: import.meta.dirname }
					);
					await copyFile(resolve(temporaryDirectory, 'index.d.ts'), resolve(import.meta.dirname, 'dist/index.d.ts'));
				} finally {
					await rm(temporaryDirectory, { force: true, recursive: true });
				}
			},
		},
		{
			name: 'executable-cli',
			async closeBundle() {
				await chmod(resolve(import.meta.dirname, 'dist/cli.js'), 0o755);
			},
		},
	],

	build: {
		emptyOutDir: true,
		lib: {
			entry: {
				index: resolve(import.meta.dirname, 'src/index.ts'),
				cli: resolve(import.meta.dirname, 'src/cli.ts'),
			},
			formats: ['es'],
		},
		rollupOptions: {
			external: isExternal,
			output: {
				entryFileNames: '[name].js',
			},
		},
	},

	test: {
		fileParallelism: false,
		restoreMocks: true,
	},
});
