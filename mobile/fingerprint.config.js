// CI gives every APK a new version and versionCode; leaving them out of the fingerprint keeps the
// runtime version stable, so an over-the-air update reaches every APK with the same native code.
/** @type {import('expo/fingerprint').Config} */
const config = {
  sourceSkips: ['ExpoConfigVersions', 'PackageJsonAndroidAndIosScriptsIfNotContainRun'],
};

module.exports = config;
