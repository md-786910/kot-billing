// Values set by CI at build time. The Android versionCode rises with every build so a new APK
// installs over the previous one; nothing else here is secret or environment-specific
// (each phone gets its server address when it is paired).
module.exports = ({ config }) => ({
  ...config,
  version: process.env.APP_VERSION || config.version,
  android: {
    ...config.android,
    versionCode: Number(process.env.ANDROID_VERSION_CODE) || config.android?.versionCode || 1,
  },
});
