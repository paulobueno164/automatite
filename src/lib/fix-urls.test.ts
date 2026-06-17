import { describe, it, expect } from "vitest";
import { buildActionFixUrl, buildSettingsFixUrl } from "./fix-urls";

describe("buildActionFixUrl", () => {
  it("should return the correct URL when fieldKey is not provided", () => {
    const url = buildActionFixUrl("auto-123", 2);
    expect(url).toBe("/automations/auto-123/edit#action-2");
  });

  it("should return the correct URL when fieldKey is provided", () => {
    const url = buildActionFixUrl("auto-123", 2, "my-field");
    expect(url).toBe("/automations/auto-123/edit#action-2-field-my-field");
  });
});

describe("buildSettingsFixUrl", () => {
  it('should return email setting URL for "smtp"', () => {
    expect(buildSettingsFixUrl("smtp")).toBe("/settings#setting-email");
  });

  it('should return email setting URL for "resend"', () => {
    expect(buildSettingsFixUrl("resend")).toBe("/settings#setting-email");
  });

  it('should return anthropic setting URL for "anthropic"', () => {
    expect(buildSettingsFixUrl("anthropic")).toBe("/settings#setting-anthropic");
  });

  it("should return generic integration URL for other providers", () => {
    expect(buildSettingsFixUrl("slack")).toBe("/settings#integration-slack");
    expect(buildSettingsFixUrl("github")).toBe("/settings#integration-github");
  });
});
