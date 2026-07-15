export const getOptionArray = (option: unknown): unknown[] | false => {
	if (Array.isArray(option)) {
		return option;
	}

	if (typeof option === 'string') {
		return option.split(';');
	}

	return false;
};

const matchesPackageSelector = (packageName: string, selector: string): boolean =>
	packageName.startsWith(selector.lastIndexOf('@') > 0 ? selector : `${selector}@`);

export const includePackages = <Package>(
	whitelist: string[],
	packages: Record<string, Package>
): Record<string, Package> => {
	const resultJson: Record<string, Package> = {};

	for (const packageName of Object.keys(packages)) {
		// Whitelist packages by declaring:
		// 1. the package full name. Ex: `react` (we suffix an '@' to ensure we don't match packages like `react-native`)
		// 2. the package full name and the major version. Ex: `react@16`
		// 3. the package full name and full version. Ex: `react@16.0.2`
		if (whitelist.findIndex(whitelistPackage => matchesPackageSelector(packageName, whitelistPackage)) !== -1) {
			resultJson[packageName] = packages[packageName] as Package;
		}
	}

	return resultJson;
};

export const excludePackages = <Package>(
	blacklist: string[],
	packages: Record<string, Package>
): Record<string, Package> => {
	const resultJson: Record<string, Package> = {};

	for (const packageName of Object.keys(packages)) {
		// Blacklist packages by declaring:
		// 1. the package full name. Ex: `react` (we suffix an '@' to ensure we don't match packages like `react-native`)
		// 2. the package full name and the major version. Ex: `react@16`
		// 3. the package full name and full version. Ex: `react@16.0.2`
		if (blacklist.findIndex(blacklistPackage => matchesPackageSelector(packageName, blacklistPackage)) === -1) {
			resultJson[packageName] = packages[packageName] as Package;
		}
	}

	return resultJson;
};

export const excludePackagesStartingWith = <Package>(
	blacklist: string[],
	packages: Record<string, Package>
): Record<string, Package> => {
	const resultJson: Record<string, Package> = { ...packages };

	for (const packageName in resultJson) {
		for (const denyPrefix of blacklist) {
			if (packageName.startsWith(denyPrefix)) {
				delete resultJson[packageName];
			}
		}
	}

	return resultJson;
};

export const excludePrivatePackages = <Package>(packages: Record<string, Package>): Record<string, Package> => {
	const resultJson: Record<string, Package> = { ...packages };

	for (const packageName of Object.keys(resultJson)) {
		const packageDetails = resultJson[packageName] as { private?: unknown } | null | undefined;
		if (packageDetails?.private) {
			delete resultJson[packageName];
		}
	}

	return resultJson;
};
