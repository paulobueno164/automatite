import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { encrypt, decrypt, encryptJson, decryptJson } from "./crypto";
import { randomBytes } from "crypto";

describe("crypto utils", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset env before each test to guarantee isolated state
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore env after each test
    process.env = originalEnv;
  });

  describe("encrypt and decrypt", () => {
    it("should successfully encrypt and decrypt a string using the fallback key", () => {
      // Ensure ENCRYPTION_KEY is undefined so it uses the fallback key
      delete process.env.ENCRYPTION_KEY;

      const plainText = "hello world";
      const encrypted = encrypt(plainText);

      expect(typeof encrypted).toBe("string");
      expect(encrypted).not.toBe(plainText);
      expect(encrypted.split(".")).toHaveLength(3); // iv.tag.ciphertext

      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plainText);
    });

    it("should successfully encrypt and decrypt a string using a valid ENCRYPTION_KEY", () => {
      // 32 bytes in hex = 64 characters
      const validKey = randomBytes(32).toString("hex");
      process.env.ENCRYPTION_KEY = validKey;

      const plainText = "super secret message";
      const encrypted = encrypt(plainText);

      expect(typeof encrypted).toBe("string");
      expect(encrypted).not.toBe(plainText);

      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plainText);
    });

    it("should ignore invalid ENCRYPTION_KEY (not 64 hex chars) and use fallback key", () => {
      // Set an invalid key (too short)
      process.env.ENCRYPTION_KEY = "invalid-key";

      const plainText = "another secret";
      const encrypted = encrypt(plainText);

      // Temporarily remove the key to ensure we decrypt with the fallback key
      delete process.env.ENCRYPTION_KEY;

      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plainText);
    });

    it("should throw an error when decrypting an invalid payload", () => {
      expect(() => decrypt("invalid-payload")).toThrow();
      expect(() => decrypt("a.b.c")).toThrow();
    });

    it("should throw an error if tampered payload is provided", () => {
      const plainText = "tampered data test";
      const encrypted = encrypt(plainText);
      const parts = encrypted.split(".");

      // Tamper with the ciphertext part
      parts[2] = Buffer.from("tampered").toString("base64");
      const tamperedPayload = parts.join(".");

      expect(() => decrypt(tamperedPayload)).toThrow();
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

    it("encryptJson and decryptJson work together", () => {
      const obj = { key: "value", num: 42, bool: true, nested: { test: "data" } };
      const encrypted = encryptJson(obj);
      const decrypted = decryptJson(encrypted);
      expect(decrypted).toEqual(obj);
    });
  });
});
