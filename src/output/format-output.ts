import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
// @ts-expect-error lodash.clonedeep does not publish TypeScript declarations.
import cloneDeep from 'lodash.clonedeep';
// biome-ignore lint/correctness/useImportExtensions: The emitted ESM import addresses the generated JavaScript file.
import { asCSV } from './csv.js';
// biome-ignore lint/correctness/useImportExtensions: The emitted ESM import addresses the generated JavaScript file.
import { filterAttributes } from './filter-attributes.js';
// biome-ignore lint/correctness/useImportExtensions: The emitted ESM import addresses the generated JavaScript file.
import { asMarkDown, asPlainVertical, asSummary, asTree } from './renderers.js';

type OutputModule = Record<string, unknown> & {
	licenseFile?: unknown;
};

type OutputData = Record<string, OutputModule>;

interface FormatOutputArgs {
	angluarCli?: boolean;
	color?: boolean;
	csv?: boolean;
	csvComponentPrefix?: unknown;
	customFormat?: unknown;
	files?: string;
	json?: boolean;
	limitAttributes?: string;
	markdown?: boolean;
	out?: string;
	plainVertical?: boolean;
	relativeLicensePath?: boolean;
	summary?: boolean;
}

export function shouldColorizeOutput(args: FormatOutputArgs): boolean | undefined {
	return args.color && !args.out && !args.files && !(args.csv || args.json || args.markdown || args.plainVertical);
}

export function colorizeOutput<Module>(json: Record<string, Module>): void {
	for (const key of Object.keys(json)) {
		const index = key.lastIndexOf('@');
		const colorizedKey =
			chalk.white.bgHex('#2F4F4F')(key.slice(0, index)) +
			chalk.dim('@') +
			chalk.white.bgHex('#008000')(key.slice(index + 1));
		if (colorizedKey === key) {
			continue;
		}

		json[colorizedKey] = json[key] as Module;

		delete json[key];
	}
}

function filterJson(limitAttributes: string | undefined, json: OutputData): OutputData {
	let filteredJson = json;

	if (limitAttributes) {
		filteredJson = {};
		const attributes = limitAttributes.split(',').map(attribute => attribute.trim());

		for (const dependency of Object.keys(json)) {
			filteredJson[dependency] = filterAttributes(attributes, json[dependency] as OutputModule);
		}
	}

	return filteredJson;
}

export function getFormattedOutput(modulesWithVersions: OutputData, args: FormatOutputArgs): string {
	let filteredJson: OutputData | null = filterJson(args.limitAttributes, modulesWithVersions);
	const jsonCopy = cloneDeep(filteredJson) as OutputData;
	filteredJson = null;

	if (args.files) {
		for (const moduleName of Object.keys(jsonCopy)) {
			const outPath = path.join(args.files, `${moduleName}-LICENSE.txt`);
			const moduleData = jsonCopy[moduleName] as OutputModule;
			const originalLicenseFile = moduleData.licenseFile;

			if (originalLicenseFile && fs.existsSync(originalLicenseFile as string)) {
				if (args.relativeLicensePath) {
					if (args.out) {
						moduleData.licenseFile = path.relative(path.dirname(args.out), outPath);
					} else {
						moduleData.licenseFile = path.relative(process.cwd(), outPath);
					}
				} else {
					moduleData.licenseFile = outPath;
				}
			}
		}
	}

	if (args.json) {
		return `${JSON.stringify(jsonCopy, null, 4)}\n`;
	}

	if (args.csv) {
		return asCSV(jsonCopy, args.customFormat, args.csvComponentPrefix);
	}

	if (args.markdown) {
		return `${asMarkDown(jsonCopy, args.customFormat)}\n`;
	}

	if (args.summary) {
		return asSummary(jsonCopy);
	}

	if (args.plainVertical || args.angluarCli) {
		return asPlainVertical(jsonCopy);
	}

	return asTree(jsonCopy);
}
