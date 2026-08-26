import path from 'node:path';
import { supportsColor } from 'chalk';
// @ts-expect-error nopt does not publish TypeScript declarations.
import nopt from 'nopt';
import { resolveDependencyDepth } from '../dependencies/dependency-depth';

type ArgumentValues = Record<string, unknown> & {
	angularCli?: boolean;
	clarificationsFile?: string;
	clarificationsMatchAll?: boolean;
	color?: boolean | null;
	csv?: boolean;
	csvComponentPrefix?: string;
	customPath?: string;
	development?: boolean;
	excludeLicenses?: string;
	excludePackages?: string;
	excludePackagesStartingWith?: string;
	excludePrivatePackages?: boolean;
	failOn?: string;
	files?: string;
	help?: boolean;
	includeLicenses?: string;
	includePackages?: string;
	json?: boolean;
	limitAttributes?: string;
	markdown?: boolean;
	nopeer?: boolean;
	onlyAllow?: string;
	onlyunknown?: boolean;
	out?: string;
	plainVertical?: boolean;
	production?: boolean;
	relativeLicensePath?: boolean;
	relativeModulePath?: boolean;
	start?: string;
	summary?: boolean;
	unknown?: boolean;
	version?: boolean;
};

type ParsedArguments = ArgumentValues & {
	depth?: number;
	direct?: boolean | number;
};

type DefaultableArguments = ArgumentValues & {
	depth?: number | string;
	direct?: boolean | number | string | null;
};

type NormalizedArguments = Omit<
	ParsedArguments,
	'color' | 'depth' | 'direct' | 'relativeLicensePath' | 'relativeModulePath' | 'start'
> & {
	color: boolean;
	depth?: number;
	direct?: never;
	failOn?: string;
	help?: boolean;
	onlyAllow?: string;
	relativeLicensePath: boolean;
	relativeModulePath: boolean;
	start: string;
	version?: boolean;
};

type LegacyNumberConstructor = (value?: unknown, radix?: number) => number;

// nopt uses constructors as runtime option descriptors.
export const knownOptions = {
	angularCli: Boolean,
	clarificationsFile: path,
	clarificationsMatchAll: Boolean,
	color: Boolean,
	csv: Boolean,
	csvComponentPrefix: String,
	customPath: path,
	depth: Number,
	development: Boolean,
	direct: [String, null],
	excludeLicenses: String,
	excludePackages: String,
	excludePackagesStartingWith: String,
	excludePrivatePackages: Boolean,
	failOn: String,
	files: path,
	help: Boolean,
	includeLicenses: String,
	includePackages: String,
	json: Boolean,
	limitAttributes: String,
	markdown: Boolean,
	nopeer: Boolean,
	onlyAllow: String,
	onlyunknown: Boolean,
	out: path,
	plainVertical: Boolean,
	production: Boolean,
	relativeLicensePath: Boolean,
	relativeModulePath: Boolean,
	start: String,
	summary: Boolean,
	unknown: Boolean,
	version: Boolean,
};

export const shortHands = {
	h: ['--help'],
	v: ['--version'],
};

function normalizeArgv(args?: string[]): string[] | undefined {
	if (Array.isArray(args) && (args.length === 0 || args[0]?.startsWith('-'))) {
		return [process.execPath, 'license-checker', ...args];
	}

	return args;
}

function parseArguments(args?: string[]): ParsedArguments {
	// nopt also returns argv bookkeeping that is not part of the checker options.
	const {
		argv: _argv,
		depth: rawDepth,
		direct: rawDirect,
		...otherArguments
	} = nopt(knownOptions, shortHands, normalizeArgv(args)) as DefaultableArguments & { argv?: unknown };
	const parsedArguments: ParsedArguments = { ...otherArguments };
	const depth = typeof rawDepth === 'number' || typeof rawDepth === 'string' ? normalizeNumber(rawDepth) : undefined;
	const direct = parseDirectValue(rawDirect);

	if (depth !== undefined) {
		parsedArguments.depth = depth;
	}
	if (direct !== undefined) {
		parsedArguments.direct = direct;
	}

	return parsedArguments;
}

const normalizeNumber = (value: number | string): number | undefined => {
	const numberValue = typeof value === 'number' ? value : (Number as LegacyNumberConstructor)(value.toLowerCase(), 10);

	return Number.isNaN(numberValue) ? undefined : Math.max(0, numberValue);
};

const parseDirectValue = (value: unknown): boolean | number | undefined => {
	if (value === true || value === 'true') {
		return true;
	}

	if (value === undefined) {
		return;
	}

	if (value === false || value === null || value === 'false' || value === 'null') {
		return false;
	}

	if (typeof value === 'number' || typeof value === 'string') {
		return normalizeNumber(value);
	}
};

const normalizeDependencyDepth = (depth: unknown, direct: unknown): number | undefined => {
	const normalizedDepth = typeof depth === 'number' || typeof depth === 'string' ? normalizeNumber(depth) : undefined;

	return resolveDependencyDepth({ depth: normalizedDepth, direct: parseDirectValue(direct) });
};

export function setDefaultArguments(parsedArguments: DefaultableArguments = {}): NormalizedArguments {
	const { color, depth, direct, relativeLicensePath, relativeModulePath, start, ...otherArguments } = parsedArguments;
	const dependencyDepth = normalizeDependencyDepth(depth, direct);
	const normalizedColor =
		otherArguments.json || otherArguments.markdown || otherArguments.csv
			? false
			: (color ?? (supportsColor ? supportsColor.hasBasic : false));
	const argumentsWithDefaults: NormalizedArguments = {
		...otherArguments,
		color: normalizedColor,
		relativeLicensePath: Boolean(relativeLicensePath),
		relativeModulePath: Boolean(relativeModulePath),
		start: start ?? process.cwd(),
	};

	if (dependencyDepth !== undefined) {
		argumentsWithDefaults.depth = dependencyDepth;
	}

	return argumentsWithDefaults;
}

export function getNormalizedArguments(args?: string[]): NormalizedArguments {
	return setDefaultArguments(parseArguments(args));
}
