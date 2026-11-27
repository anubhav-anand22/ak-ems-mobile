import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSmsRecipients,
  filterSelectedSmsPhones,
  formatSmsRecipientLabel,
  normalizePhoneKey,
} from "../src/lib/smsRecipientUtils";

test("smsRecipientUtils - normalizePhoneKey & recipient list", async (t) => {
  await t.test("returns empty list when SMS is disabled or neither contacts nor party phone exist", () => {
    assert.deepStrictEqual(
      buildSmsRecipients({
        isSmsEnabled: false,
        configuredContacts: [{ name: "Mom", phone: "9876543210" }],
        toFrom: { name: "Alex", number: "9123456789" },
      }),
      [],
    );

    assert.deepStrictEqual(
      buildSmsRecipients({
        isSmsEnabled: true,
        configuredContacts: [],
        toFrom: { name: "Alex", number: null },
      }),
      [],
    );
  });

  await t.test("shows picked contact phone when SMS is enabled even if Settings contact list is empty", () => {
    const recipients = buildSmsRecipients({
      isSmsEnabled: true,
      configuredContacts: [],
      toFrom: { name: "Alex", number: "9123456789" },
    });
    assert.strictEqual(recipients.length, 1);
    assert.strictEqual(recipients[0].name, "Alex");
    assert.strictEqual(recipients[0].phone, "9123456789");
    assert.strictEqual(recipients[0].isParty, true);
  });

  await t.test("combines party number and configured contacts without duplicates and filters excluded keys", () => {
    assert.strictEqual(normalizePhoneKey("+91 98765 43210"), "9876543210");

    const recipients = buildSmsRecipients({
      isSmsEnabled: true,
      configuredContacts: [
        { name: "Mom", phone: "9876543210" },
        { name: "Partner", phone: "9988776655" },
      ],
      toFrom: { name: "Mom (Personal)", number: "+91 98765 43210" },
    });

    assert.strictEqual(recipients.length, 2);
    assert.deepStrictEqual(
      recipients.map((r) => r.phone),
      ["+91 98765 43210", "9988776655"],
    );

    const excluded = new Set<string>([normalizePhoneKey("+91 98765 43210")]);
    assert.deepStrictEqual(
      filterSelectedSmsPhones(recipients, excluded),
      ["9988776655"],
    );

    // Excluding all yields empty array -> no SMS sent
    const allExcluded = new Set<string>(recipients.map((r) => r.key));
    assert.deepStrictEqual(
      filterSelectedSmsPhones(recipients, allExcluded),
      [],
    );
  });

  await t.test("truncates overly long contact names in chip label while keeping phone number visible", () => {
    const label = formatSmsRecipientLabel({
      name: "Very Long Contact Name That Would Overflow",
      phone: "+91 9876543210",
    });
    assert.ok(label.endsWith(" • +91 9876543210"));
    assert.ok(label.includes("…"));
    assert.ok(label.length < 40);

    assert.strictEqual(
      formatSmsRecipientLabel({ name: "", phone: "9876543210" }),
      "9876543210",
    );
  });
});
