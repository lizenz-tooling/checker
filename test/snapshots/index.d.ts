/**
 * Default value or inclusion toggle for a custom output field.
 *
 * Custom format keys become columns in CSV output and additional fields in
 * JSON output. A value of `false` prevents the checker from populating an
 * optional field, but does not remove core fields such as `licenses`.
 */
export type CustomFormatValue = string | boolean | undefined;
/** Maps custom output field names to their default values or inclusion toggles. */
export type CustomFormat = Record<string, CustomFormatValue>;
/** Options accepted by {@link runLicenseCheck} and the deprecated {@link init}. */
export type LicenseCheckOptions = {
	/** Path from which to start checking dependencies. */
	start: string;
	/** Only include production dependencies. */
	production?: boolean;
	/** Only include development dependencies. */
	development?: boolean;
	/** Report guessed licenses as unknown licenses. */
	unknown?: boolean;
	/** Only include packages with unknown or guessed licenses. */
	onlyunknown?: boolean;
	/** Format output written via {@link out} as JSON. */
	json?: boolean;
	/** Format output written via {@link out} as CSV. */
	csv?: boolean;
	/** Value placed in the leading component column of CSV output. */
	csvComponentPrefix?: string;
	/** File to which the formatted result is written. */
	out?: string;
	/** Path to a JSON file containing a {@link CustomFormat}. */
	customPath?: string;
	/** Comma-separated licenses to exclude from the result. */
	excludeLicenses?: string;
	/** Return license-file locations relative to {@link start}. */
	relativeLicensePath?: boolean;
	/** Return module locations relative to {@link start}. */
	relativeModulePath?: boolean;
	/** Format output written via {@link out} as a license-usage summary. */
	summary?: boolean;
	/** Semicolon-separated licenses that cause the check to fail when found. */
	failOn?: string;
	/** Semicolon-separated licenses allowed by the check; any other license causes it to fail. */
	onlyAllow?: string;
	/** Semicolon-separated `package@version` values to include exclusively. */
	includePackages?: string;
	/** Semicolon-separated `package@version` values to exclude. */
	excludePackages?: string;
	/** Exclude packages whose package metadata marks them as private. */
	excludePrivatePackages?: boolean;
	/** Exclude packages whose names start with any of the configured values. */
	excludePackagesStartingWith?: string;
	/**
	 * Dependency traversal limit used by the checker.
	 *
	 * The CLI normalizes its `--direct` and `--depth` arguments to a number in
	 * this property. Boolean values remain supported for compatibility.
	 */
	direct?: boolean | number;
	/**
	 * CLI recursion-depth argument.
	 *
	 * The CLI normalizes this value into {@link direct} before invoking the
	 * checker. Programmatic callers should set {@link direct} instead.
	 */
	depth?: number;
	/** Colorize human-readable output and unknown-license markers. */
	color?: boolean;
	/** Custom output fields and their default values or inclusion toggles. */
	customFormat?: CustomFormat;
	/** Ignore peer dependencies. */
	nopeer?: boolean;
	/** Path to license clarifications for malformed or non-standard packages. */
	clarificationsFile?: string;
	/** Require every supplied clarification to match a package. */
	clarificationsMatchAll?: boolean;
	/** Comma-separated licenses to include exclusively in the result. */
	includeLicenses?: string;
	/** Directory to which individual license files are written. */
	files?: string;
};
/** Information collected for one dependency. */
export type KnownModuleInfo = {
	/** Package name. */
	name?: string;
	/** Package version. */
	version?: string;
	/** Package description. */
	description?: string;
	/** Repository URL. */
	repository?: string;
	/** Publisher or author name. */
	publisher?: string;
	/** Publisher or author email address. */
	email?: string;
	/** Publisher, author, or package URL. */
	url?: string;
	/** Detected license or licenses. */
	licenses?: string | string[];
	/** Path to the license file, when available. */
	licenseFile?: string;
	/** Contents of the license file. */
	licenseText?: string;
	/** Custom value indicating whether the license was modified. */
	licenseModified?: string;
	/** Whether the package is marked as private. */
	private?: boolean;
	/** Path to the installed package. */
	path?: string;
	/** Whether the package path is relative. */
	relativeModulePath?: boolean;
	/** Copyright statement extracted from the license file. */
	copyright?: string;
	/** Path to the package's notice file. */
	noticeFile?: string;
};
/** Information about a dependency, including fields requested through {@link CustomFormat}. */
export type ModuleInfo = KnownModuleInfo & Record<string, string | string[] | boolean | undefined>;
/** Maps each `package@version` identifier to the information collected for that dependency. */
export type ModuleInfos = Record<string, ModuleInfo>;
/**
 * Checks dependency licenses according to the supplied options.
 *
 * @param options - Controls the license checker's behavior.
 * @returns All information collected for the dependencies found by the checker.
 */
export declare function runLicenseCheck(options: LicenseCheckOptions): Promise<ModuleInfos>;
/**
 * Runs the license check for the given args.
 *
 * @param args - Controls the license checker's behavior.
 * @param callback - Called after the checker finishes.
 * @deprecated Will be removed in a future version. Please switch to {@link runLicenseCheck} instead.
 */
export declare const init: (args: LicenseCheckOptions, callback: (err: Error | null, ret: ModuleInfos) => void) => void;
