# Changelog

## 0.0.1

- Port the complete runtime behavior and all 186 tests from `license-checker-rseidelsohn` commit `fa55e119` to TS.
- `runLicenseCheck` replaces the original, callback-based `init` function.
- Add the primary `license-checker` binary while retaining `license-checker-rseidelsohn` as a compatibility alias.
- Rename debug namespaces to `@lizenz/checker:error` and `@lizenz/checker:log`.
- 👉 check out the [original changelog](https://github.com/RSeidelsohn/license-checker-rseidelsohn/blob/71732b903e9e72f7e6dc9a06f4ad188ed50f56d6/CHANGELOG.md)
