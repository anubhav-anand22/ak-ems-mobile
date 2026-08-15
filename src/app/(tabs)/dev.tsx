import { Link } from "expo-router";
import { StyleSheet, View } from "react-native";
import { Button, Text } from "react-native-paper";

export default function Dev() {
  return (
    <View style={styles.container}>
      <Text>Hello</Text>
      <Link href={"/HelloWidgetPreviewScreen"}>
        <Button>Open widget preview</Button>
      </Link>
      <Link href={"/logScreen"}>
        <Button>Open Log screen</Button>
      </Link>
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
