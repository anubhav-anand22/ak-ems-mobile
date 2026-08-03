import { KVStoreKeyVals } from "@/lib/parseInvoicePDF";
import { validateGrokApiKey } from "@/lib/validateGrokApiKey";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Appbar, HelperText, TextInput } from "react-native-paper";
import { Dropdown } from "react-native-paper-dropdown";

const SettingsScreen = () => {
  const [grokApiKey, setGrokApiKey] = useState("");
  const [isGrokApiKeySaved, setIsGrokApiKeySaved] = useState(true);
  const [isGrokApiKeyShow, setIsGrokApiKeyShow] = useState(false);
  const [isGrokApiKeyValid, setIsGrokApiKeyValid] = useState(true);
  const [isGrokApiKeyChecking, setIsGrokApiKeyChecking] = useState(false);

  const [invoiceParseMode, setInvoiceParseMode] = useState<
    null | (typeof KVStoreKeyVals.PARSE_MODE.vals)[number]
  >(null);

  useEffect(() => {
    AsyncStorage.getItem(KVStoreKeyVals.GROK_API_KEY.key).then((value) => {
      if (value) setGrokApiKey(value);
      setIsGrokApiKeySaved(!!value);
    });
    AsyncStorage.getItem(KVStoreKeyVals.PARSE_MODE.key).then((value) => {
      if (value)
        setInvoiceParseMode(
          value as (typeof KVStoreKeyVals.PARSE_MODE.vals)[number],
        );
    });
  }, []);

  return (
    <View>
      <Appbar.Header>
        <Appbar.Content title="Settings" />
      </Appbar.Header>
      <View style={{ padding: 10, gap: 10 }}>
        <TextInput
          label={`Grok API Key${isGrokApiKeySaved ? " (saved)" : " (not saved)"}`}
          mode="outlined"
          value={grokApiKey}
          secureTextEntry={!isGrokApiKeyShow}
          onChangeText={(text) => {
            setGrokApiKey(text);
            setIsGrokApiKeySaved(false);
          }}

          onSubmitEditing={() => {
            const key = grokApiKey.trim().replace(/\n/g, "");
            if (!isGrokApiKeySaved) {
              setIsGrokApiKeyChecking(true);
              validateGrokApiKey(key)
                .then((result) => {
                  console.log({ result });
                  if (result === null) return;
                  setIsGrokApiKeyValid(result);
                  setIsGrokApiKeyChecking(false);
                })
                .catch(() => {
                  setIsGrokApiKeyValid(false);
                })
                .finally(() => {
                  setIsGrokApiKeyChecking(false);
                });
            }

            AsyncStorage.setItem(KVStoreKeyVals.GROK_API_KEY.key, key);

            setIsGrokApiKeySaved(true);
          }}
          right={
            <TextInput.Icon
              icon={isGrokApiKeyShow ? "eye" : "eye-off"}
              onPress={() => setIsGrokApiKeyShow(!isGrokApiKeyShow)}
              loading={isGrokApiKeyChecking}
            />
          }
          error={!isGrokApiKeyValid}
        />
        {isGrokApiKeyValid ? null : (
          <HelperText type="error" visible>
            Grok API Key is not valid
          </HelperText>
        )}
        <Dropdown
        hideMenuHeader
          mode="outlined"
          label="Invoice Parse Mode"
          value={invoiceParseMode as string}
          options={KVStoreKeyVals.PARSE_MODE.vals.map((e) => ({
            label: e,
            value: e,
          }))}
          onSelect={(value) => {
            setInvoiceParseMode(
              value as (typeof KVStoreKeyVals.PARSE_MODE.vals)[number],
            );
            AsyncStorage.setItem(
              KVStoreKeyVals.PARSE_MODE.key,
              value as string,
            );
          }}
        />
      </View>
    </View>
  );
};

export default SettingsScreen;
