import { describe, it, expect } from "vitest";
import { encryptJson, decryptJson, encrypt, decrypt } from "./crypto";

describe("JSON encryption utilities", () => {
  it("should encrypt and decrypt a JSON object successfully", () => {
    const originalObject = { key: "value", num: 42, bool: true, nested: { a: 1 } };
    const encryptedPayload = encryptJson(originalObject);

    // Ensure it's encrypted (not just JSON stringified)
    expect(encryptedPayload).not.toContain("value");
    expect(encryptedPayload).not.toContain("key");

    // Decrypt and verify
    const decryptedObject = decryptJson<typeof originalObject>(encryptedPayload);
    expect(decryptedObject).toEqual(originalObject);
  });

  it("should encrypt and decrypt an array successfully", () => {
    const originalArray = [1, "two", { three: 3 }];
    const encryptedPayload = encryptJson(originalArray);

    const decryptedArray = decryptJson<typeof originalArray>(encryptedPayload);
    expect(decryptedArray).toEqual(originalArray);
  });

  it("should encrypt and decrypt primitive values successfully", () => {
    const strPayload = encryptJson("string value");
    expect(decryptJson<string>(strPayload)).toBe("string value");

    const numPayload = encryptJson(12345);
    expect(decryptJson<number>(numPayload)).toBe(12345);

    const boolPayload = encryptJson(true);
    expect(decryptJson<boolean>(boolPayload)).toBe(true);

    const nullPayload = encryptJson(null);
    expect(decryptJson<null>(nullPayload)).toBeNull();
  });

  it("should throw an error when decrypting an invalid payload (not base64 format)", () => {
    expect(() => decryptJson("invalid.payload.format")).toThrow();
  });

  it("should throw an error when decrypting valid base64 but incorrect format", () => {
    // Missing parts
    expect(() => decryptJson("YWJj.ZGVm")).toThrow();
  });

  it("should throw an error when decrypting a valid payload that contains invalid JSON", () => {
    // Encrypting a raw string that is not valid JSON
    const encryptedInvalidJson = encrypt("invalid_json_string{");
    expect(() => decryptJson(encryptedInvalidJson)).toThrow(/Unexpected token|Expected property name/i);
  });
});

describe("crypto utilities", () => {
  it("encrypt and decrypt a simple string", () => {
    const plain = "hello world";
    const encrypted = encrypt(plain);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plain);
    expect(encrypted).not.toBe(plain);
  });

  it("encrypt and decrypt with special characters", () => {
    const plain = "hello 🌍 and 🚀! #123";
    const encrypted = encrypt(plain);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plain);
  });

  it("encrypt generates different ciphertexts for the same plaintext (due to random IV)", () => {
    const plain = "hello world";
    const encrypted1 = encrypt(plain);
    const encrypted2 = encrypt(plain);
    expect(encrypted1).not.toBe(encrypted2);
  });

  it("decrypt throws on invalid format", () => {
    expect(() => decrypt("invalid.payload")).toThrow();
  });

  it("decrypt throws on tampered data", () => {
    const plain = "secret message";
    const encrypted = encrypt(plain);
    const parts = encrypted.split(".");

    // Modify the ciphertext part
    const tamperedData = Buffer.from(parts[2], "base64");
    tamperedData[0] ^= 1; // Flip a bit
    parts[2] = tamperedData.toString("base64");

    const tamperedPayload = parts.join(".");

    expect(() => decrypt(tamperedPayload)).toThrow();
  });

  it("decrypt throws on tampered auth tag", () => {
    const plain = "secret message";
    const encrypted = encrypt(plain);
    const parts = encrypted.split(".");

    // Modify the auth tag
    const tamperedTag = Buffer.from(parts[1], "base64");
    tamperedTag[0] ^= 1;
    parts[1] = tamperedTag.toString("base64");

    const tamperedPayload = parts.join(".");

    expect(() => decrypt(tamperedPayload)).toThrow();
  });
});
