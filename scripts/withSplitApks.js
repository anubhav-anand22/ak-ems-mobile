const { withAppBuildGradle } = require('expo/config-plugins');

module.exports = function withSplitApks(config) {
  return withAppBuildGradle(config, (config) => {
    const splitsRegex = /splits\s*\{\s*abi\s*\{[\s\S]*?\}\s*\}/;

    const newSplitsBlock = `splits {
        abi {
            reset()
            enable true
            universalApk true
            include "arm64-v8a", "x86_64"
        }
    }`;

    // 1. Inject the splits configuration
    if (config.modResults.contents.match(splitsRegex)) {
      config.modResults.contents = config.modResults.contents.replace(splitsRegex, newSplitsBlock);
    } else {
      config.modResults.contents = config.modResults.contents.replace(
        /android\s*\{/,
        `android {\n    ${newSplitsBlock}`
      );
    }

    // 2. Inject the version code mapper to prevent the IncrementalSplitterRunnable crash
    if (!config.modResults.contents.includes("versionCodeOverride")) {
      config.modResults.contents += `
android.applicationVariants.all { variant ->
    variant.outputs.each { output ->
        def versionCodes = ["armeabi-v7a": 1, "x86": 2, "arm64-v8a": 3, "x86_64": 4]
        def abi = output.getFilter(com.android.build.OutputFile.ABI)
        if (abi != null) {
            output.versionCodeOverride = versionCodes.get(abi) * 1000000 + variant.versionCode
        }
    }
}
`;
    }

    return config;
  });
};

// const { withAppBuildGradle } = require("expo/config-plugins");

// module.exports = function withSplitApks(config) {
//   return withAppBuildGradle(config, (config) => {
//     const splitsRegex = /splits\s*\{\s*abi\s*\{[\s\S]*?\}\s*\}/;

//     // Hardcoding the string literals completely avoids the missing method error.
//     const newSplitsBlock = `splits {
//         abi {
//             reset()
//             enable true
//             universalApk true
//             include "arm64-v8a", "x86_64"
//         }
//     }`;

//     if (config.modResults.contents.match(splitsRegex)) {
//       config.modResults.contents = config.modResults.contents.replace(
//         splitsRegex,
//         newSplitsBlock,
//       );
//     } else {
//       config.modResults.contents = config.modResults.contents.replace(
//         /android\s*\{/,
//         `android {\n    ${newSplitsBlock}`,
//       );
//     }

//     return config;
//   });
// };

// // const { withAppBuildGradle } = require('expo/config-plugins');

// // module.exports = function withSplitApks(config) {
// //   return withAppBuildGradle(config, (config) => {
// //     // 1. Target the entire splits { abi { ... } } block instead of a variable
// //     // that changes formatting across Expo SDK versions.
// //     const splitsRegex = /splits\s*\{\s*abi\s*\{[\s\S]*?\}\s*\}/;

// //     // 2. We enable splits, enable the universal APK, and dynamically pull
// //     // the architectures from your expo-build-properties.
// //     const newSplitsBlock = `splits {
// //         abi {
// //             reset()
// //             enable true
// //             universalApk true
// //             include (*reactNativeArchitectures())
// //         }
// //     }`;

// //     // 3. Replace the block if it exists, or inject it if it doesn't
// //     if (config.modResults.contents.match(splitsRegex)) {
// //       config.modResults.contents = config.modResults.contents.replace(splitsRegex, newSplitsBlock);
// //     } else {
// //       config.modResults.contents = config.modResults.contents.replace(
// //         /android\s*\{/,
// //         `android {\n    ${newSplitsBlock}`
// //       );
// //     }

// //     return config;
// //   });
// // };

// // // const { withAppBuildGradle } = require('expo/config-plugins');

// // // module.exports = function withSplitApks(config) {
// // //   return withAppBuildGradle(config, config => {
// // //     // 1. Enable separate builds per CPU architecture
// // //     config.modResults.contents = config.modResults.contents.replace(
// // //       /def enableSeparateBuildPerCPUArchitecture = false/,
// // //       'def enableSeparateBuildPerCPUArchitecture = true'
// // //     );

// // //     // 2. Force the generation of a Universal APK alongside the splits
// // //     config.modResults.contents = config.modResults.contents.replace(
// // //       /universalApk false/g,
// // //       'universalApk true'
// // //     );

// // //     return config;
// // //   });
// // // };
