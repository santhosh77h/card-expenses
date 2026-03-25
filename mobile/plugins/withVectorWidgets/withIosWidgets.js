const {
  withXcodeProject,
  withEntitlementsPlist,
  withInfoPlist,
  IOSConfig,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const WIDGET_EXTENSION_NAME = 'VectorWidgets';
const WIDGET_BUNDLE_ID = 'com.cardlytics.app.widgets';
const APP_GROUP_ID = 'group.com.cardlytics.app';
const DEPLOYMENT_TARGET = '15.0';

// ---------------------------------------------------------------------------
// 1. Add App Group entitlement to main app
// ---------------------------------------------------------------------------

function withAppGroupEntitlement(config) {
  return withEntitlementsPlist(config, (mod) => {
    mod.modResults['com.apple.security.application-groups'] = [APP_GROUP_ID];
    return mod;
  });
}

// ---------------------------------------------------------------------------
// 2. Add widget extension target to Xcode project
// ---------------------------------------------------------------------------

function withWidgetExtensionTarget(config) {
  return withXcodeProject(config, async (mod) => {
    const xcodeProject = mod.modResults;
    const templateDir = path.resolve(__dirname, 'ios');
    const projectRoot = mod.modRequest.projectRoot;
    const iosDir = path.join(projectRoot, 'ios');
    const widgetDir = path.join(iosDir, WIDGET_EXTENSION_NAME);

    // Create widget extension directory
    if (!fs.existsSync(widgetDir)) {
      fs.mkdirSync(widgetDir, { recursive: true });
    }

    // Copy Swift source files
    const swiftFiles = [
      'VectorWidgets.swift',
      'WidgetDataProvider.swift',
      'Models.swift',
      'UploadWidget.swift',
      'SpendingSummaryWidget.swift',
      'CategoryDonutWidget.swift',
    ];

    for (const file of swiftFiles) {
      const src = path.join(templateDir, file);
      const dest = path.join(widgetDir, file);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
      }
    }

    // Copy entitlements
    const entitlementsSrc = path.join(templateDir, 'VectorWidgets.entitlements');
    const entitlementsDest = path.join(widgetDir, `${WIDGET_EXTENSION_NAME}.entitlements`);
    if (fs.existsSync(entitlementsSrc)) {
      fs.copyFileSync(entitlementsSrc, entitlementsDest);
    }

    // Copy Info.plist — also copy with Xcode's default naming convention
    const plistSrc = path.join(templateDir, 'Info.plist');
    const plistDest = path.join(widgetDir, 'Info.plist');
    const plistDestAlt = path.join(widgetDir, `${WIDGET_EXTENSION_NAME}-Info.plist`);
    if (fs.existsSync(plistSrc)) {
      fs.copyFileSync(plistSrc, plistDest);
      fs.copyFileSync(plistSrc, plistDestAlt);
    }

    // Copy native bridge files to main app
    const mainAppDir = path.join(iosDir, mod.modRequest.projectName || 'VectorExpense');
    const bridgeSwiftSrc = path.join(templateDir, 'VectorWidgetBridge.swift');
    const bridgeObjcSrc = path.join(templateDir, 'VectorWidgetBridge.m');
    if (fs.existsSync(bridgeSwiftSrc)) {
      fs.copyFileSync(bridgeSwiftSrc, path.join(mainAppDir, 'VectorWidgetBridge.swift'));
    }
    if (fs.existsSync(bridgeObjcSrc)) {
      fs.copyFileSync(bridgeObjcSrc, path.join(mainAppDir, 'VectorWidgetBridge.m'));
    }

    // --- Xcode project modifications ---

    // Check if widget target already exists
    const existingTarget = xcodeProject.pbxTargetByName(WIDGET_EXTENSION_NAME);
    if (existingTarget) {
      return mod;
    }

    // Add widget extension target
    const targetUuid = xcodeProject.generateUuid();
    const targetProductUuid = xcodeProject.generateUuid();

    // Create PBX group for widget files
    const widgetGroupKey = xcodeProject.pbxCreateGroup(WIDGET_EXTENSION_NAME, WIDGET_EXTENSION_NAME);

    // Add files to the widget group
    const allWidgetFiles = [
      ...swiftFiles,
      `${WIDGET_EXTENSION_NAME}.entitlements`,
      'Info.plist',
    ];

    // Add native target for widget extension
    const target = xcodeProject.addTarget(
      WIDGET_EXTENSION_NAME,
      'app_extension',
      WIDGET_EXTENSION_NAME,
      WIDGET_BUNDLE_ID
    );

    if (target) {
      // Add source files to the extension target
      for (const file of swiftFiles) {
        const filePath = `${WIDGET_EXTENSION_NAME}/${file}`;
        xcodeProject.addSourceFile(
          filePath,
          { target: target.uuid },
          widgetGroupKey
        );
      }

      // Set build settings for the widget target
      // Find the config list for this target, then update each config
      const targetObj = xcodeProject.pbxNativeTargetSection()[target.uuid];
      const configListId = targetObj ? targetObj.buildConfigurationList : null;
      const configLists = xcodeProject.pbxXCConfigurationList();
      const configurations = xcodeProject.pbxXCBuildConfigurationSection();

      // Collect config IDs belonging to the widget target
      const widgetConfigIds = new Set();
      if (configListId && configLists[configListId]) {
        const buildConfigs = configLists[configListId].buildConfigurations;
        if (buildConfigs) {
          for (const bc of buildConfigs) {
            widgetConfigIds.add(bc.value);
          }
        }
      }

      for (const key in configurations) {
        // Skip comment entries (strings)
        if (typeof configurations[key] !== 'object') continue;
        const cfg = configurations[key];
        if (!cfg || !cfg.buildSettings) continue;

        // Match by config list membership, or fallback to bundle ID match
        const isWidgetConfig = widgetConfigIds.has(key) ||
          (cfg.buildSettings.PRODUCT_BUNDLE_IDENTIFIER &&
           cfg.buildSettings.PRODUCT_BUNDLE_IDENTIFIER.replace(/"/g, '') === WIDGET_BUNDLE_ID);

        if (isWidgetConfig) {
          cfg.buildSettings.SWIFT_VERSION = '5.0';
          cfg.buildSettings.IPHONEOS_DEPLOYMENT_TARGET = DEPLOYMENT_TARGET;
          cfg.buildSettings.CODE_SIGN_ENTITLEMENTS = `"${WIDGET_EXTENSION_NAME}/${WIDGET_EXTENSION_NAME}.entitlements"`;
          cfg.buildSettings.INFOPLIST_FILE = `"${WIDGET_EXTENSION_NAME}/${WIDGET_EXTENSION_NAME}-Info.plist"`;
          cfg.buildSettings.LD_RUNPATH_SEARCH_PATHS = '"$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks"';
          cfg.buildSettings.TARGETED_DEVICE_FAMILY = '"1,2"';
          cfg.buildSettings.MARKETING_VERSION = '1.0';
          cfg.buildSettings.CURRENT_PROJECT_VERSION = '1';
          cfg.buildSettings.GENERATE_INFOPLIST_FILE = 'NO';
          cfg.buildSettings.PRODUCT_BUNDLE_IDENTIFIER = `"${WIDGET_BUNDLE_ID}"`;
          cfg.buildSettings.DEVELOPMENT_TEAM = '6BCFGQHZBT';
          cfg.buildSettings.CODE_SIGN_STYLE = 'Automatic';
          cfg.buildSettings.CODE_SIGN_IDENTITY = '"Apple Development"';
        }
      }

      // Add WidgetKit and SwiftUI frameworks to the extension target
      xcodeProject.addFramework('WidgetKit.framework', {
        target: target.uuid,
        link: true,
      });
      xcodeProject.addFramework('SwiftUI.framework', {
        target: target.uuid,
        link: true,
      });

      // Embed the extension in the main app
      const mainTarget = xcodeProject.getFirstTarget();
      if (mainTarget) {
        // Add embed extensions build phase if not present
        xcodeProject.addBuildPhase(
          [],
          'PBXCopyFilesBuildPhase',
          'Embed App Extensions',
          mainTarget.firstTarget.uuid,
          'app_extension'
        );
      }
    }

    // Add native bridge files to main app target
    const mainAppTarget = xcodeProject.getFirstTarget();
    if (mainAppTarget) {
      const mainGroupKey = xcodeProject.findPBXGroupKey({ name: mod.modRequest.projectName || 'VectorExpense' });
      if (mainGroupKey) {
        xcodeProject.addSourceFile(
          `${mod.modRequest.projectName || 'VectorExpense'}/VectorWidgetBridge.swift`,
          { target: mainAppTarget.firstTarget.uuid },
          mainGroupKey
        );
        xcodeProject.addSourceFile(
          `${mod.modRequest.projectName || 'VectorExpense'}/VectorWidgetBridge.m`,
          { target: mainAppTarget.firstTarget.uuid },
          mainGroupKey
        );
      }
    }

    return mod;
  });
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

module.exports = function withIosWidgets(config) {
  config = withAppGroupEntitlement(config);
  config = withWidgetExtensionTarget(config);
  return config;
};
