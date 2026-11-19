import React from "react";
import { View } from "react-native";
import { Appbar } from "react-native-paper";
import { useRouter } from "expo-router";
import { PdfParserTest } from "@/components/pdf/PdfParserTest";

export default function PdfParserTestScreen() {
  const router = useRouter();

  return (
    <View style={{ flex: 1 }}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="PDF Parser Test" />
      </Appbar.Header>
      <PdfParserTest />
    </View>
  );
}
