import { CustomPaperTheme } from "@/constants/paperTheme";
import type { GoalType } from "@/db/schema";
import {
  computeFocusedFieldScrollOffset,
  computeGoalDialogLayoutMetrics,
  getWillClampCurrentNotice,
  GoalFormErrors,
  NormalizedGoalValues,
  validateGoalInput,
} from "@/lib/goalsUtils";
import { useGlobalState } from "@/lib/gState";
import { indianNumberFormatter } from "@/lib/numFormator";
import ReactiveKVStore from "@/lib/reactiveKV";
import { sanitizeDecimalInput } from "@/lib/shoppingListUtils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Keyboard,
  LayoutChangeEvent,
  LayoutRectangle,
  ScrollView,
  TextInput as RNTextInput,
  View,
} from "react-native";
import {
  useKeyboardState,
  useWindowDimensions,
} from "react-native-keyboard-controller";
import {
  Button,
  Chip,
  Dialog,
  HelperText,
  Portal,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type GoalFormFieldKey = "targetName" | "targetMoney" | "currentMoney" | "note";

const DIALOG_TOP_PADDING = 16;
const DIALOG_BOTTOM_PADDING = 16;

type GoalFormModalProps = {
  visible: boolean;
  initialGoal: GoalType | null;
  isSubmitting?: boolean;
  submitError?: string | null;
  onDismiss: () => void;
  onSubmit: (
    values: NormalizedGoalValues,
    wasCurrentClamped: boolean,
  ) => void | Promise<void>;
};

export function GoalFormModal({
  visible,
  initialGoal,
  isSubmitting = false,
  submitError = null,
  onDismiss,
  onSubmit,
}: GoalFormModalProps) {
  const theme = useTheme<CustomPaperTheme>();
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isKeyboardVisible = useKeyboardState((state) => state.isVisible);
  const keyboardHeight = useKeyboardState((state) => state.height);

  const globalTags = ReactiveKVStore.useReactiveKVStore((s) => s.tags);
  const addTagDialogShow = useGlobalState((s) => s.addTagDialogShow);
  const setAddTagDialogShow = useGlobalState((s) => s.setAddTagDialogShow);

  const [targetName, setTargetName] = useState("");
  const [targetMoney, setTargetMoney] = useState("");
  const [currentMoney, setCurrentMoney] = useState("");
  const [note, setNote] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [errors, setErrors] = useState<GoalFormErrors>({});
  const [titleHeight, setTitleHeight] = useState(60);
  const [actionsHeight, setActionsHeight] = useState(64);

  const scrollViewRef = useRef<ScrollView>(null);
  const targetMoneyRef = useRef<RNTextInput>(null);
  const currentMoneyRef = useRef<RNTextInput>(null);
  const noteRef = useRef<RNTextInput>(null);
  const wasVisibleRef = useRef(false);
  const lastGoalKeyRef = useRef<string | number | null>(null);
  const prevGlobalTagsRef = useRef<string[]>(globalTags);
  const pendingTagAddRef = useRef(false);
  const scrollOffsetRef = useRef(0);
  const scrollViewportHeightRef = useRef(0);
  const focusedFieldRef = useRef<GoalFormFieldKey | null>(null);
  const fieldLayoutsRef = useRef<
    Partial<Record<GoalFormFieldKey, LayoutRectangle>>
  >({});

  useEffect(() => {
    const goalKey = initialGoal ? initialGoal.id : "new";
    if (
      visible &&
      (!wasVisibleRef.current || lastGoalKeyRef.current !== goalKey)
    ) {
      if (initialGoal) {
        setTargetName(initialGoal.targetName);
        setTargetMoney(String(initialGoal.targetMoney));
        setCurrentMoney(String(initialGoal.currentMoney));
        setNote(initialGoal.note ?? "");
        setSelectedTags(initialGoal.tags ?? []);
      } else {
        setTargetName("");
        setTargetMoney("");
        setCurrentMoney("");
        setNote("");
        setSelectedTags([]);
      }
      setErrors({});
      scrollOffsetRef.current = 0;
      lastGoalKeyRef.current = goalKey;
    } else if (!visible) {
      lastGoalKeyRef.current = null;
      scrollOffsetRef.current = 0;
      focusedFieldRef.current = null;
    }
    wasVisibleRef.current = visible;
  }, [visible, initialGoal]);

  useEffect(() => {
    if (!visible || addTagDialogShow) {
      focusedFieldRef.current = null;
    }
  }, [visible, addTagDialogShow]);

  useEffect(() => {
    if (!isKeyboardVisible) {
      focusedFieldRef.current = null;
    }
  }, [isKeyboardVisible]);

  useEffect(() => {
    if (!addTagDialogShow && pendingTagAddRef.current) {
      pendingTagAddRef.current = false;
      const prevSet = new Set(prevGlobalTagsRef.current);
      const addedTags = globalTags.filter((tag) => !prevSet.has(tag));
      if (addedTags.length > 0) {
        setSelectedTags((prev) => Array.from(new Set([...prev, ...addedTags])));
      }
    }
    prevGlobalTagsRef.current = globalTags;
  }, [addTagDialogShow, globalTags]);

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

  const availableTags = useMemo(
    () => Array.from(new Set([...globalTags, ...selectedTags])),
    [globalTags, selectedTags],
  );

  const clampNotice = useMemo(
    () => getWillClampCurrentNotice(targetMoney, currentMoney),
    [targetMoney, currentMoney],
  );

  const scrollFieldIntoView = useCallback((fieldKey: GoalFormFieldKey) => {
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
    (fieldKey: GoalFormFieldKey) => {
      focusedFieldRef.current = fieldKey;
      requestAnimationFrame(() => {
        if (focusedFieldRef.current === fieldKey) {
          scrollFieldIntoView(fieldKey);
        }
      });
    },
    [scrollFieldIntoView],
  );

  const handleFieldBlur = useCallback((fieldKey: GoalFormFieldKey) => {
    if (focusedFieldRef.current === fieldKey) {
      focusedFieldRef.current = null;
    }
  }, []);

  const registerFieldLayout = useCallback(
    (fieldKey: GoalFormFieldKey, event: LayoutChangeEvent) => {
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

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag],
    );
  };

  const handleOpenAddTag = () => {
    prevGlobalTagsRef.current = globalTags;
    pendingTagAddRef.current = true;
    Keyboard.dismiss();
    setAddTagDialogShow(true);
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;

    const validation = validateGoalInput({
      targetName,
      targetMoney,
      currentMoney,
      note,
      tags: selectedTags,
    });

    if (!validation.isValid) {
      setErrors(validation.errors);
      const firstErrorField: GoalFormFieldKey | null =
        validation.errors.targetName
          ? "targetName"
          : validation.errors.targetMoney
            ? "targetMoney"
            : validation.errors.currentMoney
              ? "currentMoney"
              : null;
      if (firstErrorField) {
        requestAnimationFrame(() => scrollFieldIntoView(firstErrorField));
      }
      return;
    }

    Keyboard.dismiss();
    setErrors({});
    await onSubmit(validation.values, validation.wasCurrentClamped);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    Keyboard.dismiss();
    onDismiss();
  };

  const isEditMode = initialGoal !== null;

  return (
    <Portal>
      <Dialog
        testID="goal-form-dialog"
        visible={visible && !addTagDialogShow}
        dismissable={!isSubmitting}
        onDismiss={handleClose}
        style={{
          marginTop: DIALOG_TOP_PADDING,
          marginBottom:
            DIALOG_BOTTOM_PADDING + layoutMetrics.extraKeyboardBottomMargin,
          maxHeight: layoutMetrics.dialogMaxHeight,
        }}
      >
        <Dialog.Title
          style={{
            flexShrink: 0,
            marginTop: 0,
            marginBottom: 0,
            paddingTop: titlePaddingTop,
            paddingBottom: titlePaddingBottom,
          }}
          onLayout={(event) => {
            const nextHeight = Math.ceil(event.nativeEvent.layout.height);
            setTitleHeight((prev) => (prev !== nextHeight ? nextHeight : prev));
          }}
        >
          {isEditMode ? "Edit Goal" : "Add Goal"}
        </Dialog.Title>
        <Dialog.Content
          style={{
            flexShrink: 1,
            paddingBottom: contentPaddingBottom,
          }}
        >
          <ScrollView
            ref={scrollViewRef}
            testID="goal-form-scroll-view"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
            scrollEventThrottle={16}
            onScroll={(event) => {
              scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
            }}
            onLayout={handleScrollViewLayout}
            style={{
              flexGrow: 0,
              flexShrink: 1,
              maxHeight: layoutMetrics.scrollMaxHeight,
            }}
            contentContainerStyle={{ paddingBottom: 4 }}
          >
            <View style={{ gap: 8 }}>
              <View onLayout={(e) => registerFieldLayout("targetName", e)}>
                <TextInput
                  testID="goal-form-target-name-input"
                  mode="outlined"
                  label="Target Name *"
                  placeholder="e.g., Emergency Fund"
                  maxLength={100}
                  autoFocus={visible && !isEditMode && !addTagDialogShow}
                  disabled={isSubmitting}
                  error={Boolean(errors.targetName)}
                  value={targetName}
                  returnKeyType="next"
                  onFocus={() => handleFieldFocus("targetName")}
                  onBlur={() => handleFieldBlur("targetName")}
                  onChangeText={(txt) => {
                    setTargetName(txt);
                    if (errors.targetName && txt.trim()) {
                      setErrors((prev) => ({ ...prev, targetName: undefined }));
                    }
                  }}
                  onSubmitEditing={() => targetMoneyRef.current?.focus()}
                />
                {errors.targetName ? (
                  <HelperText
                    testID="goal-form-target-name-error"
                    type="error"
                    visible={Boolean(errors.targetName)}
                    padding="none"
                  >
                    {errors.targetName}
                  </HelperText>
                ) : null}
              </View>

              <View onLayout={(e) => registerFieldLayout("targetMoney", e)}>
                <TextInput
                  ref={targetMoneyRef}
                  testID="goal-form-target-money-input"
                  mode="outlined"
                  label="Target Amount *"
                  placeholder="0"
                  keyboardType="decimal-pad"
                  left={<TextInput.Affix text="₹" />}
                  disabled={isSubmitting}
                  error={Boolean(errors.targetMoney)}
                  value={targetMoney}
                  returnKeyType="next"
                  onFocus={() => handleFieldFocus("targetMoney")}
                  onBlur={() => handleFieldBlur("targetMoney")}
                  onChangeText={(txt) => {
                    setTargetMoney(sanitizeDecimalInput(txt));
                    if (errors.targetMoney) {
                      setErrors((prev) => ({ ...prev, targetMoney: undefined }));
                    }
                  }}
                  onSubmitEditing={() => currentMoneyRef.current?.focus()}
                />
                {errors.targetMoney ? (
                  <HelperText
                    testID="goal-form-target-money-error"
                    type="error"
                    visible={Boolean(errors.targetMoney)}
                    padding="none"
                  >
                    {errors.targetMoney}
                  </HelperText>
                ) : null}
              </View>

              <View onLayout={(e) => registerFieldLayout("currentMoney", e)}>
                <TextInput
                  ref={currentMoneyRef}
                  testID="goal-form-current-money-input"
                  mode="outlined"
                  label="Current Saved Amount"
                  placeholder="0"
                  keyboardType="decimal-pad"
                  left={<TextInput.Affix text="₹" />}
                  disabled={isSubmitting}
                  error={Boolean(errors.currentMoney)}
                  value={currentMoney}
                  returnKeyType="next"
                  onFocus={() => handleFieldFocus("currentMoney")}
                  onBlur={() => handleFieldBlur("currentMoney")}
                  onChangeText={(txt) => {
                    setCurrentMoney(sanitizeDecimalInput(txt));
                    if (errors.currentMoney) {
                      setErrors((prev) => ({
                        ...prev,
                        currentMoney: undefined,
                      }));
                    }
                  }}
                  onSubmitEditing={() => noteRef.current?.focus()}
                />
                {errors.currentMoney ? (
                  <HelperText
                    testID="goal-form-current-money-error"
                    type="error"
                    visible={Boolean(errors.currentMoney)}
                    padding="none"
                  >
                    {errors.currentMoney}
                  </HelperText>
                ) : clampNotice.willClamp ? (
                  <HelperText
                    testID="goal-form-clamp-notice"
                    type="info"
                    visible
                    padding="none"
                  >
                    Current amount (₹
                    {indianNumberFormatter.format(clampNotice.currentMoney)})
                    exceeds target and will be clamped to ₹
                    {indianNumberFormatter.format(clampNotice.targetMoney)}.
                  </HelperText>
                ) : null}
              </View>

              <View onLayout={(e) => registerFieldLayout("note", e)}>
                <TextInput
                  ref={noteRef}
                  testID="goal-form-note-input"
                  mode="outlined"
                  label="Note"
                  placeholder="Optional details or milestone notes"
                  multiline
                  maxLength={600}
                  disabled={isSubmitting}
                  style={{ minHeight: 80, maxHeight: 160 }}
                  value={note}
                  onFocus={() => handleFieldFocus("note")}
                  onBlur={() => handleFieldBlur("note")}
                  onChangeText={setNote}
                />
              </View>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 7,
                  flexWrap: "wrap",
                  marginTop: 4,
                }}
              >
                <Text style={{ fontWeight: "bold" }}>Tags: </Text>
                {availableTags.map((tag) => (
                  <Chip
                    key={tag}
                    testID={`goal-form-tag-chip-${tag}`}
                    icon={selectedTags.includes(tag) ? "check" : undefined}
                    mode="outlined"
                    disabled={isSubmitting}
                    onPress={() => toggleTag(tag)}
                  >
                    {tag}
                  </Chip>
                ))}
                <Button
                  testID="goal-form-add-tag-btn"
                  onPress={handleOpenAddTag}
                  mode="contained-tonal"
                  icon="plus"
                  disabled={isSubmitting}
                >
                  Add tag
                </Button>
              </View>

              {submitError ? (
                <HelperText
                  type="error"
                  visible={Boolean(submitError)}
                  padding="none"
                  style={{ color: theme.colors.customError }}
                >
                  {submitError}
                </HelperText>
              ) : null}
            </View>
          </ScrollView>
        </Dialog.Content>
        <Dialog.Actions
          style={{
            flexWrap: "wrap",
            rowGap: 8,
            flexGrow: 0,
            flexShrink: 0,
            paddingTop: 4,
            paddingBottom: actionsPaddingBottom,
          }}
          onLayout={(event) => {
            const nextHeight = Math.ceil(event.nativeEvent.layout.height);
            setActionsHeight((prev) =>
              prev !== nextHeight ? nextHeight : prev,
            );
          }}
        >
          <Button
            testID="goal-form-cancel-btn"
            mode="contained-tonal"
            disabled={isSubmitting}
            style={{ paddingHorizontal: 12 }}
            onPress={handleClose}
          >
            Cancel
          </Button>
          <Button
            testID="goal-form-submit-btn"
            mode="contained"
            loading={isSubmitting}
            disabled={isSubmitting}
            style={{ paddingHorizontal: 12 }}
            onPress={handleSubmit}
          >
            {isEditMode ? "Save" : "Add Goal"}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
