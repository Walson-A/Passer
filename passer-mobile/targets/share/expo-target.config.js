/**
 * The share extension: choosing Passer in the share sheet sends what is shared
 * straight to the PC, without opening the app.
 *
 * Generated at prebuild by `@bacons/apple-targets`. The Swift sources live in this
 * folder. `_shared/` is compiled into this extension and into the app, where the
 * Shortcuts actions use it too. Contract with the app: `docs/mobile/extensions.md`.
 *
 * @type {import('@bacons/apple-targets/app.plugin').ConfigFunction}
 */
module.exports = (config) => ({
  type: 'share',
  name: 'PasserShare',
  displayName: 'Passer',
  bundleIdentifier: '.share',
  // apple-targets defaults to 18.0; the app itself runs from iOS 16.4.
  deploymentTarget: '16.4',
  frameworks: ['SwiftUI', 'UniformTypeIdentifiers', 'ImageIO'],
  // The App Group gives the extension the paired PCs and the keychain group holding the token.
  entitlements: {
    'com.apple.security.application-groups': config.ios.entitlements['com.apple.security.application-groups'],
  },
});
