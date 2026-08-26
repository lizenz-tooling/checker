#!/usr/bin/env node

import { getNormalizedArguments, knownOptions } from './cli/options';
import { exitProcessOrWarnIfNeeded } from './cli/preflight';
import { runLicenseCheck } from './index';
import { colorizeOutput, getFormattedOutput, shouldColorizeOutput } from './output/format-output';

const parsedArgs = getNormalizedArguments();
const known = Object.keys(knownOptions);
const unknownArgs = Object.keys(parsedArgs).filter(arg => !known.includes(arg));

exitProcessOrWarnIfNeeded({ unknownArgs, parsedArgs });

try {
	const foundLicensesJson = await runLicenseCheck(parsedArgs);
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
