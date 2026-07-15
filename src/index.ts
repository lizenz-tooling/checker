import path from 'node:path';
import chalk from 'chalk';
// @ts-expect-error debug does not publish TypeScript declarations.
import debug from 'debug';
// biome-ignore lint/correctness/useImportExtensions: The emitted ESM import addresses the generated JavaScript file.
import { deleteNonDirectDependencies } from './dependencies/direct-dependencies.js';
// biome-ignore lint/correctness/useImportExtensions: The emitted ESM import addresses the generated JavaScript file.
import readInstalledPackages from './dependencies/read-installed-packages.js';
// biome-ignore lint/correctness/useImportExtensions: The emitted ESM import addresses the generated JavaScript file.
import { readJson } from './files/read-json.js';
// biome-ignore lint/correctness/useImportExtensions: The emitted ESM import addresses the generated JavaScript file.
import { assertAllClarificationsWereUsed, readClarifications } from './licenses/clarifications.js';
// biome-ignore lint/correctness/useImportExtensions: The emitted ESM import addresses the generated JavaScript file.
import { collectLicenseResults } from './licenses/collect-license-results.js';
// biome-ignore lint/correctness/useImportExtensions: The emitted ESM import addresses the generated JavaScript file.
import { getFormattedOutput } from './output/format-output.js';
// biome-ignore lint/correctness/useImportExtensions: The emitted ESM import addresses the generated JavaScript file.
import { writeIndividualLicenseFilesToDir, writeOutputToFile } from './output/write-output.js';
// biome-ignore lint/correctness/useImportExtensions: The emitted ESM import addresses the generated JavaScript file.
import { getLicenseMatch, getLicensePolicy, throwIfLicensePolicyFails } from './policies/license-policy.js';
import {
	excludePackages,
	excludePackagesStartingWith,
	excludePrivatePackages,
	getOptionArray,
	includePackages,
	// biome-ignore lint/correctness/useImportExtensions: The emitted ESM import addresses the generated JavaScript file.
} from './policies/package-filters.js';

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

export type CustomFormatValue = string | boolean | undefined;

export type CustomFormat = Record<string, CustomFormatValue>;

export type LicenseCheckOptions = {
	start: string;
	production?: boolean;
	development?: boolean;
	unknown?: boolean;
	onlyunknown?: boolean;
	json?: boolean;
	csv?: boolean;
	csvComponentPrefix?: string;
	out?: string;
	customPath?: string;
	excludeLicenses?: string;
	relativeLicensePath?: boolean;
	relativeModulePath?: boolean;
	summary?: boolean;
	failOn?: string;
	onlyAllow?: string;
	includePackages?: string;
	excludePackages?: string;
	excludePrivatePackages?: boolean;
	excludePackagesStartingWith?: string;
	direct?: boolean | number;
	depth?: number;
	color?: boolean;
	customFormat?: CustomFormat;
	nopeer?: boolean;
	clarificationsFile?: string;
	clarificationsMatchAll?: boolean;
	includeLicenses?: string;
	files?: string;
};

export type KnownModuleInfo = {
	name?: string;
	version?: string;
	description?: string;
	repository?: string;
	publisher?: string;
	email?: string;
	url?: string;
	licenses?: string | string[];
	licenseFile?: string;
	licenseText?: string;
	licenseModified?: string;
	private?: boolean;
	path?: string;
	relativeModulePath?: boolean;
	copyright?: string;
	noticeFile?: string;
};

export type ModuleInfo = KnownModuleInfo & Record<string, string | string[] | boolean | undefined>;
export type ModuleInfos = Record<string, ModuleInfo>;

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
 * @param {LicenseCheckOptions} args Specifies the path to the module to check dependencies of.
 * @param {(err: Error | null, ret: ModuleInfos) => void} callback Called after the checker finished.
 * @deprecated Will be removed in a future version. Please switch to {@link runLicenseCheck} instead.
 */
export const init = (args: LicenseCheckOptions, callback: (err: Error | null, ret: ModuleInfos) => void): void => {
	runLicenseCheck(args).then(
		result => callback(null, result),
		error => callback(error, {})
	);
};
