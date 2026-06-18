import { describe, it, expect } from "vitest";
import { isValidCron, computeNextRun, describeCron } from "./schedule.js";

describe("schedule", () => {
  describe("isValidCron", () => {
    it("returns true for valid cron strings", () => {
      expect(isValidCron("*/5 * * * *")).toBe(true);
      expect(isValidCron("0 9 * * *")).toBe(true);
      expect(isValidCron("0 18 * * *")).toBe(true);
      expect(isValidCron("0 9 * * 1")).toBe(true);
      expect(isValidCron("0 9 1 * *")).toBe(true);
      expect(isValidCron("0 0 1 1 *")).toBe(true);
    });

    it("returns false for invalid cron strings", () => {
      expect(isValidCron("invalid")).toBe(false);
      expect(isValidCron("60 * * * *")).toBe(false); // minute out of range
      expect(isValidCron("0 24 * * *")).toBe(false); // hour out of range
      expect(isValidCron("0 0 32 * *")).toBe(false); // day out of range
      expect(isValidCron("0 0 1 13 *")).toBe(false); // month out of range
      expect(isValidCron("0 0 1 1 8")).toBe(false); // day of week out of range
    });
  });

  describe("computeNextRun", () => {
    it("returns a Date object for valid cron strings", () => {
      const result = computeNextRun("*/5 * * * *");
      expect(result).toBeInstanceOf(Date);
    });

    it("returns null for invalid cron strings", () => {
      expect(computeNextRun("invalid")).toBe(null);
      expect(computeNextRun("60 * * * *")).toBe(null);
    });
  });

  describe("describeCron", () => {
    it("returns the preset label if it matches a preset", () => {
      expect(describeCron("*/5 * * * *")).toBe("A cada 5 minutos");
      expect(describeCron("0 9 * * *")).toBe("Todo dia às 9h");
    });

    it("returns a fallback string if it does not match a preset", () => {
      expect(describeCron("0 0 1 1 *")).toBe("cron: 0 0 1 1 *");
      expect(describeCron("invalid")).toBe("cron: invalid");
    });
  });
});
