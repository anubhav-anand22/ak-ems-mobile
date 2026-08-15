import { File } from "expo-file-system";
import { db } from "@/db/dbinit";
import { dbTransaction, TransactionType } from "@/db/schema";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { KVStoreKeyVals } from "./parseInvoicePDF";
import { getDocumentAsync } from "expo-document-picker";
import { log } from "./log";

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

    const transactions = data.transactions as TransactionType[];

    for (const transaction of transactions) {
      await db.insert(dbTransaction).values(transaction);
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

    if (data?.tags) await AsyncStorage.setItem("tags", data.tags);
  } catch (e) {
    console.log(e);
    log.error(e);
  }
}
