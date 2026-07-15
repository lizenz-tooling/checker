import { execFile, spawn } from 'node:child_process';
import path from 'node:path';
import { text } from 'node:stream/consumers';
import { promisify } from 'node:util';
import { expect } from 'vitest';

export type BinResult = {
	code: number | null;
	stderr: string;
	stdout: string;
};

export type RunBinOptions = {
	cwd?: string;
	env?: NodeJS.ProcessEnv;
};

const repoPath = path.resolve(import.meta.dirname, '..');
const binPath = path.join(repoPath, 'dist/cli.js');
const vitePath = path.join(repoPath, 'node_modules/vite/bin/vite.js');
const build = promisify(execFile);
let buildPromise: Promise<unknown> | undefined;

const ensureBuilt = (): Promise<unknown> => {
	buildPromise ??= build(process.execPath, [vitePath, 'build'], { cwd: repoPath });
	return buildPromise;
};

export const runBin = async (args: string[], options: RunBinOptions = {}): Promise<BinResult> => {
	await ensureBuilt();

	return new Promise<BinResult>((resolve, reject) => {
		const proc = spawn(process.execPath, [binPath, ...args], {
			cwd: options.cwd ?? repoPath,
			env: { ...process.env, ...options.env },
			stdio: ['ignore', 'pipe', 'pipe'],
		});
		const stdout = text(proc.stdout);
		const stderr = text(proc.stderr);

		proc.on('error', reject);
		proc.on('close', async code => {
			resolve({ code, stderr: await stderr, stdout: await stdout });
		});
	});
};

// biome-ignore lint/suspicious/noExplicitAny: Preserve the Legacy helper's deliberately permissive JSON boundary.
export const getPackageKey = (output: any, packageName: string): string => {
	const packageKey = Object.keys(output).find(key => key.startsWith(`${packageName}@`));
	expect(packageKey, `Expected ${packageName} in output`).toBeTruthy();
	if (!packageKey) {
		throw new Error(`Expected ${packageName} in output`);
	}
	return packageKey;
};

// biome-ignore lint/suspicious/noExplicitAny: Preserve the Legacy helper's deliberately permissive JSON boundary.
export const hasPackage = (output: any, packageName: string): boolean =>
	Object.keys(output).some(key => key.startsWith(`${packageName}@`));
