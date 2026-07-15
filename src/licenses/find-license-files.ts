import path from 'node:path';

const BASENAMES_PRECEDENCE = [
	/^LICENSE$/,
	/^LICENSE-\w+$/, // e.g. LICENSE-MIT
	/^LICENCE$/,
	/^LICENCE-\w+$/, // e.g. LICENCE-MIT
	/^MIT-LICENSE$/,
	/^COPYING$/,
	/^README$/, // TODO: should we really include README?
];

// Find and list license files in the precedence order
export const findLicenseFiles = (dirFiles: string[]): string[] => {
	const files: string[] = [];

	for (const basenamePattern of BASENAMES_PRECEDENCE) {
		dirFiles.some(filename => {
			const basename = getBaseFileName(filename);

			if (basenamePattern.test(basename)) {
				files.push(filename);

				return true;
			}

			return false;
		});
	}

	return files;
};

const getBaseFileName = (filename: string): string => path.basename(filename, path.extname(filename)).toUpperCase();
