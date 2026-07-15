type OutputModule = Record<string, unknown> & {
	licenses?: unknown;
	repository?: unknown;
};

type OutputData = Record<string, OutputModule>;

export const getCsvData = (sorted: OutputData, customFormat?: unknown, csvComponentPrefix?: unknown): string[] => {
	const csvDataArr: string[] = [];

	for (const [key, module] of Object.entries(sorted)) {
		const dataElements: Array<string | string[]> = [];

		if (csvComponentPrefix) {
			dataElements.push(`"${csvComponentPrefix}"`);
		}

		// Grab the custom keys from the custom format
		if (typeof customFormat === 'object' && Object.keys(customFormat as object).length > 0) {
			dataElements.push(`"${key}"`);

			for (const item of Object.keys(customFormat as object)) {
				dataElements.push(`"${module[item]}"`);
			}
		} else {
			// Be sure to push empty strings for empty values, as this is what CSV expects:
			dataElements.push([`"${key}"`, `"${module.licenses || ''}"`, `"${module.repository || ''}"`]);
		}

		csvDataArr.push(dataElements.join(','));
	}

	return csvDataArr;
};

export const getCsvHeaders = (customFormat?: unknown, csvComponentPrefix?: unknown): string => {
	const prefixName = '"component"';
	const entriesArr: string[] = [];

	if (csvComponentPrefix) {
		entriesArr.push(prefixName);
	}

	if (typeof customFormat === 'object' && Object.keys(customFormat as object).length > 0) {
		entriesArr.push('"module name"');

		for (const item of Object.keys(customFormat as object)) {
			entriesArr.push(`"${item}"`);
		}
	} else {
		entriesArr.push('"module name"', '"license"', '"repository"');
	}

	return entriesArr.join(',');
};

export const asCSV = (sorted: OutputData, customFormat?: unknown, csvComponentPrefix?: unknown): string => {
	const csvHeaders = getCsvHeaders(customFormat, csvComponentPrefix);
	const csvDataArr = getCsvData(sorted, customFormat, csvComponentPrefix);

	return [csvHeaders, ...csvDataArr].join('\n');
};
