import {
  CompoundingFrequency,
  CompoundingFrequencyObj,
  Expense,
  ExpenseType,
  InterestArr,
  InterestType,
  SubExpenseType,
} from "@/constants/expense";
import { CustomPaperTheme } from "@/constants/paperTheme";
import {
  createTransaction,
  getTransactionById,
  TransactionType,
  updateTransaction,
} from "@/db";
import { getCompoundingFreqAsNum } from "@/lib/getCompoundingFreqAsNum";
import { getCurrentLocation } from "@/lib/getCurrentLocation";
import { getRandomStr } from "@/lib/getRandomStr";
import { useGlobalState } from "@/lib/gState";
import { log } from "@/lib/log";
import { indianNumberFormatter } from "@/lib/numFormator";
import { parseStrMath } from "@/lib/parseStrMath";
import { getInitials } from "@/lib/userTransactionsUtils";
import {
  buildExpenseItemsFromInvoice,
  buildInvoiceNote,
  parseInvoiceData,
  PDFParsedData,
  usePdfParser,
} from "@/lib/pdfParser";
import ReactiveKVStore from "@/lib/reactiveKV";
import { sendSMSMsg } from "@/lib/sendSMSMsg";
import updateWidget, { setWidgetDataDirty } from "@/widget/updateWidget";
import {
  Contact,
  getPermissionsAsync as getContactsPermissionsAsync,
  requestPermissionsAsync as requestContactsPermissionsAsync,
} from "expo-contacts";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useNavigationState } from "expo-router/build/react-navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import {
  deleteNoteImage,
  getNoteImageUri,
  saveImageAsWebP,
} from "@/lib/noteImageStorage";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import {
  Appbar,
  Avatar,
  Button,
  Card,
  Checkbox,
  Chip,
  DataTable,
  Dialog,
  Divider,
  HelperText,
  Icon,
  IconButton,
  List,
  Menu,
  Portal,
  SegmentedButtons,
  Surface,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { Dropdown, DropdownRef } from "react-native-paper-dropdown";

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

  const theme = useTheme<CustomPaperTheme>();
  const [amountTxt, setAmountTxt] = useState("");
  const [amountTitleTxt, setAmountTitleTxt] = useState("");
  const [amountArr, setAmountArr] = useState<
    { title: string; amount: number; id: number }[]
  >([]);

  const totalItemsAmount = useMemo(() => {
    const sum = amountArr.reduce(
      (acc, curr) => acc + (Number(curr.amount) || 0),
      0,
    );
    return Math.round(sum * 100) / 100;
  }, [amountArr]);

  const handleExpenseChange = (newExpense: ExpenseType) => {
    if (isLoading) return;
    setExpense(newExpense);
    const validSubExpenses = Expense.ExpenseObj[newExpense];
    if (!(validSubExpenses as readonly string[]).includes(subExpense)) {
      setSubExpense(validSubExpenses[0]);
    }
  };

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

  const creditPreview = useMemo(() => {
    if (expense !== "Credit") return null;
    const principal =
      totalItemsAmount > 0
        ? totalItemsAmount
        : Math.max(0, parseFloat(amountTxt) || 0);
    const rate = Math.max(0, parseFloat(interestRate) || 0) / 100;
    const time = Math.max(0, parseFloat(interestTimePeriod) || 0);

    let interestAmount = 0;
    let total = principal;

    if (interestType === "Simple" && rate > 0 && time > 0) {
      interestAmount = principal * rate * time;
      total = principal + interestAmount;
    } else if (interestType === "Compound" && rate > 0 && time > 0) {
      const n = getCompoundingFreqAsNum(compoundingFrequency ?? "yearly");
      total = principal * Math.pow(1 + rate / n, n * time);
      interestAmount = total - principal;
    }

    return {
      principal: Math.round(principal * 100) / 100,
      interest: Math.round(interestAmount * 100) / 100,
      total: Math.round(total * 100) / 100,
    };
  }, [
    expense,
    interestType,
    interestRate,
    interestTimePeriod,
    compoundingFrequency,
    totalItemsAmount,
    amountTxt,
  ]);

  const grandTotalDisplay = useMemo(() => {
    if (expense === "Credit" && creditPreview) {
      return creditPreview.total;
    }
    if (totalItemsAmount > 0) {
      return totalItemsAmount;
    }
    const [parsed, err] = parseStrMath(amountTxt);
    return !err && parsed !== null && parsed > 0 ? parsed : 0;
  }, [expense, creditPreview, totalItemsAmount, amountTxt]);

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

  const [noteImages, setNoteImages] = useState<string[]>([]);
  const [isImageProcessing, setIsImageProcessing] = useState(false);
  const [previewImageUri, setPreviewImageUri] = useState<string | null>(null);
  const newlyCreatedImagesRef = useRef<string[]>([]);
  const isSubmittedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (!isSubmittedRef.current && newlyCreatedImagesRef.current.length > 0) {
        for (const filename of newlyCreatedImagesRef.current) {
          deleteNoteImage(filename).catch(() => {});
        }
      }
    };
  }, []);

  const pickImageFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setIsImageProcessing(true);
        for (const asset of result.assets) {
          const filename = await saveImageAsWebP(asset.uri);
          newlyCreatedImagesRef.current.push(filename);
          setNoteImages((prev) => [...prev, filename]);
        }
      }
    } catch (e) {
      console.error("Failed to pick image from gallery:", e);
      setSnackbar({
        message: "Failed to pick image from gallery",
        type: "error",
      });
    } finally {
      setIsImageProcessing(false);
    }
  };

  const takePhotoWithCamera = async () => {
    try {
      const { granted } = await ImagePicker.requestCameraPermissionsAsync();
      if (!granted) {
        setSnackbar({
          message: "Camera permission is required to capture photos",
          type: "error",
        });
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setIsImageProcessing(true);
        for (const asset of result.assets) {
          const filename = await saveImageAsWebP(asset.uri);
          newlyCreatedImagesRef.current.push(filename);
          setNoteImages((prev) => [...prev, filename]);
        }
      }
    } catch (e) {
      console.error("Failed to capture photo:", e);
      setSnackbar({
        message: "Failed to capture photo",
        type: "error",
      });
    } finally {
      setIsImageProcessing(false);
    }
  };

  const removeNoteImageHandler = async (filenameToRemove: string) => {
    setNoteImages((prev) => prev.filter((f) => f !== filenameToRemove));
    if (!editData || !editData.noteImages?.includes(filenameToRemove)) {
      newlyCreatedImagesRef.current = newlyCreatedImagesRef.current.filter(
        (f) => f !== filenameToRemove,
      );
      await deleteNoteImage(filenameToRemove);
    }
  };

  const [invoiceIsLoading, setInvoiceIsLoading] = useState(false);
  const {
    isParsing: isPdfParsing,
    pickAndParsePdf,
    parsePdfFile,
    parserElement,
  } = usePdfParser();

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
          latitude: currentLocation.coords.latitude,
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
        const updated = await updateTransaction(editData.id, {
          amount: amoArr,
          expenseType: expense,
          subExpenseType: subExpense,
          toFrom: toFromTxt.name,
          toFromPhoneNumber: toFromTxt.number,
          note: noteTxt,
          noteImages,
          tags: selectedTags,
          interestType: expense === "Credit" ? interestType : "None",
          interestRate: expense === "Credit" ? interestRateNum : undefined,
          interestTime:
            expense === "Credit" ? interestTimePeriodNum : undefined,
          compoundingFrequency:
            expense === "Credit" ? compoundingFrequency : undefined,
        });

        dbInsertReturnId = updated?.id ?? editData.id;
      } else {
        const inserted = await createTransaction({
          amount: amoArr,
          expenseType: expense,
          subExpenseType: subExpense,
          toFrom: toFromTxt.name,
          toFromPhoneNumber: toFromTxt.number,
          note: noteTxt,
          noteImages,
          tags: selectedTags,
          interestType: expense === "Credit" ? interestType : "None",
          interestRate: expense === "Credit" ? interestRateNum : undefined,
          interestTime:
            expense === "Credit" ? interestTimePeriodNum : undefined,
          compoundingFrequency:
            expense === "Credit" ? compoundingFrequency : undefined,
          location,
        });

        dbInsertReturnId = inserted.id;
      }

      isSubmittedRef.current = true;

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
      setNoteImages([]);
      newlyCreatedImagesRef.current = [];
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

      if (returnToPreviousScreen) goBack(dbInsertReturnId);
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

  const goBack = (addedId?: number) => {
    updateWidget();

    if (editRouteData.isFromWidget === "true") {
      BackHandler.exitApp();
      return;
    }

    const ids = addedId ? [...newExpenseItemIds, addedId] : newExpenseItemIds;
    if (ids.length === 0) {
      if (router.canGoBack()) router.back();
      else router.replace("/(tabs)");
    } else {
      const targetRoute = previousRoute?.name
        ? `/${previousRoute.name}`
        : "/(tabs)";
      router.replace({
        pathname: targetRoute as any,
        params: {
          newExpenseItemIds: JSON.stringify(ids),
          mode: editData ? "edit" : "add",
        },
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
    getContactsPermissionsAsync()
      .then(async ({ status }) => {
        if (status !== "granted") {
          return;
        }
        try {
          const allContacts = await Contact.getAll();
          const contacts = await Promise.all(
            (allContacts || []).map(async (c) => {
              let name = "";
              let number = "";
              try {
                if (typeof c.getFullName === "function") {
                  name = (await c.getFullName()) || "";
                }
              } catch (_) {}
              try {
                if (typeof c.getPhones === "function") {
                  const phones = await c.getPhones();
                  number = phones?.[0]?.number ?? "";
                }
              } catch (_) {}
              return { name, number };
            }),
          );
          setContactList(contacts.filter((c) => c.name));
        } catch (err) {
          log.error("Failed to load contacts in background", err);
        }
      })
      .catch((err) => log.error("Failed to get contact permissions", err));
  }, [hasContactPermission]);

  useEffect(() => {
    if (!editRouteData.id) return setIsLoading(false);
    const idNum = parseInt(editRouteData.id);
    if (!idNum || isNaN(idNum)) return setIsLoading(false);
    const loadEditData = async () => {
      try {
        setIsLoading(true);
        const data = await getTransactionById(idNum);

        if (!data) return setEditData(false);
        setExpense(data.expenseType);
        setSubExpense(data.subExpenseType);
        setAmountArr(data.amount.map((a) => ({ ...a, id: Math.random() })));
        setToFromTxt({
          name: data.toFrom,
          number: data.toFromPhoneNumber,
        });
        setNoteTxt(data.note ?? "");
        setNoteImages(data.noteImages ?? []);
        newlyCreatedImagesRef.current = [];
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
    try {
      setInvoiceIsLoading(true);
      let data: PDFParsedData | null = null;

      if (invoicePDFPath) {
        setSnackbar({ message: "Scanning invoice...", type: "info" });
        const rawResult = await parsePdfFile(invoicePDFPath);
        data = parseInvoiceData(rawResult);
      } else {
        const pickRes = await pickAndParsePdf();
        if (!pickRes.fileUri || !pickRes.invoiceData) {
          return;
        }
        data = pickRes.invoiceData;
      }

      if (
        !data ||
        (data.items.length === 0 &&
          !data.invoiceNumber &&
          !data.totalAmount &&
          !data.finalTotalAmount)
      ) {
        setSnackbar({
          message: "No invoice details found in the selected PDF.",
          type: "warning",
        });
        return;
      }

      // 1. Company name to toFrom input field
      if (data.invoiceFrom) {
        setToFromTxt({ name: data.invoiceFrom, number: null });
      }

      // 2. Items list with miscellaneous difference
      const newItems = buildExpenseItemsFromInvoice(data);
      if (newItems.length > 0) {
        setAmountArr(newItems);
        setAmountTitleTxt("");
        setAmountTxt("");
      }

      // 3. Invoice numbers, date, and other data in the note section
      const noteStr = buildInvoiceNote(data);
      if (noteStr) {
        setNoteTxt((prev) =>
          prev && prev.trim() ? `${prev.trim()}\n${noteStr}` : noteStr,
        );
      }

      setSnackbar({
        message: `Scanned ${data.invoiceFrom || "Invoice"}: ${newItems.length} items added`,
        type: "info",
      });
    } catch (error) {
      log.error("Failed to parse invoice in AddExpense:", error);
      setSnackbar({
        message: "Failed to scan invoice PDF.",
        type: "error",
      });
    } finally {
      setInvoiceIsLoading(false);
    }
  };

  const filteredContacts = contactList.filter(
    (e) =>
      toFromTxt.name.trim() !== "" &&
      e?.name?.toLowerCase().includes(toFromTxt.name.toLowerCase()),
  );
  const isContactMenuVisible =
    isContactListVisible && filteredContacts.length > 0;

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
      {parserElement}
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => goBack()} />
        <Appbar.Content
          title={editData ? "Edit Expense" : "Add Expense"}
          subtitle={
            editData
              ? `Editing entry #${editData.id}`
              : `${expense} • ${subExpense}`
          }
        />
        {__DEV__ ? (
          <Appbar.Action icon={"plus-box"} onPress={devRandomInpValHandler} />
        ) : null}
        <Appbar.Action
          icon={"receipt-text"}
          onPress={() => parseInvoideHandler()}
          loading={invoiceIsLoading || isPdfParsing}
          disabled={invoiceIsLoading || isPdfParsing}
        />
      </Appbar.Header>
      <KeyboardAwareScrollView
        style={{ flex: 1, backgroundColor: theme.colors.background }}
        refreshControl={<RefreshControl refreshing={isLoading} />}
        bottomOffset={20}
        contentContainerStyle={{
          padding: 14,
          gap: 14,
          paddingBottom: 80,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Card 1: Transaction Type & Direction */}
        <Card
          mode="elevated"
          elevation={1}
          style={{
            borderRadius: 16,
            backgroundColor: theme.colors.surface,
          }}
        >
          <Card.Content style={{ gap: 12, padding: 14 }}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <Icon
                source="swap-horizontal-circle-outline"
                size={20}
                color={theme.colors.primary}
              />
              <Text
                variant="titleSmall"
                style={{ fontWeight: "700", color: theme.colors.onSurface }}
              >
                Transaction Type
              </Text>
            </View>

            <SegmentedButtons
              value={expense}
              onValueChange={(val) => handleExpenseChange(val as ExpenseType)}
              buttons={[
                {
                  value: "Simple Expense",
                  label: "Simple Expense",
                  icon: "cash-multiple",
                },
                {
                  value: "Credit",
                  label: "Credit",
                  icon: "handshake-outline",
                },
              ]}
              theme={{ roundness: 3 }}
            />

            <View
              onStartShouldSetResponderCapture={() => {
                expenseAmountInpRef?.current?.focus();
                return false;
              }}
            >
              <SegmentedButtons
                value={subExpense}
                onValueChange={(e) =>
                  isLoading ? null : setSubExpense(e as SubExpenseType)
                }
                buttons={Expense.ExpenseObj[expense].map((e) => ({
                  value: e,
                  label: e,
                  icon:
                    e === "Send" || e === "Lend"
                      ? "arrow-top-right"
                      : "arrow-bottom-left",
                }))}
                theme={{ roundness: 3 }}
              />
            </View>
          </Card.Content>
        </Card>
        {/* Card 2: Items & Pricing */}
        <Card
          mode="elevated"
          elevation={1}
          style={{
            borderRadius: 16,
            backgroundColor: theme.colors.surface,
          }}
        >
          <Card.Content style={{ gap: 12, padding: 14 }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <Icon
                  source="format-list-numbered"
                  size={20}
                  color={theme.colors.primary}
                />
                <Text
                  variant="titleSmall"
                  style={{ fontWeight: "700", color: theme.colors.onSurface }}
                >
                  Items & Amount
                </Text>
              </View>
              {amountArr.length > 0 && (
                <Chip compact icon="tag-outline" style={{ height: 28 }}>
                  {amountArr.length}{" "}
                  {amountArr.length === 1 ? "item" : "items"}
                </Chip>
              )}
            </View>

            {/* Quick invoice PDF banner when empty */}
            {amountArr.length === 0 && (
              <Surface
                elevation={0}
                style={{
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: theme.colors.surfaceVariant,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <View
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <Icon
                    source="receipt-text-outline"
                    size={24}
                    color={theme.colors.primary}
                  />
                  <View style={{ flex: 1 }}>
                    <Text variant="labelLarge" style={{ fontWeight: "600" }}>
                      Have a PDF invoice?
                    </Text>
                    <Text
                      variant="bodySmall"
                      style={{ color: theme.colors.onSurfaceVariant }}
                    >
                      Auto-extract items, prices & vendor
                    </Text>
                  </View>
                </View>
                <Button
                  mode="contained-tonal"
                  compact
                  icon="file-upload-outline"
                  onPress={() => parseInvoideHandler()}
                  loading={invoiceIsLoading || isPdfParsing}
                  disabled={invoiceIsLoading || isPdfParsing}
                >
                  Scan PDF
                </Button>
              </Surface>
            )}

            {/* Added Items List */}
            {amountArr.length > 0 && (
              <Surface
                elevation={0}
                style={{
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: theme.colors.outlineVariant,
                  overflow: "hidden",
                }}
              >
                {amountArr.map((item, index) => (
                  <View key={item.id}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingVertical: 10,
                        paddingHorizontal: 12,
                        backgroundColor:
                          index % 2 === 0
                            ? "transparent"
                            : theme.colors.surfaceVariant + "30",
                        gap: 10,
                      }}
                    >
                      <View
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          backgroundColor: theme.colors.primaryContainer,
                          justifyContent: "center",
                          alignItems: "center",
                        }}
                      >
                        <Text
                          variant="labelSmall"
                          style={{
                            fontWeight: "700",
                            color: theme.colors.onPrimaryContainer,
                          }}
                        >
                          {index + 1}
                        </Text>
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text
                          variant="bodyMedium"
                          style={{ fontWeight: "600" }}
                          numberOfLines={2}
                        >
                          {item.title}
                        </Text>
                      </View>

                      <Text
                        variant="titleMedium"
                        style={{
                          fontWeight: "700",
                          color: theme.colors.primary,
                        }}
                      >
                        ₹{indianNumberFormatter.format(item.amount)}
                      </Text>

                      <View
                        style={{ flexDirection: "row", alignItems: "center" }}
                      >
                        <IconButton
                          disabled={isLoading}
                          icon="pencil-outline"
                          size={18}
                          style={{ margin: 0 }}
                          onPress={() => {
                            let arr = amountArr.filter((a) => a.id !== item.id);
                            if (amountTitleTxt.trim() && amountTxt.trim()) {
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
                        <IconButton
                          disabled={isLoading}
                          icon="close-circle-outline"
                          iconColor={theme.colors.error}
                          size={18}
                          style={{ margin: 0 }}
                          onPress={() => {
                            setAmountArr(
                              amountArr.filter((a) => a.id !== item.id),
                            );
                          }}
                        />
                      </View>
                    </View>
                    {index < amountArr.length - 1 && (
                      <Divider style={{ opacity: 0.5 }} />
                    )}
                  </View>
                ))}

                {/* Subtotal row */}
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    backgroundColor: theme.colors.surfaceVariant,
                    borderTopWidth: 1,
                    borderTopColor: theme.colors.outlineVariant,
                  }}
                >
                  <Text variant="titleSmall" style={{ fontWeight: "700" }}>
                    Total ({amountArr.length}{" "}
                    {amountArr.length === 1 ? "item" : "items"})
                  </Text>
                  <Text
                    variant="titleMedium"
                    style={{ fontWeight: "bold", color: theme.colors.primary }}
                  >
                    ₹{indianNumberFormatter.format(totalItemsAmount)}
                  </Text>
                </View>
              </Surface>
            )}

            {/* Input fields to add an item */}
            <View style={{ gap: 8, marginTop: 4 }}>
              <Text
                variant="labelMedium"
                style={{
                  color: theme.colors.onSurfaceVariant,
                  fontWeight: "500",
                }}
              >
                {amountArr.length === 0
                  ? "Enter Amount & Title"
                  : "Add Another Item"}
              </Text>

              <View
                style={{
                  flexDirection: "row",
                  gap: 8,
                  alignItems: "flex-start",
                }}
              >
                <TextInput
                  testID="add-expense-screen-amount-input"
                  disabled={isLoading}
                  ref={expenseAmountInpRef}
                  label="Amount*"
                  placeholder="0.00"
                  left={<TextInput.Affix text="₹" />}
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
                      icon={
                        isAmountNumericKeyboard
                          ? "calculator-variant-outline"
                          : "numeric"
                      }
                      disabled={isLoading}
                      onPress={() => setIsAmountNumericKeyboard((p) => !p)}
                    />
                  }
                  error={amountInpErr !== ""}
                  onSubmitEditing={() => {
                    expenseAmountTitleRef?.current?.focus();
                  }}
                />
                <IconButton
                  disabled={isLoading}
                  icon="information-outline"
                  onPress={() => setIsMathInputInfoDialogShow(true)}
                  mode="outlined"
                  style={{ marginTop: 6 }}
                />
              </View>
              {amountInpErr !== "" && (
                <HelperText type="error" visible style={{ marginTop: -4 }}>
                  {amountInpErr}
                </HelperText>
              )}

              <View
                style={{
                  flexDirection: "row",
                  gap: 8,
                  alignItems: "flex-start",
                }}
              >
                <TextInput
                  testID="add-expense-title-input"
                  disabled={isLoading}
                  ref={expenseAmountTitleRef}
                  label="Title*"
                  placeholder="e.g. Groceries, Dinner, Rent..."
                  mode="outlined"
                  style={{ flex: 1 }}
                  value={amountTitleTxt}
                  onChangeText={(text) => {
                    setAmountTitleTxt(text.slice(0, 100));
                    setAmountTitleTxtErr("");
                  }}
                  maxLength={100}
                  error={amountTitleTxtErr !== ""}
                  onSubmitEditing={addAmountToListHandler}
                />
                <Button
                  testID="add-expense-add-item-btn"
                  disabled={isLoading}
                  icon="plus"
                  mode="contained-tonal"
                  onPress={addAmountToListHandler}
                  style={{ marginTop: 6, minWidth: 84 }}
                >
                  Add
                </Button>
              </View>
              {amountTitleTxtErr !== "" && (
                <HelperText type="error" visible style={{ marginTop: -4 }}>
                  {amountTitleTxtErr}
                </HelperText>
              )}
            </View>
          </Card.Content>
        </Card>
        {/* Card 3: Counterparty & Notes */}
        <Card
          mode="elevated"
          elevation={1}
          style={{
            borderRadius: 16,
            backgroundColor: theme.colors.surface,
          }}
        >
          <Card.Content style={{ gap: 12, padding: 14 }}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <Icon
                source="card-account-details-outline"
                size={20}
                color={theme.colors.primary}
              />
              <Text
                variant="titleSmall"
                style={{ fontWeight: "700", color: theme.colors.onSurface }}
              >
                {subExpense === "Borrow" || subExpense === "Receive"
                  ? "Source (From)"
                  : "Recipient / Vendor (To)"}
              </Text>
            </View>

            <Menu
              visible={isContactMenuVisible}
              onDismiss={() => setIsContactListVisible(false)}
              anchorPosition="bottom"
              anchor={
                <TextInput
                  testID="add-expense-tofrom-input"
                  disabled={isLoading}
                  onFocus={() => setIsContactListVisible(true)}
                  onBlur={() => setIsContactListVisible(false)}
                  ref={toFromInputRef}
                  label={
                    subExpense === "Borrow" || subExpense === "Receive"
                      ? "From*"
                      : "To*"
                  }
                  placeholder="Contact or merchant name..."
                  left={<TextInput.Icon icon="account-outline" />}
                  right={
                    <TextInput.Icon
                      disabled={isLoading}
                      icon="contacts-outline"
                      onPress={pickContact}
                    />
                  }
                  mode="outlined"
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
              {filteredContacts.slice(0, 5).map((item) => (
                <List.Item
                  key={item.name}
                  title={item.name}
                  description={item.number || undefined}
                  left={() => (
                    <Avatar.Text
                      size={32}
                      label={getInitials(item.name)}
                      style={{ alignSelf: "center", marginLeft: 8 }}
                    />
                  )}
                  onPress={() => {
                    setToFromTxt({
                      name: item.name,
                      number: item.number ?? null,
                    });
                    setIsContactListVisible(false);
                    setToFromTxtErr("");
                  }}
                />
              ))}
            </Menu>
            {toFromTxtErr !== "" && (
              <HelperText type="error" visible style={{ marginTop: -8 }}>
                {toFromTxtErr}
              </HelperText>
            )}

            <TextInput
              testID="add-expense-note-input"
              disabled={isLoading}
              ref={noteInputRef}
              label="Note (optional)"
              placeholder="Add note, receipt reference, remarks..."
              mode="outlined"
              style={{ minHeight: 88, maxHeight: 180 }}
              value={noteTxt}
              onChangeText={setNoteTxt}
              maxLength={600}
              multiline
            />
            {noteTxtErr !== "" && (
              <HelperText type="error" visible style={{ marginTop: -8 }}>
                {noteTxtErr}
              </HelperText>
            )}

            {/* Note Image Attachments */}
            <View style={{ marginTop: 8, gap: 10 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                >
                  <Icon
                    source="paperclip"
                    size={18}
                    color={theme.colors.primary}
                  />
                  <Text
                    variant="labelLarge"
                    style={{
                      fontWeight: "600",
                      color: theme.colors.onSurface,
                    }}
                  >
                    Receipt Photos{" "}
                    {noteImages.length > 0 ? `(${noteImages.length})` : ""}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <Button
                    testID="add-expense-take-photo-btn"
                    mode="outlined"
                    compact
                    icon="camera"
                    disabled={isLoading || isImageProcessing}
                    onPress={takePhotoWithCamera}
                    style={{ borderRadius: 20 }}
                  >
                    Camera
                  </Button>
                  <Button
                    testID="add-expense-pick-gallery-btn"
                    mode="outlined"
                    compact
                    icon="image-outline"
                    disabled={isLoading || isImageProcessing}
                    onPress={pickImageFromGallery}
                    style={{ borderRadius: 20 }}
                  >
                    Gallery
                  </Button>
                </View>
              </View>

              {isImageProcessing && (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    paddingVertical: 4,
                  }}
                >
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                  <Text
                    variant="bodySmall"
                    style={{ color: theme.colors.onSurfaceVariant }}
                  >
                    Compressing & attaching image...
                  </Text>
                </View>
              )}

              {noteImages.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 10, paddingVertical: 4 }}
                >
                  {noteImages.map((filename, index) => {
                    const uri = getNoteImageUri(filename);
                    return (
                      <View
                        key={filename + index}
                        style={{
                          position: "relative",
                          width: 80,
                          height: 80,
                          borderRadius: 10,
                          borderWidth: 1,
                          borderColor: theme.colors.outlineVariant,
                          overflow: "hidden",
                          backgroundColor: theme.colors.surfaceVariant,
                        }}
                      >
                        <Pressable
                          style={{ flex: 1 }}
                          onPress={() => setPreviewImageUri(uri)}
                        >
                          <Image
                            source={{ uri }}
                            style={{ width: "100%", height: "100%" }}
                            contentFit="cover"
                            transition={200}
                          />
                        </Pressable>
                        <IconButton
                          testID={`remove-note-image-${index}`}
                          icon="close-circle"
                          iconColor={theme.colors.error}
                          size={20}
                          style={{
                            position: "absolute",
                            top: -6,
                            right: -6,
                            backgroundColor: theme.colors.surface,
                            margin: 0,
                          }}
                          onPress={() => removeNoteImageHandler(filename)}
                        />
                      </View>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          </Card.Content>
        </Card>

        {/* Card 4: Credit & Interest Terms (Only when expense === "Credit") */}
        {expense === "Credit" && (
          <Card
            mode="elevated"
            elevation={1}
            style={{
              borderRadius: 16,
              backgroundColor: theme.colors.surface,
            }}
          >
            <Card.Content style={{ gap: 12, padding: 14 }}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <Icon
                  source="percent-outline"
                  size={20}
                  color={theme.colors.primary}
                />
                <Text
                  variant="titleSmall"
                  style={{ fontWeight: "700", color: theme.colors.onSurface }}
                >
                  Credit & Interest Terms
                </Text>
              </View>

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
                    isLoading ? null : setInterestType(e as InterestType)
                  }
                  buttons={InterestArr.map((i) => ({ value: i, label: i }))}
                  theme={{ roundness: 3 }}
                />
              </View>

              {interestType !== "None" && (
                <View style={{ gap: 10 }}>
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <TextInput
                        disabled={isLoading}
                        ref={interestRateInputRef}
                        label="Interest Rate (%)"
                        placeholder="e.g. 10"
                        right={<TextInput.Affix text="%" />}
                        mode="outlined"
                        value={interestRate}
                        error={interestRateErr !== ""}
                        onChangeText={(txt) => {
                          const newTxt = txt.replace(/[^0-9.]/g, "");
                          let num = parseFloat(newTxt);
                          setInterestRate(newTxt);
                          if (num <= 0) {
                            setInterestRateErr("Rate must be > 0");
                          } else {
                            setInterestRateErr("");
                          }
                        }}
                        onSubmitEditing={() =>
                          interestTimePeriodInputRef.current?.focus()
                        }
                      />
                      {interestRateErr !== "" && (
                        <HelperText type="error" visible>
                          {interestRateErr}
                        </HelperText>
                      )}
                    </View>

                    <View style={{ flex: 1 }}>
                      <TextInput
                        disabled={isLoading}
                        ref={interestTimePeriodInputRef}
                        label="Duration (Years)"
                        placeholder="e.g. 1"
                        right={<TextInput.Affix text="yr" />}
                        mode="outlined"
                        value={interestTimePeriod}
                        error={interestTimePeriodErr !== ""}
                        onChangeText={(txt) => {
                          const newTxt = txt.replace(/[^0-9.]/g, "");
                          let num = parseFloat(newTxt);
                          setInterestTimePeriod(newTxt);
                          if (num <= 0) {
                            setInterestTimePeriodErr("Duration must be > 0");
                          } else {
                            setInterestTimePeriodErr("");
                          }
                        }}
                        onSubmitEditing={() =>
                          compoundingFrequencyInputRef.current?.focus()
                        }
                      />
                      {interestTimePeriodErr !== "" && (
                        <HelperText type="error" visible>
                          {interestTimePeriodErr}
                        </HelperText>
                      )}
                    </View>
                  </View>

                  {interestType === "Compound" && (
                    <View>
                      <Dropdown
                        disabled={isLoading}
                        label="Compounding Frequency"
                        placeholder="Compounding Frequency"
                        options={
                          CompoundingFrequencyObj as Mutable<
                            typeof CompoundingFrequencyObj
                          >
                        }
                        value={compoundingFrequency}
                        onSelect={(val) =>
                          val && setCompoundingFrequency(val as any)
                        }
                        ref={compoundingFrequencyInputRef}
                        mode="outlined"
                      />
                      {compoundingFrequencyErr !== "" && (
                        <HelperText type="error" visible>
                          {compoundingFrequencyErr}
                        </HelperText>
                      )}
                    </View>
                  )}

                  {/* Live Credit Interest Preview Banner */}
                  {creditPreview && (
                    <Surface
                      elevation={0}
                      style={{
                        padding: 12,
                        borderRadius: 12,
                        backgroundColor: theme.colors.surfaceVariant,
                        gap: 6,
                      }}
                    >
                      <Text
                        variant="labelMedium"
                        style={{
                          fontWeight: "700",
                          color: theme.colors.onSurfaceVariant,
                        }}
                      >
                        Estimated Repayment Breakdown
                      </Text>
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                        }}
                      >
                        <Text
                          variant="bodySmall"
                          style={{ color: theme.colors.onSurfaceVariant }}
                        >
                          Principal Amount:
                        </Text>
                        <Text
                          variant="bodySmall"
                          style={{ fontWeight: "600" }}
                        >
                          ₹{indianNumberFormatter.format(creditPreview.principal)}
                        </Text>
                      </View>
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                        }}
                      >
                        <Text
                          variant="bodySmall"
                          style={{ color: theme.colors.onSurfaceVariant }}
                        >
                          {interestType} Interest:
                        </Text>
                        <Text
                          variant="bodySmall"
                          style={{
                            fontWeight: "600",
                            color: theme.colors.primary,
                          }}
                        >
                          +₹{indianNumberFormatter.format(creditPreview.interest)}
                        </Text>
                      </View>
                      <Divider style={{ marginVertical: 4 }} />
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <Text
                          variant="labelLarge"
                          style={{ fontWeight: "700" }}
                        >
                          Total {subExpense === "Lend" ? "Receivable" : "Repayable"}:
                        </Text>
                        <Text
                          variant="titleMedium"
                          style={{
                            fontWeight: "bold",
                            color: theme.colors.primary,
                          }}
                        >
                          ₹{indianNumberFormatter.format(creditPreview.total)}
                        </Text>
                      </View>
                    </Surface>
                  )}
                </View>
              )}
            </Card.Content>
          </Card>
        )}

        {/* Card 5: Tags & Location */}
        <Card
          mode="elevated"
          elevation={1}
          style={{
            borderRadius: 16,
            backgroundColor: theme.colors.surface,
          }}
        >
          <Card.Content style={{ gap: 14, padding: 14 }}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <Icon
                source="tag-multiple-outline"
                size={20}
                color={theme.colors.primary}
              />
              <Text
                variant="titleSmall"
                style={{ fontWeight: "700", color: theme.colors.onSurface }}
              >
                Tags & Location
              </Text>
            </View>

            {/* Tags */}
            <View style={{ gap: 8 }}>
              <Text
                variant="labelMedium"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                Tags
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 6,
                  alignItems: "center",
                }}
              >
                {tags.map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <Chip
                      key={tag}
                      mode={isSelected ? "flat" : "outlined"}
                      selected={isSelected}
                      showSelectedOverlay
                      icon={isSelected ? "check" : "tag-outline"}
                      disabled={isLoading}
                      onPress={() => toggleSelectedTagHandler(tag)}
                    >
                      {tag}
                    </Chip>
                  );
                })}
                <Chip
                  mode="outlined"
                  icon="plus"
                  disabled={isLoading}
                  onPress={() => setAddTagDialogShow(true)}
                >
                  Add tag
                </Chip>
              </View>
            </View>

            <Divider />

            {/* Location toggle row */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <View
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <Icon
                  source={
                    currentLocation ? "map-marker-check" : "map-marker-outline"
                  }
                  size={22}
                  color={
                    currentLocation
                      ? theme.colors.primary
                      : theme.colors.onSurfaceVariant
                  }
                />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyMedium" style={{ fontWeight: "600" }}>
                    Add current location
                  </Text>
                  <Text
                    variant="bodySmall"
                    style={{ color: theme.colors.onSurfaceVariant }}
                  >
                    {isLoactionLoading
                      ? "Fetching GPS location..."
                      : currentLocation
                        ? "Location coordinates captured"
                        : "Attach current place to transaction"}
                  </Text>
                </View>
              </View>
              <View style={{ justifyContent: "center", alignItems: "center" }}>
                {isLoactionLoading ? (
                  <ActivityIndicator size={24} style={{ padding: 6 }} />
                ) : (
                  <Checkbox
                    status={addLocation ? "checked" : "unchecked"}
                    onPress={() => setAddLocation(!addLocation)}
                    disabled={isLoading}
                  />
                )}
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Bottom Grand Total & Action Area */}
        <Surface
          elevation={1}
          style={{
            marginTop: 6,
            borderRadius: 16,
            padding: 16,
            backgroundColor: theme.colors.elevation.level1,
            gap: 12,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <View>
              <Text
                variant="labelMedium"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {expense === "Credit" && interestType !== "None"
                  ? `Total Payable (${amountArr.length || 1} ${amountArr.length === 1 || amountArr.length === 0 ? "item" : "items"})`
                  : `Grand Total (${amountArr.length || 1} ${amountArr.length === 1 || amountArr.length === 0 ? "item" : "items"})`}
              </Text>
              <Text
                variant="headlineSmall"
                style={{ fontWeight: "bold", color: theme.colors.primary }}
              >
                ₹{indianNumberFormatter.format(grandTotalDisplay)}
              </Text>
            </View>
            <Chip
              icon={
                expense === "Credit"
                  ? "handshake-outline"
                  : subExpense === "Receive"
                    ? "arrow-bottom-left"
                    : "arrow-top-right"
              }
              mode="outlined"
            >
              {expense === "Credit" ? subExpense : subExpense}
            </Chip>
          </View>

          <Divider />

          <View style={{ gap: 8 }}>
            <Button
              testID="add-expense-submit-return-btn"
              mode="contained"
              icon="check-circle-outline"
              onPress={() => onAddExpenseHandler(true)}
              disabled={isLoading}
              loading={isLoading}
              contentStyle={{ height: 48 }}
              style={{ borderRadius: 12 }}
            >
              {editData ? "Edit & return" : "Add & return"}
            </Button>
            <Button
              testID="add-expense-submit-btn"
              mode="contained-tonal"
              icon="plus-circle-outline"
              onPress={() => onAddExpenseHandler()}
              disabled={isLoading}
              loading={isLoading}
              contentStyle={{ height: 48 }}
              style={{ borderRadius: 12 }}
            >
              {editData ? "Edit" : "Add"}
            </Button>
          </View>
        </Surface>

        <Portal>
          <Dialog
            visible={isMathInputInfoDialogShow}
            onDismiss={() => setIsMathInputInfoDialogShow(false)}
          >
            <Dialog.Title>Math Expressions</Dialog.Title>
            <Dialog.Content style={{ gap: 6 }}>
              <Text variant="bodyMedium">
                You can enter math equations directly in the amount box:
              </Text>
              <View style={{ gap: 4, marginTop: 4 }}>
                <Text variant="bodySmall">
                  • <Text style={{ fontWeight: "bold" }}>+</Text> Addition (e.g.
                  100 + 50)
                </Text>
                <Text variant="bodySmall">
                  • <Text style={{ fontWeight: "bold" }}>-</Text> Subtraction (e.g.
                  200 - 45)
                </Text>
                <Text variant="bodySmall">
                  • <Text style={{ fontWeight: "bold" }}>*</Text> Multiplication (e.g.
                  12 * 4)
                </Text>
                <Text variant="bodySmall">
                  • <Text style={{ fontWeight: "bold" }}>/</Text> Division (e.g.
                  500 / 3)
                </Text>
                <Text variant="bodySmall">
                  • <Text style={{ fontWeight: "bold" }}>^</Text> Power,{" "}
                  <Text style={{ fontWeight: "bold" }}>!</Text> Factorial
                </Text>
                <Text variant="bodySmall">• Parentheses: 2 * (50 + 25)</Text>
              </View>
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setIsMathInputInfoDialogShow(false)}>
                Got it
              </Button>
            </Dialog.Actions>
          </Dialog>

          <Dialog
            visible={!!previewImageUri}
            onDismiss={() => setPreviewImageUri(null)}
            style={{ borderRadius: 16 }}
          >
            <Dialog.Title>Receipt Attachment</Dialog.Title>
            <Dialog.Content style={{ alignItems: "center" }}>
              {previewImageUri ? (
                <Image
                  source={{ uri: previewImageUri }}
                  style={{ width: "100%", height: 320, borderRadius: 8 }}
                  contentFit="contain"
                />
              ) : null}
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setPreviewImageUri(null)}>Close</Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      </KeyboardAwareScrollView>
    </>
  );
}
