export type DependencyDepthOptions = {
	depth?: number;
	direct?: boolean | number;
};

export function resolveDependencyDepth({ depth, direct }: DependencyDepthOptions): number | undefined {
	if (depth !== undefined) {
		return depth;
	}

	if (direct === true) {
		return 0;
	}

	if (typeof direct === 'number') {
		return direct;
	}
}
