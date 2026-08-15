import { PermissionsAndroid, Platform } from "react-native";
import { SendDirectSms } from "react-native-send-direct-sms";
import { log } from "./log";

export const sendDirectSMS = async (
  phoneNumber: string,
  message: string,
): Promise<{ errMsg?: string } | undefined> => {
  try {
    // 1. Safety check: Block iOS since it will crash
    if (Platform.OS !== "android") {
      return { errMsg: "Background SMS is only supported on Android." };
    }

    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.SEND_SMS,
      {
        title: "Send SMS Permission",
        message: "This app needs access to send SMS in the background.",
        buttonNeutral: "Ask Me Later",
        buttonNegative: "Cancel",
        buttonPositive: "OK",
      },
    );

    if (granted === PermissionsAndroid.RESULTS.GRANTED) {
      // 2. CRITICAL: You must await the SendDirectSms promise!
      await SendDirectSms(phoneNumber, message);
      return undefined; // Indicates success
    } else {
      return { errMsg: "Permission denied, unable to send SMS." };
    }
  } catch (err) {
    // 3. Log the ACTUAL error. If it says "SendDirectSms is not a function",
    // it means you are in Expo Go and need a Dev Build.
    log.error("SMS Native Module Error:", err);
    return { errMsg: "Something went wrong, unable to send SMS." };
  }
};

// import { PermissionsAndroid } from "react-native";
// import { SendDirectSms } from "react-native-send-direct-sms";

// export const sendDirectSMS = async (
//   phoneNumber: string,
//   message: string,
// ): Promise<{ errMsg?: string } | undefined> => {
//   try {
//     const granted = await PermissionsAndroid.request(
//       PermissionsAndroid.PERMISSIONS.SEND_SMS,
//       {
//         title: "Send SMS Permission",
//         message: "This app needs access to send SMS in the background.",
//         buttonNeutral: "Ask Me Later",
//         buttonNegative: "Cancel",
//         buttonPositive: "OK",
//       },
//     );
//     if (granted === PermissionsAndroid.RESULTS.GRANTED) {
//       SendDirectSms(phoneNumber, message);
//     } else {
//       return { errMsg: "Permission denied, unable to send SMS." };
//     }
//   } catch (err) {
//     console.warn(err);
//     return { errMsg: "Something went wrong, unable to send SMS." };
//   }
// };
