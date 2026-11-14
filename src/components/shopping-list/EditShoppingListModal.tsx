import { ShoppingCartType } from "@/db/schema";
import { createGeoJSONCircle } from "@/lib/createGeoJSONCircle";
import { formatSmartDate } from "@/lib/formatSmartDate";
import { getCurrentLocation } from "@/lib/getCurrentLocation";
import {
  DEFAULT_GEOFENCE_RADIUS_KM,
  DEFAULT_GEOFENCE_RADIUS_METERS,
  openBatteryOptimizationSettings,
} from "@/lib/locationUtils";
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
} from "@maplibre/maplibre-react-native";
import { LocationObject } from "expo-location";
import { useEffect, useState } from "react";
import {
  Keyboard,
  ScrollView,
  useWindowDimensions,
  View,
} from "react-native";
import {
  ActivityIndicator,
  Button,
  Checkbox,
  Dialog,
  HelperText,
  Portal,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";

type GeoFenceCoords = {
  lat: number;
  lon: number;
};

type EditShoppingListModalProps = {
  visible: boolean;
  item: ShoppingCartType | null;
  isSaving?: boolean;
  saveError?: string | null;
  onDismiss: () => void;
  onSave: (updates: {
    listId: number;
    note: string | null;
    coords: GeoFenceCoords | null;
  }) => void | Promise<void>;
};

export function EditShoppingListModal({
  visible,
  item,
  isSaving = false,
  saveError = null,
  onDismiss,
  onSave,
}: EditShoppingListModalProps) {
  const theme = useTheme();
  const { height } = useWindowDimensions();

  const [note, setNote] = useState("");
  const [isGeoFenceEnabled, setIsGeoFenceEnabled] = useState(false);
  const [geoFence, setGeoFence] = useState<GeoFenceCoords | null>(null);
  const [isMapSelectorVisible, setIsMapSelectorVisible] = useState(false);
  const [isLocationLoading, setIsLocationLoading] = useState(false);
  const [currentLocation, setCurrentLocation] =
    useState<LocationObject | null>(null);
  const [isScrollEnabled, setIsScrollEnabled] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (visible && item) {
      setNote(item.note ?? "");
      const hasLocation = Boolean(item.location);
      setIsGeoFenceEnabled(hasLocation);
      setGeoFence(
        item.location
          ? { lat: item.location.lat, lon: item.location.lon }
          : null,
      );
      setIsMapSelectorVisible(false);
      setIsLocationLoading(false);
      setIsScrollEnabled(true);
      setValidationError(null);
    }
  }, [visible, item]);

  const openMapPicker = async () => {
    setIsMapSelectorVisible(true);
    if (!currentLocation && !geoFence) {
      setIsLocationLoading(true);
      try {
        const [loc] = await getCurrentLocation();
        if (loc) {
          setCurrentLocation(loc);
        }
      } finally {
        setIsLocationLoading(false);
      }
    }
  };

  const handleToggleGeoFence = async () => {
    if (isSaving || isLocationLoading) return;
    setValidationError(null);

    if (isGeoFenceEnabled) {
      setIsGeoFenceEnabled(false);
      setGeoFence(null);
      setIsMapSelectorVisible(false);
      return;
    }

    setIsGeoFenceEnabled(true);
    await openMapPicker();
  };

  const handleSave = async () => {
    if (!item || isSaving) return;

    if (isGeoFenceEnabled && !geoFence) {
      setValidationError(
        "Tap on the map to choose a geofence location, or uncheck Geofence.",
      );
      return;
    }

    Keyboard.dismiss();
    setValidationError(null);
    const trimmedNote = note.trim();
    await onSave({
      listId: item.id,
      note: trimmedNote.length > 0 ? trimmedNote : null,
      coords: isGeoFenceEnabled ? geoFence : null,
    });
  };

  const handleClose = () => {
    if (isSaving) return;
    Keyboard.dismiss();
    onDismiss();
  };

  const cameraCenter: [number, number] | null = geoFence
    ? [geoFence.lon, geoFence.lat]
    : currentLocation
      ? [currentLocation.coords.longitude, currentLocation.coords.latitude]
      : null;

  const combinedError = validationError || saveError;

  return (
    <Portal>
      <Dialog
        visible={visible}
        dismissable={!isSaving}
        onDismiss={handleClose}
      >
        <Dialog.Title>Edit Shopping List</Dialog.Title>
        <Dialog.Content>
          <ScrollView
            scrollEnabled={isScrollEnabled}
            keyboardShouldPersistTaps="handled"
            style={{ maxHeight: height * 0.62 }}
          >
            <View style={{ gap: 10 }}>
              {item ? (
                <Text
                  variant="bodySmall"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  {item.products.length}{" "}
                  {item.products.length === 1 ? "Item" : "Items"} • Updated{" "}
                  {formatSmartDate(item.updatedAt)}
                </Text>
              ) : null}

              <TextInput
                testID="edit-list-modal-note-input"
                mode="outlined"
                label="List Name / Note"
                placeholder="e.g., Weekly Groceries"
                multiline
                disabled={isSaving}
                style={{ minHeight: 80 }}
                value={note}
                onChangeText={setNote}
              />

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text variant="bodyMedium">Geofence reminder</Text>
                  {isGeoFenceEnabled && geoFence ? (
                    <Text
                      variant="labelSmall"
                      style={{ color: theme.colors.onSurfaceVariant }}
                    >
                      Zone: {geoFence.lat.toFixed(4)}, {geoFence.lon.toFixed(4)} ({DEFAULT_GEOFENCE_RADIUS_METERS}m)
                    </Text>
                  ) : null}
                </View>
                {isLocationLoading ? (
                  <ActivityIndicator />
                ) : (
                  <Checkbox
                    testID="edit-list-modal-geofence-checkbox"
                    disabled={isSaving}
                    status={isGeoFenceEnabled ? "checked" : "unchecked"}
                    onPress={handleToggleGeoFence}
                  />
                )}
              </View>

              {isGeoFenceEnabled ? (
                <Button
                  mode="text"
                  compact
                  icon="battery-heart-variant"
                  style={{ alignSelf: "flex-start", marginTop: -6 }}
                  onPress={() => openBatteryOptimizationSettings()}
                >
                  Disable battery limits for real-time alerts
                </Button>
              ) : null}

              {isGeoFenceEnabled && !isMapSelectorVisible ? (
                <Button
                  mode="outlined"
                  icon="map-marker-radius"
                  disabled={isSaving}
                  onPress={openMapPicker}
                >
                  {geoFence ? "Change Location on Map" : "Pick Location on Map"}
                </Button>
              ) : null}

              {isGeoFenceEnabled && isMapSelectorVisible ? (
                <View style={{ gap: 6 }}>
                  <Text
                    variant="labelSmall"
                    style={{ color: theme.colors.onSurfaceVariant }}
                  >
                    Tap on the map to set the {DEFAULT_GEOFENCE_RADIUS_METERS}m reminder zone
                  </Text>
                  <View
                    style={{
                      borderRadius: theme.roundness,
                      overflow: "hidden",
                    }}
                  >
                    <View
                      collapsable={false}
                      onTouchStart={() => setIsScrollEnabled(false)}
                      onTouchEnd={() => setIsScrollEnabled(true)}
                      onTouchCancel={() => setIsScrollEnabled(true)}
                    >
                      <Map
                        mapStyle="https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json"
                        style={{ width: "100%", height: 210 }}
                        doubleTapZoom
                        onPress={(e) => {
                          setValidationError(null);
                          setGeoFence({
                            lat: e.nativeEvent.lngLat[1],
                            lon: e.nativeEvent.lngLat[0],
                          });
                        }}
                      >
                        {cameraCenter ? (
                          <Camera center={cameraCenter} zoom={14} />
                        ) : null}
                        {geoFence ? (
                          <GeoJSONSource
                            id="edit-geofence-source"
                            data={createGeoJSONCircle(
                              geoFence.lon,
                              geoFence.lat,
                              DEFAULT_GEOFENCE_RADIUS_KM,
                            )}
                          >
                            <Layer
                              id="edit-geofence-fill"
                              type="fill"
                              style={{
                                fillColor: "rgba(0, 150, 255, 0.2)",
                              }}
                            />
                            <Layer
                              id="edit-geofence-line"
                              type="line"
                              style={{
                                lineColor: "rgba(0, 150, 255, 1)",
                                lineWidth: 2,
                              }}
                            />
                          </GeoJSONSource>
                        ) : null}
                      </Map>
                    </View>
                  </View>
                </View>
              ) : null}

              {combinedError ? (
                <HelperText
                  type="error"
                  visible={Boolean(combinedError)}
                  padding="none"
                >
                  {combinedError}
                </HelperText>
              ) : null}
            </View>
          </ScrollView>
        </Dialog.Content>
        <Dialog.Actions style={{ flexWrap: "wrap", rowGap: 8 }}>
          <Button
            testID="edit-list-modal-cancel-btn"
            mode="contained-tonal"
            disabled={isSaving}
            style={{ paddingHorizontal: 12 }}
            onPress={handleClose}
          >
            Cancel
          </Button>
          <Button
            testID="edit-list-modal-save-btn"
            mode="contained"
            loading={isSaving}
            disabled={isSaving}
            style={{ paddingHorizontal: 12 }}
            onPress={handleSave}
          >
            Save
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
