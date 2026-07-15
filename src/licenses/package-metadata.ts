import fs from 'node:fs';
import path from 'node:path';
// biome-ignore lint/correctness/useImportExtensions: The emitted ESM import addresses the generated JavaScript file.
import { firstDefined } from '../shared/first-defined.js';

interface RepositoryDetails {
	clarificationRepository?: unknown;
	jsonRepository?: { url?: unknown } | null;
}

interface PartyDetails {
	email?: unknown;
	name?: unknown;
	publisher?: unknown;
	url?: unknown;
}

interface AuthorDetails {
	author?: PartyDetails | null;
	clarification?: PartyDetails | null;
}

interface ExtendedPackageJson {
	readme?: unknown;
}

export function getRepositoryUrl({ clarificationRepository, jsonRepository }: RepositoryDetails): unknown {
	if (clarificationRepository) {
		return clarificationRepository;
	}

	if (typeof jsonRepository?.url === 'string') {
		return jsonRepository.url
			.replace('git+ssh://git@', 'git://')
			.replace('git+https://github.com', 'https://github.com')
			.replace('git://github.com', 'https://github.com')
			.replace('git@github.com:', 'https://github.com/')
			.replace(/\.git$/, '');
	}
}

export function getAuthorDetails({ clarification, author }: AuthorDetails) {
	const publisher = firstDefined(clarification?.publisher, author?.name);
	const email = firstDefined(clarification?.email, author?.email);
	const url = firstDefined(clarification?.url, author?.url);

	return { publisher, email, url };
}

// Eventually store the contents of the module's README.md in currentExtendedPackageJson.readme:
export const storeReadmeInPackageJsonIfExists = (modulePath: unknown, currentExtendedPackageJson: unknown): void => {
	const packageJson = currentExtendedPackageJson as ExtendedPackageJson | null;

	if (
		typeof modulePath !== 'string' ||
		typeof currentExtendedPackageJson !== 'object' ||
		modulePath === '' ||
		(typeof packageJson?.readme === 'string' &&
			packageJson?.readme?.toLowerCase()?.indexOf('no readme data found') === -1)
	) {
		return;
	}

	const readmeFile = path.join(modulePath, 'README.md');

	if (fs.existsSync(readmeFile)) {
		(packageJson as ExtendedPackageJson).readme = fs.readFileSync(readmeFile, 'utf8').toString();
	}
};
