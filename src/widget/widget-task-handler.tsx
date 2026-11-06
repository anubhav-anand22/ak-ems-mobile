import React from "react";
import type { WidgetTaskHandlerProps } from "react-native-android-widget";
import updateWidget from "./updateWidget";
import Constants from "expo-constants";
import { getWidget } from "./getWidget";
import { WidgetCall } from "./WidgetCall";

import { WidgetName } from "./widgetRegistry";

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const widgetInfo = props.widgetInfo;
  const widgetName = widgetInfo.widgetName as WidgetName;
  const widget = await getWidget(widgetName);

  if (!widget) {
    console.warn(`Unknown widget name: ${widgetInfo.widgetName}`);
    return;
  }

  const isDev = Constants.expoConfig?.extra?.appEnv === "development";

  async function render() {
    const data = await widget.getData();
    props.renderWidget(
      <WidgetCall data={data} info={widgetInfo} isDev={isDev} />,
    );
  }

  switch (props.widgetAction) {
    case "WIDGET_ADDED":
    case "WIDGET_RESIZED": {
      await render();
      break;
    }

    case "WIDGET_UPDATE": {
      await updateWidget(true, widgetName);
      break;
    }

    case "WIDGET_DELETED":
      // Not needed for now
      break;

    case "WIDGET_CLICK":
      break;

    default:
      break;
  }
}
