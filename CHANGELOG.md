# Changelog

## 0.0.1

- Port the complete runtime behavior and all 186 tests from `license-checker-rseidelsohn` commit
  `fa55e1197234e1a7efc662f7a3e76fe4212a25ec` to TypeScript.
- Publish the promise-based `runLicenseCheck` as the primary root API while retaining the deprecated callback-based
  `init` wrapper for compatibility.
- Add the primary `license-checker` binary while retaining `license-checker-rseidelsohn` as a compatibility alias.
- Rename debug namespaces to `@lizenz/checker:error` and `@lizenz/checker:log`.
