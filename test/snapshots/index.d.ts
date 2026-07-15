export type CustomFormatValue = string | boolean | undefined;
export type CustomFormat = Record<string, CustomFormatValue>;
export type LicenseCheckOptions = {
    start: string;
    production?: boolean;
    development?: boolean;
    unknown?: boolean;
    onlyunknown?: boolean;
    json?: boolean;
    csv?: boolean;
    csvComponentPrefix?: string;
    out?: string;
    customPath?: string;
    excludeLicenses?: string;
    relativeLicensePath?: boolean;
    relativeModulePath?: boolean;
    summary?: boolean;
    failOn?: string;
    onlyAllow?: string;
    includePackages?: string;
    excludePackages?: string;
    excludePrivatePackages?: boolean;
    excludePackagesStartingWith?: string;
    direct?: boolean | number;
    depth?: number;
    color?: boolean;
    customFormat?: CustomFormat;
    nopeer?: boolean;
    clarificationsFile?: string;
    clarificationsMatchAll?: boolean;
    includeLicenses?: string;
    files?: string;
};
export type KnownModuleInfo = {
    name?: string;
    version?: string;
    description?: string;
    repository?: string;
    publisher?: string;
    email?: string;
    url?: string;
    licenses?: string | string[];
    licenseFile?: string;
    licenseText?: string;
    licenseModified?: string;
    private?: boolean;
    path?: string;
    relativeModulePath?: boolean;
    copyright?: string;
    noticeFile?: string;
};
export type ModuleInfo = KnownModuleInfo & Record<string, string | string[] | boolean | undefined>;
export type ModuleInfos = Record<string, ModuleInfo>;
export declare function runLicenseCheck(options: LicenseCheckOptions): Promise<ModuleInfos>;
/**
 * Runs the license check for the given args.
 *
 * @param {LicenseCheckOptions} args Specifies the path to the module to check dependencies of.
 * @param {(err: Error | null, ret: ModuleInfos) => void} callback Called after the checker finished.
 * @deprecated Will be removed in a future version. Please switch to {@link runLicenseCheck} instead.
 */
export declare const init: (args: LicenseCheckOptions, callback: (err: Error | null, ret: ModuleInfos) => void) => void;
