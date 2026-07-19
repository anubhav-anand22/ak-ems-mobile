import { MD3DarkTheme, MD3LightTheme, MD3Theme } from "react-native-paper";

export type CustomPaperTheme = MD3Theme & {
  colors: MD3Theme["colors"] & {
    customSuccess: string;
    customOnSuccess: string;
    customSuccessContainer: string;
    customOnSuccessContainer: string;
    customError: string;
    customOnError: string;
    customErrorContainer: string;
    customOnErrorContainer: string;
  };
};

export const paperThemeDark: CustomPaperTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    customSuccess: "#81C784",
    customOnSuccess: "#00390D",
    customSuccessContainer: "#1B5E20",
    customOnSuccessContainer: "#C8E6C9",
    customError: "#FFB4AB",
    customOnError: "#690005",
    customErrorContainer: "#93000A",
    customOnErrorContainer: "#FFDAD6",
  },
};

export const paperThemeLight: CustomPaperTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    customSuccess: "#2E7D32",
    customOnSuccess: "#FFFFFF",
    customSuccessContainer: "#C8E6C9",
    customOnSuccessContainer: "#002204",
    customError: "#BA1A1A",
    customOnError: "#FFFFFF",
    customErrorContainer: "#FFDAD6",
    customOnErrorContainer: "#410002",
  },
};
