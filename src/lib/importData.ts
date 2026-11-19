import { File } from "expo-file-system";
import { insertTransactions, TransactionType } from "@/db";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { KVStoreKeyVals } from "./parseInvoicePDF";
import { getDocumentAsync } from "expo-document-picker";
import { log } from "./log";
import ReactiveKVStore from "./reactiveKV";

export async function importData() {
  try {
    const result = await getDocumentAsync({
      type: "application/json",
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled) return;

    const uri = result?.assets[0]?.uri;

    if (!uri) return;

    const file = new File(uri);
    const content = await file.text();
    const data = JSON.parse(content);

    const transactions = data.transactions as any[];

    if (Array.isArray(transactions)) {
      try {
        await insertTransactions(transactions);
      } catch (insertError) {
        log.error("Failed to import individual transaction", insertError);
      }
    }

    if (data?.grokApiKey)
      await AsyncStorage.setItem(
        KVStoreKeyVals.GROK_API_KEY.key,
        data.grokApiKey,
      );

    if (data?.parseMode)
      await AsyncStorage.setItem(KVStoreKeyVals.PARSE_MODE.key, data.parseMode);

    if (data?.sendTxSmsContacts)
      await AsyncStorage.setItem(
        KVStoreKeyVals.SEND_TX_SMS_CONTACTS.key,
        data.sendTxSmsContacts,
      );

    if (data?.sendTxSmsContactsEnabled)
      await AsyncStorage.setItem(
        KVStoreKeyVals.SEND_TX_SMS_CONTACTS_ENABLED.key,
        data.sendTxSmsContactsEnabled,
      );

    if (data?.tags) {
      await AsyncStorage.setItem("tags", typeof data.tags === "string" ? data.tags : JSON.stringify(data.tags));
      try {
        const parsedTags = typeof data.tags === "string" ? JSON.parse(data.tags) : data.tags;
        if (Array.isArray(parsedTags)) {
          ReactiveKVStore.useReactiveKVStore.getState().addTags(parsedTags);
        }
      } catch (err) {
        log.error("Failed to parse tags during import", err);
      }
    }
  } catch (e) {
    console.log(e);
    log.error(e);
  }
}
