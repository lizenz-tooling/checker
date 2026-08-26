# `@lizenz/checker`

Collects license information from a project's installed dependency tree. Useful for verifying against a list of licenses
that you want to allow / disallow in your project.

This package derives from the original `license-checker` work by Dav Glass and the updated `license-checker-rseidelsohn`
maintained by Roman Seidelsohn and Roland Hummel.

## Installation

It is recommended to install the package:

Either globally:

```shell
npm install --global @lizenz/checker
```

Or as local devDependency in your project:

```shell
npm install --save-dev @lizenz/checker
```

Now, you can use the binary `license-checker` in your npm scripts. An example for such a script would look like this:

```json5
// in your package.json:
{
  // ...
  "scripts": {
    // ...
    "ensureValidLicenses": "license-check --excludePackages foo,bar --failOn GPL-3.0-or-later --json"
  }
  // ...
}
```

Alternatively, you can run it with `npx`:

```shell
npx @lizenz/checker --excludePackages foo,bar --failOn GPL-3.0-or-later --json
```

## Command line options

All CLI options in alphabetical order:

- `--clarificationsFile`: read package-specific license clarifications from a JSON file.
- `--clarificationsMatchAll`: fail if any clarification entry was not used.
- `--color`: colorize terminal tree output.
- `--csv`: output CSV.
- `--csvComponentPrefix`: add a component column prefix to CSV output.
- `--customPath`: read a custom output format from a JSON file.
- `--depth`: limit how deeply dependencies are scanned. `0` includes only direct dependencies, `1` also includes their
  immediate dependencies, and each larger value adds another level. Without this option, the complete installed
  dependency tree is scanned.
- `--development`: include only development dependencies.
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

Deprecated CLI options that still work, but will be removed in the future to reduce clutter and simplify usage:

- `--angularCli`: synonym for the plain vertical output mode; the frozen compatibility baseline retains its historic
  behavior.
- `--direct`: compatibility alias for dependency depth. `--direct` or `--direct=true` means `--depth=0`; a numeric value
  behaves like the same `--depth` value. If both options are present, `--depth` takes precedence. New invocations should
  use `--depth` directly.

When several "output" flags are present, precedence is JSON, CSV, Markdown, Summary, Plain Vertical, then Tree.

## Programmatic API

When you have installed the package into your project, you can call it programmatically:

```ts
import {runLicenseCheck} from '@lizenz/checker';

const modules = await runLicenseCheck({
    start: process.cwd()
});
```

`runLicenseCheck` returns a promise and never terminates the host process. Policy, clarification, input, and file-system
errors reject that promise.

For compatibility with the original API, there is also a callback-based variant called `init`. It is deprecated here,
and will be removed in a future release. Most projects will rely on the CLI anyway, but to those who are using the
programmatic API, we recommend to migrate to `runLicenseCheck`.

## Debugging

Use the namespaces `@lizenz/checker:error` and `@lizenz/checker:log` with the `DEBUG` environment variable.
