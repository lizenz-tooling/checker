// @ts-expect-error spdx-correct does not publish TypeScript declarations.
import spdxCorrect from 'spdx-correct';
// @ts-expect-error spdx-satisfies does not publish TypeScript declarations.
import spdxSatisfies from 'spdx-satisfies';

const LICENSE_TITLE_UNKNOWN = 'UNKNOWN';
const bsdLicenses = ['0BSD', 'BSD-2-Clause', 'BSD-3-Clause', 'BSD-4-Clause'];

interface LicensePolicyOptions {
	failOn?: string;
	onlyAllow?: string;
}

interface PackagePolicy {
	currentLicense?: string | null;
	failOnLicenses: unknown;
	onlyAllowLicenses: string[];
	packageName: string;
}

interface LicenseMatch {
	hasUnknownLicense: boolean;
	match: boolean;
}

const transformBSD = (spdx: string): string => (spdx === 'BSD' ? `(${bsdLicenses.join(' OR ')})` : spdx);
const expandBSD = (spdx: string): string[] => (spdx === 'BSD' ? bsdLicenses : [spdx]);
const invertResultOf = (fn: (spdx: string) => boolean) => (spdx: string) => !fn(spdx);
const spdxIsValid = (spdx: string): boolean => spdxCorrect(spdx) === spdx;

const parsePolicyList = (value: string): string[] => {
	const licenses: string[] = [];

	for (const license of value.split(';')) {
		const trimmed = license.trim();
		if (trimmed.length > 0) {
			licenses.push(trimmed);
		}
	}

	return licenses;
};

export function getLicensePolicy(options: LicensePolicyOptions) {
	if (options.failOn) {
		return {
			failOnLicenses: parsePolicyList(options.failOn),
			onlyAllowLicenses: [],
		};
	}

	if (options.onlyAllow) {
		return {
			failOnLicenses: [],
			onlyAllowLicenses: parsePolicyList(options.onlyAllow),
		};
	}

	return {
		failOnLicenses: [],
		onlyAllowLicenses: [],
	};
}

export function checkForFailOn(currentLicense: string, failOnLicenses: unknown): void {
	if (!Array.isArray(failOnLicenses) || failOnLicenses.length === 0) {
		return;
	}

	if (failOnLicenses.includes(currentLicense)) {
		throw new Error(`Found license defined by the --failOn flag: "${currentLicense}". Exiting.`);
	}
}

/**
 * Check if the current license contains (eventually among others) at least one of the allowed licenses.
 */
export function checkForOnlyAllow(currentLicense: string, packageName: string, onlyAllowLicenses: string[]): void {
	if (onlyAllowLicenses.length > 0) {
		let containsOneOfAllowedPackages = false;

		for (const allowedLicense of onlyAllowLicenses) {
			// "currentLicense" is a longer string that may contain several license names,
			// and we check if one of those is a license listed in the "onlyAllowLicenses"
			// licenses array:
			if (currentLicense.includes(allowedLicense)) {
				containsOneOfAllowedPackages = true;
				break;
			}
		}

		if (!containsOneOfAllowedPackages) {
			throw new Error(
				`Package "${packageName}" is licensed under "${currentLicense}" which is not permitted by the --onlyAllow flag. Exiting.`
			);
		}
	}
}

export function throwIfLicensePolicyFails({
	currentLicense,
	failOnLicenses,
	onlyAllowLicenses,
	packageName,
}: PackagePolicy): void {
	if (currentLicense) {
		checkForFailOn(currentLicense, failOnLicenses);
		checkForOnlyAllow(currentLicense, packageName, onlyAllowLicenses);
	}
}

export function getLicenseMatch(licensesArr: string[], compareLicenses: string[]): LicenseMatch {
	const expandedCompareLicenses = compareLicenses.flatMap(expandBSD);
	const validSPDXLicenses = expandedCompareLicenses.filter(spdxIsValid);
	const invalidSPDXLicenses = expandedCompareLicenses.map(transformBSD).filter(invertResultOf(spdxIsValid));

	let hasUnknownLicense = false;
	let match = false;

	for (const license of licensesArr) {
		if (license.indexOf(LICENSE_TITLE_UNKNOWN) >= 0) {
			// Necessary due to colorization and preserves the historic include/exclude behavior for unknown licenses.
			hasUnknownLicense = true;
		} else {
			const withoutTrailingAsterisk = license.endsWith('*') ? license.slice(0, -1) : license;
			const transformed = transformBSD(withoutTrailingAsterisk);

			if (
				invalidSPDXLicenses.indexOf(transformed) >= 0 ||
				(spdxCorrect(transformed) &&
					validSPDXLicenses.length > 0 &&
					spdxSatisfies(spdxCorrect(transformed), validSPDXLicenses))
			) {
				match = true;
			}
		}
	}

	return { hasUnknownLicense, match };
}
