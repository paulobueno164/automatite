import { describe, it, expect } from "vitest";
import { sanitizeFormHtml } from "./form-template";

describe("sanitizeFormHtml", () => {
  it("should remove script tags", () => {
    const input = "<div>Hello<script>alert(1)</script></div>";
    const output = sanitizeFormHtml(input);
    expect(output).not.toContain("<script>");
    expect(output).toContain("<div>Hello</div>");
  });

  it("should remove dangerous tags", () => {
    const input = '<div><iframe src="malicious.com"></iframe><object data="test"></object></div>';
    const output = sanitizeFormHtml(input);
    expect(output).not.toContain("<iframe");
    expect(output).not.toContain("<object");
    expect(output).toContain("<div></div>");
  });

  it("should strip event handlers", () => {
    const input = '<img src="x" onerror="alert(1)" onclick=\'doStuff()\' onmouseover=bad()>';
    const output = sanitizeFormHtml(input);
    expect(output).not.toContain("onerror");
    expect(output).not.toContain("onclick");
    expect(output).not.toContain("onmouseover");
    // We expect some extra spaces where attributes were removed if using simple regex
    expect(output.replace(/\s+/g, " ")).toContain('<img src="x" >');
  });

  it("should neutralize javascript URIs in href", () => {
    const input = '<a href="javascript:alert(1)">Click me</a><a href = " javascript:alert(2) ">Spacey</a>';
    const output = sanitizeFormHtml(input);
    expect(output).not.toContain("javascript:");
    expect(output).toContain('href="#"');
  });

  it("should neutralize javascript URIs in src", () => {
    const input = '<img src="javascript:alert(1)">';
    const output = sanitizeFormHtml(input);
    expect(output).not.toContain("javascript:");
    expect(output).toContain('src="about:blank"');
  });

  it("should keep safe attributes and tags", () => {
    const input = '<div class="foo" style="color: red">Safe content <b data-test="123">bold</b></div>';
    const output = sanitizeFormHtml(input);
    expect(output).toBe(input);
  });
});
