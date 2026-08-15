import { requestPermissionsAsync, Contact } from "expo-contacts";
import { log } from "./log";

export const getContact = async () => {
  try {
    // 1. Check & Ask for Permission
    // This automatically checks current status and asks the user if not previously asked.
    const { status } = await requestPermissionsAsync();

    // 2. Fetch contacts if permission is granted
    if (status === "granted") {
      const contact = await Contact.presentPicker();

      if (contact) {
        return {
          contact,
          fullName: await contact.getFullName(),
          phoneNumber: await contact.getPhones()
        };
      } else {
        return null;
      }
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error fetching contacts:", error);
    log.error(error);
  }
};
