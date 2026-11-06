import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { requestWidgetUpdate } from "react-native-android-widget";
import { getWidget } from "./getWidget";
import { WidgetCall } from "./WidgetCall";
import { widgetRegistry, WidgetName } from "./widgetRegistry";

const updateWidget = async (ignoreDirty = false, widgetName?: WidgetName) => {
  if (!ignoreDirty) {
    const isDataDirty = await AsyncStorage.getItem("IS_WIDGET_DATA_DIRTY");

    if (isDataDirty !== "true") return;
  }
  await AsyncStorage.setItem("IS_WIDGET_DATA_DIRTY", "false");

  const isDev = Constants.expoConfig?.extra?.appEnv === "development";
  const targets: WidgetName[] = widgetName
    ? [widgetName]
    : (Object.keys(widgetRegistry) as WidgetName[]);

  for (const name of targets) {
    try {
      const widget = await getWidget(name);
      if (!widget) continue;
      const data = await widget.getData();

      await requestWidgetUpdate({
        widgetName: name,
        renderWidget: (info) => (
          <WidgetCall data={data} info={info} isDev={isDev} />
        ),
      });
    } catch (e) {
      console.error(`Failed to update widget: ${name}`, e);
    }
  }
};

export const setWidgetDataDirty = async () => {
  await AsyncStorage.setItem("IS_WIDGET_DATA_DIRTY", "true");
};

export default updateWidget;
