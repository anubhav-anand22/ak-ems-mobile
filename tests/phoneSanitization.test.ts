import test from "node:test";
import assert from "node:assert/strict";

test("phone number sanitization", async (t) => {
  const sanitize = (phone: string) => phone.replace(/[^0-9+]/g, "").trim();

  await t.test("strips spaces, hyphens, and brackets from phone numbers", () => {
    assert.strictEqual(sanitize("+91 98765-43210"), "+919876543210");
    assert.strictEqual(sanitize("+1 (555) 123-4567"), "+15551234567");
    assert.strictEqual(sanitize("09876543210"), "09876543210");
  });

  await t.test("handles already clean numbers", () => {
    assert.strictEqual(sanitize("+919876543210"), "+919876543210");
  });

  await t.test("rejects strings without any digits", () => {
    assert.strictEqual(sanitize("invalid-phone"), "");
  });
});
