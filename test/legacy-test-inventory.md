# Legacy test inventory

Normative source: `license-checker-rseidelsohn` commit `fa55e1197234e1a7efc662f7a3e76fe4212a25ec`.

No test invokes `init` directly or indirectly. The historically named `init policy errors` suite calls
`runLicenseCheck`; therefore no test is excluded and all 186 generated cases are ported.

| Legacy file | Generated tests | Target status |
| --- | ---: | --- |
| `tests/cli.test.ts` | 25 | Ported to `test/cli.test.ts` |
| `tests/cli/options.test.ts` | 18 | Ported to `test/cli/options.test.ts` |
| `tests/cli/preflight.test.ts` | 2 | Ported to `test/cli/preflight.test.ts` |
| `tests/dependencies/direct-dependencies.test.ts` | 3 | Ported |
| `tests/dependencies/read-installed-packages.test.ts` | 6 | Ported |
| `tests/dependencies/walk-dependency-tree.test.ts` | 4 | Ported |
| `tests/files/read-json.test.ts` | 4 | Ported |
| `tests/index.test.ts` | 36 | Ported to `test/index.test.ts` |
| `tests/licenses/clarifications.test.ts` | 3 | Ported |
| `tests/licenses/collect-license-results.test.ts` | 2 | Ported |
| `tests/licenses/copyright.test.ts` | 1 | Ported |
| `tests/licenses/detect-license-title.test.ts` | 36 | Ported |
| `tests/licenses/find-license-files.test.ts` | 9 | Ported |
| `tests/licenses/package-metadata.test.ts` | 5 | Ported |
| `tests/output/csv.test.ts` | 5 | Ported |
| `tests/output/filter-attributes.test.ts` | 2 | Ported |
| `tests/output/format-output.test.ts` | 3 | Ported |
| `tests/output/renderers.test.ts` | 6 | Ported |
| `tests/output/write-output.test.ts` | 2 | Ported |
| `tests/policies/license-policy.test.ts` | 8 | Ported |
| `tests/policies/package-filters.test.ts` | 5 | Ported |
| `tests/shared/first-defined.test.ts` | 1 | Ported |
| **Total** | **186** | **186 ported, 0 excluded** |

The 178 syntactic `it`/`it.each` definitions generate 186 cases because the option-format loop creates four cases and
the two SPDX parameterized tests create four and three cases respectively.
