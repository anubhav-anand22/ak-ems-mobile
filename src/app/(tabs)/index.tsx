import { AdvanceSearch, AdvanceSearchRef } from "@/components/ui/AdvanceSearch";
import Seperator from "@/components/ui/Seperator";
import { Expense, ExpenseType, ExpenseTypeA } from "@/constants/expense";
import { CustomPaperTheme } from "@/constants/paperTheme";
import {
  addCreditPayment,
  convertTransactionType,
  deleteTransactionWithWallets,
  deleteTransactionsWithWallets,
  getTransactionById,
  getTransactions,
  getTransactionsByIds,
  getWallets,
  TransactionType,
  updateCreditPayment,
  WalletType,
} from "@/db";
import { debounce } from "@/lib/debounce";
import { formatSmartDate } from "@/lib/formatSmartDate";
import { getRandomStr } from "@/lib/getRandomStr";
import { getTotalAmount } from "@/lib/getTotalAmount";
import { ConfirmData, useGlobalState } from "@/lib/gState";
import { log } from "@/lib/log";
import { indianNumberFormatter } from "@/lib/numFormator";
import { extractCoordinates, openLocationInGoogleMaps } from "@/lib/locationUtils";
import { getTransactionLinkedWallets } from "@/lib/walletUtils";
import ReactiveKVStore from "@/lib/reactiveKV";
import { sendSMSMsg } from "@/lib/sendSMSMsg";
import updateWidget from "@/widget/updateWidget";
import { FlashList, FlashListRef } from "@shopify/flash-list";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BackHandler,
  Dimensions,
  Pressable,
  RefreshControl,
  ScrollView,
  TextInput as RNTextInput,
  ScaledSize,
  StyleSheet,
  View,
} from "react-native";
import { Image } from "expo-image";
import { getNoteImageUri } from "@/lib/noteImageStorage";
import {
  Appbar,
  Button,
  Card,
  Chip,
  DataTable,
  Divider,
  FAB,
  Icon,
  IconButton,
  Menu,
  SegmentedButtons,
  Text,
  useTheme,
} from "react-native-paper";
import Animated, {
  createAnimatedComponent,
  FadeIn,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";
import { HeaderUserButton } from "@/components/user-transactions/HeaderUserButton";
import { RecentUsersModal } from "@/components/user-transactions/RecentUsersModal";
import { UserSummaryDialog } from "@/components/user-transactions/UserSummaryDialog";
import { TransactionDetailDialog } from "@/components/user-transactions/TransactionDetailDialog";
import { FullScreenImageViewer } from "@/components/ui/FullScreenImageViewer";
import { SelectedTransactionsSummaryModal } from "@/components/user-transactions/SelectedTransactionsSummaryModal";
import { ExportTransactionsModal } from "@/components/ui/ExportTransactionsModal";
import { useRecentUsers } from "@/hooks/useRecentUsers";
import { useUserTransactions } from "@/hooks/useUserTransactions";

const AnimatedCard = createAnimatedComponent(Card);

export type LoadTxParams = {
  isLoadMore?: boolean;
  overrideSearch?: string;
  timeRange?: { start?: Date; end?: Date };
  tags?: string[];
  amountRange?: { min?: number; max?: number };
  toFrom?: string[];
};

type UserExplorerState =
  | { step: "closed" }
  | { step: "recent-users" }
  | { step: "user-summary"; userName: string; phoneNumber: string | null }
  | {
      step: "transaction-detail";
      userName: string;
      phoneNumber: string | null;
      transaction: TransactionType;
    };

export default function HomeScreen() {
  const theme = useTheme<CustomPaperTheme>();

  const router = useRouter();
  const homeScreenRouteData = useLocalSearchParams<{
    newExpenseItemIds?: string;
    mode?: "edit" | "add";
  }>();

  const flashlistRef = useRef<FlashListRef<TransactionType>>(null);
  const fetchIdRef = useRef(0); // Tracks the latest request to prevent search race conditions
  const advanceSearchRef = useRef<AdvanceSearchRef>(null);
  const addConfirm = useGlobalState((s) => s.addConfirm);
  const setSnackbar = useGlobalState((s) => s.setSnackbar);
  const dimention = Dimensions.get("window");

  const [transactions, setTransactions] = useState<TransactionType[]>([]);
  const [wallets, setWallets] = useState<WalletType[]>([]);
  const [fullScreenImageUri, setFullScreenImageUri] = useState<string | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [lastItem, setLastItem] = useState<{ id: number; updatedAt: Date } | undefined>(undefined);
  const [hasReachedEnd, setHasReachedEnd] = useState(false);
  const [selected, setSelected] = useState(() => new Set<number>());
  const [isSummaryModalVisible, setIsSummaryModalVisible] = useState(false);
  const [isExportModalVisible, setIsExportModalVisible] = useState(false);
  const [isSelectionMenuVisible, setIsSelectionMenuVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchInpShow, setIsSearchInpShow] = useState(false);
  const [menuPos, setMenuPos] = useState<{
    x: number;
    y: number;
    itemId: number;
    itemIndex: number;
    isCredit?: boolean;
  } | null>(null);
  const [isAdvanceSearchVisible, setIsAdvanceSearchVisible] = useState(false);
  // const [txType, setTxType] = useState<ExpenseType | "All">("All");
  const txType = ReactiveKVStore.useReactiveKVStore(s => s.expenseTypeA);
  const setTxType = ReactiveKVStore.useReactiveKVStore(s => s.setExpenseTypeA);
  const [userExplorer, setUserExplorer] = useState<UserExplorerState>({
    step: "closed",
  });
  const recentUsersState = useRecentUsers(userExplorer.step === "recent-users");
  const selectedExplorerUser =
    userExplorer.step === "user-summary" ||
    userExplorer.step === "transaction-detail"
      ? userExplorer.userName
      : null;
  const userTransactionsState = useUserTransactions(selectedExplorerUser);

  useEffect(() => {
    if (!isSearchInpShow) {
      setIsAdvanceSearchVisible(false);
    }
  }, [isSearchInpShow]);

  useEffect(() => {
    loadTransactions({ isLoadMore: false });
    console.log({ txType });
  }, [txType]);

  const loadTransactions = useCallback(
    async ({
      isLoadMore = false,
      overrideSearch,
      timeRange,
      tags,
      amountRange,
      toFrom,
    }: LoadTxParams) => {
      const currentFetchId = ++fetchIdRef.current;
      const searchTxt = (overrideSearch ?? searchQuery).trim();

      try {
        if (isLoadMore && hasReachedEnd) return;

        setIsLoading(true);

        const limit = 14;
        const currentLastItem = isLoadMore ? lastItem : undefined;

        const fetchedTransactions = await getTransactions({
          txType,
          searchTxt,
          timeRange,
          tags,
          amountRange,
          toFrom,
          cursor: currentLastItem
            ? { id: currentLastItem.id, updatedAt: currentLastItem.updatedAt }
            : null,
          limit,
        });

        // Discard stale request
        if (currentFetchId !== fetchIdRef.current) {
          return;
        }

        if (fetchedTransactions.length > 0) {
          const last = fetchedTransactions[fetchedTransactions.length - 1];
          setLastItem({ id: last.id, updatedAt: last.updatedAt });
        } else if (!isLoadMore) {
          setLastItem(undefined);
        }

        setHasReachedEnd(fetchedTransactions.length < limit);

        if (isLoadMore) {
          setTransactions((prev) => [...prev, ...fetchedTransactions]);
        } else {
          setTransactions(fetchedTransactions);
        }
      } catch (e) {
        log.error(e);
      } finally {
        if (currentFetchId === fetchIdRef.current) {
          setIsLoading(false);
        }
      }
    },
    [hasReachedEnd, lastItem, searchQuery, txType],
  );


  const deleteItem = useCallback(
    async (id: number, revertWalletBalances: boolean = false) => {
      try {
        await deleteTransactionWithWallets(id, revertWalletBalances);
        setTransactions((prev) => prev.filter((item) => item.id !== id));
      } catch (err: any) {
        log.error(err);
        setSnackbar({
          message: err?.message || "Failed to delete transaction",
          type: "error",
          action: "dismiss",
        });
      }
    },
    [setSnackbar],
  );

  useFocusEffect(
    useCallback(() => {
      loadTransactions({});
      getWallets().then(setWallets).catch(log.error);
    }, []),
  );

  const walletNameMap = useMemo(
    () => new Map(wallets.map((w) => [w.id, w.name])),
    [wallets],
  );

  const selectedTransactions = useMemo(
    () => transactions.filter((t) => selected.has(t.id)),
    [transactions, selected],
  );

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          let returnVal = false;
          if (isSelectionMenuVisible) {
            setIsSelectionMenuVisible(false);
            return true;
          }
          if (isSummaryModalVisible) {
            setIsSummaryModalVisible(false);
            return true;
          }
          if (isExportModalVisible) {
            setIsExportModalVisible(false);
            return true;
          }
          if (selected.size > 0) {
            setSelected(new Set());
            returnVal = true;
          }
          if (isSearchInpShow) {
            setIsSearchInpShow(false);
            setSearchQuery("");
            loadTransactions({ isLoadMore: false, overrideSearch: "" });
            returnVal = true;
          }
          return returnVal;
        },
      );

      return () => subscription.remove();
    }, [
      isSelectionMenuVisible,
      isSummaryModalVisible,
      isExportModalVisible,
      selected,
      isSearchInpShow,
      loadTransactions,
      isAdvanceSearchVisible,
    ]),
  );

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        if (
          homeScreenRouteData?.mode &&
          homeScreenRouteData.newExpenseItemIds &&
          transactions.length > 0
        ) {
          const ids = JSON.parse(
            homeScreenRouteData.newExpenseItemIds,
          ) as number[];

          if (homeScreenRouteData.mode === "edit") {
            const id = ids[0];
            if (!id) return;
            const itemPositionInList = transactions.findIndex(
              (e) => e.id === id,
            );

            const itemObj = await getTransactionById(id);

            if (!itemObj || !isMounted) return;

            setTransactions((p) => {
              const newP = [...p];
              newP[itemPositionInList] = itemObj;
              return newP;
            });
          } else if (homeScreenRouteData.mode === "add") {
            const itemObjs = await getTransactionsByIds(ids);

            if (isMounted) {
              setTransactions((p) => [...itemObjs, ...p]);
            }
          }
        }
      } catch (e) {
        log.error(e);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [homeScreenRouteData.mode, homeScreenRouteData.newExpenseItemIds]);

  const styles = useMemo(() => stylesFn(), []);

  return (
    <>
      <AnimatedCard
        layout={LinearTransition.springify()}
        style={{
          overflow: "hidden",
          borderRadius: isAdvanceSearchVisible ? theme.roundness : 0,
          borderTopLeftRadius: 0,
          borderTopRightRadius: 0,
          backgroundColor: theme.colors.surface,
        }}
      >
        <Appbar.Header>
          {selected.size > 0 ? (
            <>
              <Appbar.Action
                icon="close"
                accessibilityLabel="Deselect all"
                onPress={() => setSelected(new Set())}
              />
              <Appbar.Content
                title={`${selected.size} selected`}
                titleStyle={{ fontSize: 18, fontWeight: "600" }}
              />
              {selected.size === 1 ? (
                <Appbar.Action
                  icon="pencil"
                  accessibilityLabel="Edit"
                  onPress={() => {
                    router.push({
                      pathname: "/add-expense",
                      params: {
                        id: selected.values().next().value,
                        mode: "edit",
                      },
                    });
                  }}
                />
              ) : (
                <Appbar.Action
                  testID="home-selected-summary-btn"
                  icon="chart-box-outline"
                  accessibilityLabel="Combined Summary"
                  onPress={() => setIsSummaryModalVisible(true)}
                />
              )}
              <Appbar.Action
                testID="home-selected-export-btn"
                icon="export-variant"
                accessibilityLabel="Export Selected"
                onPress={() => setIsExportModalVisible(true)}
              />
              <Appbar.Action
                icon="delete"
                accessibilityLabel="Delete Selected"
                onPress={() => {
                  const selectedIds = [...selected];
                  const hasWalletLinks = selectedTransactions.some(
                    (t) =>
                      Array.isArray(t.walletAllocations) &&
                      t.walletAllocations.length > 0,
                  );

                  const executeBulkDelete = async (
                    revertWalletBalances: boolean,
                  ) => {
                    try {
                      setIsLoading(true);
                      await deleteTransactionsWithWallets(
                        selectedIds,
                        revertWalletBalances,
                      );
                      setTransactions((prev) =>
                        prev.filter((t) => !selected.has(t.id)),
                      );
                      setSelected(new Set());
                    } catch (e: any) {
                      log.error(e);
                      setSnackbar({
                        message:
                          e?.message || "Failed to delete selected expenses",
                        type: "error",
                        action: "dismiss",
                      });
                    } finally {
                      setIsLoading(false);
                    }
                  };

                  if (hasWalletLinks) {
                    addConfirm({
                      id: getRandomStr(),
                      title: "Delete Selected",
                      body: `Some selected expenses are linked to wallet balance(s). Revert wallet balances as well, or delete transactions only?`,
                      onConfirm: () => executeBulkDelete(true),
                      confirmTxt: "Revert & Delete",
                      confirmBtnType: "DANGER",
                      aditionalBtns: [
                        {
                          id: getRandomStr(),
                          txt: "Delete Only",
                          type: "DANGER",
                          onPress: () => executeBulkDelete(false),
                        },
                      ],
                    });
                  } else {
                    addConfirm({
                      id: getRandomStr(),
                      title: "Delete Selected",
                      body: `Are you sure you want to delete ${selected.size} expense${selected.size !== 1 ? "s" : ""}?`,
                      onConfirm: () => executeBulkDelete(false),
                      confirmTxt: "Delete",
                      confirmBtnType: "DANGER",
                    });
                  }
                }}
              />
              <Menu
                visible={isSelectionMenuVisible}
                onDismiss={() => setIsSelectionMenuVisible(false)}
                anchor={
                  <Appbar.Action
                    icon="dots-vertical"
                    accessibilityLabel="More selection options"
                    onPress={() => setIsSelectionMenuVisible(true)}
                  />
                }
              >
                {selected.size === 1 ? (
                  <Menu.Item
                    testID="home-selected-summary-btn"
                    leadingIcon="chart-box-outline"
                    title="Combined info"
                    onPress={() => {
                      setIsSelectionMenuVisible(false);
                      setIsSummaryModalVisible(true);
                    }}
                  />
                ) : null}
                <Menu.Item
                  leadingIcon="select-all"
                  title="Select all"
                  onPress={() => {
                    setIsSelectionMenuVisible(false);
                    setSelected(new Set(transactions.map((t) => t.id)));
                  }}
                />
                <Menu.Item
                  leadingIcon="select-inverse"
                  title="Invert selection"
                  onPress={() => {
                    setIsSelectionMenuVisible(false);
                    const newSelected = new Set(selected);
                    transactions.forEach((t) => {
                      if (newSelected.has(t.id)) {
                        newSelected.delete(t.id);
                      } else {
                        newSelected.add(t.id);
                      }
                    });
                    setSelected(newSelected);
                  }}
                />
                <Divider />
                <Menu.Item
                  leadingIcon="close"
                  title="Clear selection"
                  onPress={() => {
                    setIsSelectionMenuVisible(false);
                    setSelected(new Set());
                  }}
                />
              </Menu>
            </>
          ) : isSearchInpShow ? (
            <>
              <Appbar.Action
                testID="home-search-back-btn"
                icon="keyboard-backspace"
                onPress={() => {
                  setIsSearchInpShow(false);
                  setSearchQuery("");
                  loadTransactions({
                    isLoadMore: false,
                    overrideSearch: "",
                  });
                }}
              />
              <RNTextInput
                testID="home-search-input"
                style={{ flex: 1, color: theme.colors.onSurface }}
                autoFocus
                placeholder="Search"
                placeholderTextColor={theme.colors.onSurfaceVariant}
                value={searchQuery}
                onChangeText={(txt) => {
                  setSearchQuery(txt);
                  debounce(
                    () => advanceSearchRef.current?.search(txt),
                    600,
                    "home-search-inp",
                  );
                }}
              />
              <Appbar.Action
                icon="tune"
                onPress={() => {
                  setIsAdvanceSearchVisible((p) => !p);
                }}
              />
              <Appbar.Action
                testID="home-search-clear-btn"
                icon="close"
                onPress={() => {
                  setSearchQuery("");
                  if (searchQuery === "") setIsSearchInpShow(false);
                  loadTransactions({
                    isLoadMore: false,
                    overrideSearch: "",
                  });
                }}
              />
            </>
          ) : (
            <>
              <Appbar.Content title="Home" style={{ marginLeft: 16 }} />
              <HeaderUserButton
                onPress={() => setUserExplorer({ step: "recent-users" })}
              />
              <Appbar.Action
                testID="home-search-btn"
                icon="magnify"
                onPress={() => setIsSearchInpShow(true)}
              />
              <Appbar.Action
                testID="home-split-btn"
                icon="call-split"
                accessibilityLabel="Money Split"
                onPress={() => router.push("/split" as any)}
              />
              <Appbar.Action
                testID="home-wallet-btn"
                icon="wallet-outline"
                accessibilityLabel="Wallets"
                onPress={() => router.push("/wallet" as any)}
              />
            </>
          )}
        </Appbar.Header>
        <AdvanceSearch
          visible={isAdvanceSearchVisible}
          defaultData={{
            timeTo: new Date(),
            timeFrom: new Date(new Date().setMonth(new Date().getMonth() - 1)),
          }}
          normalSearchQuery={searchQuery}
          onSearch={loadTransactions}
          ref={advanceSearchRef}
        />
      </AnimatedCard>

      <Menu
        visible={menuPos !== null}
        anchor={menuPos}
        onDismiss={() => setMenuPos(null)}
      >
        <Menu.Item
          testID="menu-item-delete"
          onPress={() => {
            const id = menuPos?.itemId;
            setMenuPos(null);
            if (!id) return;
            const targetTx = transactions.find((t) => t.id === id);
            const hasWalletLinks =
              Array.isArray(targetTx?.walletAllocations) &&
              targetTx.walletAllocations.length > 0;

            if (hasWalletLinks) {
              addConfirm({
                id: getRandomStr(),
                title: "Delete Linked Expense",
                body: "This transaction is linked to wallet balance(s). Revert wallet balance(s) as well, or delete the transaction only?",
                onConfirm: () => deleteItem(id, true),
                confirmTxt: "Revert & Delete",
                confirmBtnType: "DANGER",
                aditionalBtns: [
                  {
                    id: getRandomStr(),
                    txt: "Delete Only",
                    type: "DANGER",
                    onPress: () => deleteItem(id, false),
                  },
                ],
              });
            } else {
              addConfirm({
                id: getRandomStr(),
                title: "Delete",
                body: "Are you sure you want to delete this expense?",
                onConfirm: () => deleteItem(id, false),
                confirmTxt: "Delete",
                confirmBtnType: "DANGER",
              });
            }
          }}
          title="Delete"
          leadingIcon={"delete"}
        />
        <Menu.Item
          testID="menu-item-edit"
          onPress={() => {
            if (menuPos?.itemId)
              router.push({
                pathname: "/add-expense",
                params: {
                  id: menuPos?.itemId,
                  mode: "edit",
                },
              });
            setMenuPos(null);
          }}
          title="Edit"
          leadingIcon={"pencil"}
        />
        <Menu.Item
          testID="menu-item-convert"
          onPress={() => {
            const itemId = menuPos?.itemId;
            const isCredit = menuPos?.isCredit;
            setMenuPos(null);
            addConfirm({
              id: getRandomStr(),
              title: "Convert",
              body: `Are you sure you want to convert this transaction from ${menuPos?.isCredit ? "Credit" : "Simple Expense"} to ${menuPos?.isCredit ? "Simple Expense" : "Credit"}?`,
              onConfirm: async () => {
                if (itemId) {
                  convertTransactionType(
                    itemId,
                    isCredit ? "Simple Expense" : "Credit",
                  ).then((result) => {
                    if (result) {
                      const index = transactions.findIndex(
                        (e) => e.id === itemId,
                      );
                      if (index !== -1) {
                        setTransactions((prev) =>
                          prev.map((e, i) => (i === index ? result : e)),
                        );
                      }
                    }
                  });
                }
              },
              confirmTxt: "Convert",
              confirmBtnType: "DANGER",
            });
          }}
          title={
            menuPos?.isCredit
              ? "Convert to Simple Expense"
              : "Convert to Credit"
          }
          leadingIcon={menuPos?.isCredit ? "bank" : "credit-card"}
        />
        <Menu.Item
          testID="menu-item-full-credit"
          onPress={() => {
            const id = menuPos?.itemId;
            setMenuPos(null);
            addConfirm({
              id: getRandomStr(),
              title: "Full payment?",
              onConfirm: () => {
                if (id) {
                  const itemIndex = transactions.findIndex((e) => e.id === id);
                  if (itemIndex !== -1) {
                    const item = transactions[itemIndex];
                    const totalAmount = getTotalAmount(item);
                    updateCreditPayment(id, totalAmount).then(() => {
                      setTransactions((prev) => [
                        ...prev.slice(0, itemIndex),
                        { ...item, creditPayment: totalAmount },
                        ...prev.slice(itemIndex + 1),
                      ]);
                    });
                    if (item.toFromPhoneNumber)
                      sendSMSMsg.sendCreditPaymentsSMS({
                        totalAmo: totalAmount,
                        amountPayedYet: totalAmount,
                        fromName: item.toFrom,
                        fromPhoneNumber: item.toFromPhoneNumber,
                      });
                    updateWidget(true);
                  }
                }
              },
              confirmTxt: "Pay",
            });
          }}
          title="Full credit payment"
          leadingIcon={"credit-card-check-outline"}
        />
        <Menu.Item
          testID="menu-item-partial-credit"
          onPress={() => {
            const id = menuPos?.itemId;
            const itemIndex = transactions.findIndex((t) => t.id === id);
            const item = transactions[itemIndex];
            const totalAmount = getTotalAmount(item);
            const totalPayableAmount = totalAmount - (item.creditPayment ?? 0);
            setMenuPos(null);
            addConfirm({
              id: getRandomStr(),
              title: "Partial payment?",
              inputBox: {
                label: "Amount",
                keyboardType: "numeric",
                acceptOnValidOnly: true,
                validateFn: (txt) => {
                  const num = Number(txt);
                  if (Number.isNaN(num)) {
                    return { isValid: false, errMsg: "Invalid amount" };
                  } else if (num > totalPayableAmount) {
                    return {
                      isValid: false,
                      errMsg: "Amount exceeds total payable",
                    };
                  }
                  return { isValid: true };
                },
                inpControllFn: (txt) => txt.replace(/[^0-9.]/g, ""),
                async onConfirm(txt) {
                  const amount = Number(txt);
                  if (Number.isNaN(amount) || !id) return;
                  if (amount > totalPayableAmount)
                    return setSnackbar({
                      message: "Amount exceeds total payable",
                      type: "error",
                    });

                  const { newPayment } = await addCreditPayment(id, amount);
                  setTransactions((prev) => [
                    ...prev.slice(0, itemIndex),
                    { ...item, creditPayment: newPayment },
                    ...prev.slice(itemIndex + 1),
                  ]);
                  updateWidget(true);
                  if (item.toFromPhoneNumber)
                    sendSMSMsg.sendCreditPaymentsSMS({
                      totalAmo: totalAmount,
                      amountPayedYet: newPayment,
                      fromName: item.toFrom,
                      fromPhoneNumber: item.toFromPhoneNumber,
                    });
                },
              },
              confirmTxt: "Pay",
            });
          }}
          title="Partial credit payment"
          leadingIcon={"credit-card-check-outline"}
        />
        {__DEV__ ? (
          <Menu.Item
            onPress={() => {
              const id = menuPos?.itemId;
              setMenuPos(null);
              if (!id) return;
              const itemIndex = transactions.findIndex((e) => e.id === id);
              if (itemIndex === -1) return;
              const item = transactions[itemIndex];
              updateCreditPayment(id, 0).then(() => {
                setTransactions((prev) => [
                  ...prev.slice(0, itemIndex),
                  { ...item, creditPayment: 0 },
                  ...prev.slice(itemIndex + 1),
                ]);
              });
            }}
            title="Set credit payment to 0"
            leadingIcon={"credit-card-check-outline"}
          />
        ) : null}
      </Menu>

      <FlashList
        ListHeaderComponent={
          <View style={{ marginBottom: 10 }}>
            <SegmentedButtons<ExpenseTypeA>
              value={txType}
              onValueChange={setTxType}
              buttons={(["All", ...Expense.ExpenseArr] as const).map((e) => ({
                value: e,
                label: e,
              }))}
              theme={{ roundness: 2 }}
            />
          </View>
        }
        ref={flashlistRef}
        ListEmptyComponent={
          <View
            style={{
              alignItems: "center",
              justifyContent: "center",
              flex: 1,
              paddingVertical: 30,
              gap: 10,
            }}
          >
            <Text
              style={{ fontWeight: "500", fontSize: 18, textAlign: "center" }}
            >
              {isSearchInpShow
                ? "Nothing was found"
                : "No expense item\nAdd new"}
            </Text>
            <Icon
              source={"cloud-question-outline"}
              size={Math.min(dimention.width, dimention.height) / 5}
            />
          </View>
        }
        onEndReached={() => {
          if (!hasReachedEnd) {
            loadTransactions({ isLoadMore: true });
          }
        }}
        onEndReachedThreshold={0.1}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => loadTransactions({ isLoadMore: false })}
          />
        }
        data={transactions}
        ListFooterComponent={<View style={{ width: 100, height: 150 }} />}
        renderItem={({ item, index }) => (
          <ExpenseItem
            data={item}
            walletNameMap={walletNameMap}
            theme={theme}
            dimention={dimention}
            addConfirm={addConfirm}
            deleteItem={deleteItem}
            onOpenImage={(uri) => setFullScreenImageUri(uri)}
            addSelected={() =>
              setSelected((p) => {
                const newSelected = new Set(p);
                newSelected.add(item.id);
                return newSelected;
              })
            }
            removeSelected={() =>
              setSelected((p) => {
                const newSelected = new Set(p);
                newSelected.delete(item.id);
                return newSelected;
              })
            }
            isSelected={selected.has(item.id)}
            isSelectionActive={selected.size > 0}
            setMenuPos={(x, y) =>
              setMenuPos({
                x,
                y,
                itemId: item.id,
                itemIndex: index,
                isCredit: item.expenseType === "Credit",
              })
            }
          />
        )}
        keyExtractor={(item) => item.id.toString()}
        ItemSeparatorComponent={Seperator.S10}
        contentContainerStyle={{ padding: 10 }}
      />
      <FAB
        testID="index-screen-add-expense-fab-btn"
        icon="plus"
        style={styles.fab}
        onPress={() => router.push("/add-expense")}
      />

      <RecentUsersModal
        visible={userExplorer.step === "recent-users"}
        users={recentUsersState.users}
        isLoading={recentUsersState.isLoading}
        isLoadingMore={recentUsersState.isLoadingMore}
        hasMore={recentUsersState.hasMore}
        error={recentUsersState.error}
        onDismiss={() => setUserExplorer({ step: "closed" })}
        onSelectUser={(user) =>
          setUserExplorer({
            step: "user-summary",
            userName: user.toFrom,
            phoneNumber: user.phoneNumber,
          })
        }
        onLoadMore={recentUsersState.loadMore}
        onRetry={recentUsersState.refresh}
      />

      <UserSummaryDialog
        visible={userExplorer.step === "user-summary"}
        userName={
          userExplorer.step === "user-summary" ||
          userExplorer.step === "transaction-detail"
            ? userExplorer.userName
            : null
        }
        phoneNumber={
          userExplorer.step === "user-summary" ||
          userExplorer.step === "transaction-detail"
            ? userExplorer.phoneNumber
            : null
        }
        stats={userTransactionsState.stats}
        transactions={userTransactionsState.transactions}
        isLoading={userTransactionsState.isLoading}
        isLoadingMore={userTransactionsState.isLoadingMore}
        hasMore={userTransactionsState.hasMore}
        error={userTransactionsState.error}
        onSelectTransaction={(transaction) =>
          setUserExplorer((prev) =>
            prev.step === "user-summary"
              ? {
                  step: "transaction-detail",
                  userName: prev.userName,
                  phoneNumber: prev.phoneNumber,
                  transaction,
                }
              : prev,
          )
        }
        onLoadMore={userTransactionsState.loadMore}
        onRetry={userTransactionsState.refresh}
        onBackToUsers={() => setUserExplorer({ step: "recent-users" })}
        onDismiss={() => setUserExplorer({ step: "closed" })}
      />

      <TransactionDetailDialog
        visible={userExplorer.step === "transaction-detail"}
        transaction={
          userExplorer.step === "transaction-detail"
            ? userExplorer.transaction
            : null
        }
        onDismiss={() =>
          setUserExplorer((prev) =>
            prev.step === "transaction-detail"
              ? {
                  step: "user-summary",
                  userName: prev.userName,
                  phoneNumber: prev.phoneNumber,
                }
              : prev,
          )
        }
      />

      <FullScreenImageViewer
        visible={!!fullScreenImageUri}
        imageUri={fullScreenImageUri}
        onClose={() => setFullScreenImageUri(null)}
      />

      {selected.size > 0 ? (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          style={styles.summaryFloatingBar}
        >
          <Button
            testID="floating-selected-summary-btn"
            mode="contained"
            icon="chart-box-outline"
            onPress={() => setIsSummaryModalVisible(true)}
            style={styles.summaryFloatingButton}
            contentStyle={{ height: 44, paddingHorizontal: 4 }}
          >
            Combined Info ({selected.size})
          </Button>
        </Animated.View>
      ) : null}

      <SelectedTransactionsSummaryModal
        visible={isSummaryModalVisible}
        transactions={selectedTransactions}
        onClose={() => setIsSummaryModalVisible(false)}
      />

      <ExportTransactionsModal
        visible={isExportModalVisible}
        onClose={() => setIsExportModalVisible(false)}
        transactions={selectedTransactions}
        scope="selected"
        title={`Export Selected (${selected.size})`}
      />
    </>
  );
}

const ExpenseItem = ({
  data,
  walletNameMap,
  theme,
  dimention,
  addConfirm,
  deleteItem,
  addSelected,
  isSelected,
  removeSelected,
  isSelectionActive,
  setMenuPos,
  onOpenImage,
}: {
  data: TransactionType;
  walletNameMap: ReadonlyMap<number, string>;
  theme: CustomPaperTheme;
  dimention: ScaledSize;
  addConfirm: (obj: ConfirmData) => void;
  deleteItem: (id: number) => void;
  addSelected: (id: number) => void;
  removeSelected: (id: number) => void;
  isSelected: boolean;
  isSelectionActive: boolean;
  setMenuPos: (x: number, y: number) => void;
  onOpenImage: (uri: string) => void;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    setIsExpanded(false);
  }, [data.id]);

  const totalAmount = useMemo(() => getTotalAmount(data), [data]);
  const locationCoords = useMemo(
    () => extractCoordinates(data.location),
    [data.location],
  );
  const linkedWallets = useMemo(
    () => getTransactionLinkedWallets(data.walletAllocations, walletNameMap),
    [data.walletAllocations, walletNameMap],
  );
  const iconData = {
    Borrow: ["credit-card-outline", 19],
    Lend: ["hand-coin", 20],
    Receive: ["bank-transfer-in", 24],
    Send: ["bank-transfer-out", 24],
  } as const;

  return (
    <View style={{ width: "100%" }}>
      <AnimatedCard
        testID="expense-item-card"
        layout={LinearTransition.springify()}
        key={data.id.toString()}
        style={{
          overflow: "hidden",
          borderWidth: 2,
          borderColor: isSelected ? theme.colors.primary : "transparent",
        }}
        onLongPress={() => addSelected(data.id)}
        onPress={() => {
          if (isSelectionActive) {
            if (isSelected) {
              removeSelected(data.id);
            } else {
              addSelected(data.id);
            }
          } else {
            setIsExpanded((p) => !p);
          }
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
            justifyContent: "space-between",
            backgroundColor: theme.colors.surface,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              paddingHorizontal: 10,
            }}
          >
            <Icon
              size={iconData[data.subExpenseType][1]}
              source={iconData[data.subExpenseType][0]}
            />
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 5 }}
            >
              {data.expenseType === "Simple Expense" ||
              data.expenseType === "Credit" ? (
                <>
                  <Text>{data.expenseType}</Text>
                  <View style={{ paddingTop: 2 }}>
                    <Icon source={"circle"} size={4} />
                  </View>
                </>
              ) : null}
              <Text>{data.subExpenseType}</Text>
              {data.interestType !== "None" ? (
                <>
                  <View style={{ paddingTop: 2 }}>
                    <Icon source={"circle"} size={4} />
                  </View>
                  <Text>{data.interestType}</Text>
                </>
              ) : null}
            </View>
          </View>
          <IconButton
            testID="expense-item-menu-btn"
            icon={"dots-horizontal"}
            style={{ height: 24, margin: 5, zIndex: 10 }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={(e) => {
              e.stopPropagation();
              const { pageX, pageY } = e.nativeEvent;
              setMenuPos(pageX, pageY + 20);
            }}
          />
        </View>
        <Card.Content>
          <View>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "flex-end",
                // width: dimention.width - 60,
              }}
            >
              <View
                style={{
                  flex: 1,
                  minWidth: 0, // VERY IMPORTANT
                  marginRight: 12,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
                  <Text
                    style={{
                      fontSize: dimention.fontScale * 24,
                      fontWeight: "bold",
                    }}
                  >
                    {indianNumberFormatter.format(
                      data.expenseType === "Credit" && data.creditPayment
                        ? totalAmount - data.creditPayment
                        : totalAmount,
                    )}
                  </Text>
                  <Text style={{ marginBottom: 3 }}>
                    INR{" "}
                    {data.expenseType === "Credit"
                      ? `(${indianNumberFormatter.format(totalAmount)} - ${indianNumberFormatter.format(data.creditPayment || 0)})`
                      : ""}
                  </Text>
                </View>
                <Text numberOfLines={isExpanded ? undefined : 1}>
                  {data.toFrom}
                </Text>
                {data.interestType !== "None" ? (
                  <Text>
                    {data.interestType === "Compound"
                      ? `${data.interestRate}% p.a ${data.interestTime}y, ${data.compoundingFrequency}`
                      : `${data.interestRate}% p.a ${data.interestTime}y`}
                  </Text>
                ) : null}
              </View>

              <View
                style={{
                  flexDirection: "column",
                  gap: 5,
                  alignItems: "flex-end",
                  flexShrink: 1,
                  maxWidth: "48%",
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 5,
                    maxWidth: "100%",
                  }}
                >
                  <Text
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={{ flexShrink: 1 }}
                  >
                    {formatSmartDate(data.updatedAt)}
                  </Text>
                  <View style={{ paddingTop: 2 }}>
                    <Icon source={"clock-outline"} size={16} />
                  </View>
                </View>

                {data.location ? (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 5,
                      maxWidth: "100%",
                    }}
                  >
                    <Text
                      numberOfLines={1}
                      ellipsizeMode="tail"
                      style={{ flexShrink: 1 }}
                    >
                      {[
                        data.location.city,
                        data.location.district,
                        data.location.state,
                        data.location.isoCountryCode,
                      ]
                        .filter((e) => e)
                        .join(", ")}
                    </Text>
                    <View style={{ paddingTop: 2 }}>
                      <Icon source={"map-marker"} size={16} />
                    </View>
                  </View>
                ) : null}
              </View>
            </View>
            <View>
              {data.tags && data.tags.length > 0 && (
                <View
                  style={{
                    flexDirection: "row",
                    gap: 5,
                    marginTop: 5,
                    flexWrap: "wrap",
                  }}
                >
                  {data.tags.map((tag) => (
                    <Chip key={tag} compact>
                      {tag}
                    </Chip>
                  ))}
                </View>
              )}
            </View>
            {isExpanded ? (
              <Animated.View
                entering={FadeIn.duration(200)}
                exiting={FadeOut.duration(150)}
                layout={LinearTransition.springify()}
                style={{ marginTop: 5 }}
              >
                {linkedWallets.length > 0 ? (
                  <View
                    style={{
                      flexDirection: "row",
                      gap: 6,
                      marginBottom: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    {linkedWallets.map((w) => (
                      <Chip
                        key={`wallet-${w.walletId}`}
                        testID={`expense-item-wallet-chip-${w.walletId}`}
                        compact
                        mode="outlined"
                        icon="wallet-outline"
                      >
                        {linkedWallets.length > 1
                          ? `${w.name} (₹${indianNumberFormatter.format(w.amount)})`
                          : w.name}
                      </Chip>
                    ))}
                  </View>
                ) : null}
                <View style={{ marginBottom: 10 }}>
                  <DataTable>
                    <DataTable.Header
                      style={{ gap: 10, padding: 0, paddingHorizontal: 0 }}
                    >
                      <DataTable.Title style={{ flex: 0 }}>
                        Amount
                      </DataTable.Title>
                      <DataTable.Title style={{ flex: 2 }}>
                        Title
                      </DataTable.Title>
                    </DataTable.Header>
                    {data.amount.map((am, index) => (
                      <DataTable.Row
                        key={index + am.title}
                        style={{ gap: 10, padding: 0, paddingHorizontal: 0 }}
                      >
                        <DataTable.Cell style={{ flex: 0, marginRight: 10 }}>
                          ₹ {indianNumberFormatter.format(am.amount)}
                        </DataTable.Cell>
                        <DataTable.Cell style={{ flex: 2 }}>
                          {am.title}
                        </DataTable.Cell>
                      </DataTable.Row>
                    ))}
                  </DataTable>
                </View>
                {data.note ? <Text style={{ marginTop: 2 }}>{data.note}</Text> : null}
                {data.noteImages && data.noteImages.length > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8, marginTop: 8 }}
                  >
                    {data.noteImages.map((filename, idx) => (
                      <Pressable
                        key={`${data.id}-thumb-${idx}`}
                        testID={`expense-item-image-${idx}`}
                        onPress={(e) => {
                          e.stopPropagation();
                          onOpenImage(getNoteImageUri(filename));
                        }}
                        style={({ pressed }) => ({
                          width: 58,
                          height: 58,
                          borderRadius: 8,
                          overflow: "hidden",
                          borderWidth: 1,
                          borderColor: theme.colors.outlineVariant,
                          opacity: pressed ? 0.75 : 1,
                        })}
                      >
                        <Image
                          source={{ uri: getNoteImageUri(filename) }}
                          style={{ width: "100%", height: "100%" }}
                          contentFit="cover"
                        />
                      </Pressable>
                    ))}
                  </ScrollView>
                ) : null}
                {locationCoords ? (
                  <View style={{ marginTop: 10, alignItems: "flex-start" }}>
                    <Button
                      testID="expense-item-open-maps-btn"
                      mode="contained-tonal"
                      compact
                      icon="google-maps"
                      onPress={(e) => {
                        e?.stopPropagation?.();
                        openLocationInGoogleMaps(
                          locationCoords.latitude,
                          locationCoords.longitude,
                        );
                      }}
                    >
                      Open in Google Maps
                    </Button>
                  </View>
                ) : null}
              </Animated.View>
            ) : null}
          </View>
        </Card.Content>
      </AnimatedCard>
    </View>
  );
};

const stylesFn = () => {
  return StyleSheet.create({
    container: {
      flexGrow: 1,
    },
    fab: {
      position: "absolute",
      margin: 16,
      right: 0,
      bottom: 0,
    },
    summaryFloatingBar: {
      position: "absolute",
      left: 16,
      bottom: 16,
      zIndex: 10,
    },
    summaryFloatingButton: {
      borderRadius: 24,
      elevation: 4,
    },
  });
};
