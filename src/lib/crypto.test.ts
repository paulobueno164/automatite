import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { encrypt, decrypt } from "./crypto";
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
  });
});
