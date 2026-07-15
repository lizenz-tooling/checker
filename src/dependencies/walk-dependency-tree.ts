export type DependencyTreeNode = Record<string, unknown> & {
	dependencies?: Record<string, DependencyTreeNode>;
	name?: string;
	version?: string;
};

interface WalkDependencyTreeOptions {
	maxDepth?: number | boolean | string | null;
	shouldVisit?: (dependency: DependencyTreeNode, currentDepth: number) => boolean;
	// biome-ignore lint/suspicious/noConfusingVoidType: Preserve the legacy visitor's void-or-boolean contract.
	visit: (dependency: DependencyTreeNode, currentDepth: number) => void | boolean;
}

/**
 * Walks a dependency tree depth-first and calls `visit` for every accepted node.
 *
 * A maxDepth of 0 still visits direct dependencies, matching the license checker's historic `direct: 0` behavior.
 */
export function walkDependencyTree(
	rootDependency: DependencyTreeNode,
	{ maxDepth = Number.POSITIVE_INFINITY, shouldVisit = () => true, visit }: WalkDependencyTreeOptions
): void {
	if (typeof visit !== 'function') {
		throw new TypeError('walkDependencyTree requires a visit function');
	}

	const walk = (dependency: DependencyTreeNode | null | undefined, currentDepth: number): void => {
		if (!dependency || !shouldVisit(dependency, currentDepth)) {
			return;
		}

		const visitResult = visit(dependency, currentDepth);

		if (visitResult === false || currentDepth > (maxDepth as number) || !dependency.dependencies) {
			return;
		}

		for (const dependencyName of Object.keys(dependency.dependencies)) {
			walk(dependency.dependencies[dependencyName], currentDepth + 1);
		}
	};

	walk(rootDependency, 0);
}
