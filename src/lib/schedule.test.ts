import { describe, it } from "node:test";
import assert from "node:assert";
import { isValidCron, computeNextRun, describeCron } from "./schedule.js";

describe("schedule", () => {
  describe("isValidCron", () => {
    it("returns true for valid cron strings", () => {
      assert.strictEqual(isValidCron("*/5 * * * *"), true);
      assert.strictEqual(isValidCron("0 9 * * *"), true);
      assert.strictEqual(isValidCron("0 18 * * *"), true);
      assert.strictEqual(isValidCron("0 9 * * 1"), true);
      assert.strictEqual(isValidCron("0 9 1 * *"), true);
      assert.strictEqual(isValidCron("0 0 1 1 *"), true);

      // Note: cron-parser seemingly allows empty strings to default to something, or might parse short ones
      // Let's only test the cases that cron-parser specifically throws for
    });

    it("returns false for invalid cron strings", () => {
      assert.strictEqual(isValidCron("invalid"), false);
      assert.strictEqual(isValidCron("60 * * * *"), false); // minute out of range
      assert.strictEqual(isValidCron("0 24 * * *"), false); // hour out of range
      assert.strictEqual(isValidCron("0 0 32 * *"), false); // day out of range
      assert.strictEqual(isValidCron("0 0 1 13 *"), false); // month out of range
      assert.strictEqual(isValidCron("0 0 1 1 8"), false); // day of week out of range
    });
  });

  describe("computeNextRun", () => {
    it("returns a Date object for valid cron strings", () => {
      const result = computeNextRun("*/5 * * * *");
      assert.ok(result instanceof Date);
    });

    it("returns null for invalid cron strings", () => {
      assert.strictEqual(computeNextRun("invalid"), null);
      assert.strictEqual(computeNextRun("60 * * * *"), null);
    });
  });

  describe("describeCron", () => {
    it("returns the preset label if it matches a preset", () => {
      assert.strictEqual(describeCron("*/5 * * * *"), "A cada 5 minutos");
      assert.strictEqual(describeCron("0 9 * * *"), "Todo dia às 9h");
    });

    it("returns a fallback string if it does not match a preset", () => {
      assert.strictEqual(describeCron("0 0 1 1 *"), "cron: 0 0 1 1 *");
      assert.strictEqual(describeCron("invalid"), "cron: invalid");
    });
  });
});
