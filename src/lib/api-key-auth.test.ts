import { describe, it, expect } from "vitest";
import { hashApiKey } from "./api-key-auth";

describe("hashApiKey", () => {
  it("should generate a consistent SHA-256 hash for a given string", () => {
    const raw = "atk_test_123";
    const expectedHash = "62732835ea9b3845e30a19e896fa2e9c4c14a55b5bdb17382c12fd794718a271";

    const hash = hashApiKey(raw);

    expect(hash).toBe(expectedHash);
  });

  it("should handle empty string correctly", () => {
    const raw = "";
    // e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 is the sha256 of empty string
    const expectedHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

    const hash = hashApiKey(raw);

    expect(hash).toBe(expectedHash);
  });

  it("should generate different hashes for different inputs", () => {
    const hash1 = hashApiKey("test_string_1");
    const hash2 = hashApiKey("test_string_2");

    expect(hash1).not.toBe(hash2);
  });
});
