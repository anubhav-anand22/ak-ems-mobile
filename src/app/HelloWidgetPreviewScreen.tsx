import * as React from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import { WidgetPreview } from "react-native-android-widget";

import { HelloWidget } from "@/widget/HelloWidget";
import getWidgetData, { WidgetData } from "@/widget/getWidgetData";
import { Button } from "react-native-paper";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { KVStoreKeyVals } from "@/lib/parseInvoicePDF";
import { widgetThemes } from "@/constants/widgetTheme";

export default function HelloWidgetPreviewScreen() {
  const [data, setData] = React.useState<WidgetData | null>(null);
  const [key, setKey] = React.useState<number>(0);
  const [widgetThemeIndex, setWidgetThemeIndex] = React.useState(0);

  const dim = Dimensions.get("window");

  const fetchData = async () => {
    const result = await getWidgetData();
    setData(result);
    const themeIndex = await AsyncStorage.getItem(
      KVStoreKeyVals.WIDGET_THEME.key,
    );
    setWidgetThemeIndex(Number(themeIndex) ?? 0);
  };

  React.useEffect(() => {
    fetchData();
  }, []);

  const renderWidget = React.useCallback(() => {
    if (!data)
      return (
        <HelloWidget
          data={{
            isDarkMode: false,
            transactions: [],
            totalSpendAndReceive: { spend: 0, recive: 0 },
            widgetTheme: widgetThemes[widgetThemeIndex],
          }}
        />
      );
    return <HelloWidget data={data} />;
  }, [data, key, widgetThemes]);

  return (
    <View style={styles.container}>
      {data && renderWidget ? (
        <WidgetPreview
          key={`widget-preview-${key}`}
          renderWidget={renderWidget}
          width={dim.width - 40}
          height={dim.width - 100}
        />
      ) : null}
      <Button
        onPress={() => {
          setKey(key + 1);
        }}
      >
        Refresh
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
