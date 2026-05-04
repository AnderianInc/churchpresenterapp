const { notarize } = require('@electron/notarize');

module.exports = async function afterSign(context) {
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== 'darwin') return;

  // Skip if Apple credentials are not configured (e.g. unsigned development builds)
  if (!process.env.APPLE_ID || !process.env.APPLE_APP_SPECIFIC_PASSWORD || !process.env.APPLE_TEAM_ID) {
    console.log('Skipping notarization: Apple credentials not set.');
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = `${appOutDir}/${appName}.app`;

  console.log(`Notarizing ${appPath}…`);
  await notarize({
    tool: 'notarytool',
    appBundleId: 'com.church.churchpresenter',
    appPath,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
    teamId: process.env.APPLE_TEAM_ID,
  });
  console.log('Notarization complete.');
};
