import {
  Dimensions,
  View,
  Modal,
  ScrollView,
  FlatList,
  Pressable,
  RefreshControl,
} from "react-native";
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
  MD3Theme,
  Menu,
  Portal,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import ActionSheet, {
  ActionSheetRef,
  useScrollHandlers,
} from "react-native-actions-sheet";
import { RefObject, useCallback, useEffect, useRef, useState } from "react";
import {
  Map,
  Camera,
  GeoJSONSource,
  Layer,
} from "@maplibre/maplibre-react-native";
import { getCurrentLocation } from "@/lib/getCurrentLocation";
import { LocationObject } from "expo-location";
import {} from "@rn-org/react-native-geofencing";
import { createGeoJSONCircle } from "@/lib/createGeoJSONCircle";
import { db } from "@/db/dbinit";
import {
  dbShoppingCart,
  dbTransaction,
  ShoppingCartType,
  ShoppingProduct,
} from "@/db/schema";
import { FlashList } from "@shopify/flash-list";
import Seperator from "@/components/ui/Seperator";
import { desc, eq } from "drizzle-orm";
import { indianNumberFormatter } from "@/lib/numFormator";
import { formatSmartDate } from "@/lib/formatSmartDate";
import { CustomPaperTheme } from "@/constants/paperTheme";
import { ConfirmData, useGlobalState } from "@/lib/gState";
import { getRandomStr } from "@/lib/getRandomStr";
import { useFocusEffect, useRouter } from "expo-router";
import Geofencing from "@rn-org/react-native-geofencing";
import { requestGeofencePermissions } from "@/lib/requestGeofencePermissions";
import { log } from "@/lib/log";

export default function ShopingList() {
  const dim = Dimensions.get("window");
  const appTheme = useTheme<CustomPaperTheme>();
  const router = useRouter();
  const addConfirm = useGlobalState((e) => e.addConfirm);
  const actionSheetRef = useRef<ActionSheetRef>(null);
  const [shoppingCart, setShoppingCart] = useState<ShoppingCartType[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const onNewItemAdd = (item: ShoppingCartType) => {
    setShoppingCart((prev) => [item, ...prev]);
  };

  const fetchShoppingCart = async () => {
    setIsLoading(true);
    try {
      log.info("fetchShoppingCart");
      const items = await db
        .select()
        .from(dbShoppingCart)
        .orderBy(desc(dbShoppingCart.updatedAt));
      setShoppingCart(items);
    } catch (e) {
      log.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteShopingCartItem = async (item: ShoppingCartType) => {
    log.info("deleteShopingCartItem", item.id, item.products[0].productName);
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
        log.info("item deleted", item.id, item.products[0].productName);
      })
      .catch((err) => {
        console.error(err);
        log.error(err);
      });
  };

  useFocusEffect(
    useCallback(() => {
      fetchShoppingCart();
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
                onDeleteItem={(id, newProductArr) => {
                  addConfirm({
                    id: getRandomStr(),
                    title: "Delete Item",
                    body: "Are you sure you want to delete this item?",
                    confirmBtnType: "DANGER",
                    onConfirm: () => {
                      db.update(dbShoppingCart)
                        .set({
                          products: newProductArr,
                        })
                        .where(eq(dbShoppingCart.id, id))
                        .then(() => {
                          setShoppingCart((prev) => {
                            const newArr = [...prev];
                            const index = newArr.findIndex(
                              (cartItem) => cartItem.id === id,
                            );
                            newArr[index].products = newProductArr;
                            return newArr;
                          });
                        })
                        .catch((err) => {
                          console.error(err);
                        });
                    },
                  });
                }}
                onRemove={(item) => {
                  addConfirm({
                    id: getRandomStr(),
                    title: "Delete",
                    confirmTxt: "Delete & Add TX",
                    aditionalBtns: [
                      {
                        txt: "Delete",
                        onPress: () => {
                          deleteShopingCartItem(item);
                        },
                        type: "DANGER",
                        id: getRandomStr(10),
                      },
                    ],
                    body: "Are you sure you want to delete this item?",
                    confirmBtnType:
                      item.completedItems?.length === item.products.length
                        ? undefined
                        : "DANGER",
                    onConfirm: () => {
                      console.log(item.completedItems);
                      if (item.completedItems?.length !== 0) {
                        // log.info("adding transaction due to completed items");
                        // db.insert(dbTransaction)
                        //   .values({
                        //     amount: item.products
                        //       .filter((e) =>
                        //         item.completedItems?.includes(e.productName),
                        //       )
                        //       .map((e) => {
                        //         return {
                        //           amount: e.amount ?? 0,
                        //           title: `${e.productName} ${e.quantity ?? 1}${e.unit ?? ""}`,
                        //         };
                        //       }),
                        //     expenseType: "Simple Expense",
                        //     subExpenseType: "Send",
                        //     toFrom: "Shopping",
                        //     note: item.note,
                        //   })
                        //   .catch(log.error);
                      }
                      deleteShopingCartItem(item);
                      if (item.completedItems?.length !== 0) {
                        const obj = {
                          note: item.note,
                          toFrom: "Shopping Cart",
                          amount: item.products
                            .filter((e) =>
                              item.completedItems?.includes(e.productName),
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

      <AddShoppingItem
        actionSheetRef={actionSheetRef}
        onNewItemAdd={onNewItemAdd}
      />
      <FAB
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
  onRemove,
  onDeleteItem,
}: {
  item: ShoppingCartType;
  appTheme: CustomPaperTheme;
  onRemove: (item: ShoppingCartType) => void;
  onDeleteItem: (id: number, newProductArr: ShoppingProduct[]) => void;
}) => {
  const [completedItems, setCompletedItems] = useState(
    item.completedItems ?? [],
  );

  const updateCompletedItems = async (items: string[]) => {
    setCompletedItems(items);
    await db
      .update(dbShoppingCart)
      .set({ completedItems: items })
      .where(eq(dbShoppingCart.id, item.id));
  };

  const toggleIsAllShoppingItemCompleted = async () => {
    if (completedItems?.length === item.products.length) {
      updateCompletedItems([]);
    } else {
      const items = (item.products ?? []).map((e) => e.productName);
      updateCompletedItems(items);
    }
  };

  const toggleIsShoppingItemCompleted = async (productName: string) => {
    log.info("toggleIsShoppingItemCompleted", productName, completedItems);
    if (completedItems?.includes(productName)) {
      setCompletedItems((p) => {
        const newArr = p.filter((e) => e !== productName);
        updateCompletedItems(newArr);
        return newArr;
      });
    } else {
      setCompletedItems((p) => {
        const newArr = [...p, productName];
        updateCompletedItems(newArr);
        return newArr;
      });
    }
  };

  return (
    <Card>
      <Card.Title
        title={`${item.products.length} ${item.products.length === 1 ? "Item" : "Items"} (${formatSmartDate(item.updatedAt)})`}
        // left={({ size }) => <Icon source={"cart"} size={size} />}
        right={() => (
          <View
            style={{
              paddingRight: 10,
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <Checkbox
              status={
                completedItems?.length === item.products.length
                  ? "checked"
                  : "unchecked"
              }
              onPress={toggleIsAllShoppingItemCompleted}

            />
            <IconButton
              icon={"delete"}
              onPress={() => {
                onRemove({ ...item, completedItems });
              }}
              iconColor={appTheme.colors.customError}
              style={{padding: 0, margin: 0, marginLeft: 5}}
            />
            <IconButton
              icon={"pencil"}
              onPress={() => {
                onRemove({ ...item, completedItems });
              }}
              style={{padding: 0, margin: 0}}
            />
          </View>
        )}
      />
      <Card.Content>
        <DataTable>
          <DataTable.Header>
            <DataTable.Title>Product</DataTable.Title>
            <DataTable.Title numeric>Amount</DataTable.Title>
            <DataTable.Title numeric>Quantity</DataTable.Title>
            <DataTable.Title numeric> </DataTable.Title>
          </DataTable.Header>
          {item.products.map((product, index) => (
            <DataTable.Row
              key={index + product.productName + item.id}
              onLongPress={() =>
                onDeleteItem(
                  item.id,
                  item.products.filter(
                    (p) => p.productName !== product.productName,
                  ),
                )
              }
            >
              <DataTable.Cell>{product.productName}</DataTable.Cell>
              <DataTable.Cell numeric>
                {product.amount
                  ? indianNumberFormatter.format(product.amount ?? 0)
                  : "?"}
              </DataTable.Cell>
              <DataTable.Cell numeric>
                {product.quantity
                  ? indianNumberFormatter.format(product.quantity ?? 0)
                  : "?"}
              </DataTable.Cell>
              <DataTable.Cell numeric>
                <Checkbox
                  status={
                    completedItems?.includes(product.productName)
                      ? "checked"
                      : "unchecked"
                  }
                  onPress={() =>
                    toggleIsShoppingItemCompleted(product.productName)
                  }
                />
              </DataTable.Cell>
            </DataTable.Row>
          ))}
        </DataTable>
      </Card.Content>
    </Card>
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
          ? parseFloat((parseFloat(amountInpTxt) || 0).toFixed(2))
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
    setIsGeoFencingLoading(false);
    setIsMapSelectorVisible(false);
  };

  const onSubmitHandler = async () => {
    try {
      setSubmitLoading(true);

      if (productArr.length === 0) return;

      let geoFenceId: string | undefined;

      if (geoFence) {
        const [_, isDenied] = await requestGeofencePermissions();
        if (isDenied) return;
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
            message: "Failed to add geofence",
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
          location: geoFence
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
            <Text>Geo fence</Text>
            {isGeoFencingLoading ? (
              <ActivityIndicator />
            ) : (
              <Checkbox
                disabled={isSubmitLoading}
                status={geoFence ? "checked" : "unchecked"}
                onPress={async () => {
                  if (isGeoFencingLoading) return;
                  if (geoFence) {
                    setGeoFence(null);
                    setIsMapSelectorVisible(false);
                  } else {
                    setIsGeoFencingLoading(true);
                    if (!currentLocation) {
                      const currentLocation = await getCurrentLocation();
                      if (currentLocation[0]) {
                        setCurrentLocation(currentLocation[0]);
                      }
                      console.log(currentLocation[0]?.coords);
                    }

                    setIsMapSelectorVisible(true);
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
