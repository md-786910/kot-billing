// Values set by CI at build time. The Android versionCode rises with every build so a new APK
// installs over the previous one; nothing else here is secret or environment-specific.
//
// Over-the-air updates (EAS Update) switch on once app.json has extra.eas.projectId
// (run `npx eas-cli init` once). Each APK then downloads new JS on launch and runs it on the
// next start. Updates only reach APKs with the same native code (fingerprint runtime version);
// native changes still need a new APK.
module.exports = ({ config }) => {
  const projectId = config.extra?.eas?.projectId;
  return {
    ...config,
    version: process.env.APP_VERSION || config.version,
    android: {
      ...config.android,
      versionCode: Number(process.env.ANDROID_VERSION_CODE) || config.android?.versionCode || 1,
    },
    runtimeVersion: { policy: 'fingerprint' },
    updates: projectId
      ? {
          url: `https://u.expo.dev/${projectId}`,
          // APKs are built by Gradle in CI, not EAS Build, so the channel is set here
          requestHeaders: { 'expo-channel-name': 'production' },
          checkAutomatically: 'ON_LOAD',
          fallbackToCacheTimeout: 0,
        }
      : { enabled: false },
  };
};
