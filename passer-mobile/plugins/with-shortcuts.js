const fs = require('fs');
const path = require('path');
const { IOSConfig, withDangerousMod, withInfoPlist, withXcodeProject } = require('expo/config-plugins');

/**
 * Adds the Shortcuts actions (`native/shortcuts`) to the app target.
 *
 * App Intents must be compiled into the app itself: Apple's metadata extraction
 * doesn't see intents in static pods, and App Shortcut phrases are only read from
 * an `AppShortcuts.xcstrings` catalog in the app bundle. The actions reuse the
 * share extension's Swift in `targets/share/_shared`, which `@bacons/apple-targets`
 * already links into the app. See docs/mobile/extensions.md.
 */

const SOURCE = path.join(__dirname, '..', 'native', 'shortcuts');
const GROUP = 'Shortcuts';

function sourceFiles() {
  return fs.readdirSync(SOURCE).filter((name) => /\.(swift|xcstrings)$/.test(name));
}

function withShortcutFiles(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const destination = path.join(config.modRequest.platformProjectRoot, config.modRequest.projectName, GROUP);
      fs.mkdirSync(destination, { recursive: true });
      for (const name of sourceFiles()) {
        fs.copyFileSync(path.join(SOURCE, name), path.join(destination, name));
      }
      return config;
    },
  ]);
}

function withShortcutTarget(config) {
  return withXcodeProject(config, (config) => {
    const project = config.modResults;
    const projectName = config.modRequest.projectName;
    const groupName = `${projectName}/${GROUP}`;

    for (const name of sourceFiles()) {
      const filepath = `${projectName}/${GROUP}/${name}`;
      if (project.hasFile(filepath)) continue;
      if (name.endsWith('.swift')) {
        IOSConfig.XcodeUtils.addBuildSourceFileToGroup({ filepath, groupName, project });
      } else {
        IOSConfig.XcodeUtils.addResourceFileToGroup({ filepath, groupName, project, isBuildFile: true });
      }
    }

    // A String Catalog is only compiled when Xcode knows its type.
    for (const reference of Object.values(project.pbxFileReferenceSection())) {
      if (reference && typeof reference.path === 'string' && reference.path.replace(/"/g, '').endsWith('.xcstrings')) {
        reference.lastKnownFileType = 'text.json.xcstrings';
      }
    }

    // French phrases and titles need French among the project's regions.
    const root = project.pbxProjectSection()[project.getFirstProject().uuid];
    const regions = (root.knownRegions || []).map((region) => String(region).replace(/"/g, ''));
    if (!regions.includes('fr')) root.knownRegions = [...(root.knownRegions || []), 'fr'];

    return config;
  });
}

function withShortcutLocalizations(config) {
  return withInfoPlist(config, (config) => {
    const localizations = new Set(config.modResults.CFBundleLocalizations || []);
    localizations.add('en');
    localizations.add('fr');
    config.modResults.CFBundleLocalizations = [...localizations];
    return config;
  });
}

module.exports = function withShortcuts(config) {
  return withShortcutLocalizations(withShortcutTarget(withShortcutFiles(config)));
};
