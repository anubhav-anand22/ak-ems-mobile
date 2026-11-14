import notifee, { AndroidImportance } from "@notifee/react-native";

let lastTriggerTime = 0;
let lastTriggerKey = "";

export const triggerAlarmNotification = async ({
  title,
  body,
}: {
  title: string;
  body: string;
}) => {
  const now = Date.now();
  const key = `${title}::${body}`;
  // Suppress duplicate notifications within 4 seconds
  if (now - lastTriggerTime < 4000 && lastTriggerKey === key) {
    return;
  }
  lastTriggerTime = now;
  lastTriggerKey = key;

  try {
    // 1. Request permissions (Required for iOS and Android 13+)
    await notifee.requestPermission();
  } catch {}

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
