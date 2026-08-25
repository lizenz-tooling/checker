import path from 'node:path';
import chalk from 'chalk';
// @ts-expect-error debug does not publish TypeScript declarations.
import debug from 'debug';
import { deleteNonDirectDependencies } from './dependencies/direct-dependencies';
import readInstalledPackages from './dependencies/read-installed-packages';
import { readJson } from './files/read-json';
import { assertAllClarificationsWereUsed, readClarifications } from './licenses/clarifications';
import { collectLicenseResults } from './licenses/collect-license-results';
import { getFormattedOutput } from './output/format-output';
import { writeIndividualLicenseFilesToDir, writeOutputToFile } from './output/write-output';
import { getLicenseMatch, getLicensePolicy, throwIfLicensePolicyFails } from './policies/license-policy.js';
import {
	excludePackages,
	excludePackagesStartingWith,
	excludePrivatePackages,
	getOptionArray,
	includePackages,
} from './policies/package-filters';

const LICENSE_TITLE_UNKNOWN = 'UNKNOWN';
const LICENSE_TITLE_UNLICENSED = 'UNLICENSED';

// biome-ignore lint/suspicious/noExplicitAny: Preserve the Legacy dependency tree's deliberately permissive shape.
type RuntimeRecord = Record<string, any>;

const debugError = debug('@lizenz/checker:error');
const debugLog = debug('@lizenz/checker:log');

debugLog.log = console.log.bind(console);

const parseLicenseFilter = (value: string | null | undefined): string[] | undefined => {
	if (value === null || value === undefined) {
		return;
	}

	return (value.match(/([^\\\][^,]|\\,)+/g) as RegExpMatchArray).map(license =>
		license.replace(/\\,/g, ',').replace(/^\s+|\s+$/g, '')
	);
};

/**
 * Default value or inclusion toggle for a custom output field.
 *
 * Custom format keys become columns in CSV output and additional fields in JSON output. A value of `false` prevents
 * the checker from populating an optional field, but does not remove core fields such as `licenses`.
 */
export type CustomFormatValue = string | boolean | undefined;

/** Maps custom output field names to their default values or inclusion toggles. */
export type CustomFormat = Record<string, CustomFormatValue>;

/** Options accepted by {@link runLicenseCheck} and the deprecated {@link init}. */
export type LicenseCheckOptions = {
	/** Path from which to start checking dependencies. */
	start: string;
	/** Only include production dependencies. */
	production?: boolean;
	/** Only include development dependencies. */
	development?: boolean;
	/** Report guessed licenses as unknown licenses. */
	unknown?: boolean;
	/** Only include packages with unknown or guessed licenses. */
	onlyunknown?: boolean;
	/** Format output written via {@link out} as JSON. */
	json?: boolean;
	/** Format output written via {@link out} as CSV. */
	csv?: boolean;
	/** Value placed in the leading component column of CSV output. */
	csvComponentPrefix?: string;
	/** File to which the formatted result is written. */
	out?: string;
	/** Path to a JSON file containing a {@link CustomFormat}. */
	customPath?: string;
	/** Comma-separated licenses to exclude from the result. */
	excludeLicenses?: string;
	/** Return license-file locations relative to {@link start}. */
	relativeLicensePath?: boolean;
	/** Return module locations relative to {@link start}. */
	relativeModulePath?: boolean;
	/** Format output written via {@link out} as a license-usage summary. */
	summary?: boolean;
	/** Semicolon-separated licenses that cause the check to fail when found. */
	failOn?: string;
	/** Semicolon-separated licenses allowed by the check; any other license causes it to fail. */
	onlyAllow?: string;
	/** Semicolon-separated `package@version` values to include exclusively. */
	includePackages?: string;
	/** Semicolon-separated `package@version` values to exclude. */
	excludePackages?: string;
	/** Exclude packages whose package metadata marks them as private. */
	excludePrivatePackages?: boolean;
	/** Exclude packages whose names start with any of the configured values. */
	excludePackagesStartingWith?: string;
	/**
	 * Dependency traversal limit used by the checker.
	 *
	 * The CLI normalizes its `--direct` and `--depth` arguments to a number in this property. Boolean values remain
	 * supported for compatibility.
	 */
	direct?: boolean | number;
	/**
	 * CLI recursion-depth argument.
	 *
	 * The CLI normalizes this value into {@link direct} before invoking the checker. Programmatic callers should set
	 * {@link direct} instead.
	 */
	depth?: number;
	/** Colorize human-readable output and unknown-license markers. */
	color?: boolean;
	/** Custom output fields and their default values or inclusion toggles. */
	customFormat?: CustomFormat;
	/** Ignore peer dependencies. */
	nopeer?: boolean;
	/** Path to license clarifications for malformed or non-standard packages. */
	clarificationsFile?: string;
	/** Require every supplied clarification to match a package. */
	clarificationsMatchAll?: boolean;
	/** Comma-separated licenses to include exclusively in the result. */
	includeLicenses?: string;
	/** Directory to which individual license files are written. */
	files?: string;
};

/** Information collected for one dependency. */
export type KnownModuleInfo = {
	/** Package name. */
	name?: string;
	/** Package version. */
	version?: string;
	/** Package description. */
	description?: string;
	/** Repository URL. */
	repository?: string;
	/** Publisher or author name. */
	publisher?: string;
	/** Publisher or author email address. */
	email?: string;
	/** Publisher, author, or package URL. */
	url?: string;
	/** Detected license or licenses. */
	licenses?: string | string[];
	/** Path to the license file, when available. */
	licenseFile?: string;
	/** Contents of the license file. */
	licenseText?: string;
	/** Custom value indicating whether the license was modified. */
	licenseModified?: string;
	/** Whether the package is marked as private. */
	private?: boolean;
	/** Path to the installed package. */
	path?: string;
	/** Whether the package path is relative. */
	relativeModulePath?: boolean;
	/** Copyright statement extracted from the license file. */
	copyright?: string;
	/** Path to the package's notice file. */
	noticeFile?: string;
};

/** Information about a dependency, including fields requested through {@link CustomFormat}. */
export type ModuleInfo = KnownModuleInfo & Record<string, string | string[] | boolean | undefined>;

/** Maps each `package@version` identifier to the information collected for that dependency. */
export type ModuleInfos = Record<string, ModuleInfo>;

/**
 * Checks dependency licenses according to the supplied options.
 *
 * @param options - Controls the license checker's behavior.
 * @returns All information collected for the dependencies found by the checker.
 */
export async function runLicenseCheck(options: LicenseCheckOptions): Promise<ModuleInfos> {
	debugLog('scanning %s', options.start);

	if (options.customPath) {
		options.customFormat = readJson(options.customPath) as CustomFormat;
	}

	const optionsForReadingInstalledPackages = {
		depth: options.direct,
		nopeer: options.nopeer,
		dev: true,
		log: debugLog,
	};

	if (options.production || options.development) {
		optionsForReadingInstalledPackages.dev = false;
	}

	const { failOnLicenses, onlyAllowLicenses } = getLicensePolicy(options);
	const clarifications = readClarifications(options.clarificationsFile);

	let installedPackagesJson: RuntimeRecord;
	try {
		installedPackagesJson = await readInstalledPackages(options.start, optionsForReadingInstalledPackages);
	} catch (error) {
		debugError(error);
		throw error;
	}

	if (optionsForReadingInstalledPackages.depth === 0) {
		deleteNonDirectDependencies(installedPackagesJson, options);
	}

	const results = collectLicenseResults({
		args: options,
		basePath: options.relativeLicensePath ? installedPackagesJson.path : null,
		clarifications,
		customFormat: options.customFormat,
		development: options.development,
		direct: options.direct,
		production: options.production,
		rootPackage: installedPackagesJson,
		unknown: options.unknown,
	}) as ModuleInfos;

	if (options.clarificationsMatchAll) {
		assertAllClarificationsWereUsed(clarifications);
	}

	const colorize = options.color;
	const sorted: ModuleInfos = {};
	let resultJson: ModuleInfos = {};
	const excludeLicenses = parseLicenseFilter(options.excludeLicenses);
	const includeLicenses = parseLicenseFilter(options.includeLicenses);

	const colorizeString = (value: string): string => (colorize ? chalk.bold.red(value) : value);

	for (const item of Object.keys(results).sort()) {
		const moduleInfo = results[item] as ModuleInfo;

		if (moduleInfo.private) {
			moduleInfo.licenses = colorizeString(LICENSE_TITLE_UNLICENSED);
		}

		if (!moduleInfo.licenses) {
			moduleInfo.licenses = colorizeString(LICENSE_TITLE_UNKNOWN);
		}

		if (
			options.unknown &&
			moduleInfo.licenses &&
			moduleInfo.licenses !== LICENSE_TITLE_UNKNOWN &&
			moduleInfo.licenses.indexOf('*') > -1
		) {
			moduleInfo.licenses = colorizeString(LICENSE_TITLE_UNKNOWN);
		}

		if (options.relativeModulePath && moduleInfo.path != null) {
			moduleInfo.path = path.relative(options.start, moduleInfo.path);
		}

		if (options.onlyunknown) {
			if (moduleInfo.licenses.indexOf('*') > -1 || moduleInfo.licenses.indexOf(LICENSE_TITLE_UNKNOWN) > -1) {
				sorted[item] = moduleInfo;
			}
		} else {
			sorted[item] = moduleInfo;
		}
	}

	let noPackagesFoundError: Error | undefined;
	if (!Object.keys(sorted).length) {
		noPackagesFoundError = new Error('No packages found in this path...');
	}

	if (
		(!Array.isArray(excludeLicenses) || excludeLicenses.length === 0) &&
		(!Array.isArray(includeLicenses) || includeLicenses.length === 0)
	) {
		resultJson = { ...sorted };
	} else {
		if (Array.isArray(excludeLicenses) && excludeLicenses.length > 0) {
			for (const [packageName, packageData] of Object.entries(sorted)) {
				const { licenses } = packageData;

				if (!licenses) {
					resultJson[packageName] = packageData;
				} else {
					const licensesArr = Array.isArray(licenses) ? licenses : [licenses];
					const licenseMatch = getLicenseMatch(licensesArr, excludeLicenses);

					if (licenseMatch.hasUnknownLicense || !licenseMatch.match) {
						resultJson[packageName] = packageData;
					}
				}
			}
		}

		if (Array.isArray(includeLicenses) && includeLicenses.length > 0) {
			for (const [packageName, packageData] of Object.entries(sorted)) {
				const { licenses } = packageData;

				if (!licenses) {
					resultJson[packageName] = packageData;
				} else {
					const licensesArr = Array.isArray(licenses) ? licenses : [licenses];
					const licenseMatch = getLicenseMatch(licensesArr, includeLicenses);

					if (licenseMatch.hasUnknownLicense || licenseMatch.match) {
						resultJson[packageName] = packageData;
					}
				}
			}
		}
	}

	const whitelist = getOptionArray(options.includePackages);
	if (whitelist) {
		resultJson = includePackages(whitelist as string[], resultJson);
	}

	const blacklist = getOptionArray(options.excludePackages);
	if (blacklist) {
		resultJson = excludePackages(blacklist as string[], resultJson);
	}

	const excludeStartStringsArr = getOptionArray(options.excludePackagesStartingWith);
	if (excludeStartStringsArr) {
		resultJson = excludePackagesStartingWith(excludeStartStringsArr as string[], resultJson);
	}

	if (options.excludePrivatePackages) {
		resultJson = excludePrivatePackages(resultJson);
	}

	for (const packageName of Object.keys(resultJson)) {
		throwIfLicensePolicyFails({
			currentLicense: resultJson[packageName]?.licenses as string,
			failOnLicenses,
			onlyAllowLicenses,
			packageName,
		});
	}

	if (noPackagesFoundError) {
		debugError(noPackagesFoundError);
		throw noPackagesFoundError;
	}

	if (options.out) {
		await writeOutputToFile(options.out, getFormattedOutput(resultJson, options));
	}

	if (options.files) {
		await writeIndividualLicenseFilesToDir(options.files, resultJson);
	}

	return resultJson;
}

/**
 * Runs the license check for the given args.
 *
 * @param {LicenseCheckOptions} args Controls the license checker's behavior.
 * @param {(err: Error | null, ret: ModuleInfos) => void} callback Called after the checker finishes.
 *
 * @deprecated Will be removed in a future version. Please switch to {@link runLicenseCheck} instead.
 */
export const init = (args: LicenseCheckOptions, callback: (err: Error | null, ret: ModuleInfos) => void): void => {
	runLicenseCheck(args).then(
		result => callback(null, result),
		error => callback(error, {})
	);
};
