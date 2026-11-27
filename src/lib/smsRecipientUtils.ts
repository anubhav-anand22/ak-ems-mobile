export interface SmsRecipientItem {
  key: string;
  name: string;
  phone: string;
  isParty: boolean;
}

export function normalizePhoneKey(phone: string): string {
  const trimmed = phone.trim();
  if (!trimmed) return "";
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith("0")) {
    return digits.slice(1);
  }
  return digits || trimmed;
}

export function buildSmsRecipients(params: {
  isSmsEnabled: boolean;
  configuredContacts: { name: string; phone: string }[];
  toFrom?: { name?: string | null; number?: string | null } | null;
}): SmsRecipientItem[] {
  const { isSmsEnabled, configuredContacts, toFrom } = params;
  if (!isSmsEnabled) {
    return [];
  }

  const recipients: SmsRecipientItem[] = [];
  const seenKeys = new Set<string>();

  const partyPhone = toFrom?.number?.trim() || "";
  if (partyPhone) {
    const key = normalizePhoneKey(partyPhone);
    if (key) {
      seenKeys.add(key);
      recipients.push({
        key,
        name: toFrom?.name?.trim() || "",
        phone: partyPhone,
        isParty: true,
      });
    }
  }

  for (const contact of configuredContacts) {
    const phone = contact?.phone?.trim() || "";
    if (!phone) continue;
    const key = normalizePhoneKey(phone);
    if (!key || seenKeys.has(key)) continue;
    seenKeys.add(key);
    recipients.push({
      key,
      name: contact.name?.trim() || "",
      phone,
      isParty: false,
    });
  }

  return recipients;
}

export function filterSelectedSmsPhones(
  recipients: SmsRecipientItem[],
  excludedKeys: ReadonlySet<string>,
): string[] {
  return recipients
    .filter((recipient) => !excludedKeys.has(recipient.key))
    .map((recipient) => recipient.phone);
}

export function formatSmsRecipientLabel(
  recipient: Pick<SmsRecipientItem, "name" | "phone">,
  maxNameLength = 18,
): string {
  const cleanName = recipient.name?.trim() || "";
  if (!cleanName) {
    return recipient.phone;
  }
  const shortName =
    cleanName.length > maxNameLength
      ? `${cleanName.slice(0, Math.max(1, maxNameLength - 1)).trimEnd()}…`
      : cleanName;
  return `${shortName} • ${recipient.phone}`;
}
