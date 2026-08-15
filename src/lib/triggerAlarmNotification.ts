import notifee, { AndroidImportance } from "@notifee/react-native";

export const triggerAlarmNotification = async ({
  title,
  body,
}: {
  title: string;
  body: string;
}) => {
  // 1. Request permissions (Required for iOS and Android 13+)
  await notifee.requestPermission();

  // 2. Create the Android channel for the alarm
  const channelId = await notifee.createChannel({
    id: "geofence-alarms",
    name: "Geofence Alarms",
    sound: "default", // Matches alarm.mp3 in res/raw without the extension
    importance: AndroidImportance.HIGH,
  });

  // 3. Display the notification
  await notifee.displayNotification({
    title,
    body,
    android: {
      channelId,
      sound: "default",
      // Optional: Add a vibration pattern
      vibrationPattern: [300, 500, 300, 500],
    },
  });
};
