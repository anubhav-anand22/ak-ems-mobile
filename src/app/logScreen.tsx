import Seperator from "@/components/ui/Seperator";
import { log, useLogStore } from "@/lib/log";
import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { Dimensions, View } from "react-native";
import { Appbar, Button, Card, Text } from "react-native-paper";

const LogScreen = () => {
  const logs = useLogStore((state) => state.logs);
  const dim = Dimensions.get("window");
  const router = useRouter();

  return (
    <View style={{ flex: 1 }}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Logs" />
        <Appbar.Action icon={"plus"} onPress={() => log.info("Test")} />
      </Appbar.Header>
      <View style={{ flex: 1 }}>
        <FlashList
          contentContainerStyle={{ padding: 10 }}
          ItemSeparatorComponent={Seperator.S10}
          ListEmptyComponent={
            <View
              style={{
                width: dim.width,
                height: dim.height - 200,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Text>No logs yet</Text>
              <Button onPress={() => log.info("Test")}>Text</Button>
            </View>
          }
          ListHeaderComponent={
            <Text
              style={{ fontSize: 24, fontWeight: "bold", marginBottom: 10 }}
            >
              Logs
            </Text>
          }
          ListFooterComponent={<View style={{ width: 10, height: 200 }} />}
          data={logs}
          renderItem={({ item }) => (
            <Card>
              <Card.Content>
                <Text>{item.msg}</Text>
              </Card.Content>
            </Card>
          )}
        />
      </View>
    </View>
  );
};

export default LogScreen;
