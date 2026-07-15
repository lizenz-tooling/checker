import fs from 'node:fs';
// @ts-expect-error treeify does not publish TypeScript declarations.
import treeify from 'treeify';
// biome-ignore lint/correctness/useImportExtensions: The emitted ESM import addresses the generated JavaScript file.
import { detectLicenseTitle } from '../licenses/detect-license-title.js';

type OutputModule = Record<string, unknown> & {
	licenseFile?: unknown;
	licenses?: unknown;
	repository?: unknown;
};

type OutputData = Record<string, OutputModule>;

interface LicenseDescriptor {
	name?: unknown;
	type?: unknown;
}

export const asTree = (sorted: unknown): string => treeify.asTree(sorted, true);

export const asSummary = (sorted: OutputData): string => {
	const licenseCountMap = new global.Map<unknown, number>();
	const licenseCountArray: Array<{ license: unknown; count: number }> = [];
	const sortedLicenseCountObj: Record<string, number> = {};

	for (const { licenses } of Object.values(sorted)) {
		if (licenses) {
			licenseCountMap.set(licenses, (licenseCountMap.get(licenses) as number) + 1 || 1);
		}
	}

	for (const [license, count] of licenseCountMap) {
		licenseCountArray.push({ license, count });
	}

	for (const { license, count } of licenseCountArray.sort((a, b) => b.count - a.count)) {
		sortedLicenseCountObj[license as string] = count;
	}

	return treeify.asTree(sortedLicenseCountObj, true);
};

/**
 * Exports data as Markdown (*.md) which has its own syntax.
 *
 * @param  sorted                  The sorted JSON data from all packages.
 * @param  {object} [customFormat] The custom format with information about the needed keys.
 * @return {string}                The returning plain text.
 */
export const asMarkDown = (sorted: OutputData, customFormat?: unknown): string => {
	const text: string[] = [];

	if (customFormat && Object.keys(customFormat as object).length > 0) {
		for (const sortedItem of Object.keys(sorted)) {
			const module = sorted[sortedItem] as OutputModule;
			text.push(`- **[${sortedItem}](${module.repository})**`);

			for (const customItem of Object.keys(customFormat as object)) {
				text.push(`    - ${customItem}: ${module[customItem]}`);
			}
		}
	} else {
		for (const key of Object.keys(sorted)) {
			const module = sorted[key] as OutputModule;
			text.push(`- [${key}](${module.repository}) - ${module.licenses}`);
		}
	}

	return text.join('\n');
};

const getModuleNameForLicenseTextHeader = (moduleName = ''): string => {
	const lastIndexOfAtCharacter = moduleName.lastIndexOf('@');

	return `${moduleName.substring(0, lastIndexOfAtCharacter)} ${moduleName.substring(lastIndexOfAtCharacter + 1)}\n`;
};

/**
 * Output data in plain vertical format like Angular CLI does: https://angular.io/3rdpartylicenses.txt
 */
export const asPlainVertical = (sorted: OutputData): string =>
	Object.entries(sorted)
		.map(([moduleName, moduleData]) => {
			let licenseText = getModuleNameForLicenseTextHeader(moduleName);
			const licenses = moduleData.licenses;
			const licenseDescriptor = licenses as LicenseDescriptor;

			if (Array.isArray(licenses) && licenses.length > 0) {
				// biome-ignore lint/suspicious/useIterableCallbackReturn: TODO we'll have to check if "moduleData.licenses" can contain something that might not be handled inside the map callback
				licenseText += licenses.map(moduleLicense => {
					if (typeof moduleLicense === 'object') {
						return moduleLicense.type || moduleLicense.name;
					}

					if (typeof moduleLicense === 'string') {
						return moduleLicense;
					}
				});
			} else if (typeof licenses === 'object' && (licenseDescriptor.type || licenseDescriptor.name)) {
				licenseText += detectLicenseTitle((licenseDescriptor.type || licenseDescriptor.name) as string);
			} else if (typeof licenses === 'string') {
				licenseText += detectLicenseTitle(licenses);
			}

			licenseText += '\n';
			const licenseFile = moduleData.licenseFile;
			const licenseFileDescriptor = licenseFile as LicenseDescriptor;

			if (Array.isArray(licenseFile) && licenseFile.length > 0) {
				// biome-ignore lint/suspicious/useIterableCallbackReturn: TODO we'll have to check if "moduleData.licenseFile" can contain something that might not be handled inside the map callback
				licenseText += licenseFile.map(moduleLicense => {
					if (typeof moduleLicense === 'object') {
						return moduleLicense.type || moduleLicense.name;
					}

					if (typeof moduleLicense === 'string') {
						return moduleLicense;
					}
				});
			} else if (typeof licenseFile === 'object' && (licenseFileDescriptor.type || licenseFileDescriptor.name)) {
				licenseText += licenseFileDescriptor.type || licenseFileDescriptor.name;
			} else if (typeof licenseFile === 'string') {
				licenseText += fs.readFileSync(licenseFile, { encoding: 'utf8' });
			}

			return licenseText;
		})
		.join('\n\n');
