import Seperator from "@/components/ui/Seperator";
import { CustomPaperTheme } from "@/constants/paperTheme";
import { db } from "@/db/dbinit";
import type { TransactionType } from "@/db/schema";
import { dbTransaction } from "@/db/schema";
import { debounce } from "@/lib/debounce";
import { formatSmartDate } from "@/lib/formatSmartDate";
import { getRandomStr } from "@/lib/getRandomStr";
import { ConfirmData, useGlobalState } from "@/lib/gState";
import { indianNumberFormatter } from "@/lib/numFormator";
import { FlashList, FlashListRef } from "@shopify/flash-list";
import { and, desc, eq, inArray, like, lt, or, sql } from "drizzle-orm";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  BackHandler,
  Dimensions,
  RefreshControl,
  TextInput as RNTextInput,
  ScaledSize,
  StyleSheet,
  View,
} from "react-native";
import {
  Appbar,
  Card,
  Chip,
  DataTable,
  FAB,
  Icon,
  IconButton,
  Menu,
  Text,
  useTheme,
} from "react-native-paper";
import Animated, {
  createAnimatedComponent,
  FadeIn,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";

const AnimatedCard = createAnimatedComponent(Card);

export default function HomeScreen() {
  const theme = useTheme<CustomPaperTheme>();
  const router = useRouter();
  const homeScreenRouteData = useLocalSearchParams<{
    newExpenseItemIds?: string;
    mode?: "edit" | "add";
  }>();

  const flashlistRef = useRef<FlashListRef<TransactionType>>(null);
  const fetchIdRef = useRef(0); // Tracks the latest request to prevent search race conditions
  const addConfirm = useGlobalState((s) => s.addConfirm);
  const dimention = Dimensions.get("window");

  const [transactions, setTransactions] = useState<TransactionType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastItemId, setLastItemId] = useState<number | undefined>(undefined);
  const [hasReachedEnd, setHasReachedEnd] = useState(false);
  const [selected, setSelected] = useState(() => new Set<number>());
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchInpShow, setIsSearchInpShow] = useState(false);
  const [menuPos, setMenuPos] = useState<{
    x: number;
    y: number;
    itemId: number;
    itemIndex: number;
  } | null>(null);

  const loadTransactions = useCallback(
    async (isLoadMore: boolean = false, overrideSearch?: string) => {
      const currentFetchId = ++fetchIdRef.current;
      const searchTxt = (overrideSearch ?? searchQuery).trim();

      try {
        if (isLoadMore && hasReachedEnd) return;
        setIsLoading(true);
        const limit = 14;

        const currentLastItemId = isLoadMore ? lastItemId : undefined;

        const searchCondition = searchTxt
          ? or(
              like(dbTransaction.toFrom, `%${searchTxt}%`),
              // like(dbTransaction.note, `%${searchTxt}%`),
              sql`EXISTS (SELECT 1 FROM json_each(${dbTransaction.tags}) WHERE value LIKE ${`%${searchTxt}%`})`,
              // sql`EXISTS (SELECT 1 FROM json_each(${dbTransaction.amount}) WHERE json_extract(value, '$.title') LIKE ${`%${searchTxt}%`})`,
            )
          : undefined;

        const whereClause = currentLastItemId
          ? searchCondition
            ? and(lt(dbTransaction.id, currentLastItemId), searchCondition)
            : lt(dbTransaction.id, currentLastItemId)
          : searchCondition;

        const query = db.select().from(dbTransaction);
        const fetchedTransactions = await (
          whereClause ? query.where(whereClause) : query
        )
          .orderBy(desc(dbTransaction.updatedAt))
          .limit(limit);

        // Discard stale data if a newer search/request was triggered
        if (currentFetchId !== fetchIdRef.current) return;

        if (fetchedTransactions.length > 0) {
          setLastItemId(fetchedTransactions[fetchedTransactions.length - 1].id);
        } else if (!isLoadMore) {
          setLastItemId(undefined);
        }

        setHasReachedEnd(fetchedTransactions.length < limit);

        if (isLoadMore) {
          setTransactions((prev) => [...prev, ...fetchedTransactions]);
        } else {
          setTransactions(fetchedTransactions);
        }
      } catch (e) {
        console.log(e);
      } finally {
        if (currentFetchId === fetchIdRef.current) {
          setIsLoading(false);
        }
      }
    },
    [hasReachedEnd, lastItemId, searchQuery],
  );

  const deleteItem = useCallback(async (id: number) => {
    setTransactions((prev) => {
      const i = prev.findIndex((item) => item.id === id);
      if (i !== -1) {
        return [...prev.slice(0, i), ...prev.slice(i + 1)];
      }
      return prev;
    });
    await db.delete(dbTransaction).where(eq(dbTransaction.id, id));
  }, []);

  useLayoutEffect(() => {
    loadTransactions(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          if (selected.size > 0) {
            setSelected(new Set());
            return true;
          } else if (isSearchInpShow) {
            setIsSearchInpShow(false);
            setSearchQuery("");
            loadTransactions(false, "");
            return true;
          }
          return false;
        },
      );

      return () => subscription.remove();
    }, [selected, isSearchInpShow, loadTransactions]),
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

            const [itemObj] = await db
              .select()
              .from(dbTransaction)
              .where(eq(dbTransaction.id, id))
              .limit(1);

            if (!itemObj || !isMounted) return;

            setTransactions((p) => {
              const newP = [...p];
              newP[itemPositionInList] = itemObj;
              return newP;
            });
          } else if (homeScreenRouteData.mode === "add") {
            const itemObjs = await db
              .select()
              .from(dbTransaction)
              .where(inArray(dbTransaction.id, ids))
              .orderBy(desc(dbTransaction.updatedAt));

            if (isMounted) {
              setTransactions((p) => [...itemObjs, ...p]);
            }
          }
        }
      } catch (e) {
        console.log(e);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [homeScreenRouteData.mode, homeScreenRouteData.newExpenseItemIds]);

  const styles = useMemo(() => stylesFn(), []);

  return (
    <>
      <Appbar.Header>
        {isSearchInpShow ? null : (
          <Appbar.Content
            title={`Home ${selected.size > 0 ? `(${selected.size})` : ""}`}
          />
        )}
        {selected.size > 0 ? (
          <>
            {selected.size === 1 ? (
              <Appbar.Action
                icon="pencil"
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
            ) : null}
            <Appbar.Action
              icon="delete"
              onPress={() => {
                addConfirm({
                  id: getRandomStr(),
                  title: "Delete Selected",
                  body: `Are you sure you want to delete ${selected.size} expense${selected.size !== 1 ? "s" : ""}?`,
                  onConfirm: async () => {
                    try {
                      setIsLoading(true);
                      const newTransactions = transactions.filter(
                        (t) => !selected.has(t.id),
                      );
                      setTransactions(newTransactions);
                      const selectedIds = [...selected];
                      await db
                        .delete(dbTransaction)
                        .where(inArray(dbTransaction.id, selectedIds));
                      setSelected(new Set());
                    } catch (e) {
                      console.log(e);
                    } finally {
                      setIsLoading(false);
                    }
                  },
                  confirmTxt: "Delete",
                  confirmBtnType: "DANGER",
                });
              }}
            />
            <Appbar.Action
              icon="select-all"
              onPress={() => {
                setSelected(new Set(transactions.map((t) => t.id)));
              }}
            />
            <Appbar.Action
              icon="select-remove"
              onPress={() => {
                setSelected(new Set());
              }}
            />
            <Appbar.Action
              icon="select-inverse"
              onPress={() => {
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
          </>
        ) : (
          <>
            {isSearchInpShow ? (
              <>
                <Appbar.Action
                  icon="keyboard-backspace"
                  onPress={() => {
                    setIsSearchInpShow(false);
                    setSearchQuery("");
                    loadTransactions(false, "");
                  }}
                />
                <RNTextInput
                  style={{ flex: 1, color: theme.colors.onSurface }}
                  autoFocus
                  placeholder="Search"
                  placeholderTextColor={theme.colors.onSurfaceVariant}
                  value={searchQuery}
                  onChangeText={(txt) => {
                    setSearchQuery(txt);
                    debounce(
                      () => loadTransactions(false, txt),
                      600,
                      "home-search-inp",
                    );
                  }}
                />
                <Appbar.Action
                  icon="close"
                  onPress={() => {
                    setSearchQuery("");
                    if (searchQuery === "") setIsSearchInpShow(false);
                    loadTransactions(false, "");
                  }}
                />
              </>
            ) : (
              <>
                <Appbar.Action
                  icon="magnify"
                  onPress={() => setIsSearchInpShow(true)}
                />
                <Appbar.Action
                  icon="reload"
                  onPress={() => loadTransactions(false)}
                />
              </>
            )}
          </>
        )}
      </Appbar.Header>

      <Menu
        visible={menuPos !== null}
        anchor={menuPos}
        onDismiss={() => setMenuPos(null)}
      >
        <Menu.Item
          onPress={() => {
            const id = menuPos?.itemId;
            setMenuPos(null);
            addConfirm({
              id: getRandomStr(),
              title: "Delete",
              body: "Are you sure you want to delete this expense?",
              onConfirm: () => {
                if (id) deleteItem(id);
              },
              confirmTxt: "Delete",
              confirmBtnType: "DANGER",
            });
          }}
          title="Delete"
          leadingIcon={"delete"}
        />
        <Menu.Item
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
      </Menu>

      <FlashList
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
            loadTransactions(true);
          }
        }}
        onEndReachedThreshold={0.1}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => loadTransactions(false)}
          />
        }
        data={transactions}
        ListFooterComponent={<View style={{ width: 100, height: 150 }} />}
        renderItem={({ item, index }) => (
          <ExpenseItem
            data={item}
            theme={theme}
            dimention={dimention}
            addConfirm={addConfirm}
            deleteItem={deleteItem}
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
              setMenuPos({ x, y, itemId: item.id, itemIndex: index })
            }
          />
        )}
        keyExtractor={(item) => item.id.toString()}
        ItemSeparatorComponent={Seperator.S10}
        contentContainerStyle={{ padding: 10 }}
      />
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => router.push("/add-expense")}
      />
    </>
  );
}

const ExpenseItem = ({
  data,
  theme,
  dimention,
  addSelected,
  isSelected,
  removeSelected,
  isSelectionActive,
  setMenuPos,
}: {
  data: TransactionType;
  theme: CustomPaperTheme;
  dimention: ScaledSize;
  addConfirm: (obj: ConfirmData) => void;
  deleteItem: (id: number) => void;
  addSelected: (id: number) => void;
  removeSelected: (id: number) => void;
  isSelected: boolean;
  isSelectionActive: boolean;
  setMenuPos: (x: number, y: number) => void;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    setIsExpanded(false);
  }, [data.id]);

  const totalAmount = useMemo(
    () => data.amount.reduce((p, c) => p + c.amount, 0),
    [data.amount],
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
              {data.expenseType === "Simple Expense" ? (
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
                    {indianNumberFormatter.format(totalAmount)}
                  </Text>
                  <Text style={{ marginBottom: 3 }}>INR</Text>
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
                }}
              >
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 5 }}
                >
                  <Text>{formatSmartDate(data.updatedAt)}</Text>
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
                    }}
                  >
                    <Text>
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
                <Text>{data.note}</Text>
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
  });
};
