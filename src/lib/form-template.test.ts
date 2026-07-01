import { describe, it, expect } from "vitest";
import { sanitizeFormHtml } from "./form-template";

describe("sanitizeFormHtml", () => {
  it("should remove script tags", () => {
    const input = '<div>Hello</div><script>alert("xss")</script>';
    expect(sanitizeFormHtml(input)).toBe("<div>Hello</div>");
  });

  it("should remove html, head, body tags", () => {
    const input = "<html><body><div>Hello</div></body></html>";
    expect(sanitizeFormHtml(input)).toBe("<div>Hello</div>");
  });

  it("should remove event handlers", () => {
    const input = '<div onclick="alert(\'xss\')">Click me</div>';
    const sanitized = sanitizeFormHtml(input);
    expect(sanitized).not.toContain("onclick");
  });

  it("should remove javascript: URIs", () => {
    const input = '<a href="javascript:alert(\'xss\')">Link</a>';
    const sanitized = sanitizeFormHtml(input);
    expect(sanitized).not.toContain("javascript:");
  });

  it("should remove iframe tags", () => {
    const input = '<iframe src="https://evil.com"></iframe>';
    const sanitized = sanitizeFormHtml(input);
    expect(sanitized).toBe("");
  });

  it("should preserve standard layout elements", () => {
    const input = '<div style="color: red">Hello {titulo}</div>';
    expect(sanitizeFormHtml(input)).toBe(input);
  });
});
