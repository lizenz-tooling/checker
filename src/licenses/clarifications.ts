// biome-ignore lint/correctness/useImportExtensions: The emitted ESM import addresses the generated JavaScript file.
import { readJson } from '../files/read-json.js';

export type Clarification = Record<string, unknown> & {
	semverRange: string;
	used: boolean;
};

export type Clarifications = Record<string, Clarification[]>;

export function readClarifications(clarificationsFile: unknown): Clarifications {
	const clarifications: Clarifications = {};

	if (!clarificationsFile) {
		return clarifications;
	}

	const clarificationsFromFile = readJson(clarificationsFile);

	for (const [versionString, clarification] of Object.entries(clarificationsFromFile as Record<string, unknown>)) {
		const versionSplit = versionString.lastIndexOf('@');
		if (versionSplit !== -1) {
			const name = versionString.slice(0, versionSplit);
			const semverRange = versionString.slice(versionSplit + 1);
			clarifications[name] = clarifications[name] || [];
			// keep track for each clarification if it was used, optionally error when not
			clarifications[name].push({
				...(clarification as Record<string, unknown>),
				semverRange,
				used: false,
			});
		}
	}

	return clarifications;
}

export function assertAllClarificationsWereUsed(clarifications: Clarifications): void {
	const unusedClarifications: string[] = [];

	for (const [packageName, entries] of Object.entries(clarifications)) {
		for (const clarification of entries) {
			if (!clarification.used) {
				unusedClarifications.push(`${packageName}@${clarification.semverRange}`);
			}
		}
	}

	if (unusedClarifications.length) {
		const list = unusedClarifications.join(', ');
		throw new Error(`Some clarifications (${list}) were unused and --clarificationsMatchAll was specified. Exiting.`);
	}
}
