import { Appbar } from "react-native-paper";

type HeaderUserButtonProps = {
  onPress: () => void;
  disabled?: boolean;
};

export function HeaderUserButton({ onPress, disabled }: HeaderUserButtonProps) {
  return (
    <Appbar.Action
      testID="home-users-btn"
      icon="account-group"
      accessibilityLabel="User transaction history"
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      disabled={disabled}
      onPress={onPress}
    />
  );
}
