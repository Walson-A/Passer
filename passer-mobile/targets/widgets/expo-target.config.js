/**
 * The widgets: a Home Screen and Lock Screen widget for one chosen action, a
 * Home Screen launch pad, and the Control Center controls (iOS 18). Each one
 * opens Passer on its action, and the app runs it with its own interface.
 *
 * Generated at prebuild by `@bacons/apple-targets`. `_shared/` is compiled into
 * this extension and into the app: a control's intent must exist in both to
 * bring the app forward. Contract with the app: `docs/mobile/extensions.md`.
 *
 * @type {import('@bacons/apple-targets/app.plugin').ConfigFunction}
 */
module.exports = (config) => ({
  type: 'widget',
  name: 'PasserWidgets',
  displayName: 'Passer',
  bundleIdentifier: '.widgets',
  // Widgets run from iOS 17 like the app; the controls are marked iOS 18 in Swift.
  deploymentTarget: '17.0',
  frameworks: ['SwiftUI', 'WidgetKit', 'AppIntents'],
  // The App Group gives the widgets the paired PC's name, and the controls the action inbox.
  entitlements: {
    'com.apple.security.application-groups': config.ios.entitlements['com.apple.security.application-groups'],
  },
});
