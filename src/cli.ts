#!/usr/bin/env node

// biome-ignore lint/correctness/useImportExtensions: The emitted ESM import addresses the generated JavaScript file.
import { getNormalizedArguments, knownOptions } from './cli/options.js';
// biome-ignore lint/correctness/useImportExtensions: The emitted ESM import addresses the generated JavaScript file.
import { exitProcessOrWarnIfNeeded } from './cli/preflight.js';
// biome-ignore lint/correctness/useImportExtensions: The emitted ESM import addresses the generated JavaScript file.
import { type LicenseCheckOptions, runLicenseCheck } from './index.js';
// biome-ignore lint/correctness/useImportExtensions: The emitted ESM import addresses the generated JavaScript file.
import { colorizeOutput, getFormattedOutput, shouldColorizeOutput } from './output/format-output.js';

const parsedArgs = getNormalizedArguments();
const known = Object.keys(knownOptions);
const unknownArgs = Object.keys(parsedArgs).filter(arg => !known.includes(arg));

exitProcessOrWarnIfNeeded({ unknownArgs, parsedArgs });

try {
	const foundLicensesJson = await runLicenseCheck(parsedArgs as LicenseCheckOptions);
	if (!parsedArgs.out) {
		if (shouldColorizeOutput(parsedArgs)) {
			colorizeOutput(foundLicensesJson);
		}

		const formattedOutput = getFormattedOutput(foundLicensesJson, parsedArgs);
		console.log(formattedOutput);
	}
} catch (error) {
	console.error((error as { message?: unknown }).message ?? error);
	process.exitCode = 1;
}
