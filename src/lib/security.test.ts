import { describe, it, expect } from "vitest";
import { isSafeUrl } from "./security";

describe("isSafeUrl", () => {
  it("should allow safe public URLs", () => {
    expect(isSafeUrl("https://google.com")).toBe(true);
    expect(isSafeUrl("http://example.com/api")).toBe(true);
    expect(isSafeUrl("https://api.github.com/users/octocat")).toBe(true);
  });

  it("should block localhost and loopback", () => {
    expect(isSafeUrl("http://localhost")).toBe(false);
    expect(isSafeUrl("http://127.0.0.1")).toBe(false);
    expect(isSafeUrl("http://0.0.0.0")).toBe(false);
    expect(isSafeUrl("http://[::1]")).toBe(false);
    expect(isSafeUrl("https://localhost:3000")).toBe(false);
  });

  it("should block private IP ranges (RFC 1918)", () => {
    expect(isSafeUrl("http://10.0.0.1")).toBe(false);
    expect(isSafeUrl("http://172.16.0.1")).toBe(false);
    expect(isSafeUrl("http://172.31.255.255")).toBe(false);
    expect(isSafeUrl("http://192.168.1.1")).toBe(false);
    expect(isSafeUrl("https://192.168.0.100/admin")).toBe(false);
  });

  it("should block link-local IPs", () => {
    expect(isSafeUrl("http://169.254.169.254")).toBe(false);
  });

  it("should block .local domains", () => {
    expect(isSafeUrl("http://myserver.local")).toBe(false);
  });

  it("should block non-http/https protocols", () => {
    expect(isSafeUrl("file:///etc/passwd")).toBe(false);
    expect(isSafeUrl("ftp://example.com")).toBe(false);
    expect(isSafeUrl("javascript:alert(1)")).toBe(false);
  });

  it("should handle invalid URLs", () => {
    expect(isSafeUrl("not-a-url")).toBe(false);
    expect(isSafeUrl("")).toBe(false);
  });
});
