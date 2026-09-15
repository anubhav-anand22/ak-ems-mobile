import {
  CompoundingFrequency,
  CompoundingFrequencyObj,
  Expense,
  ExpenseType,
  InterestArr,
  InterestType,
  SubExpenseType,
} from "@/constants/expense";
import { db } from "@/db/dbinit";
import { dbTransaction, TransactionType } from "@/db/schema";
import { getCurrentLocation } from "@/lib/getCurrentLocation";
import { getRandomStr } from "@/lib/getRandomStr";
import { useGlobalState } from "@/lib/gState";
import { parseStrMath } from "@/lib/parseStrMath";
import ReactiveKVStore from "@/lib/reactiveKV";
import updateWidget, { setWidgetDataDirty } from "@/widget/updateWidget";
import { eq } from "drizzle-orm";
import {
  Contact,
  getPermissionsAsync as getContactsPermissionsAsync,
  requestPermissionsAsync as requestContactsPermissionsAsync,
} from "expo-contacts";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useNavigationState } from "expo-router/build/react-navigation";
import { useEffect, useRef, useState } from "react";
import {
  BackHandler,
  RefreshControl,
  View,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import {
  KeyboardAvoidingView,
  KeyboardAwareScrollView,
} from "react-native-keyboard-controller";
import {
  Appbar,
  Button,
  Checkbox,
  Chip,
  DataTable,
  Dialog,
  HelperText,
  IconButton,
  List,
  Menu,
  Portal,
  SegmentedButtons,
  Text,
  TextInput,
} from "react-native-paper";
import { Dropdown, DropdownRef } from "react-native-paper-dropdown";
import { KVStoreKeyVals, parseInvoicePDF } from "@/lib/parseInvoicePDF";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { sendDirectSMS } from "@/lib/sendDirectSMS";
import { log } from "@/lib/log";
import { sendSMSMsg } from "@/lib/sendSMSMsg";

export default function AddExpense() {
  const router = useRouter();
  const previousRoute = useNavigationState((state) => {
    const index = state.index;
    return index > 0 ? state.routes[index - 1] : undefined;
  });
  const editRouteData = useLocalSearchParams<{
    id?: string;
    mode?: "edit";
    isFromWidget?: string;
    invoicePDFPath?: string;
    from?: string;
    shopingListData: string;
  }>();

  const setAddTagDialogShow = useGlobalState((s) => s.setAddTagDialogShow);
  const setSnackbar = useGlobalState((s) => s.setSnackbar);
  const tags = ReactiveKVStore.useReactiveKVStore((s) => s.tags);

  const expenseAmountTitleRef = useRef<any>(null);
  const expenseAmountInpRef = useRef<any>(null);
  const toFromInputRef = useRef<any>(null);
  const noteInputRef = useRef<any>(null);
  const interestRateInputRef = useRef<any>(null);
  const interestTimePeriodInputRef = useRef<any>(null);
  const compoundingFrequencyInputRef = useRef<DropdownRef>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [expense, setExpense] = useState<ExpenseType>(Expense.ExpenseArr[0]);
  const [subExpense, setSubExpense] = useState<SubExpenseType>(
    Expense.SubExpenseArr[0],
  );
  const [isAmountNumericKeyboard, setIsAmountNumericKeyboard] = useState(true);
  const [isMathInputInfoDialogShow, setIsMathInputInfoDialogShow] =
    useState(false);
  const [interestType, setInterestType] = useState<InterestType>(
    InterestArr[0],
  );

  const [amountTxt, setAmountTxt] = useState("");
  const [amountTitleTxt, setAmountTitleTxt] = useState("");
  const [amountArr, setAmountArr] = useState<
    { title: string; amount: number; id: number }[]
  >([]);
  const [toFromTxt, setToFromTxt] = useState<{
    name: string;
    number: string | null;
  }>({ name: "", number: null });
  const [noteTxt, setNoteTxt] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [interestRate, setInterestRate] = useState("");
  const [interestTimePeriod, setInterestTimePeriod] = useState("");
  const [compoundingFrequency, setCompoundingFrequency] =
    useState<CompoundingFrequency>(CompoundingFrequencyObj[0].value);
  const [addLocation, setAddLocation] = useState(false);
  const [currentLocation, setCurrentLocation] =
    useState<Location.LocationObject | null>(null);
  const [contactList, setContactList] = useState<
    { name: string; number: string }[]
  >([]);

  const [amountInpErr, setAmountInpErr] = useState("");
  const [amountTitleTxtErr, setAmountTitleTxtErr] = useState("");
  const [toFromTxtErr, setToFromTxtErr] = useState("");
  const [noteTxtErr, setNoteTxtErr] = useState("");
  const [interestRateErr, setInterestRateErr] = useState("");
  const [interestTimePeriodErr, setInterestTimePeriodErr] = useState("");
  const [compoundingFrequencyErr, setCompoundingFrequencyErr] = useState("");

  const [hasContactPermission, setHasContactPermission] = useState(false);
  const [isContactListVisible, setIsContactListVisible] = useState(false);
  const [isLoactionLoading, setIsLoactionLoading] = useState(false);
  const [editData, setEditData] = useState<TransactionType | null | false>(
    null,
  );
  const [newExpenseItemIds, setNewExpenseItemIds] = useState<number[]>([]);

  const [invoiceIsLoading, setInvoiceIsLoading] = useState(false);

  const toggleSelectedTagHandler = (tag: string) => {
    setSelectedTags((prevTags) =>
      prevTags.includes(tag)
        ? prevTags.filter((t) => t !== tag)
        : [...prevTags, tag],
    );
  };

  const pickContact = async () => {
    try {
      const { status } = await requestContactsPermissionsAsync();

      if (status !== "granted") {
        return;
      }

      setHasContactPermission(true);

      const contact = await Contact.presentPicker();

      if (contact) {
        const fullName = await contact.getFullName();
        const phoneNum = (await contact.getPhones())[0]?.number ?? "";
        setToFromTxt({ name: fullName, number: phoneNum });
      } else {
        setSnackbar({
          message: "No contact selected",
          type: "error",
          action: "dismiss",
        });
      }
    } catch (error) {
      console.error(error);
      setSnackbar({
        message: "Failed to pick contact",
        type: "error",
        action: "dismiss",
      });
    }
  };

  const onAddExpenseHandler = async (
    returnToPreviousScreen: boolean = false,
  ) => {
    try {
      setIsLoading(true);
      const amoTxtTrimed = amountTxt.trim();
      const amoTitleTxtTrimed = amountTitleTxt.trim();
      const toFromTxtTrimed = toFromTxt.name.trim();
      const interestRateNum = parseFloat(interestRate.trim());
      const interestTimePeriodNum = parseFloat(interestTimePeriod.trim());

      if (
        amountArr.length === 0 &&
        (amoTxtTrimed === "" || amoTitleTxtTrimed === "")
      ) {
        setAmountInpErr("Amount is required");
        setAmountTitleTxtErr("Amount title is required");
        return;
      } else if (
        amountArr.length === 0 &&
        amoTxtTrimed !== "" &&
        amoTitleTxtTrimed !== ""
      ) {
        addAmountToListHandler();
      }

      if (!toFromTxtTrimed) {
        setToFromTxtErr("To/From is required");
        return;
      }

      if (expense === "Credit") {
        if (interestType === "Simple" || interestType === "Compound") {
          if (!interestRate.trim()) {
            setInterestRateErr("Interest rate is required");
            return;
          }
          if (interestRateNum <= 0) {
            setInterestRateErr("Interest rate must be greater than 0");
            return;
          }
          if (!interestTimePeriod.trim()) {
            setInterestTimePeriodErr("Interest time period is required");
            return;
          }
          if (interestTimePeriodNum <= 0) {
            setInterestTimePeriodErr(
              "Interest time period must be greater than 0",
            );
            return;
          }
        }
        if (interestType === "Compound") {
          if (!compoundingFrequency) {
            setCompoundingFrequencyErr("Compounding frequency is required");
            return;
          }
        }
      }

      const amoArr: AmountTitleObj[] = amountArr.map((e) => ({
        amount: e.amount,
        title: e.title,
      }));

      let location: LocationObj | undefined;

      if (currentLocation) {
        const locationData = await Location.reverseGeocodeAsync({
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
        });
        location = {
          latitude: currentLocation.coords.longitude,
          longitude: currentLocation.coords.longitude,
          altitude: currentLocation.coords.altitude ?? undefined,
          city: locationData[0]?.city ?? undefined,
          state: locationData[0]?.region ?? undefined,
          country: locationData[0]?.country ?? undefined,
          postalCode: locationData[0]?.postalCode ?? undefined,
          district: locationData[0]?.district ?? undefined,
          isoCountryCode: locationData[0]?.isoCountryCode ?? undefined,
        };
      }

      let dbInsertReturnId: number;

      if (editData) {
        const [{ id }] = await db
          .update(dbTransaction)
          .set({
            amount: amoArr,
            expenseType: expense,
            subExpenseType: subExpense,
            toFrom: toFromTxt.name,
            toFromPhoneNumber: toFromTxt.number,
            note: noteTxt,
            tags: selectedTags,
            interestType: expense === "Credit" ? interestType : "None",
            interestRate: expense === "Credit" ? interestRateNum : undefined,
            interestTime:
              expense === "Credit" ? interestTimePeriodNum : undefined,
            compoundingFrequency:
              expense === "Credit" ? compoundingFrequency : undefined,
          })
          .where(eq(dbTransaction.id, editData.id))
          .returning({ id: dbTransaction.id });

        dbInsertReturnId = id;
      } else {
        const [{ id }] = await db
          .insert(dbTransaction)
          .values({
            amount: amoArr,
            expenseType: expense,
            subExpenseType: subExpense,
            toFrom: toFromTxt.name,
            toFromPhoneNumber: toFromTxt.number,
            note: noteTxt,
            tags: selectedTags,
            interestType: expense === "Credit" ? interestType : "None",
            interestRate: expense === "Credit" ? interestRateNum : undefined,
            interestTime:
              expense === "Credit" ? interestTimePeriodNum : undefined,
            compoundingFrequency:
              expense === "Credit" ? compoundingFrequency : undefined,
            location,
          })
          .returning({ id: dbTransaction.id });

        dbInsertReturnId = id;
      }

      // if (
      //   (await AsyncStorage.getItem(
      //     KVStoreKeyVals.SEND_TX_SMS_CONTACTS_ENABLED.key,
      //   )) === "true"
      // ) {
      //   const contacts = await AsyncStorage.getItem(
      //     KVStoreKeyVals.SEND_TX_SMS_CONTACTS.key,
      //   );
      //   log.info({ contacts });
      //   if (contacts) {
      //     const parsedContacts = JSON.parse(contacts) as SmsSendContact[];
      //     log.info({ parsedContacts });
      //     if (parsedContacts.length > 0) {
      //       let textMessage = `AK EMS:\nExpense: ${expense}.${subExpense}\nAmount: ${amoArr.reduce((acc, curr) => acc + curr.amount, 0).toFixed(2)}\n${subExpense === "Borrow" || subExpense === "Receive" ? "From: " : "To: "}${toFromTxt.name}\nNote: ${noteTxt}\n`;

      //       textMessage += "Items:\n";
      //       for (const item of amoArr) {
      //         textMessage += `${item.title}: ${item.amount.toFixed(2)}\n`;
      //       }

      //       if (expense === "Credit") {
      //         textMessage += `Interest type: ${interestType}\nInterest Rate: ${interestRate}\nInterest Time Period: ${interestTimePeriod}\nCompounding Frequency: ${compoundingFrequency}\n`;
      //       }

      //       if (toFromTxt.number && toFromTxt.number.length > 0) {
      //         await sendDirectSMS(toFromTxt.number, textMessage).catch(
      //           log.error,
      //         );
      //       }

      //       for (const contact of parsedContacts) {
      //         // 1. Wait for the result object
      //         const result = await sendDirectSMS(
      //           contact.phone,
      //           textMessage,
      //         ).catch(log.error);

      //         // 2. Actually check if it failed instead of blindly logging success
      //         if (result?.errMsg) {
      //           console.error(
      //             `❌ Failed to send to ${contact.phone}: ${result.errMsg}`,
      //           );
      //         } else {
      //           log.info(`✅ Successfully sent to ${contact.phone}`);
      //         }
      //         await new Promise((resolve) => setTimeout(resolve, 1000));
      //       }
      //     }
      //   }
      // }
      //

      sendSMSMsg.sendTxAddedSMS({
        expense,
        subExpense,
        amoArr,
        toFromTxt,
        noteTxt,
        interestType,
        interestRate,
        interestTimePeriod,
        compoundingFrequency,
      });

      setNewExpenseItemIds((p) => [...p, dbInsertReturnId]);

      setSnackbar({
        message: "Expense added successfully",
        type: "success",
        action: "dismiss",
      });

      setAmountArr([]);
      setAmountTxt("");
      setAmountTitleTxt("");
      setToFromTxt({ name: "", number: null });
      setNoteTxt("");
      setInterestRate("");
      setInterestTimePeriod("");
      setSelectedTags([]);

      setAmountInpErr("");
      setAmountTitleTxtErr("");
      setToFromTxtErr("");
      setNoteTxtErr("");
      setInterestRateErr("");
      setInterestTimePeriodErr("");

      await setWidgetDataDirty();

      if (returnToPreviousScreen) goBack();
    } catch (error) {
      log.error(error);
      setSnackbar({ message: "Failed to add expense", type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  const addAmountToListHandler = () => {
    setAmountTitleTxt(amountTitleTxt.trim());
    setAmountTxt(amountTxt.trim());

    if (amountTxt === "" && amountTitleTxt === "" && amountArr.length !== 0) {
      setAmountInpErr("");
      setAmountTitleTxt("");
      return;
    }

    if (amountTitleTxt === "") {
      setAmountTitleTxtErr("Amount title is required");
      return;
    }

    if (amountTxt === "") {
      setAmountInpErr("Amount is required");
      return;
    }

    const [result, error] = parseStrMath(amountTxt);
    if (error) {
      setAmountInpErr("Invalid amount");
      return;
    }

    setAmountArr((p) => [
      ...p,
      { title: amountTitleTxt, amount: result, id: Math.random() },
    ]);

    setAmountTitleTxt("");
    setAmountTxt("");
    if (!toFromInputRef.current?.isFocused()) {
      expenseAmountInpRef?.current?.focus();
    }
  };

  const goBack = () => {
    // router.setParams({
    //   newExpenseItemIds: JSON.stringify(newExpenseItemIds),
    //   mode: editData ? "edit" : "add",
    // });
    // router.back();
    updateWidget();

    if (editRouteData.isFromWidget === "true") {
      BackHandler.exitApp();
      router.replace("/(tabs)");
      return;
    }

    if (newExpenseItemIds.length === 0) {
      if (router.canGoBack()) router.back();
    } else {
      // @ts-ignore
      router.replace(`/${previousRoute?.name}`, {
        newExpenseItemIds: JSON.stringify(newExpenseItemIds),
        mode: editData ? "edit" : "add",
      });
    }
  };

  useEffect(() => {
    setSubExpense(Expense.ExpenseObj[expense][0]);
  }, [expense]);

  useEffect(() => {
    if (
      editRouteData.from === "shoping-list" &&
      editRouteData.shopingListData
    ) {
      try {
        const data = JSON.parse(editRouteData.shopingListData) as {
          note: string | null;
          toFrom: string;
          amount: {
            amount: number;
            title: string;
            id: number;
          }[];
        };

        setNoteTxt(data.note ?? "");
        setToFromTxt({ name: data.toFrom, number: null });
        setAmountArr(data.amount);
        setExpense("Simple Expense");
        setSubExpense("Send");
      } catch (e) {
        console.log(e);
      }
    }
  }, [editRouteData.from, editRouteData.shopingListData]);

  useEffect(() => {
    if (addLocation) {
      setIsLoactionLoading(true);
      getCurrentLocation()
        .then(([location, error]) => {
          if (error) {
            log.error(error);
            setAddLocation(false);
            setCurrentLocation(null);
            setSnackbar({
              message: "Failed to get location",
              type: "error",
              action: "dismiss",
            });
          } else {
            setCurrentLocation(location);
          }
        })
        .finally(() => {
          setIsLoactionLoading(false);
        });
    } else {
      setCurrentLocation(null);
    }
  }, [addLocation, setSnackbar]);

  useEffect(() => {
    if (hasContactPermission) return;
    getContactsPermissionsAsync().then(async ({ status }) => {
      if (status !== "granted") {
        return;
      }
      const contacts = await Promise.all(
        (await Contact.getAll()).map(
          async ({ id, getFullName, getPhones }) => ({
            name: await getFullName(),
            number: (await getPhones())[0]?.number ?? "",
          }),
        ),
      );
      setContactList(contacts);
    });
  }, [hasContactPermission]);

  useEffect(() => {
    if (!editRouteData.id) return setIsLoading(false);
    const idNum = parseInt(editRouteData.id);
    if (!idNum || isNaN(idNum)) return setIsLoading(false);
    const loadEditData = async () => {
      try {
        setIsLoading(true);
        const result = await db
          .select()
          .from(dbTransaction)
          .where(eq(dbTransaction.id, idNum))
          .limit(1);

        if (result.length === 0) return setEditData(false);
        const data = result[0];
        setExpense(data.expenseType);
        setSubExpense(data.subExpenseType);
        setAmountArr(data.amount.map((a) => ({ ...a, id: Math.random() })));
        setToFromTxt({
          name: data.toFrom,
          number: data.toFromPhoneNumber,
        });
        setNoteTxt(data.note ?? "");
        setInterestRate(data.interestRate?.toString() ?? "");
        setInterestTimePeriod(data?.interestTime?.toString() ?? "");
        setCompoundingFrequency(data.compoundingFrequency ?? "daily");
        setInterestType(data.interestType ?? "None");
        setSelectedTags(data.tags ?? []);

        setEditData(data);
      } catch (error) {
        setSnackbar({ message: "Failed to load edit data", type: "error" });
        setEditData(false);
      } finally {
        setIsLoading(false);
      }
    };
    loadEditData();
  }, [editRouteData.id, editRouteData.mode]);

  useEffect(() => {
    if (editRouteData.invoicePDFPath)
      parseInvoideHandler(editRouteData.invoicePDFPath);
  }, [editRouteData.invoicePDFPath]);

  const parseInvoideHandler = async (invoicePDFPath?: string) => {
    setInvoiceIsLoading(true);
    const parsedInvoide = await parseInvoicePDF(
      (msg) => {
        setSnackbar({ message: msg, type: "info" });
      },
      (progress, isInter, isComplete) => {
        console.log(progress);
        if (isComplete) {
          setInvoiceIsLoading(false);
        }
      },
      invoicePDFPath,
    );
    console.log({ parsedInvoide });
    if (parsedInvoide) {
      if (parsedInvoide.providerName)
        setToFromTxt({ name: parsedInvoide.providerName, number: null });
      if (parsedInvoide.items) {
        const arr: {
          title: string;
          amount: number;
          id: number;
        }[] = [];
        parsedInvoide.items.forEach((e, index) => {
          if (e.amount && e.productName) {
            arr.push({
              title: `${e.productName} ${e.quantity && e.quantityType ? `(${e.quantity} ${e.quantityType})` : ""}`,
              amount: e.amount,
              id: Math.random(),
            });
          }
        });
        if (parsedInvoide?.discount) {
          arr.push({
            title: "Discount",
            amount: -parsedInvoide.discount,
            id: Math.random(),
          });
        }
        setAmountArr(arr);
      }
      // setAmountArr(
      //   parsedInvoide.items
      //     .filter((e) => e.amount && e.productName )
      //     .map((e) => ({
      //       amount: e.amount,
      //       title: e.productName,
      //       id: Math.random().toString(),
      //     })),
      // );
    }
    setInvoiceIsLoading(false);
    console.log({ parsedInvoide });
  };

  const devRandomInpValHandler = () => {
    setExpense(
      Expense.ExpenseArr[Math.floor(Math.random() * Expense.ExpenseArr.length)],
    );
    setSubExpense(
      Expense.SubExpenseArr[
        Math.floor(Math.random() * Expense.SubExpenseArr.length)
      ],
    );
    setAmountArr(
      Array.from({ length: Math.floor(Math.random() * 10) }, (_, i) => ({
        amount: Math.random() * 100,
        title: `Item ${i + 1}`,
        id: Math.random(),
      })),
    );
    setToFromTxt({ name: getRandomStr(10), number: null });
    setNoteTxt(getRandomStr(20));
  };

  return (
    <>
      <Appbar.Header>
        <Appbar.Content title="Add Expense" />
        <Appbar.BackAction onPress={goBack} />
        {__DEV__ ? (
          <Appbar.Action icon={"plus-box"} onPress={devRandomInpValHandler} />
        ) : null}
        <Appbar.Action
          icon={"receipt-text"}
          onPress={() => parseInvoideHandler()}
          loading={invoiceIsLoading}
        />
      </Appbar.Header>
      <KeyboardAvoidingView style={{ flex: 1 }}>
        <KeyboardAwareScrollView
          refreshControl={<RefreshControl refreshing={isLoading} />}
          bottomOffset={20}
          contentContainerStyle={{
            // padding: 10,
            paddingBottom: 40,
            gap: 10,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ padding: 10, gap: 10, flex: 1 }}>
            <SegmentedButtons
              value={expense}
              onValueChange={(e) => (isLoading ? null : setExpense(e))}
              buttons={Expense.ExpenseArr.map((e) => ({ value: e, label: e }))}
              theme={{ roundness: 2 }}
            />
            <View
              onStartShouldSetResponderCapture={() => {
                expenseAmountInpRef?.current?.focus();
                return false;
              }}
            >
              <SegmentedButtons
                value={subExpense}
                onValueChange={(e) => (isLoading ? null : setSubExpense(e))}
                buttons={Expense.ExpenseObj[expense].map((e) => ({
                  value: e,
                  label: e,
                }))}
                theme={{ roundness: 2 }}
              />
            </View>
            {amountArr.length === 0 ? null : (
              <DataTable>
                <DataTable.Header
                  style={{
                    padding: 0,
                    paddingHorizontal: 0,
                  }}
                >
                  <DataTable.Title style={{ flex: 2 }}>Title</DataTable.Title>
                  <DataTable.Title>Amount</DataTable.Title>
                  <DataTable.Title style={{ flex: 0 }}>Action</DataTable.Title>
                </DataTable.Header>
                {amountArr.map((item, index) => (
                  <DataTable.Row
                    key={item.id}
                    style={{ padding: 0, paddingHorizontal: 0 }}
                  >
                    <DataTable.Cell style={{ flex: 2 }}>
                      {index + 1}
                      {") "}
                      {item.title}
                    </DataTable.Cell>
                    <DataTable.Cell style={{ marginLeft: 10 }}>
                      <Text>₹{item.amount}</Text>
                    </DataTable.Cell>
                    <DataTable.Cell
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "flex-end",
                        flex: 0,
                      }}
                    >
                      <IconButton
                        disabled={isLoading}
                        icon="close"
                        size={16}
                        onPress={() => {
                          setAmountArr(
                            amountArr.filter((a) => a.id !== item.id),
                          );
                        }}
                      />
                      <IconButton
                        disabled={isLoading}
                        icon="pencil"
                        size={16}
                        onPress={() => {
                          let arr = amountArr.filter((a) => a.id !== item.id);

                          if (amountTitleTxt.trim() && amountTitleTxt.trim()) {
                            arr.push({
                              id: Math.random(),
                              title: amountTitleTxt,
                              amount: Number(amountTxt),
                            });
                          }
                          setAmountArr(arr);
                          setAmountTitleTxt(item.title);
                          setAmountTxt(item.amount.toString());
                          expenseAmountInpRef.current?.focus();
                        }}
                      />
                    </DataTable.Cell>
                  </DataTable.Row>
                ))}
              </DataTable>
            )}

            <View style={{ flexDirection: "row", flex: 1 }}>
              <TextInput
                testID="add-expense-screen-amount-input"
                disabled={isLoading}
                ref={expenseAmountInpRef}
                label={"Amount*"}
                keyboardType={isAmountNumericKeyboard ? "numeric" : "default"}
                mode="outlined"
                style={{ flex: 1 }}
                value={amountTxt}
                onChangeText={(text) => {
                  setAmountTxt(text.replace(/[^0-9.\-\!\*\/\^\+\(\)]/g, ""));
                  setAmountInpErr("");
                }}
                onEndEditing={() => {
                  const [result, error] = parseStrMath(amountTxt);
                  if (error) {
                    if (amountArr.length !== 0 && amountTxt.trim() === "") {
                      setAmountInpErr("");
                    } else {
                      if (amountTxt === "") {
                        setAmountInpErr("Amount is required");
                      } else {
                        setAmountInpErr("Invalid input");
                      }
                    }
                  } else {
                    setAmountTxt(result.toString());
                  }
                }}
                right={
                  <TextInput.Icon
                    icon="alphabetical-variant"
                    disabled={isLoading}
                    onPress={() => setIsAmountNumericKeyboard((p) => !p)}
                  />
                }
                error={amountInpErr !== ""}
                onSubmitEditing={() => {
                  expenseAmountTitleRef?.current?.focus();
                }}
              />

              <View style={{ paddingTop: 4 }}>
                <IconButton
                  disabled={isLoading}
                  icon="information-outline"
                  onPress={() => setIsMathInputInfoDialogShow(true)}
                  mode="contained"
                />
              </View>
            </View>
            {amountInpErr === "" ? null : (
              <HelperText type="error" visible={amountInpErr !== ""}>
                {amountInpErr}
              </HelperText>
            )}
            <View style={{ flexDirection: "row" }}>
              <TextInput
                disabled={isLoading}
                ref={expenseAmountTitleRef}
                label={"Title*"}
                mode="outlined"
                style={{ flex: 1 }}
                value={amountTitleTxt}
                onChangeText={(text) => {
                  setAmountTitleTxt(text.slice(0, 100));
                  setAmountTitleTxtErr("");
                }}
                maxLength={100}
                error={amountTitleTxtErr !== ""}
                onEndEditing={addAmountToListHandler}
              />
              <View style={{ paddingTop: 4 }}>
                <IconButton
                  disabled={isLoading}
                  icon="check-circle-outline"
                  onPress={addAmountToListHandler}
                  mode="contained"
                />
              </View>
            </View>
            {amountTitleTxtErr === "" ? null : (
              <HelperText type="error" visible={amountTitleTxtErr !== ""}>
                {amountTitleTxtErr}
              </HelperText>
            )}
            <Menu
              visible={isContactListVisible}
              onDismiss={() => setIsContactListVisible(false)}
              anchorPosition="bottom"

              anchor={
                <TextInput
                  disabled={isLoading}
                  onFocus={() => setIsContactListVisible(true)}
                  onBlur={() => setIsContactListVisible(false)}
                  ref={toFromInputRef}
                  label={
                    subExpense === "Borrow" || subExpense === "Receive"
                      ? "From*"
                      : "To*"
                  }
                  right={
                    <TextInput.Icon
                      disabled={isLoading}
                      icon="contacts-outline"
                      onPress={pickContact}
                    />
                  }
                  mode="outlined"
                  style={{ flex: 1 }}
                  value={toFromTxt.name}
                  onChangeText={(text) => {
                    setToFromTxt({ name: text.slice(0, 100), number: null });
                    if (text === "") {
                      setToFromTxtErr("This is a required field.");
                    } else {
                      setToFromTxtErr("");
                    }
                    setIsContactListVisible(true);
                  }}
                  maxLength={100}
                  error={toFromTxtErr !== ""}
                  onSubmitEditing={() => noteInputRef?.current?.focus()}
                />
              }
            >
              {contactList
                .filter((e) => e?.name?.includes(toFromTxt.name))
                .map((item) => (
                  <List.Item
                    key={item.name}
                    title={item.name}
                    onPress={() => {
                      setToFromTxt({ name: item.name, number: null });
                      setIsContactListVisible(false);
                      setToFromTxtErr("");
                    }}
                  />
                ))}
            </Menu>
            {toFromTxtErr === "" ? null : (
              <HelperText type="error" visible={toFromTxtErr !== ""}>
                {toFromTxtErr}
              </HelperText>
            )}
            <TextInput
              disabled={isLoading}
              ref={noteInputRef}
              label={"Note"}
              mode="outlined"
              style={{ flex: 1, minHeight: 100, maxHeight: 200 }}
              value={noteTxt}
              onChangeText={setNoteTxt}
              maxLength={600}
              multiline
            />
            {noteTxtErr === "" ? null : (
              <HelperText type="error" visible={noteTxtErr !== ""}>
                {noteTxtErr}
              </HelperText>
            )}

            {expense === "Credit" ? (
              <>
                <View
                  onStartShouldSetResponderCapture={() => {
                    setTimeout(() => {
                      interestRateInputRef?.current?.focus();
                    }, 200);
                    return false;
                  }}
                >
                  <SegmentedButtons
                    value={interestType}
                    onValueChange={(e) =>
                      isLoading ? null : setInterestType(e)
                    }
                    buttons={InterestArr.map((i) => ({ value: i, label: i }))}
                    theme={{ roundness: 2 }}
                  />
                </View>
                {interestType === "None" ? null : (
                  <>
                    <TextInput
                      disabled={isLoading}
                      ref={interestRateInputRef}
                      label={"Interest Rate"}
                      mode="outlined"
                      style={{ flex: 1 }}
                      value={interestRate}
                      error={interestRateErr !== ""}
                      onChangeText={(txt) => {
                        const newTxt = txt.replace(/[^0-9.]/g, "");
                        let num = parseFloat(newTxt);
                        setInterestRate(newTxt);
                        if (num <= 0) {
                          setInterestRateErr(
                            "Interest rate must be greater than 0",
                          );
                        } else {
                          setInterestRateErr("");
                        }
                      }}
                      onSubmitEditing={() =>
                        interestTimePeriodInputRef.current?.focus()
                      }
                    />
                    {interestRateErr === "" ? null : (
                      <HelperText type="error" visible={interestRateErr !== ""}>
                        {interestRateErr}
                      </HelperText>
                    )}
                    <TextInput
                      disabled={isLoading}
                      ref={interestTimePeriodInputRef}
                      label={"Time period (years)"}
                      mode="outlined"
                      style={{ flex: 1 }}
                      value={interestTimePeriod}
                      error={interestTimePeriodErr !== ""}
                      onChangeText={(txt) => {
                        const newTxt = txt.replace(/[^0-9.]/g, "");
                        let num = parseFloat(newTxt);
                        setInterestTimePeriod(newTxt);
                        if (num <= 0) {
                          setInterestTimePeriodErr(
                            "Time period must be greater than 0",
                          );
                        } else {
                          setInterestTimePeriodErr("");
                        }
                      }}
                      onSubmitEditing={() =>
                        compoundingFrequencyInputRef.current?.focus()
                      }
                    />
                    {interestTimePeriodErr === "" ? null : (
                      <HelperText
                        type="error"
                        visible={interestTimePeriodErr !== ""}
                      >
                        {interestTimePeriodErr}
                      </HelperText>
                    )}
                    {interestType === "Compound" ? (
                      <>
                        <Dropdown
                          disabled={isLoading}
                          label="Compounding Frequency"
                          placeholder="Compounding Frequency"
                          options={CompoundingFrequencyObj}
                          value={compoundingFrequency}
                          onSelect={(val) =>
                            val && setCompoundingFrequency(val as any)
                          }
                          ref={compoundingFrequencyInputRef}
                          mode="outlined"
                        />
                        {compoundingFrequencyErr === "" ? null : (
                          <HelperText
                            type="error"
                            visible={compoundingFrequencyErr !== ""}
                          >
                            {compoundingFrequencyErr}
                          </HelperText>
                        )}
                      </>
                    ) : null}
                  </>
                )}
              </>
            ) : null}

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 7,
                flexWrap: "wrap",
              }}
            >
              <Text style={{ fontWeight: "bold" }}>Tags: </Text>
              {tags.map((tag) => (
                <Chip
                  icon={selectedTags.includes(tag) ? "check" : undefined}
                  key={tag}
                  mode="outlined"
                  disabled={isLoading}
                  onPress={() => toggleSelectedTagHandler(tag)}
                >
                  {tag}
                </Chip>
              ))}
              <Button
                onPress={() => setAddTagDialogShow(true)}
                mode="contained-tonal"
                icon={"plus"}
                disabled={isLoading}
              >
                Add tag
              </Button>
            </View>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 7,
              }}
            >
              <Text>Add current location:</Text>
              <View>
                <View style={{ opacity: isLoactionLoading ? 0 : 1 }}>
                  <Checkbox
                    status={addLocation ? "checked" : "unchecked"}
                    onPress={() => setAddLocation(!addLocation)}
                    disabled={isLoading}
                  />
                </View>
                {isLoactionLoading ? (
                  <View style={{ position: "absolute", padding: 7 }}>
                    <ActivityIndicator />
                  </View>
                ) : null}
              </View>
              {/*{isLoactionLoading ? (
                <ActivityIndicator size={32} />
              ) : (
                <Checkbox
                  status={addLocation ? "checked" : "unchecked"}
                  // onPress={() => setAddLocation(!addLocation)}
                  onPress={() => {
                    setIsLoactionLoading(true);
                    setTimeout(() => {
                      setIsLoactionLoading(false);
                    }, 1000);
                  }}
                />
              )}*/}
            </View>
            <Button
              mode="contained-tonal"
              onPress={() => onAddExpenseHandler()}
              disabled={isLoading}
              loading={isLoading}
            >
              {editData ? "Edit" : "Add"}
            </Button>
            <Button
              mode="contained"
              onPress={() => onAddExpenseHandler(true)}
              disabled={isLoading}
              loading={isLoading}
            >
              {editData ? "Edit & return" : "Add & return"}
            </Button>
            <Portal>
              <Dialog
                visible={isMathInputInfoDialogShow}
                onDismiss={() => setIsMathInputInfoDialogShow(false)}
              >
                <Dialog.Title>Math Input Info</Dialog.Title>
                <Dialog.Content>
                  <Text>+: Addition</Text>
                  <Text>-: Subtraction</Text>
                  <Text>*: Multiplication</Text>
                  <Text>/: Division</Text>
                  <Text>^: Exponentiation</Text>
                  <Text>!: Factorial</Text>
                  <Text>Eg: 2*3*(4+5)</Text>
                  <Text>Wrong: 2(3+4), Correct: 2*(3+4)</Text>
                </Dialog.Content>
              </Dialog>
            </Portal>
          </View>
        </KeyboardAwareScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
