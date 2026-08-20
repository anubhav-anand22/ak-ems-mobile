import { ExpoConfig, ConfigContext } from "expo/config";
import { version } from "./package.json";

export default ({ config }: ConfigContext): ExpoConfig => {
  const isDev = process.env.APP_ENV === "development";

  const androidPackage = isDev
    ? "com.ak22git7488.akemsmobile.dev"
    : "com.ak22git7488.akemsmobile";

  const iosBundleIdentifier = isDev
    ? "com.ak22git7488.akemsmobile.dev"
    : "com.ak22git7488.akemsmobile";

  return {
    ...config,

    name: isDev ? "AK EMS Mobile Dev" : "AK EMS Mobile",
    slug: "ak-ems-mobile",
    version,

    orientation: "portrait",
    icon: "./assets/images/icon.png",

    scheme: isDev ? "akemsmobile-dev" : "akemsmobile",

    userInterfaceStyle: "automatic",

    ios: {
      icon: "./assets/expo.icon",
      bundleIdentifier: iosBundleIdentifier,
    },

    android: {
      adaptiveIcon: {
        backgroundColor: "#E6F4FE",
        foregroundImage: "./assets/images/android-icon-foreground.png",
        backgroundImage: "./assets/images/android-icon-background.png",
        monochromeImage: "./assets/images/android-icon-monochrome.png",
      },

      permissions: [
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.SEND_SMS",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_BACKGROUND_LOCATION",
        "android.permission.WAKE_LOCK",
      ],

      predictiveBackGestureEnabled: false,

      package: androidPackage,

      intentFilters: [
        {
          action: "SEND",
          data: [
            {
              mimeType: "application/pdf",
            },
          ],
          category: ["DEFAULT"],
        },
        {
          action: "VIEW",
          category: ["DEFAULT", "BROWSABLE"],
          data: [
            { scheme: "content", mimeType: "application/pdf" },
            { scheme: "file", mimeType: "application/pdf" },
          ],
        },
      ],
    },

    web: {
      output: "static",
      favicon: "./assets/images/favicon.png",
    },

    plugins: [
      "expo-router",

      [
        "expo-splash-screen",
        {
          backgroundColor: "#208AEF",
          image: "./assets/images/splash-icon.png",
          imageWidth: 76,
        },
      ],

      "expo-secure-store",
      "expo-background-task",
      "expo-sharing",
      "expo-sqlite",
      "expo-widgets",

      [
        "react-native-android-widget",
        {
          fonts: ["./assets/fonts/Inter.ttf"],

          widgets: [
            {
              name: "Hello",
              label: "Expense Tracker",
              minWidth: "110dp",
              minHeight: "70dp",
              targetCellWidth: 4,
              targetCellHeight: 2,
              resizeMode: "horizontal|vertical",
              description: "Expense Tracker for tracking your expenses",
              previewImage: "./assets/hello.png",
              updatePeriodMillis: 1800000,
            },
          ],
        },
      ],

      [
        "expo-build-properties",
        {
          android: {
            buildArchs: ["arm64-v8a", "x86_64"],
            extraGradleProperties: {
              "org.gradle.jvmargs": "-Xmx4096m -XX:MaxMetaspaceSize=1024m",
            },
          },
        },
      ],
      "@maplibre/maplibre-react-native",
      "./scripts/withDisableLint.js",
      "./scripts/withSplitApks.js",
    ],

    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },

    extra: {
      router: {},

      eas: {
        projectId: "cebda3ce-15a0-4b79-a427-5945013ea8cd",
      },

      appEnv: isDev ? "development" : "production",
    },
    // updates: {
    //   url: "https://u.expo.dev/cebda3ce-15a0-4b79-a427-5945013ea8cd",
    // },
    runtimeVersion: {
      policy: "appVersion",
    },
  };
};
