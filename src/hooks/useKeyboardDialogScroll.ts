import {
  computeFocusedFieldScrollOffset,
  computeGoalDialogLayoutMetrics,
} from "@/lib/goalsUtils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LayoutChangeEvent, LayoutRectangle, ScrollView } from "react-native";
import {
  useKeyboardState,
  useWindowDimensions,
} from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export const DIALOG_TOP_PADDING = 16;
export const DIALOG_BOTTOM_PADDING = 16;

/**
 * Shared hook encapsulating keyboard-aware dialog height metrics and
 * automatic focused-field scrolling inside a scrollable Paper Dialog.
 */
export function useKeyboardDialogScroll<TFieldKey extends string>(
  visible: boolean,
) {
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isKeyboardVisible = useKeyboardState((state) => state.isVisible);
  const keyboardHeight = useKeyboardState((state) => state.height);

  const [titleHeight, setTitleHeight] = useState(60);
  const [actionsHeight, setActionsHeight] = useState(64);

  const scrollViewRef = useRef<ScrollView>(null);
  const scrollOffsetRef = useRef(0);
  const scrollViewportHeightRef = useRef(0);
  const focusedFieldRef = useRef<TFieldKey | null>(null);
  const fieldLayoutsRef = useRef<Partial<Record<TFieldKey, LayoutRectangle>>>(
    {},
  );

  useEffect(() => {
    if (!visible || !isKeyboardVisible) {
      focusedFieldRef.current = null;
    }
    if (!visible) {
      scrollOffsetRef.current = 0;
    }
  }, [visible, isKeyboardVisible]);

  const titlePaddingTop = isKeyboardVisible ? 16 : 20;
  const titlePaddingBottom = isKeyboardVisible ? 8 : 12;
  const contentPaddingBottom = isKeyboardVisible ? 10 : 14;
  const actionsPaddingBottom = isKeyboardVisible ? 14 : 20;

  const layoutMetrics = useMemo(
    () =>
      computeGoalDialogLayoutMetrics({
        windowHeight,
        keyboardHeight,
        isKeyboardVisible,
        topInset: insets.top,
        bottomInset: insets.bottom,
        topPadding: DIALOG_TOP_PADDING,
        bottomPadding: DIALOG_BOTTOM_PADDING,
        titleHeight,
        actionsHeight,
        contentBottomPadding: contentPaddingBottom,
      }),
    [
      windowHeight,
      keyboardHeight,
      isKeyboardVisible,
      insets.top,
      insets.bottom,
      titleHeight,
      actionsHeight,
      contentPaddingBottom,
    ],
  );

  const scrollFieldIntoView = useCallback((fieldKey: TFieldKey) => {
    const fieldLayout = fieldLayoutsRef.current[fieldKey];
    const viewportHeight = scrollViewportHeightRef.current;
    if (!fieldLayout || viewportHeight <= 0) return;

    const targetY = computeFocusedFieldScrollOffset({
      fieldY: fieldLayout.y,
      fieldHeight: fieldLayout.height,
      viewportHeight,
      currentScrollY: scrollOffsetRef.current,
    });
    if (targetY !== null) {
      scrollViewRef.current?.scrollTo({ y: targetY, animated: true });
    }
  }, []);

  const handleFieldFocus = useCallback(
    (fieldKey: TFieldKey) => {
      focusedFieldRef.current = fieldKey;
      requestAnimationFrame(() => {
        if (focusedFieldRef.current === fieldKey) {
          scrollFieldIntoView(fieldKey);
        }
      });
    },
    [scrollFieldIntoView],
  );

  const handleFieldBlur = useCallback((fieldKey: TFieldKey) => {
    if (focusedFieldRef.current === fieldKey) {
      focusedFieldRef.current = null;
    }
  }, []);

  const registerFieldLayout = useCallback(
    (fieldKey: TFieldKey, event: LayoutChangeEvent) => {
      fieldLayoutsRef.current[fieldKey] = event.nativeEvent.layout;
      if (focusedFieldRef.current === fieldKey) {
        requestAnimationFrame(() => {
          if (focusedFieldRef.current === fieldKey) {
            scrollFieldIntoView(fieldKey);
          }
        });
      }
    },
    [scrollFieldIntoView],
  );

  const handleScrollViewLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const nextHeight = event.nativeEvent.layout.height;
      const prevHeight = scrollViewportHeightRef.current;
      scrollViewportHeightRef.current = nextHeight;

      const activeField = focusedFieldRef.current;
      if (activeField && nextHeight > 0 && nextHeight !== prevHeight) {
        requestAnimationFrame(() => {
          if (focusedFieldRef.current === activeField) {
            scrollFieldIntoView(activeField);
          }
        });
      }
    },
    [scrollFieldIntoView],
  );

  const resetScrollOffset = useCallback(() => {
    scrollOffsetRef.current = 0;
  }, []);

  return {
    scrollViewRef,
    scrollOffsetRef,
    layoutMetrics,
    titlePaddingTop,
    titlePaddingBottom,
    contentPaddingBottom,
    actionsPaddingBottom,
    setTitleHeight,
    setActionsHeight,
    scrollFieldIntoView,
    handleFieldFocus,
    handleFieldBlur,
    registerFieldLayout,
    handleScrollViewLayout,
    resetScrollOffset,
  };
}
