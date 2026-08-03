import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useColorScheme, Text } from "react-native";
import { MaterialDesignIcons } from "@react-native-vector-icons/material-design-icons";

import { Colors } from "@/constants/theme";

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === "unspecified" ? "light" : scheme];

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.text } }}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require("@/assets/images/tabIcons/home.png")}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="stats">
        <NativeTabs.Trigger.Label>Stats</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          // src={<MaterialDesignIcons name="chart-arc" />}
          md={"data_usage"}
          // renderingMode="template"
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="goals">
        <NativeTabs.Trigger.Label>Goals</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          // src={<MaterialDesignIcons name="chart-arc" />}
          md={"flag"}
          // renderingMode="template"
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="setting">
        <NativeTabs.Trigger.Label>Setting</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md={"settings"} />
      </NativeTabs.Trigger>
      {__DEV__ && (
        <NativeTabs.Trigger name="dev">
          <NativeTabs.Trigger.Label>Dev</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon md={"code"} />
        </NativeTabs.Trigger>
      )}
    </NativeTabs>
  );
}
