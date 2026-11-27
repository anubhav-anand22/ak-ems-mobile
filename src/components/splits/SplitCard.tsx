import { CustomPaperTheme } from "@/constants/paperTheme";
import type { SplitRecordType } from "@/db/schema";
import { indianNumberFormatter } from "@/lib/numFormator";
import { View } from "react-native";
import {
  Card,
  Chip,
  Divider,
  Icon,
  IconButton,
  Text,
  useTheme,
} from "react-native-paper";

type SplitCardProps = {
  split: SplitRecordType;
  isDeleting?: boolean;
  onDelete: (split: SplitRecordType) => void;
};

export function SplitCard({
  split,
  isDeleting = false,
  onDelete,
}: SplitCardProps) {
  const theme = useTheme<CustomPaperTheme>();
  const createdDate = new Date(split.createdAt);
  const formattedDate = !isNaN(createdDate.getTime())
    ? createdDate.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "";

  return (
    <Card testID={`split-card-${split.id}`} style={{ overflow: "hidden" }}>
      <Card.Content style={{ gap: 10 }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Icon
              source="call-split"
              size={20}
              color={theme.colors.primary}
            />
            <Text
              variant="titleLarge"
              style={{ fontWeight: "700", color: theme.colors.primary }}
            >
              ₹{indianNumberFormatter.format(split.totalAmount)}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            {formattedDate ? (
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {formattedDate}
              </Text>
            ) : null}
            <IconButton
              testID={`split-delete-btn-${split.id}`}
              icon="delete-outline"
              size={20}
              iconColor={theme.colors.customError}
              disabled={isDeleting}
              accessibilityLabel="Delete split"
              onPress={() => onDelete(split)}
              style={{ margin: 0 }}
            />
          </View>
        </View>

        <Divider />

        <View style={{ gap: 6 }}>
          {split.participants.map((p) => (
            <View
              key={p.id}
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  flex: 1,
                }}
              >
                <Text
                  variant="bodyMedium"
                  style={{ fontWeight: p.isMe ? "700" : "500" }}
                  numberOfLines={1}
                >
                  {p.name}
                </Text>
                {p.phoneNumber ? (
                  <Chip
                    compact
                    mode="outlined"
                    icon="phone-outline"
                    textStyle={{ fontSize: 11 }}
                  >
                    {p.phoneNumber}
                  </Chip>
                ) : null}
              </View>
              <Text
                variant="bodyMedium"
                style={{
                  fontWeight: "600",
                  color: theme.colors.onSurface,
                }}
              >
                ₹{indianNumberFormatter.format(p.calculatedMoney)} (
                {p.calculatedPercentage.toFixed(2)}%)
              </Text>
            </View>
          ))}
        </View>
      </Card.Content>
    </Card>
  );
}
