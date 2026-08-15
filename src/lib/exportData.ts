import { StorageAccessFramework } from "expo-file-system/legacy";
import { File, EncodingType } from "expo-file-system";
import { db } from "@/db/dbinit";
import { dbTransaction } from "@/db/schema";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { KVStoreKeyVals } from "./parseInvoicePDF";
import Constants from "expo-constants";
import { log } from "./log";

export const exportData = async (): Promise<{ errMsg?: string } | void> => {
  try {
    const fileName = `ak-ems-backup-${new Date().toISOString()}.json`;

    const transactions = await db.select().from(dbTransaction);
    const grokApiKey = await AsyncStorage.getItem(
      KVStoreKeyVals.GROK_API_KEY.key,
    );
    const parseMode = await AsyncStorage.getItem(KVStoreKeyVals.PARSE_MODE.key);
    const sendTxSmsContacts = await AsyncStorage.getItem(
      KVStoreKeyVals.SEND_TX_SMS_CONTACTS.key,
    );
    const sendTxSmsContactsEnabled = await AsyncStorage.getItem(
      KVStoreKeyVals.SEND_TX_SMS_CONTACTS_ENABLED.key,
    );
    const tags = await AsyncStorage.getItem("tags");

    const version = Constants.expoConfig?.version;

    const exportObj = {
      timestamp: new Date().toISOString(),
      transactions,
      grokApiKey,
      parseMode,
      sendTxSmsContacts,
      sendTxSmsContactsEnabled,
      tags,
      version,
    };

    const jsonString = JSON.stringify(exportObj);

    const permissions =
      await StorageAccessFramework.requestDirectoryPermissionsAsync();

    if (permissions.granted) {
      // 2. Create the file in the chosen directory
      const fileUri = await StorageAccessFramework.createFileAsync(
        permissions.directoryUri,
        fileName,
        "application/json",
      );

      const file = new File(fileUri);
      file.write(jsonString, { encoding: EncodingType.UTF8 });
    } else {
      return { errMsg: "Cancelled" };
    }
  } catch (error) {
    console.error("Error saving file:", error);
    log.error(error);
    return { errMsg: "Error" };
  }
};
