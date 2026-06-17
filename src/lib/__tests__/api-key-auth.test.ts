import { generateApiKey, hashApiKey } from "../api-key-auth";

describe("api-key-auth", () => {
  describe("generateApiKey", () => {
    it("should return raw, hash, and prefix", () => {
      const result = generateApiKey();
      expect(result).toHaveProperty("raw");
      expect(result).toHaveProperty("hash");
      expect(result).toHaveProperty("prefix");
    });

    it("raw should start with atk_ and be 52 characters long", () => {
      const { raw } = generateApiKey();
      expect(raw.startsWith("atk_")).toBe(true);
      expect(raw).toHaveLength(52); // "atk_" (4) + 24 bytes in hex (48) = 52
    });

    it("hash should be the sha256 hash of the raw key", () => {
      const { raw, hash } = generateApiKey();
      expect(hash).toBe(hashApiKey(raw));
    });

    it("prefix should be the first 12 characters of raw followed by …", () => {
      const { raw, prefix } = generateApiKey();
      expect(prefix).toBe(raw.slice(0, 12) + "…");
    });

    it("should generate unique keys on successive calls", () => {
      const key1 = generateApiKey();
      const key2 = generateApiKey();
      expect(key1.raw).not.toBe(key2.raw);
      expect(key1.hash).not.toBe(key2.hash);
    });
  });

  describe("hashApiKey", () => {
    it("should consistently hash a string", () => {
      const raw = "atk_testkey123";
      const hash1 = hashApiKey(raw);
      const hash2 = hashApiKey(raw);
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/); // sha256 is 64 hex characters
    });
  });
});
