import test from "node:test";
import assert from "node:assert/strict";
import { encrypt, decrypt, encryptJson, decryptJson } from "./crypto";

test("crypto utilities", async (t) => {
  await t.test("encrypt and decrypt a simple string", () => {
    const plain = "hello world";
    const encrypted = encrypt(plain);
    const decrypted = decrypt(encrypted);
    assert.strictEqual(decrypted, plain);
    assert.notStrictEqual(encrypted, plain);
  });

  await t.test("encrypt and decrypt with special characters", () => {
    const plain = "hello 🌍 and 🚀! #123";
    const encrypted = encrypt(plain);
    const decrypted = decrypt(encrypted);
    assert.strictEqual(decrypted, plain);
  });

  await t.test("encrypt generates different ciphertexts for the same plaintext (due to random IV)", () => {
    const plain = "hello world";
    const encrypted1 = encrypt(plain);
    const encrypted2 = encrypt(plain);
    assert.notStrictEqual(encrypted1, encrypted2);
  });

  await t.test("decrypt throws on invalid format", () => {
    assert.throws(() => {
      decrypt("invalid.payload");
    });
  });

  await t.test("decrypt throws on tampered data", () => {
    const plain = "secret message";
    const encrypted = encrypt(plain);
    const parts = encrypted.split(".");

    // Modify the ciphertext part
    const tamperedData = Buffer.from(parts[2], "base64");
    tamperedData[0] ^= 1; // Flip a bit
    parts[2] = tamperedData.toString("base64");

    const tamperedPayload = parts.join(".");

    assert.throws(() => {
      decrypt(tamperedPayload);
    });
  });

  await t.test("decrypt throws on tampered auth tag", () => {
    const plain = "secret message";
    const encrypted = encrypt(plain);
    const parts = encrypted.split(".");

    // Modify the auth tag
    const tamperedTag = Buffer.from(parts[1], "base64");
    tamperedTag[0] ^= 1;
    parts[1] = tamperedTag.toString("base64");

    const tamperedPayload = parts.join(".");

    assert.throws(() => {
      decrypt(tamperedPayload);
    });
  });

  await t.test("encryptJson and decryptJson work together", () => {
    const obj = { key: "value", num: 42, bool: true, nested: { test: "data" } };
    const encrypted = encryptJson(obj);
    const decrypted = decryptJson(encrypted);
    assert.deepStrictEqual(decrypted, obj);
  });
});
