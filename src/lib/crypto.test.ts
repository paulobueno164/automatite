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
