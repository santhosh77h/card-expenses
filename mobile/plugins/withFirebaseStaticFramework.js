const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

/**
 * Injects $RNFirebaseAsStaticFramework = true and modular headers
 * for Firebase dependencies into the Podfile, WITHOUT requiring
 * global use_frameworks! (which breaks op-sqlite).
 */
module.exports = function withFirebaseStaticFramework(config) {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        "Podfile"
      );
      let podfile = fs.readFileSync(podfilePath, "utf8");

      // 1. Inject $RNFirebaseAsStaticFramework at the top
      const staticFlag = '$RNFirebaseAsStaticFramework = true';
      if (!podfile.includes(staticFlag)) {
        podfile = staticFlag + "\n" + podfile;
      }

      // 2. Add modular headers for Firebase deps that need it
      const modularHeadersBlock = `
  # Firebase modular headers (required for static framework without use_frameworks!)
  pod 'GoogleUtilities', :modular_headers => true
  pod 'FirebaseCore', :modular_headers => true
  pod 'FirebaseCoreInternal', :modular_headers => true
  pod 'FirebaseInstallations', :modular_headers => true
  pod 'GoogleDataTransport', :modular_headers => true
  pod 'nanopb', :modular_headers => true
  pod 'FirebaseCoreExtension', :modular_headers => true
  pod 'FirebaseSessions', :modular_headers => true
`;

      if (!podfile.includes('GoogleUtilities, :modular_headers')) {
        // Insert after use_native_modules! line
        podfile = podfile.replace(
          /config = use_native_modules!/,
          `config = use_native_modules!\n${modularHeadersBlock}`
        );
      }

      fs.writeFileSync(podfilePath, podfile);
      return config;
    },
  ]);
};
