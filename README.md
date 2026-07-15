# `@lizenz/checker`

`@lizenz/checker` extracts license information from the installed dependency tree of an npm project. It is an ESM-only
TypeScript port of `license-checker-rseidelsohn` at the frozen upstream commit
`fa55e1197234e1a7efc662f7a3e76fe4212a25ec`.

## Command line

The primary command is `license-checker`. Existing scripts can keep using the compatibility alias
`license-checker-rseidelsohn`.

All CLI options in alphabetical order:

- `--angularCli`: synonym for the plain vertical output mode; the frozen compatibility baseline retains its historic behavior.
- `--clarificationsFile`: read package-specific license clarifications from a JSON file.
- `--clarificationsMatchAll`: fail if any clarification entry was not used.
- `--color`: colorize terminal tree output.
- `--csv`: output CSV.
- `--csvComponentPrefix`: add a component column prefix to CSV output.
- `--customPath`: read a custom output format from a JSON file.
- `--depth`: recurse through the specified number of dependency levels and override the direct setting.
- `--development`: include only development dependencies.
- `--direct`: retain the historic direct/depth normalization behavior.
- `--excludeLicenses`: exclude a comma-separated list of licenses.
- `--excludePackages`: exclude a semicolon-separated list of package selectors.
- `--excludePackagesStartingWith`: exclude packages with semicolon-separated prefixes.
- `--excludePrivatePackages`: exclude packages marked private.
- `--failOn`: fail on a semicolon-separated list of licenses.
- `--files`: copy discovered license files to a directory.
- `--help` (`-h`): print usage information.
- `--includeLicenses`: include only a comma-separated list of licenses.
- `--includePackages`: include only a semicolon-separated list of package selectors.
- `--json`: output formatted JSON.
- `--limitAttributes`: restrict JSON output to a comma-separated list of fields.
- `--markdown`: output Markdown.
- `--nopeer`: skip peer dependencies.
- `--onlyAllow`: fail on licenses outside a semicolon-separated allow-list.
- `--onlyunknown`: list only unknown or guessed licenses.
- `--out`: write formatted output to a file.
- `--plainVertical`: output license text in plain vertical format.
- `--production`: include only production dependencies.
- `--relativeLicensePath`: make license-file paths relative.
- `--relativeModulePath`: make module paths relative.
- `--start`: set the project path to scan.
- `--summary`: output license counts.
- `--unknown`: report guessed licenses as unknown.
- `--version` (`-v`): print the package version using the historic CLI exit behavior.

When several output flags are present, precedence is JSON, CSV, Markdown, Summary, Plain Vertical, then Tree.

## Programmatic API

```ts
import { runLicenseCheck } from '@lizenz/checker';

const modules = await runLicenseCheck({ start: process.cwd() });
```

`runLicenseCheck` returns a promise and never terminates the host process. Policy, clarification, input, and file-system
errors reject that promise. The deprecated callback-based `init` wrapper remains available for compatibility with the
upstream API; new code should use `runLicenseCheck`.

## Debugging

Use the namespaces `@lizenz/checker:error` and `@lizenz/checker:log` with the `DEBUG` environment variable.

## License and upstream

This package is distributed under the BSD 3-Clause License. It derives from the original `license-checker` work by Dav
Glass and the enhanced `license-checker-rseidelsohn` maintained by Roman Seidelsohn and Roland Hummel.
