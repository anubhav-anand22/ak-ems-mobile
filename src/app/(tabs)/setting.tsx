import { KVStoreKeyVals } from "@/lib/parseInvoicePDF";
import { validateGrokApiKey } from "@/lib/validateGrokApiKey";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import {
  Dimensions,
  Pressable,
  RefreshControl,
  ScaledSize,
  ScrollView,
  View,
} from "react-native";
import {
  Appbar,
  Button,
  Card,
  DataTable,
  HelperText,
  Icon,
  IconButton,
  Switch,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { Dropdown } from "react-native-paper-dropdown";
import { getContact } from "@/lib/getContact";
import { exportData } from "@/lib/exportData";
import { importData } from "@/lib/importData";
import Constants from "expo-constants";
import { widgetThemes } from "@/constants/widgetTheme";
import updateWidget from "@/widget/updateWidget";
import { log } from "@/lib/log";
import { useGlobalState } from "@/lib/gState";
import { getRandomStr } from "@/lib/getRandomStr";
import { useRouter } from "expo-router";
import { openURL } from "expo-linking";
import getLatestAppData from "@/lib/getLatestAppData";
import checkForUpdate from "@/lib/checkForUpdate";

const SettingsScreen = () => {
  const appVersion = Constants.expoConfig?.version;

  const appTheme = useTheme();
  const router = useRouter();

  const dim = Dimensions.get("window");
  const addConfirm = useGlobalState((s) => s.addConfirm);

  const [grokApiKey, setGrokApiKey] = useState("");
  const [isGrokApiKeySaved, setIsGrokApiKeySaved] = useState(true);
  const [isGrokApiKeyShow, setIsGrokApiKeyShow] = useState(false);
  const [isGrokApiKeyValid, setIsGrokApiKeyValid] = useState(true);
  const [isGrokApiKeyChecking, setIsGrokApiKeyChecking] = useState(false);
  const [selectedContactToSendTxSMS, setSelectedContactToSendTxSMS] = useState<
    SmsSendContact[]
  >([]);
  const [isSendTxSMSContactsEnabled, setIsSendTxSMSContactsEnabled] =
    useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [selectedWidgetDataIndex, setSelectedWidgetDataIndex] =
    useState<number>(0);
  const [widgetDataSummaryTime, setWidgetDataSummaryTime] = useState<
    (typeof KVStoreKeyVals.WIDGET_DATA_SUMMARY_TIME.vals)[number]
  >(KVStoreKeyVals.WIDGET_DATA_SUMMARY_TIME.vals[0]);

  const [invoiceParseMode, setInvoiceParseMode] = useState<
    null | (typeof KVStoreKeyVals.PARSE_MODE.vals)[number]
  >(null);

  const loadData = async () => {
    try {
      setIsLoading(true);
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
      AsyncStorage.getItem(KVStoreKeyVals.SEND_TX_SMS_CONTACTS.key).then(
        (value) => {
          if (value) setSelectedContactToSendTxSMS(JSON.parse(value));
        },
      );
      AsyncStorage.getItem(
        KVStoreKeyVals.SEND_TX_SMS_CONTACTS_ENABLED.key,
      ).then((value) => {
        if (value) setIsSendTxSMSContactsEnabled(value === "true");
      });
      AsyncStorage.getItem(KVStoreKeyVals.WIDGET_THEME.key).then((value) => {
        if (value) setSelectedWidgetDataIndex(Number(value) ?? 0);
      });
      AsyncStorage.getItem(KVStoreKeyVals.WIDGET_DATA_SUMMARY_TIME.key).then(
        (value) => {
          if (value)
            setWidgetDataSummaryTime(
              value as (typeof KVStoreKeyVals.WIDGET_DATA_SUMMARY_TIME.vals)[number],
            );
        },
      );
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const setContactToSendTxSMS = async (args?: {
    removePhoneNumber?: string;
  }) => {
    let arr: {
      name: string;
      phone: string;
    }[] = [];
    if (args?.removePhoneNumber) {
      setSelectedContactToSendTxSMS((p) => {
        arr = [...p.filter((e) => e.phone !== args.removePhoneNumber)];
        AsyncStorage.setItem(
          KVStoreKeyVals.SEND_TX_SMS_CONTACTS.key,
          JSON.stringify(arr),
        );
        return arr;
      });
    } else {
      const contact = await getContact();
      if (!contact) return;
      const phoneNumber = contact.phoneNumber[0].number;
      if (!phoneNumber) return;
      setSelectedContactToSendTxSMS((p) => {
        arr = [...p.filter((e) => e.phone !== phoneNumber)];
        arr.push({ name: contact.fullName, phone: phoneNumber });
        AsyncStorage.setItem(
          KVStoreKeyVals.SEND_TX_SMS_CONTACTS.key,
          JSON.stringify(arr),
        );
        return arr;
      });
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Appbar.Header>
        <Appbar.Content title={`Settings (v${appVersion})`} />
      </Appbar.Header>
      <ScrollView
        // contentContainerStyle={{ flexGrow: 1 }}
        style={{ flex: 1 }}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={loadData} />
        }
      >
        <View style={{ padding: 10, gap: 10, marginBottom: 100 }}>
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
          <Card disabled={!isSendTxSMSContactsEnabled}>
            <Card.Title
              title="Pick Contact to send transaction SMS"
              right={(p) => (
                <Switch
                  value={isSendTxSMSContactsEnabled}
                  onValueChange={(val) => {
                    setIsSendTxSMSContactsEnabled(val);
                    AsyncStorage.setItem(
                      KVStoreKeyVals.SEND_TX_SMS_CONTACTS_ENABLED.key,
                      val.toString(),
                    );
                  }}
                />
              )}
            />
            <Card.Content>
              <DataTable>
                <DataTable.Header>
                  <DataTable.Title style={{ flex: 2 }}>Name</DataTable.Title>
                  <DataTable.Title style={{ flex: 2 }}>Phone</DataTable.Title>
                  <DataTable.Title style={{ flex: 0 }}>Action</DataTable.Title>
                </DataTable.Header>

                {selectedContactToSendTxSMS.map((contact) => (
                  <DataTable.Row key={contact.phone + "contact_list"}>
                    <DataTable.Cell style={{ flex: 2 }}>
                      {contact.name}
                    </DataTable.Cell>
                    <DataTable.Cell style={{ flex: 2 }}>
                      {contact.phone}
                    </DataTable.Cell>
                    <DataTable.Cell style={{ flex: 0 }}>
                      <IconButton
                        icon="delete"
                        size={20}
                        onPress={() =>
                          setContactToSendTxSMS({
                            removePhoneNumber: contact.phone,
                          })
                        }
                      />
                    </DataTable.Cell>
                  </DataTable.Row>
                ))}
              </DataTable>
            </Card.Content>
            <Card.Actions style={{ paddingTop: 20 }}>
              <Button
                disabled={!isSendTxSMSContactsEnabled}
                mode="contained"
                onPress={() => setContactToSendTxSMS()}
              >
                Pick contact
              </Button>
            </Card.Actions>
          </Card>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              justifyContent: "space-between",
            }}
          >
            <Text
              onLongPress={() => {
                addConfirm({
                  id: getRandomStr(),
                  title: "Enter DEV Screen",
                  confirmBtnType: "DANGER",
                  onConfirm: () => {
                    router.navigate("/dev?=from=setting");
                  },
                });
              }}
            >
              Export:
            </Text>
            <Button
              loading={exportLoading}
              mode="contained"
              onPress={async (e) => {
                try {
                  setExportLoading(true);
                  await exportData();
                } catch (e) {
                  log.error(e);
                } finally {
                  setExportLoading(false);
                }
              }}
              icon={"database-export"}
            >
              Export
            </Button>
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              justifyContent: "space-between",
            }}
          >
            <Text>Import:</Text>
            <Button
              loading={importLoading}
              mode="contained"
              onPress={async () => {
                try {
                  setImportLoading(true);
                  await importData();
                } catch (e) {
                  log.error(e);
                } finally {
                  setImportLoading(false);
                }
              }}
              icon={"database-import"}
            >
              Import
            </Button>
          </View>
          <Card>
            <Card.Title title="Widget Theme" />
            <Card.Content>
              <View
                style={{
                  flexDirection: "row",
                  gap: 10,
                  flexWrap: "wrap",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                {widgetThemes.map((theme, index) => (
                  <Pressable
                    key={theme.dark + theme.light}
                    onPress={async () => {
                      setSelectedWidgetDataIndex(index);
                      await AsyncStorage.setItem(
                        KVStoreKeyVals.WIDGET_THEME.key,

                        index.toString(),
                      );
                      updateWidget(true);
                    }}
                  >
                    <View
                      style={{
                        width: 84,
                        height: 84,
                        position: "relative",
                        borderWidth: 2,
                        borderColor:
                          selectedWidgetDataIndex === index
                            ? appTheme.colors.onSurface
                            : "#0000",
                        borderRadius: 42,
                      }}
                    >
                      <View
                        style={{
                          backgroundColor: theme.dark,
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: 40,
                          height: 80,
                          borderTopLeftRadius: 40,
                          borderBottomLeftRadius: 40,
                        }}
                      />
                      <View
                        style={{
                          backgroundColor: theme.light,
                          position: "absolute",
                          top: 0,
                          left: 40,
                          width: 40,
                          height: 80,
                          borderTopRightRadius: 40,
                          borderBottomRightRadius: 40,
                        }}
                      />
                    </View>
                  </Pressable>
                ))}
              </View>
            </Card.Content>
          </Card>
          <Dropdown
            hideMenuHeader
            mode="outlined"
            label="Widget Data Summary Time Period"
            value={widgetDataSummaryTime as string}
            options={KVStoreKeyVals.WIDGET_DATA_SUMMARY_TIME.vals.map((e) => ({
              label: e,
              value: e,
            }))}
            onSelect={(value) => {
              setWidgetDataSummaryTime(
                value as (typeof KVStoreKeyVals.WIDGET_DATA_SUMMARY_TIME.vals)[number],
              );
              AsyncStorage.setItem(
                KVStoreKeyVals.WIDGET_DATA_SUMMARY_TIME.key,
                value as string,
              );
              updateWidget(true);
            }}
          />
          <SettingQuickActions dim={dim} />
        </View>
      </ScrollView>
    </View>
  );
};

export default SettingsScreen;

const SettingQuickActions = ({ dim }: { dim: ScaledSize }) => {
  const setQrCodeData = useGlobalState((s) => s.setQrCodeData);

  const [isShareLoading, setIsShareLoading] = useState(false);

  return (
    <View style={{ flexDirection: "row", gap: 10 }}>
      <Card
        style={{ flex: 1 }}
        onPress={() => {
          openURL("https://github.com/anubhav-anand22/ak-ems-mobile");
        }}
      >
        <Card.Content
          style={{ alignItems: "center", justifyContent: "center" }}
        >
          <IconButton size={dim.width / 11} icon={"code-tags"} />
          <Text>Code</Text>
        </Card.Content>
      </Card>
      <Card
        style={{ flex: 1 }}
        onPress={() => {
          checkForUpdate();
        }}
      >
        <Card.Content
          style={{ alignItems: "center", justifyContent: "center" }}
        >
          <IconButton size={dim.width / 11} icon={"refresh"} />
          <Text>Check for Updates</Text>
        </Card.Content>
      </Card>
      <Card
        style={{ flex: 1 }}
        onPress={async () => {
          try {
            setIsShareLoading(true);
            const data = await getLatestAppData();
            log.info(
              "share url: ",
              data?.releaseData?.assets[0].browser_download_url,
            );
            setQrCodeData({
              appIconUrl: null,
              appName: data?.releaseData?.assets[0].name ?? null,
              appVersion: data?.releaseData?.tag_name ?? null,
              url: data?.releaseData?.assets[0].browser_download_url ?? null,
            });
          } catch (e) {
            log.error(e);
          } finally {
            setIsShareLoading(false);
          }
        }}
      >
        <Card.Content
          style={{ alignItems: "center", justifyContent: "center" }}
        >
          <IconButton
            loading={isShareLoading}
            size={dim.width / 11}
            icon={"qrcode"}
          />
          <Text>Share</Text>
        </Card.Content>
      </Card>
    </View>
  );
};
