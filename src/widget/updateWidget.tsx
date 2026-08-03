import { requestWidgetUpdate } from "react-native-android-widget";
import { HelloWidget } from "./HelloWidget";
import getWidgetData from "./getWidgetData";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

const updateWidget = async () => {
  const isDataDirty = await AsyncStorage.getItem("IS_WIDGET_DATA_DIRTY");

  if (isDataDirty !== "true") return;
  await AsyncStorage.setItem("IS_WIDGET_DATA_DIRTY", "false");

  const data = await getWidgetData();
  const isDev = Constants.expoConfig?.extra?.appEnv === "development";
  await requestWidgetUpdate({
    widgetName: "Hello",
    renderWidget: (info) => <HelloWidget data={data} info={info} isDev={isDev} />,
  });
};

export const setWidgetDataDirty = async () => {
  await AsyncStorage.setItem("IS_WIDGET_DATA_DIRTY", "true");
};

export default updateWidget;
