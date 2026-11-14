import { AddShoppingProductModal } from "@/components/shopping-list/AddShoppingProductModal";
import { ConfirmDeleteDialog } from "@/components/shopping-list/ConfirmDeleteDialog";
import { EditShoppingListModal } from "@/components/shopping-list/EditShoppingListModal";
import Seperator from "@/components/ui/Seperator";
import { CustomPaperTheme } from "@/constants/paperTheme";
import { db } from "@/db/dbinit";
import { dbShoppingCart, ShoppingCartType, ShoppingProduct } from "@/db/schema";
import { createGeoJSONCircle } from "@/lib/createGeoJSONCircle";
import { formatSmartDate } from "@/lib/formatSmartDate";
import { useGlobalState } from "@/lib/gState";
import { getCurrentLocation } from "@/lib/getCurrentLocation";
import { getRandomStr } from "@/lib/getRandomStr";
import { log } from "@/lib/log";
import { indianNumberFormatter } from "@/lib/numFormator";
import { requestGeofencePermissions } from "@/lib/requestGeofencePermissions";
import {
  appendProductToShoppingList,
  removeProductFromShoppingListByIndex,
  toggleShoppingProductCompleted,
  updateShoppingListCompletedItems,
  updateShoppingListMetadata,
} from "@/lib/shoppingListUtils";
import updateWidget from "@/widget/updateWidget";
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
} from "@maplibre/maplibre-react-native";
import Geofencing from "@rn-org/react-native-geofencing";
import { FlashList } from "@shopify/flash-list";
import { desc, eq } from "drizzle-orm";
import { LocationObject } from "expo-location";
import { useFocusEffect, useRouter } from "expo-router";
import { RefObject, useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  Dimensions,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from "react-native";
import ActionSheet, { ActionSheetRef } from "react-native-actions-sheet";
import {
  ActivityIndicator,
  Appbar,
  Button,
  Card,
  Checkbox,
  DataTable,
  FAB,
  Icon,
  IconButton,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import Animated, {
  createAnimatedComponent,
  FadeIn,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";

const AnimatedCard = createAnimatedComponent(Card);

export default function ShopingList() {
  const dim = Dimensions.get("window");
  const appTheme = useTheme<CustomPaperTheme>();
  const router = useRouter();
  const addConfirm = useGlobalState((e) => e.addConfirm);
  const setSnackbar = useGlobalState((e) => e.setSnackbar);
  const actionSheetRef = useRef<ActionSheetRef>(null);
  const [shoppingCart, setShoppingCart] = useState<ShoppingCartType[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [addItemTargetListId, setAddItemTargetListId] = useState<number | null>(
    null,
  );
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [addItemError, setAddItemError] = useState<string | null>(null);

  const [editTargetListId, setEditTargetListId] = useState<number | null>(null);
  const [isSavingListEdit, setIsSavingListEdit] = useState(false);
  const [editListError, setEditListError] = useState<string | null>(null);

  const [deleteItemTarget, setDeleteItemTarget] = useState<{
    listId: number;
    productIndex: number;
    productName: string;
  } | null>(null);
  const [isDeletingItem, setIsDeletingItem] = useState(false);
  const [deleteItemError, setDeleteItemError] = useState<string | null>(null);

  const addItemTargetList =
    shoppingCart.find((cartItem) => cartItem.id === addItemTargetListId) ??
    null;
  const editTargetList =
    shoppingCart.find((cartItem) => cartItem.id === editTargetListId) ?? null;

  const onNewItemAdd = (item: ShoppingCartType) => {
    setShoppingCart((prev) => [item, ...prev]);
    updateWidget(true, "ShoppingList").catch(log.error);
  };

  const fetchShoppingCart = async () => {
    setIsLoading(true);
    try {
      log.info("fetchShoppingCart");
      const items = await db
        .select()
        .from(dbShoppingCart)
        .orderBy(desc(dbShoppingCart.updatedAt), desc(dbShoppingCart.id));
      setShoppingCart(items);
    } catch (e) {
      log.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteShopingCartItem = async (item: ShoppingCartType) => {
    const firstProductName = item.products[0]?.productName ?? "(empty list)";
    log.info("deleteShopingCartItem", item.id, firstProductName);
    if (item.location?.geoFenceId) {
      log.info("geofenceId", item.location.geoFenceId);
      Geofencing.removeGeofence(item.location.geoFenceId)
        .then(() => {
          log.info("geofence removed");
        })
        .catch(log.error);
    }
    await db
      .delete(dbShoppingCart)
      .where(eq(dbShoppingCart.id, item.id))
      .then(() => {
        setShoppingCart((prev) =>
          prev.filter((cartItem) => cartItem.id !== item.id),
        );
        log.info("item deleted", item.id, firstProductName);
        updateWidget(true, "ShoppingList").catch(log.error);
      })
      .catch((err) => {
        console.error(err);
        log.error(err);
        setSnackbar({
          message: "Failed to delete shopping list",
          type: "error",
          action: "dismiss",
        });
      });
  };

  const handleAddItemSubmit = async (product: ShoppingProduct) => {
    if (addItemTargetListId === null || isAddingItem) return;
    const targetList = shoppingCart.find(
      (cartItem) => cartItem.id === addItemTargetListId,
    );
    if (!targetList) {
      setAddItemTargetListId(null);
      return;
    }

    setIsAddingItem(true);
    setAddItemError(null);
    const updatedAt = new Date();
    const nextProducts = [...targetList.products, product];

    try {
      await db
        .update(dbShoppingCart)
        .set({
          products: nextProducts,
          updatedAt,
        })
        .where(eq(dbShoppingCart.id, targetList.id));

      setShoppingCart((prev) =>
        appendProductToShoppingList(prev, targetList.id, product, updatedAt),
      );
      setAddItemTargetListId(null);
      setSnackbar({
        message: `Added "${product.productName}"`,
        type: "success",
        duration: 2500,
      });
      updateWidget(true, "ShoppingList").catch(log.error);
    } catch (err) {
      log.error(err);
      setAddItemError("Failed to add item. Please try again.");
      setSnackbar({
        message: "Failed to add item",
        type: "error",
        action: "dismiss",
      });
    } finally {
      setIsAddingItem(false);
    }
  };

  const handleEditListSave = async (updates: {
    listId: number;
    note: string | null;
    coords: { lat: number; lon: number } | null;
  }) => {
    if (isSavingListEdit) return;
    const targetList = shoppingCart.find(
      (cartItem) => cartItem.id === updates.listId,
    );
    if (!targetList) {
      setEditTargetListId(null);
      return;
    }

    setIsSavingListEdit(true);
    setEditListError(null);

    try {
      let nextLocation: ShoppingCartType["location"] = null;

      if (updates.coords) {
        const unchangedCoords =
          targetList.location &&
          targetList.location.lat === updates.coords.lat &&
          targetList.location.lon === updates.coords.lon &&
          targetList.location.geoFenceId;

        if (unchangedCoords) {
          nextLocation = targetList.location;
        } else {
          const [_, isDenied] = await requestGeofencePermissions();
          if (isDenied) {
            setEditListError(
              "Location permission is required to enable geofence reminders.",
            );
            setIsSavingListEdit(false);
            return;
          }

          if (targetList.location?.geoFenceId) {
            await Geofencing.removeGeofence(
              targetList.location.geoFenceId,
            ).catch(log.error);
          }

          const geoFenceId = getRandomStr();
          const response = await Geofencing.addGeofence({
            id: geoFenceId,
            latitude: updates.coords.lat,
            longitude: updates.coords.lon,
            radius: 100,
          });

          if (!response.success) {
            log.error(response.error);
            setSnackbar({
              message: "Failed to add geofence",
              type: "error",
              action: "dismiss",
            });
            nextLocation = {
              lat: updates.coords.lat,
              lon: updates.coords.lon,
            };
          } else {
            nextLocation = {
              lat: updates.coords.lat,
              lon: updates.coords.lon,
              geoFenceId,
            };
          }
        }
      } else if (targetList.location?.geoFenceId) {
        await Geofencing.removeGeofence(targetList.location.geoFenceId).catch(
          log.error,
        );
      }

      const updatedAt = new Date();
      await db
        .update(dbShoppingCart)
        .set({
          note: updates.note,
          location: nextLocation,
          updatedAt,
        })
        .where(eq(dbShoppingCart.id, targetList.id));

      setShoppingCart((prev) =>
        updateShoppingListMetadata(
          prev,
          targetList.id,
          { note: updates.note, location: nextLocation },
          updatedAt,
        ),
      );
      setEditTargetListId(null);
      setSnackbar({
        message: "Shopping list updated",
        type: "success",
        duration: 2500,
      });
      updateWidget(true, "ShoppingList").catch(log.error);
    } catch (err) {
      log.error(err);
      setEditListError("Failed to update list. Please try again.");
      setSnackbar({
        message: "Failed to update shopping list",
        type: "error",
        action: "dismiss",
      });
    } finally {
      setIsSavingListEdit(false);
    }
  };

  const handleConfirmDeleteItem = async () => {
    if (!deleteItemTarget || isDeletingItem) return;

    setIsDeletingItem(true);
    setDeleteItemError(null);
    const updatedAt = new Date();
    const removal = removeProductFromShoppingListByIndex(
      shoppingCart,
      deleteItemTarget.listId,
      deleteItemTarget.productIndex,
      updatedAt,
    );

    if (!removal) {
      setIsDeletingItem(false);
      setDeleteItemTarget(null);
      return;
    }

    try {
      await db
        .update(dbShoppingCart)
        .set({
          products: removal.nextProducts,
          completedItems: removal.nextCompletedItems,
          updatedAt,
        })
        .where(eq(dbShoppingCart.id, deleteItemTarget.listId));

      setShoppingCart((prev) => {
        const res = removeProductFromShoppingListByIndex(
          prev,
          deleteItemTarget.listId,
          deleteItemTarget.productIndex,
          updatedAt,
        );
        return res ? res.updatedLists : prev;
      });
      setDeleteItemTarget(null);
      setSnackbar({
        message: `Removed "${removal.removedProduct.productName}"`,
        type: "success",
        duration: 2500,
      });
      updateWidget(true, "ShoppingList").catch(log.error);
    } catch (err) {
      log.error(err);
      setDeleteItemError("Failed to delete item. Please try again.");
      setSnackbar({
        message: "Failed to remove item",
        type: "error",
        action: "dismiss",
      });
    } finally {
      setIsDeletingItem(false);
    }
  };

  const handleUpdateCompletedItems = async (
    listId: number,
    completedItems: string[],
  ): Promise<boolean> => {
    try {
      await db
        .update(dbShoppingCart)
        .set({ completedItems })
        .where(eq(dbShoppingCart.id, listId));
      setShoppingCart((prev) =>
        updateShoppingListCompletedItems(prev, listId, completedItems),
      );
      updateWidget(true, "ShoppingList").catch(log.error);
      return true;
    } catch (err) {
      log.error(err);
      setSnackbar({
        message: "Failed to update item status",
        type: "error",
        action: "dismiss",
      });
      return false;
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchShoppingCart();

      const subscription = AppState.addEventListener("change", (nextState) => {
        if (nextState === "active") {
          fetchShoppingCart();
        }
      });

      return () => {
        subscription.remove();
      };
    }, []),
  );

  return (
    <>
      <Appbar.Header>
        <Appbar.Content title="Shopping List" />
      </Appbar.Header>
      <View style={{ flex: 1 }}>
        <FlashList
          ListEmptyComponent={
            <View
              style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
                minHeight: dim.height - 200,
                gap: 10,
              }}
            >
              <Text style={{ fontSize: 24, fontWeight: "bold" }}>
                No Item in List
              </Text>
              <Button
                icon={"plus"}
                mode="contained"
                onPress={() => actionSheetRef.current?.show()}
              >
                Add New
              </Button>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={fetchShoppingCart}
            />
          }
          contentContainerStyle={{ padding: 10 }}
          data={shoppingCart}
          keyExtractor={(item) => item.id + "shopping-cart-item"}
          ItemSeparatorComponent={Seperator.S10}
          renderItem={({ item }) => {
            return (
              <ShoppingCartItem
                item={item}
                appTheme={appTheme}
                onAddItemPress={(cartItem) => {
                  setAddItemError(null);
                  setAddItemTargetListId(cartItem.id);
                }}
                onEditList={(cartItem) => {
                  setEditListError(null);
                  setEditTargetListId(cartItem.id);
                }}
                onDeleteItem={(cartItem, product, productIndex) => {
                  setDeleteItemError(null);
                  setDeleteItemTarget({
                    listId: cartItem.id,
                    productIndex,
                    productName: product.productName,
                  });
                }}
                onUpdateCompletedItems={handleUpdateCompletedItems}
                onRemove={(cartItem) => {
                  addConfirm({
                    id: getRandomStr(),
                    title: "Delete",
                    confirmTxt: "Delete & Add TX",
                    aditionalBtns: [
                      {
                        txt: "Delete",
                        onPress: () => {
                          deleteShopingCartItem(cartItem);
                        },
                        type: "DANGER",
                        id: getRandomStr(10),
                      },
                    ],
                    body: "Are you sure you want to delete this item?",
                    confirmBtnType:
                      cartItem.products.length > 0 &&
                      cartItem.completedItems?.length ===
                        cartItem.products.length
                        ? undefined
                        : "DANGER",
                    onConfirm: () => {
                      deleteShopingCartItem(cartItem);
                      if ((cartItem.completedItems?.length ?? 0) > 0) {
                        const obj = {
                          note: cartItem.note,
                          toFrom: "Shopping Cart",
                          amount: cartItem.products
                            .filter((e) =>
                              cartItem.completedItems?.includes(e.productName),
                            )
                            .map((e) => {
                              return {
                                amount: e.amount ?? 0,
                                title: `${e.productName} ${e.quantity ?? 1}${e.unit ?? ""}`,
                                id: Math.random(),
                              };
                            }),
                        };
                        router.navigate({
                          pathname: "/add-expense",
                          params: {
                            from: "shoping-list",
                            shopingListData: JSON.stringify(obj),
                          },
                        });
                      }
                    },
                  });
                }}
              />
            );
          }}
          ListFooterComponent={<View style={{ paddingBottom: 100 }} />}
        />
      </View>

      <AddShoppingProductModal
        visible={addItemTargetList !== null}
        listTitle={addItemTargetList?.note}
        isSubmitting={isAddingItem}
        submitError={addItemError}
        onDismiss={() => {
          setAddItemError(null);
          setAddItemTargetListId(null);
        }}
        onSubmit={handleAddItemSubmit}
      />

      <EditShoppingListModal
        visible={editTargetList !== null}
        item={editTargetList}
        isSaving={isSavingListEdit}
        saveError={editListError}
        onDismiss={() => {
          setEditListError(null);
          setEditTargetListId(null);
        }}
        onSave={handleEditListSave}
      />

      <ConfirmDeleteDialog
        visible={deleteItemTarget !== null}
        title="Remove Item"
        itemName={deleteItemTarget?.productName ?? ""}
        isDeleting={isDeletingItem}
        errorMessage={deleteItemError}
        onConfirm={handleConfirmDeleteItem}
        onDismiss={() => {
          setDeleteItemError(null);
          setDeleteItemTarget(null);
        }}
      />

      <AddShoppingItem
        actionSheetRef={actionSheetRef}
        onNewItemAdd={onNewItemAdd}
      />
      <FAB
        testID="shopping-list-add-fab"
        icon="plus"
        style={{
          position: "absolute",
          margin: 16,
          right: 0,
          bottom: 0,
        }}
        onPress={() => actionSheetRef.current?.show()}
      />
    </>
  );
}

const ShoppingCartItem = ({
  item,
  appTheme,
  onAddItemPress,
  onEditList,
  onRemove,
  onDeleteItem,
  onUpdateCompletedItems,
}: {
  item: ShoppingCartType;
  appTheme: CustomPaperTheme;
  onAddItemPress: (item: ShoppingCartType) => void;
  onEditList: (item: ShoppingCartType) => void;
  onRemove: (item: ShoppingCartType) => void;
  onDeleteItem: (
    item: ShoppingCartType,
    product: ShoppingProduct,
    index: number,
  ) => void;
  onUpdateCompletedItems: (listId: number, items: string[]) => Promise<boolean>;
}) => {
  const [completedItems, setCompletedItems] = useState(
    item.completedItems ?? [],
  );
  const [isExpanded, setIsExpanded] = useState(true);
  const didLongPressRef = useRef(false);

  useEffect(() => {
    setCompletedItems(item.completedItems ?? []);
  }, [item.id, item.completedItems]);

  useEffect(() => {
    setIsExpanded(true);
  }, [item.id]);

  const toggleIsAllShoppingItemCompleted = async () => {
    if (item.products.length === 0) return;
    const prevItems = completedItems;
    const nextItems =
      completedItems.length === item.products.length
        ? []
        : item.products.map((e) => e.productName);
    setCompletedItems(nextItems);
    const ok = await onUpdateCompletedItems(item.id, nextItems);
    if (!ok) {
      setCompletedItems(prevItems);
    }
  };

  const toggleIsShoppingItemCompleted = async (productName: string) => {
    log.info("toggleIsShoppingItemCompleted", productName, completedItems);
    const prevItems = completedItems;
    const nextItems = toggleShoppingProductCompleted(completedItems, productName);
    setCompletedItems(nextItems);
    const ok = await onUpdateCompletedItems(item.id, nextItems);
    if (!ok) {
      setCompletedItems(prevItems);
    }
  };

  const handleCardPressIn = () => {
    didLongPressRef.current = false;
  };

  const handleCardLongPress = () => {
    didLongPressRef.current = true;
    onEditList(item);
  };

  const handleCardPress = () => {
    if (didLongPressRef.current) {
      didLongPressRef.current = false;
      return;
    }
    setIsExpanded((prev) => !prev);
  };

  const listNoteTitle = item.note?.trim();
  const countAndDateText = `${item.products.length} ${item.products.length === 1 ? "Item" : "Items"} (${formatSmartDate(item.updatedAt)})`;
  const cardSubtitle = listNoteTitle
    ? `${countAndDateText}${item.location ? " • Geofence" : ""}`
    : item.location
      ? "Geofence reminder active"
      : undefined;

  return (
    <AnimatedCard
      testID="shopping-cart-item-card"
      accessible={false}
      layout={LinearTransition.springify()}
      onPressIn={handleCardPressIn}
      onPress={handleCardPress}
      onLongPress={handleCardLongPress}
    >
      <Card.Title
        title={
          <Text variant="bodyLarge" testID="shopping-cart-item-title">
            {listNoteTitle || countAndDateText}
          </Text>
        }
        titleNumberOfLines={2}
        subtitle={cardSubtitle}
        subtitleNumberOfLines={2}
        right={() => (
          <View
            style={{
              paddingRight: 10,
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <Checkbox
              testID="shopping-cart-item-all-checkbox"
              disabled={item.products.length === 0}
              status={
                item.products.length > 0 &&
                completedItems.length === item.products.length
                  ? "checked"
                  : "unchecked"
              }
              onPress={toggleIsAllShoppingItemCompleted}
            />
            <IconButton
              testID="shopping-cart-item-delete-btn"
              icon={"delete"}
              onPress={() => {
                onRemove({ ...item, completedItems });
              }}
              iconColor={appTheme.colors.customError}
              style={{ padding: 0, margin: 0, marginLeft: 5 }}
            />
            <Icon
              source={isExpanded ? "chevron-up" : "chevron-down"}
              size={20}
              color={appTheme.colors.onSurfaceVariant}
            />
          </View>
        )}
      />
      {isExpanded ? (
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(140)}
          layout={LinearTransition.springify()}
        >
          <Card.Content>
            {item.products.length === 0 ? (
              <Text
                variant="bodyMedium"
                style={{
                  color: appTheme.colors.onSurfaceVariant,
                  textAlign: "center",
                  paddingVertical: 12,
                }}
              >
                No items in this list yet.
              </Text>
            ) : (
              <DataTable>
                <DataTable.Header>
                  <DataTable.Title>Product</DataTable.Title>
                  <DataTable.Title numeric>Amount</DataTable.Title>
                  <DataTable.Title numeric>Quantity</DataTable.Title>
                  <DataTable.Title numeric> </DataTable.Title>
                </DataTable.Header>
                {item.products.map((product, index) => {
                  const isCompleted = completedItems.includes(
                    product.productName,
                  );
                  return (
                    <Animated.View
                      key={`${item.id}-${index}-${product.productName}`}
                      exiting={FadeOut.duration(150)}
                      layout={LinearTransition.springify()}
                    >
                      <DataTable.Row
                        testID={`shopping-cart-row-${index}`}
                        onLongPress={() => onDeleteItem(item, product, index)}
                      >
                        <DataTable.Cell>
                          <Text
                            style={
                              isCompleted
                                ? {
                                    textDecorationLine: "line-through",
                                    opacity: 0.6,
                                  }
                                : undefined
                            }
                          >
                            {product.productName}
                          </Text>
                        </DataTable.Cell>
                        <DataTable.Cell numeric>
                          {product.amount
                            ? indianNumberFormatter.format(product.amount ?? 0)
                            : "?"}
                        </DataTable.Cell>
                        <DataTable.Cell numeric>
                          {product.quantity
                            ? `${indianNumberFormatter.format(product.quantity)}${product.unit ? ` ${product.unit}` : ""}`
                            : product.unit || "?"}
                        </DataTable.Cell>
                        <DataTable.Cell numeric>
                          <Checkbox
                            status={isCompleted ? "checked" : "unchecked"}
                            onPress={() =>
                              toggleIsShoppingItemCompleted(product.productName)
                            }
                          />
                        </DataTable.Cell>
                      </DataTable.Row>
                    </Animated.View>
                  );
                })}
              </DataTable>
            )}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: 10,
                gap: 8,
                paddingBottom: 7,
              }}
            >
              <Text
                variant="labelSmall"
                style={{
                  color: appTheme.colors.onSurfaceVariant,
                  flex: 1,
                }}
              >
                Hold card to edit • Hold item to remove
              </Text>
              <Button
                testID="shopping-cart-item-add-btn"
                mode="contained-tonal"
                icon="plus"
                onPress={() => onAddItemPress(item)}
              >
                Add Item
              </Button>
            </View>
          </Card.Content>
        </Animated.View>
      ) : null}
    </AnimatedCard>
  );
};

type AddShoppingItemProps = {
  actionSheetRef: RefObject<ActionSheetRef | null>;
  onNewItemAdd: (item: ShoppingCartType) => void;
};
const AddShoppingItem = ({
  actionSheetRef,
  onNewItemAdd,
}: AddShoppingItemProps) => {
  const appTheme = useTheme();
  // const handlers = useScrollHandlers<MapRef>();
  const dim = Dimensions.get("window");
  const setSnackbar = useGlobalState((s) => s.setSnackbar);
  const productNameInpRef = useRef<any>(null);
  const amountInpRef = useRef<any>(null);
  const quantityInpRef = useRef<any>(null);
  const unitInpRef = useRef<any>(null);
  const [geoFence, setGeoFence] = useState<null | { lon: number; lat: number }>(
    null,
  );
  const [isGeoFenceEnabled, setIsGeoFenceEnabled] = useState(false);
  const [isMapSelectorVisible, setIsMapSelectorVisible] = useState(false);
  const [isGeoFencingLoading, setIsGeoFencingLoading] = useState(false);
  const [productNameInpTxt, setProductNameInpTxt] = useState("");
  const [amountInpTxt, setAmountInpTxt] = useState("");
  const [quantityInpTxt, setQuantityInpTxt] = useState("");
  const [unitInpTxt, setUnitInpTxt] = useState("");
  const [noteInpTxt, setNoteInpTxt] = useState("");
  const [productArr, setProductArr] = useState<
    {
      pName: string;
      amount?: number;
      quantity?: number;
      unit?: string;
      id: number;
    }[]
  >([]);
  const [isScrollEnabled, setIsScrollEnabled] = useState(true);

  const [isSubmitLoading, setSubmitLoading] = useState(false);
  // const nativeGesture = Gesture.Native().simultaneousWithExternalGesture(
  //   ...(handlers.simultaneousHandlers as any[]),
  // );
  const [currentLocation, setCurrentLocation] = useState<LocationObject | null>(
    null,
  );

  const addToProductArr = () => {
    setProductNameInpTxt((p) => p.trim());
    setAmountInpTxt((p) => p.trim());
    setQuantityInpTxt((p) => p.trim());
    setUnitInpTxt((p) => p.trim());

    // const amount = parseFloat((parseFloat(amountInpTxt) || 0).toFixed(2));
    // const quantity = parseFloat((parseFloat(amountInpTxt) || 0).toFixed(2));

    // if (!amount) return;
    // if (!quantity) return;
    if (!productNameInpTxt) return;
    // if (!unitInpTxt) return;

    setProductArr((p) => [
      ...p,
      {
        amount: amountInpTxt
          ? parseFloat((parseFloat(amountInpTxt) || 0).toFixed(2))
          : undefined,
        pName: productNameInpTxt,
        quantity: quantityInpTxt
          ? parseFloat((parseFloat(quantityInpTxt) || 0).toFixed(2))
          : undefined,
        unit: unitInpTxt || undefined,
        id: Math.random(),
      },
    ]);

    setAmountInpTxt("");
    setProductNameInpTxt("");
    setQuantityInpTxt("");
    setUnitInpTxt("");

    productNameInpRef.current?.focus();
  };

  const resetForm = () => {
    setProductArr([]);
    setNoteInpTxt("");
    setGeoFence(null);
    setIsGeoFenceEnabled(false);
    setIsGeoFencingLoading(false);
    setIsMapSelectorVisible(false);
  };

  const onSubmitHandler = async () => {
    try {
      setSubmitLoading(true);

      if (productArr.length === 0) return;

      if (isGeoFenceEnabled && !geoFence) {
        setSnackbar({
          message:
            "Please tap on the map to set a geofence location, or uncheck Geo fence.",
          type: "error",
          action: "dismiss",
        });
        setSubmitLoading(false);
        return;
      }

      let geoFenceId: string | undefined;

      if (isGeoFenceEnabled && geoFence) {
        const [_, isDenied] = await requestGeofencePermissions();
        if (isDenied) {
          setSnackbar({
            message:
              "Location permission is required to enable geofence reminders.",
            type: "error",
            action: "dismiss",
          });
          setSubmitLoading(false);
          return;
        }
        geoFenceId = getRandomStr();
        const response = await Geofencing.addGeofence({
          id: geoFenceId,
          latitude: geoFence.lat,
          longitude: geoFence.lon,
          radius: 100,
        });
        if (!response.success) {
          geoFenceId = undefined;
          log.error(response.error);
          setSnackbar({
            message:
              "Failed to add geofence: " + (response.error || "Unknown error"),
            type: "error",
            action: "dismiss",
          });
        }
      }

      const newItem = await db
        .insert(dbShoppingCart)
        .values({
          products: productArr.map((e) => ({
            amount: e.amount,
            productName: e.pName,
            quantity: e.quantity,
            unit: e.unit,
          })),
          location:
            isGeoFenceEnabled && geoFence
              ? { lat: geoFence.lat, lon: geoFence.lon, geoFenceId }
              : null,
          note: noteInpTxt.trim(),
        })
        .returning();

      resetForm();
      actionSheetRef.current?.hide();
      onNewItemAdd(newItem[0]);
    } catch (e) {
      log.error(e);
    } finally {
      setSubmitLoading(false);
    }
  };
  return (
    <ActionSheet
      // isModal={false}
      onOpen={() => {
        productNameInpRef.current?.focus();
      }}
      // gestureEnabled
      ref={actionSheetRef}
      containerStyle={{ backgroundColor: appTheme.colors.background }}
      indicatorStyle={{ backgroundColor: appTheme.colors.onSurface }}
    >
      <ScrollView scrollEnabled={isScrollEnabled}>
        <View style={{ gap: 10, padding: 10 }}>
          <Text style={{ fontSize: 24, fontWeight: "bold" }}>Add Item</Text>
          {productArr.length === 0 ? null : (
            <DataTable>
              <DataTable.Header>
                <DataTable.Title>Product Name</DataTable.Title>
                <DataTable.Title numeric>Amount</DataTable.Title>
                <DataTable.Title numeric style={{ paddingRight: 30 }}>
                  Quantity
                </DataTable.Title>
                {/*<DataTable.Title
                  numeric
                  style={{ marginHorizontal: 10, flex: 0 }}
                >
                  Action
                </DataTable.Title>*/}
              </DataTable.Header>
              {productArr.map((product) => (
                <DataTable.Row key={product.id.toString()}>
                  <DataTable.Cell>{product.pName}</DataTable.Cell>
                  <DataTable.Cell numeric>
                    {product.amount || "?"}
                  </DataTable.Cell>
                  <DataTable.Cell numeric>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 7,
                      }}
                    >
                      <Text>
                        {product.quantity || "?"}
                        {product.unit ? `(${product.unit})` : ""}
                      </Text>
                      <Pressable
                        onPress={() =>
                          setProductArr(
                            productArr.filter((p) => p.id !== product.id),
                          )
                        }
                      >
                        <Icon
                          source="delete"
                          size={24}
                          color={appTheme.colors.error}
                        />
                      </Pressable>
                      {/*<IconButton
                        icon="delete"
                        onPress={() =>
                          setProductArr(
                            productArr.filter((p) => p.id !== product.id),
                          )
                        }
                      />*/}
                    </View>
                  </DataTable.Cell>
                </DataTable.Row>
              ))}
            </DataTable>
          )}
          <TextInput
            testID="shopping-item-product-name-input"
            disabled={isSubmitLoading}
            mode="outlined"
            placeholder="Product Name"
            ref={productNameInpRef}
            value={productNameInpTxt}
            onChangeText={setProductNameInpTxt}
            onSubmitEditing={() => amountInpRef.current?.focus()}
          />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <TextInput
              testID="shopping-item-amount-input"
              disabled={isSubmitLoading}
              mode="outlined"
              placeholder="Amount"
              ref={amountInpRef}
              keyboardType="number-pad"
              style={{ flex: 1 }}
              value={amountInpTxt}
              onChangeText={(e) => setAmountInpTxt(e.replace(/[^0-9.]/g, ""))}
              onSubmitEditing={() => quantityInpRef.current?.focus()}
            />
            <TextInput
              testID="shopping-item-quantity-input"
              disabled={isSubmitLoading}
              mode="outlined"
              ref={quantityInpRef}
              placeholder="Quantity"
              keyboardType="number-pad"
              style={{ minWidth: dim.width / 4 }}
              value={quantityInpTxt}
              onChangeText={(e) => setQuantityInpTxt(e.replace(/[^0-9.]/g, ""))}
              onSubmitEditing={() => unitInpRef.current?.focus()}
            />
            <TextInput
              testID="shopping-item-unit-input"
              disabled={isSubmitLoading}
              ref={unitInpRef}
              mode="outlined"
              placeholder="kg, ml..."
              style={{ minWidth: dim.width / 4 }}
              value={unitInpTxt}
              onChangeText={setUnitInpTxt}
              onSubmitEditing={() => addToProductArr()}
            />
          </View>
          <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
            <Button
              testID="shopping-item-add-btn"
              mode="contained"
              onPress={addToProductArr}
              loading={isSubmitLoading}
              disabled={isSubmitLoading}
              style={{ paddingHorizontal: 20 }}
            >
              Add
            </Button>
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View>
              <Text>Geo fence</Text>
              {isGeoFenceEnabled && geoFence ? (
                <Text style={{ fontSize: 12, opacity: 0.6 }}>
                  Zone: {geoFence.lat.toFixed(4)}, {geoFence.lon.toFixed(4)} (100m)
                </Text>
              ) : null}
            </View>
            {isGeoFencingLoading ? (
              <ActivityIndicator />
            ) : (
              <Checkbox
                disabled={isSubmitLoading}
                status={isGeoFenceEnabled ? "checked" : "unchecked"}
                onPress={async () => {
                  if (isGeoFencingLoading || isSubmitLoading) return;
                  if (isGeoFenceEnabled) {
                    setIsGeoFenceEnabled(false);
                    setGeoFence(null);
                    setIsMapSelectorVisible(false);
                  } else {
                    setIsGeoFenceEnabled(true);
                    setIsGeoFencingLoading(true);
                    try {
                      if (!currentLocation) {
                        const loc = await getCurrentLocation();
                        if (loc[0]) {
                          setCurrentLocation(loc[0]);
                        }
                      }
                      setIsMapSelectorVisible(true);
                    } finally {
                      setIsGeoFencingLoading(false);
                    }
                  }
                }}
              />
            )}
          </View>
          {isMapSelectorVisible ? (
            <View
              style={{ borderRadius: appTheme.roundness, overflow: "hidden" }}
            >
              {/*<GestureDetector gesture={nativeGesture}>*/}
              <View
                collapsable={false}
                onTouchStart={() => setIsScrollEnabled(false)}
                onTouchEnd={() => setIsScrollEnabled(true)}
                onTouchCancel={() => setIsScrollEnabled(true)}
              >
                <Map
                  // mapStyle="https://demotiles.maplibre.org/style.json"
                  mapStyle={
                    "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json"
                  }
                  style={{ width: dim.width - 20, height: dim.width * 0.6 }}
                  doubleTapZoom
                  onPress={(e) => {
                    console.log(e.nativeEvent.lngLat);
                    setIsGeoFencingLoading(false);
                    setGeoFence({
                      lat: e.nativeEvent.lngLat[1],
                      lon: e.nativeEvent.lngLat[0],
                    });
                  }}
                  onWillStartLoadingMap={() => console.log("load start")}
                  onDidFinishLoadingMap={() => console.log("load end")}
                  onDidFailLoadingMap={() => console.log("load fail")}
                >
                  {currentLocation ? (
                    <Camera
                      center={[
                        currentLocation.coords.longitude,
                        currentLocation.coords.latitude,
                      ]}
                      zoom={14}
                    />
                  ) : null}
                  {geoFence && (
                    <GeoJSONSource
                      id="geofence-source"
                      // In v11, "shape" was renamed to "data"
                      data={createGeoJSONCircle(
                        geoFence.lon,
                        geoFence.lat,
                        0.1,
                      )}
                    >
                      {/* The semi-transparent center of the circle */}
                      <Layer
                        id="geofence-fill"
                        type="fill" // Tell the Layer to act as a FillLayer
                        style={{
                          fillColor: "rgba(0, 150, 255, 0.2)",
                        }}
                      />

                      {/* The solid border of the circle */}
                      <Layer
                        id="geofence-line"
                        type="line" // Tell the Layer to act as a LineLayer
                        style={{
                          lineColor: "rgba(0, 150, 255, 1)",
                          lineWidth: 2,
                        }}
                      />
                    </GeoJSONSource>
                  )}
                </Map>
              </View>
              {/*</GestureDetector>*/}
            </View>
          ) : null}
          <TextInput
            placeholder="Note"
            mode="outlined"
            multiline
            style={{ minHeight: 100 }}
            value={noteInpTxt}
            onChangeText={setNoteInpTxt}
          />

          <Button
            testID="shopping-item-save-btn"
            mode="contained"
            onPress={onSubmitHandler}
            loading={isSubmitLoading}
            disabled={isSubmitLoading}
          >
            Save
          </Button>
        </View>
      </ScrollView>
    </ActionSheet>
  );
};
