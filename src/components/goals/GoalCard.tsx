import { CustomPaperTheme } from "@/constants/paperTheme";
import type { GoalType } from "@/db/schema";
import { formatSmartDate } from "@/lib/formatSmartDate";
import {
  getGoalProgressFraction,
  getGoalProgressPercent,
  getGoalRemainingMoney,
  getGoalStepAmount,
  isGoalAchieved,
} from "@/lib/goalsUtils";
import { indianNumberFormatter } from "@/lib/numFormator";
import { useEffect, useState } from "react";
import { useWindowDimensions, View } from "react-native";
import {
  Button,
  Card,
  Chip,
  Icon,
  IconButton,
  ProgressBar,
  Text,
  useTheme,
} from "react-native-paper";
import {
  createAnimatedComponent,
  LinearTransition,
} from "react-native-reanimated";

const AnimatedCard = createAnimatedComponent(Card);

type GoalCardProps = {
  goal: GoalType;
  isMutating?: boolean;
  onAdjustDelta: (goal: GoalType, delta: number) => void;
  onOpenMenu: (goal: GoalType, x: number, y: number) => void;
};

export function GoalCard({
  goal,
  isMutating = false,
  onAdjustDelta,
  onOpenMenu,
}: GoalCardProps) {
  const theme = useTheme<CustomPaperTheme>();
  const { fontScale } = useWindowDimensions();
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    setIsExpanded(false);
  }, [goal.id]);

  const achieved = isGoalAchieved(goal);
  const progressFraction = getGoalProgressFraction(goal);
  const progressPercent = getGoalProgressPercent(goal);
  const remainingMoney = getGoalRemainingMoney(goal);
  const stepAmount = getGoalStepAmount(goal.targetMoney);
  const tags = goal.tags ?? [];
  const trimmedNote = goal.note?.trim() ?? "";

  const isAtMin = goal.currentMoney <= 0;
  const isAtMax = goal.currentMoney >= goal.targetMoney;

  return (
    <View style={{ width: "100%" }}>
      <AnimatedCard
        testID={`goal-card-${goal.id}`}
        layout={LinearTransition.springify()}
        style={{ overflow: "hidden" }}
        onPress={() => {
          if (trimmedNote) {
            setIsExpanded((prev) => !prev);
          }
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: theme.colors.surface,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingHorizontal: 10,
            }}
          >
            <Icon
              size={18}
              source={achieved ? "check-decagram" : "flag-outline"}
              color={
                achieved ? theme.colors.customSuccess : theme.colors.primary
              }
            />
            <Text
              style={{
                fontWeight: "600",
                color: achieved
                  ? theme.colors.customSuccess
                  : theme.colors.onSurface,
              }}
            >
              {achieved ? "Achieved" : "Active"}
            </Text>
            <View style={{ paddingTop: 2 }}>
              <Icon source="circle" size={4} />
            </View>
            <Text
              testID={`goal-card-percent-${goal.id}`}
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {progressPercent}%
            </Text>
          </View>

          <IconButton
            testID={`goal-card-menu-btn-${goal.id}`}
            icon="dots-horizontal"
            style={{ height: 24, margin: 5, zIndex: 10 }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={(e) => {
              e.stopPropagation();
              const { pageX, pageY } = e.nativeEvent;
              onOpenMenu(goal, pageX, pageY + 20);
            }}
          />
        </View>

        <Card.Content style={{ gap: 8, paddingTop: 8 }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 10,
            }}
          >
            <Text
              testID={`goal-card-title-${goal.id}`}
              variant="titleMedium"
              style={{ flex: 1, fontWeight: "700" }}
              numberOfLines={isExpanded ? undefined : 2}
            >
              {goal.targetName}
            </Text>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                paddingTop: 2,
              }}
            >
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {formatSmartDate(goal.createdAt)}
              </Text>
              <Icon
                source="clock-outline"
                size={14}
                color={theme.colors.onSurfaceVariant}
              />
            </View>
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "baseline",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 6,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "baseline",
                flexWrap: "wrap",
              }}
            >
              <Text
                testID={`goal-card-current-${goal.id}`}
                style={{
                  fontSize: 22 * fontScale,
                  fontWeight: "bold",
                  color: achieved
                    ? theme.colors.customSuccess
                    : theme.colors.onSurface,
                }}
              >
                ₹{indianNumberFormatter.format(goal.currentMoney)}
              </Text>
              <Text
                testID={`goal-card-target-${goal.id}`}
                variant="bodyMedium"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {" "}
                / ₹{indianNumberFormatter.format(goal.targetMoney)}
              </Text>
            </View>

            <Text
              variant="labelMedium"
              style={{
                fontWeight: "600",
                color: achieved
                  ? theme.colors.customSuccess
                  : theme.colors.onSurfaceVariant,
              }}
            >
              {achieved
                ? "Goal completed!"
                : `₹${indianNumberFormatter.format(remainingMoney)} left`}
            </Text>
          </View>

          <ProgressBar
            testID={`goal-card-progress-${goal.id}`}
            progress={progressFraction}
            color={achieved ? theme.colors.customSuccess : theme.colors.primary}
            style={{
              height: 8,
              borderRadius: 4,
              backgroundColor: theme.colors.surfaceVariant,
            }}
          />

          {tags.length > 0 ? (
            <View
              style={{
                flexDirection: "row",
                gap: 5,
                flexWrap: "wrap",
              }}
            >
              {tags.map((tag) => (
                <Chip key={tag} compact>
                  {tag}
                </Chip>
              ))}
            </View>
          ) : null}

          {trimmedNote ? (
            <Text
              testID={`goal-card-note-${goal.id}`}
              variant="bodySmall"
              numberOfLines={isExpanded ? undefined : 2}
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {trimmedNote}
            </Text>
          ) : null}

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              marginTop: 2,
            }}
          >
            <Button
              testID={`goal-card-decrement-btn-${goal.id}`}
              accessibilityLabel={`Decrease ${goal.targetName} by ${stepAmount} rupees`}
              mode="contained-tonal"
              icon="minus"
              compact
              disabled={isAtMin || isMutating}
              onPress={() => onAdjustDelta(goal, -stepAmount)}
              style={{ flex: 1 }}
            >
              ₹{indianNumberFormatter.format(stepAmount)}
            </Button>

            <Button
              testID={`goal-card-increment-btn-${goal.id}`}
              accessibilityLabel={`Increase ${goal.targetName} by ${stepAmount} rupees`}
              mode="contained-tonal"
              icon="plus"
              compact
              disabled={isAtMax || isMutating}
              onPress={() => onAdjustDelta(goal, stepAmount)}
              style={{ flex: 1 }}
            >
              ₹{indianNumberFormatter.format(stepAmount)}
            </Button>
          </View>
        </Card.Content>
      </AnimatedCard>
    </View>
  );
}
