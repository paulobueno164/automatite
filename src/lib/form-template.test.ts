import { describe, it, expect } from "vitest";
import { sanitizeFormHtml } from "./form-template";

describe("sanitizeFormHtml", () => {
  it("should remove script tags", () => {
    const input = '<div>Safe</div><script>alert(1)</script>';
    expect(sanitizeFormHtml(input)).toBe('<div>Safe</div>');
  });

  it("should remove event handlers", () => {
    const input = '<img src="x" onerror="alert(1)" onmouseover="bad()">';
    const output = sanitizeFormHtml(input);
    expect(output).not.toContain("onerror");
    expect(output).not.toContain("onmouseover");
    expect(output).toBe('<img src="x">');
  });

  it("should neutralize javascript URIs", () => {
    const input = '<a href="javascript:alert(1)">click</a>';
    const output = sanitizeFormHtml(input);
    expect(output).not.toContain("javascript:");
    expect(output).toContain('href="#"');
  });

  it("should neutralize data URIs", () => {
    const input = '<img src="data:image/png;base64,xxx">';
    const output = sanitizeFormHtml(input);
    expect(output).not.toContain("data:");
    expect(output).toContain('src="#"');
  });

  it("should remove dangerous tags", () => {
    const input = '<iframe src="xxx"></iframe><form>phishing</form>';
    const output = sanitizeFormHtml(input);
    expect(output).not.toContain("<iframe");
    expect(output).not.toContain("<form");
    expect(output).toBe('phishing');
  });

  it("should handle mixed content correctly", () => {
    const input = '<div style="color:red" onclick="alert(1)">Hello <script>bad()</script></div>';
    expect(sanitizeFormHtml(input)).toBe('<div style="color:red">Hello </div>');
  });
});
