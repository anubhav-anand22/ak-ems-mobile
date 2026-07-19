import { View } from "react-native";
import { Icon, Portal, Snackbar, Text, useTheme } from "react-native-paper";

import { useGlobalState } from "../../lib/gState";

export default function GlobalSnackbar() {
  const snackbar = useGlobalState((state) => state.snackbar);
  const dismissSnackbar = useGlobalState((state) => state.dismissSnackbar);
  console.log(snackbar);

  const theme = useTheme();

  const colors = {
    success: {
      bg: "#2E7D32",
      txt: "#fff",
      icon: "check-circle",
    },
    error: {
      bg: "#D32F2F",
      txt: "#fff",
      icon: "close-octagon-outline",
    },
    warning: {
      bg: "#ED6C02",
      txt: "#fff",
      icon: "alert",
    },
    info: {
      bg: theme.colors.surface,
      txt: theme.colors.inverseSurface,
      icon: undefined,
    },
  };

  const snackbarColors = colors[snackbar?.type || "info"];

  return (
    <Portal>
      <Snackbar
        visible={snackbar?.visible ?? false}
        onDismiss={dismissSnackbar}
        // icon={snackbar?.icon ?? snackbarColors.icon}
        icon="close"
        onIconPress={snackbar?.onIconPress}
        duration={snackbar?.duration}
        style={{
          backgroundColor: snackbarColors.bg,
        }}
        action={
          snackbar?.action === "dismiss"
            ? { label: "Dismiss", onPress: dismissSnackbar, textColor: "#fff" }
            : snackbar?.action
        }
        theme={{
          colors: {
            inverseOnSurface: snackbarColors.txt,
          },
        }}
      >
        <View style={{flexDirection: "row", gap: 7, alignItems: "center"}}>
          <Icon source={snackbarColors.icon} size={24} />
          <Text>{snackbar?.message}</Text>
        </View>
      </Snackbar>
    </Portal>
  );
}
