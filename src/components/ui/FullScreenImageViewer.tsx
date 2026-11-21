import React, { useState } from "react";
import {
  Dimensions,
  Modal,
  StatusBar,
  StyleSheet,
  View,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Image } from "expo-image";
import * as Sharing from "expo-sharing";
import { ActivityIndicator, IconButton, Text, useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type FullScreenImageViewerProps = {
  visible: boolean;
  imageUri: string | null;
  onClose: () => void;
};

export function FullScreenImageViewer({
  visible,
  imageUri,
  onClose,
}: FullScreenImageViewerProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

  const [isSharing, setIsSharing] = useState(false);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [rotationState, setRotationState] = useState(0);

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const rotationDeg = useSharedValue(0);

  const updateZoomText = (newScale: number) => {
    setZoomPercent(Math.round(newScale * 100));
  };

  const resetTransforms = () => {
    scale.value = withTiming(1);
    savedScale.value = 1;
    translateX.value = withTiming(0);
    translateY.value = withTiming(0);
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
    rotationDeg.value = withTiming(0);
    setZoomPercent(100);
    setRotationState(0);
  };

  const handleClose = () => {
    resetTransforms();
    onClose();
  };

  const handleRotate = () => {
    const nextRotation = (rotationDeg.value + 90) % 360;
    rotationDeg.value = withTiming(nextRotation);
    setRotationState(nextRotation);
  };

  const handleZoomIn = () => {
    const nextScale = Math.min(scale.value + 0.5, 5);
    scale.value = withTiming(nextScale);
    savedScale.value = nextScale;
    updateZoomText(nextScale);
  };

  const handleZoomOut = () => {
    const nextScale = Math.max(scale.value - 0.5, 1);
    scale.value = withTiming(nextScale);
    savedScale.value = nextScale;
    if (nextScale === 1) {
      translateX.value = withTiming(0);
      translateY.value = withTiming(0);
      savedTranslateX.value = 0;
      savedTranslateY.value = 0;
    }
    updateZoomText(nextScale);
  };

  const handleShare = async () => {
    if (!imageUri) return;
    try {
      setIsSharing(true);
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        return;
      }
      await Sharing.shareAsync(imageUri, {
        mimeType: "image/webp",
        dialogTitle: "Share Note Image",
      });
    } catch (e) {
      console.warn("Error sharing image:", e);
    } finally {
      setIsSharing(false);
    }
  };

  // Pinch Gesture
  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      const nextScale = Math.max(0.8, Math.min(savedScale.value * e.scale, 5));
      scale.value = nextScale;
      runOnJS(updateZoomText)(nextScale);
    })
    .onEnd(() => {
      if (scale.value < 1) {
        scale.value = withTiming(1);
        savedScale.value = 1;
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        runOnJS(updateZoomText)(1);
      } else {
        savedScale.value = scale.value;
      }
    });

  // Pan Gesture
  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (scale.value > 1) {
        translateX.value = savedTranslateX.value + e.translationX;
        translateY.value = savedTranslateY.value + e.translationY;
      }
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  // Double-tap Gesture
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1.2) {
        scale.value = withTiming(1);
        savedScale.value = 1;
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
        runOnJS(updateZoomText)(1);
      } else {
        scale.value = withTiming(2.5);
        savedScale.value = 2.5;
        runOnJS(updateZoomText)(2.5);
      }
    });

  const composedGesture = Gesture.Simultaneous(
    pinchGesture,
    panGesture,
    doubleTapGesture,
  );

  const animatedImageStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotationDeg.value}deg` },
        { scale: scale.value },
      ],
    };
  });

  if (!visible || !imageUri) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <GestureHandlerRootView style={styles.rootContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <View style={styles.backdrop}>
          {/* Top Action Bar */}
          <View
            style={[
              styles.topBar,
              { paddingTop: Math.max(insets.top + 8, 20) },
            ]}
          >
            <IconButton
              testID="full-screen-image-close-btn"
              icon="close"
              iconColor="#FFFFFF"
              size={26}
              style={styles.iconButtonBackdrop}
              onPress={handleClose}
            />
            <View style={styles.topInfoContainer}>
              {rotationState !== 0 ? (
                <View style={styles.badge}>
                  <Text variant="labelSmall" style={styles.badgeText}>
                    {rotationState}°
                  </Text>
                </View>
              ) : null}
              {zoomPercent !== 100 ? (
                <View style={styles.badge}>
                  <Text variant="labelSmall" style={styles.badgeText}>
                    {zoomPercent}%
                  </Text>
                </View>
              ) : null}
            </View>
            <View style={styles.topRightActions}>
              <IconButton
                testID="full-screen-image-rotate-btn"
                icon="rotate-right"
                iconColor="#FFFFFF"
                size={24}
                style={styles.iconButtonBackdrop}
                onPress={handleRotate}
              />
              {isSharing ? (
                <ActivityIndicator
                  size={22}
                  color="#FFFFFF"
                  style={{ marginHorizontal: 8 }}
                />
              ) : (
                <IconButton
                  testID="full-screen-image-share-btn"
                  icon="share-variant"
                  iconColor="#FFFFFF"
                  size={24}
                  style={styles.iconButtonBackdrop}
                  onPress={handleShare}
                />
              )}
            </View>
          </View>

          {/* Image Canvas with Pinch / Pan / Double-Tap */}
          <View style={styles.canvasContainer}>
            <GestureDetector gesture={composedGesture}>
              <Animated.View style={[styles.imageWrapper, animatedImageStyle]}>
                <Image
                  source={{ uri: imageUri }}
                  style={{
                    width: screenWidth,
                    height: screenHeight * 0.72,
                  }}
                  contentFit="contain"
                  transition={200}
                />
              </Animated.View>
            </GestureDetector>
          </View>

          {/* Bottom Floating Zoom Controls */}
          <View
            style={[
              styles.bottomControls,
              { paddingBottom: Math.max(insets.bottom + 12, 24) },
            ]}
          >
            <View style={styles.controlsPill}>
              <IconButton
                testID="full-screen-image-zoom-out-btn"
                icon="magnify-minus-outline"
                iconColor="#FFFFFF"
                size={22}
                disabled={zoomPercent <= 100}
                onPress={handleZoomOut}
              />
              <IconButton
                testID="full-screen-image-reset-btn"
                icon="fit-to-screen-outline"
                iconColor="#FFFFFF"
                size={20}
                onPress={resetTransforms}
              />
              <IconButton
                testID="full-screen-image-zoom-in-btn"
                icon="magnify-plus-outline"
                iconColor="#FFFFFF"
                size={22}
                disabled={zoomPercent >= 500}
                onPress={handleZoomIn}
              />
            </View>
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "#050505",
    justifyContent: "space-between",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    zIndex: 20,
  },
  iconButtonBackdrop: {
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    margin: 4,
  },
  topInfoContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  topRightActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  badge: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  badgeText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  canvasContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  imageWrapper: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  bottomControls: {
    alignItems: "center",
    zIndex: 20,
  },
  controlsPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    borderRadius: 28,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
  },
});
