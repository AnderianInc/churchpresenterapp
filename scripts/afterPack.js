const { execFileSync } = require('child_process');

/**
 * afterPack hook — ad-hoc code signing for unsigned (private) macOS builds.
 *
 * This is a private, internal app: there is no paid Apple Developer account, so
 * builds are not signed with a Developer ID and not notarized. However, Apple
 * Silicon (M-series) refuses to launch a *completely unsigned* binary at all, so
 * a Developer-ID-less build would be dead on arrival on those Macs.
 *
 * The free fix is an "ad-hoc" signature (`codesign --sign -`): a local,
 * identity-less signature that satisfies the Apple Silicon "must be signed"
 * requirement without any Apple account. It does NOT get past Gatekeeper's
 * quarantine check, so recipients still clear the download flag once:
 *
 *   xattr -dr com.apple.quarantine "/Applications/Church Presenter.app"
 *
 * Why afterPack (not afterSign): electron-builder skips the afterSign hook
 * entirely when no signing occurs ("skipping afterSign hook as no signing
 * occurred"). afterPack always runs, and it runs BEFORE electron-builder's own
 * (skipped) signing step, so our ad-hoc signature is what ends up in the app.
 *
 * When real Apple credentials ARE present, we do nothing here and let
 * electron-builder perform proper Developer ID signing, with notarization
 * handled afterwards by scripts/notarize.js (afterSign).
 */
module.exports = async function afterPack(context) {
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== 'darwin') return;

  // If real signing credentials exist, let electron-builder sign properly.
  const hasAppleCreds =
    process.env.CSC_LINK ||
    (process.env.APPLE_ID && process.env.APPLE_APP_SPECIFIC_PASSWORD && process.env.APPLE_TEAM_ID);
  if (hasAppleCreds) return;

  const appName = context.packager.appInfo.productFilename;
  const appPath = `${appOutDir}/${appName}.app`;

  console.log(`Ad-hoc signing ${appPath} (no Apple credentials — private build)…`);
  // --deep signs nested Electron frameworks/helpers too; acceptable for an
  // ad-hoc local signature (Apple discourages --deep only for distribution
  // signing, which this is not).
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' });
  console.log('Ad-hoc signing complete.');
};
