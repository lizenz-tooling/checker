export const normalOutput = {
	'@babel/code-frame@7.26.2': {
		licenses: 'MIT',
		repository: 'https://github.com/babel/babel',
	},
	'unscoped-package@1.2.3': {
		licenses: 'Apache-2.0',
		repository: 'https://example.com/unscoped-package',
	},
	'@example/dual-licensed@2.0.0': {
		licenses: 'MIT OR Apache-2.0',
	},
	'missing-metadata@0.0.0': {},
};

export const withCustomFormat = {
	'@babel/code-frame@7.26.2': {
		repository: 'https://github.com/babel/babel',
		name: '@babel/code-frame',
		description: 'Generate errors that contain a code frame that point to source locations.',
		pewpew: '<<Should Never be set>>',
	},
	'unscoped-package@1.2.3': {
		name: 'unscoped-package',
		description: 'Package without a repository.',
		pewpew: 'custom value',
	},
	'@example/missing-metadata@0.0.0': {},
};

export const withBsd = {
	'bsd-3-module@0.0.0': {
		licenses: 'BSD-3-Clause',
	},
};
