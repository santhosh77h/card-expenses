const {
  withAndroidManifest,
  withMainApplication,
  withDangerousMod,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const PACKAGE_NAME = 'com.cardlytics.app';
const WIDGET_PACKAGE = 'com.cardlytics.app.widget';

// ---------------------------------------------------------------------------
// 1. Add widget receivers to AndroidManifest.xml
// ---------------------------------------------------------------------------

function withWidgetReceivers(config) {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults;
    const application = manifest.manifest.application?.[0];
    if (!application) return mod;

    if (!application.receiver) {
      application.receiver = [];
    }

    const receivers = [
      {
        name: `${WIDGET_PACKAGE}.UploadWidgetProvider`,
        meta: 'upload_widget_info',
        label: 'Quick Upload',
      },
      {
        name: `${WIDGET_PACKAGE}.SpendingSummaryWidgetProvider`,
        meta: 'spending_widget_info',
        label: 'Spending Summary',
      },
      {
        name: `${WIDGET_PACKAGE}.CategoryDonutWidgetProvider`,
        meta: 'donut_widget_info',
        label: 'Category Breakdown',
      },
    ];

    for (const rec of receivers) {
      // Skip if already added
      const exists = application.receiver.some(
        (r) => r.$?.['android:name'] === rec.name
      );
      if (exists) continue;

      application.receiver.push({
        $: {
          'android:name': rec.name,
          'android:label': rec.label,
          'android:exported': 'true',
        },
        'intent-filter': [
          {
            action: [
              {
                $: {
                  'android:name': 'android.appwidget.action.APPWIDGET_UPDATE',
                },
              },
            ],
          },
        ],
        'meta-data': [
          {
            $: {
              'android:name': 'android.appwidget.provider',
              'android:resource': `@xml/${rec.meta}`,
            },
          },
        ],
      });
    }

    return mod;
  });
}

// ---------------------------------------------------------------------------
// 2. Register the native module package in MainApplication
// ---------------------------------------------------------------------------

function withWidgetBridgePackage(config) {
  return withMainApplication(config, (mod) => {
    const contents = mod.modResults.contents;

    // Add import
    const importLine = `import ${WIDGET_PACKAGE}.VectorWidgetBridgePackage`;
    if (!contents.includes(importLine)) {
      mod.modResults.contents = contents.replace(
        /(import .*\n)(?!.*import)/,
        `$1${importLine}\n`
      );
    }

    // Add to getPackages()
    const packageLine = 'packages.add(VectorWidgetBridgePackage())';
    if (!mod.modResults.contents.includes('VectorWidgetBridgePackage')) {
      mod.modResults.contents = mod.modResults.contents.replace(
        /(packages\.add\(new .+\(\)\))/,
        `$1\n            ${packageLine}`
      );
    }

    return mod;
  });
}

// ---------------------------------------------------------------------------
// 3. Copy Kotlin + resource files into the Android project
// ---------------------------------------------------------------------------

function withWidgetSourceFiles(config) {
  return withDangerousMod(config, [
    'android',
    async (mod) => {
      const projectRoot = mod.modRequest.projectRoot;
      const androidDir = path.join(projectRoot, 'android');
      const templateDir = path.resolve(__dirname, 'android');

      // Kotlin source destination
      const kotlinDest = path.join(
        androidDir,
        'app/src/main/java/com/cardlytics/app/widget'
      );

      // Resource destination
      const resDest = path.join(androidDir, 'app/src/main/res');

      // Copy Kotlin files
      const kotlinDir = path.join(templateDir, 'widget');
      if (fs.existsSync(kotlinDir)) {
        fs.mkdirSync(kotlinDest, { recursive: true });
        const kotlinFiles = fs.readdirSync(kotlinDir).filter((f) => f.endsWith('.kt'));
        for (const file of kotlinFiles) {
          fs.copyFileSync(
            path.join(kotlinDir, file),
            path.join(kotlinDest, file)
          );
        }
      }

      // Copy resource directories
      const resDir = path.join(templateDir, 'res');
      if (fs.existsSync(resDir)) {
        const subDirs = ['layout', 'xml', 'drawable'];
        for (const sub of subDirs) {
          const srcSub = path.join(resDir, sub);
          const destSub = path.join(resDest, sub);
          if (!fs.existsSync(srcSub)) continue;
          fs.mkdirSync(destSub, { recursive: true });
          for (const file of fs.readdirSync(srcSub)) {
            fs.copyFileSync(
              path.join(srcSub, file),
              path.join(destSub, file)
            );
          }
        }
      }

      // Add string resources for widget descriptions
      const valuesDir = path.join(resDest, 'values');
      fs.mkdirSync(valuesDir, { recursive: true });
      const stringsFile = path.join(valuesDir, 'widget_strings.xml');
      if (!fs.existsSync(stringsFile)) {
        fs.writeFileSync(
          stringsFile,
          `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="widget_upload_description">Upload a PDF statement or scan with camera</string>
    <string name="widget_spending_description">See your monthly spending at a glance</string>
    <string name="widget_donut_description">Donut chart of your spending by category</string>
</resources>
`
        );
      }

      return mod;
    },
  ]);
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

module.exports = function withAndroidWidgets(config) {
  config = withWidgetReceivers(config);
  config = withWidgetBridgePackage(config);
  config = withWidgetSourceFiles(config);
  return config;
};
