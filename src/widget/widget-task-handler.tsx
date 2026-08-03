import React from "react";
import type { WidgetTaskHandlerProps } from "react-native-android-widget";
import { HelloWidget } from "./HelloWidget";
import getWidgetData from "./getWidgetData";
import updateWidget from "./updateWidget";
import Constants from "expo-constants";

const nameToWidget = {
  // Hello will be the **name** with which we will reference our widget.
  Hello: HelloWidget,
};

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const widgetInfo = props.widgetInfo;
  const Widget =
    nameToWidget[widgetInfo.widgetName as keyof typeof nameToWidget];
  const isDev = Constants.expoConfig?.extra?.appEnv === "development";

  console.log({ props });

  async function render() {
    const widgetData = await getWidgetData();
    props.renderWidget(<Widget data={widgetData} info={widgetInfo} isDev={isDev} />);
  }

  switch (props.widgetAction) {
    case "WIDGET_ADDED": {
      await render();
      break;
    }

    case "WIDGET_UPDATE": {
      updateWidget();

      break;
    }
    case "WIDGET_RESIZED": {
      await render();
      break;
    }
    case "WIDGET_DELETED":
      // Not needed for now
      break;

    case "WIDGET_CLICK":
      // Not needed for now
      break;

    default:
      break;
  }
}
