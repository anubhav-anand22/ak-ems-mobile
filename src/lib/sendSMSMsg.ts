import AsyncStorage from "@react-native-async-storage/async-storage";
import { KVStoreKeyVals } from "./parseInvoicePDF";
import { sendDirectSMS } from "./sendDirectSMS";
import { log } from "./log";

const __rowSendSMS = async ({
  textMessage,
  toFromTxt,
  parsedContacts,
}: {
  textMessage: string;
  toFromTxt: { name: string; number: string | null };
  parsedContacts: SmsSendContact[];
}) => {
  if (toFromTxt.number && toFromTxt.number.length > 0) {
    await sendDirectSMS(toFromTxt.number, textMessage).catch(log.error);
  }

  for (const contact of parsedContacts) {
    const result = await sendDirectSMS(contact.phone, textMessage).catch(
      log.error,
    );

    if (result?.errMsg) {
      console.error(`❌ Failed to send to ${contact.phone}: ${result.errMsg}`);
    } else {
      log.info(`✅ Successfully sent to ${contact.phone}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
};

const shouldSendSMS = async () => {
  return (
    (await AsyncStorage.getItem(
      KVStoreKeyVals.SEND_TX_SMS_CONTACTS_ENABLED.key,
    )) === "true"
  );
};

const getContactList = async () => {
  const contacts = await AsyncStorage.getItem(
    KVStoreKeyVals.SEND_TX_SMS_CONTACTS.key,
  );

  return contacts ? (JSON.parse(contacts) as SmsSendContact[]) : [];
};

const sendTxAddedSMS = async ({
  expense,
  subExpense,
  amoArr,
  toFromTxt,
  noteTxt,
  interestType,
  interestRate,
  interestTimePeriod,
  compoundingFrequency,
}: {
  expense: string;
  subExpense: string;
  amoArr: { amount: number; title: string }[];
  toFromTxt: { name: string; number: string | null };
  noteTxt: string;
  interestType: string;
  interestRate: string;
  interestTimePeriod: string;
  compoundingFrequency: string;
}) => {
  try {
    if (!(await shouldSendSMS())) return;

    const parsedContacts = await getContactList();
    if (parsedContacts.length === 0) return;

    let textMessage = `AK EMS:\nExpense: ${expense}.${subExpense}\nAmount: ${amoArr.reduce((acc, curr) => acc + curr.amount, 0).toFixed(2)}\n${subExpense === "Borrow" || subExpense === "Receive" ? "From: " : "To: "}${toFromTxt.name}\nNote: ${noteTxt}\n`;

    textMessage += "Items:\n";
    for (const item of amoArr) {
      textMessage += `${item.title}: ${item.amount.toFixed(2)}\n`;
    }

    if (expense === "Credit") {
      textMessage += `Interest type: ${interestType}\nInterest Rate: ${interestRate}\nInterest Time Period: ${interestTimePeriod}\nCompounding Frequency: ${compoundingFrequency}\n`;
    }

    await __rowSendSMS({ textMessage, toFromTxt, parsedContacts });
  } catch (error) {
    log.error(error);
  }
};

const sendCreditPaymentsSMS = async ({
  totalAmo,
  amountPayedYet,
  fromName,
  fromPhoneNumber,
}: {
  totalAmo: { amount: number }[] | number;
  amountPayedYet: number;
  fromName: string;
  fromPhoneNumber: string;
}) => {
  try {
    if (!(await shouldSendSMS())) return;

    const parsedContacts = await getContactList();
    if (parsedContacts.length === 0) return;

    let textMessage = `AK EMS:\n`;
    textMessage += `Credit payments due:\n`;
    const totalAmount = Array.isArray(totalAmo) ? totalAmo.reduce((acc, curr) => acc + curr.amount, 0) : totalAmo;
    textMessage += `Total: ${totalAmount.toFixed(2)} - ${amountPayedYet.toFixed(2)} = ${(totalAmount - amountPayedYet).toFixed(2)}\n`;
    textMessage += `Amount paid: ${amountPayedYet.toFixed(2)}\n`;
    textMessage += `From: ${fromName} (${fromPhoneNumber})\n`;

    await __rowSendSMS({
      textMessage,
      toFromTxt: { name: fromName, number: fromPhoneNumber },
      parsedContacts,
    });
  } catch (error) {
    log.error(error);
  }
};

export const sendSMSMsg = {
  sendTxAddedSMS,
  shouldSendSMS,
  getContactList,
  sendCreditPaymentsSMS,
};
