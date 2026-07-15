// @ts-expect-error @npmcli/arborist does not publish TypeScript declarations.
import Arborist from '@npmcli/arborist';
// @ts-expect-error @npmcli/package-json does not publish TypeScript declarations.
import PackageJson from '@npmcli/package-json';

// biome-ignore lint/suspicious/noExplicitAny: Preserve the Legacy Arborist compatibility object's open shape.
type LegacyValue = any;
type LegacyRecord = Record<string, LegacyValue>;

const clonePackageJson = (packageJson: LegacyValue): LegacyRecord => JSON.parse(JSON.stringify(packageJson ?? {}));

const readPackageJsonFromDisk = async (packagePath: string): Promise<LegacyRecord> => {
	try {
		const packageJson = await PackageJson.prepare(packagePath);
		return clonePackageJson(packageJson.content);
	} catch {
		return {};
	}
};

const getDependencySpecs = (packageJson: LegacyRecord): LegacyRecord => ({
	...packageJson.dependencies,
	...packageJson.optionalDependencies,
});

const getRootDependencySpecs = (packageJson: LegacyRecord): LegacyRecord => ({
	...getDependencySpecs(packageJson),
});

const isOptionalEdge = (edge: LegacyRecord): boolean => edge.type === 'optional' || edge.type === 'peerOptional';

const isPeerEdge = (edge: LegacyRecord): boolean => edge.type === 'peer' || edge.type === 'peerOptional';

const getNodeForPackageJson = (node: LegacyRecord): LegacyRecord => node.target ?? node;

const getNodeForDependencies = (node: LegacyRecord): LegacyRecord => node.target ?? node;

const getRealPath = (node: LegacyRecord): LegacyValue => node.target?.realpath ?? node.realpath ?? node.path;

const findDependency = (packageJson: LegacyRecord, dependencyName: string): LegacyValue => {
	let currentPackageJson: LegacyRecord | null = packageJson;

	while (currentPackageJson) {
		const dependency = currentPackageJson.dependencies?.[dependencyName];

		if (typeof dependency === 'object') {
			return dependency;
		}

		if (currentPackageJson.realName === dependencyName) {
			return currentPackageJson;
		}

		currentPackageJson = currentPackageJson.link ? null : currentPackageJson.parent;
	}
};

const unmarkExtraneous = (packageJson: LegacyRecord, options: LegacyRecord): void => {
	packageJson.extraneous = false;

	const dependencies = packageJson._dependencies ?? {};

	if (options.dev && packageJson.devDependencies && (packageJson.root || packageJson.link)) {
		for (const dependencyName of Object.keys(packageJson.devDependencies)) {
			dependencies[dependencyName] = packageJson.devDependencies[dependencyName];
		}
	}

	if (!options.nopeer && packageJson.peerDependencies) {
		for (const dependencyName of Object.keys(packageJson.peerDependencies)) {
			dependencies[dependencyName] = packageJson.peerDependencies[dependencyName];
		}
	}

	for (const dependencyName of Object.keys(dependencies)) {
		const dependency = findDependency(packageJson, dependencyName);

		if (dependency?.extraneous) {
			unmarkExtraneous(dependency, options);
		}
	}
};

const readInstalledPackages = async (folder: string, options: LegacyRecord = {}): Promise<LegacyRecord> => {
	const arb = new Arborist({ path: folder });
	const root = await arb.loadActual();
	const convertedNodes = new WeakMap<object, LegacyRecord>();

	const convertNode = async (
		node: LegacyRecord,
		parent: LegacyRecord | null = null,
		depth = 0,
		realName: string | null = null
	): Promise<LegacyRecord> => {
		if (convertedNodes.has(node)) {
			return convertedNodes.get(node) as LegacyRecord;
		}

		const packageNode = getNodeForPackageJson(node);
		const packageJson = {
			...clonePackageJson(packageNode.package),
			...(await readPackageJsonFromDisk(packageNode.path)),
		};
		const dependencySpecs = node.root === node ? getRootDependencySpecs(packageJson) : getDependencySpecs(packageJson);
		const compatibilityPackageJson: LegacyRecord = {
			...packageJson,
			name: packageJson.name ?? node.name,
			version: packageJson.version ?? node.version,
			path: node.path,
			realPath: getRealPath(node),
			realName: realName ?? packageJson.name ?? node.name,
			_dependencies: dependencySpecs,
			dependencies: {},
			extraneous: true,
			depth,
		};

		if (compatibilityPackageJson.realName && compatibilityPackageJson.name !== compatibilityPackageJson.realName) {
			compatibilityPackageJson.invalid = true;
		}

		if (node.isLink) {
			compatibilityPackageJson.link = getRealPath(node);
		}

		convertedNodes.set(node, compatibilityPackageJson);

		if (parent && !compatibilityPackageJson.link) {
			compatibilityPackageJson.parent = parent;
		}

		const dependencyNode = getNodeForDependencies(node);

		for (const [childName, child] of dependencyNode.children as Iterable<[string, LegacyRecord]>) {
			if (options.nopeer && child.peer) {
				continue;
			}

			compatibilityPackageJson.dependencies[childName] = await convertNode(
				child,
				compatibilityPackageJson,
				depth + 1,
				childName
			);
		}

		for (const [dependencyName, edge] of dependencyNode.edgesOut as Iterable<[string, LegacyRecord]>) {
			if (options.nopeer && isPeerEdge(edge)) {
				continue;
			}

			if (!edge.to) {
				if (!isOptionalEdge(edge)) {
					compatibilityPackageJson.dependencies[dependencyName] = edge.spec;
				}
				continue;
			}

			const dependency = await convertNode(edge.to, compatibilityPackageJson, depth + 1, dependencyName);

			if (!edge.valid) {
				if (isPeerEdge(edge)) {
					dependency.peerInvalid = true;
				} else {
					dependency.invalid = true;
				}
			}

			compatibilityPackageJson.dependencies[dependencyName] = dependency;
		}

		return compatibilityPackageJson;
	};

	const convertedRoot = await convertNode(root);
	convertedRoot.root = true;
	unmarkExtraneous(convertedRoot, options);

	return convertedRoot;
};

export default readInstalledPackages;
