import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "../db";
import { runAutomation } from "./index";
import { Action, Trigger } from "../flow-types";

describe("Loop Action", () => {
  let userId: string;

  beforeEach(async () => {
    const user = await prisma.user.upsert({
      where: { email: "test-loop@example.com" },
      update: {},
      create: {
        email: "test-loop@example.com",
        passwordHash: "hash",
      },
    });
    userId = user.id;
  });

  it("should iterate over items and execute sub-actions", async () => {
    const loopAction: Action = {
      type: "loop",
      label: "My Loop",
      params: {
        items: "A, B, C",
        actions: [
          { type: "log", params: { message: "Item: {loop_item} index: {loop_index}" } }
        ]
      }
    };

    const trigger: Trigger = { type: "webhook", config: {} };
    const automation = await prisma.automation.create({
      data: {
        userId,
        name: "Test Loop",
        active: true,
        triggerJson: JSON.stringify(trigger),
        actionsJson: JSON.stringify([loopAction]),
      }
    });

    const { steps } = await runAutomation(automation.id, {});

    // 1 step for the loop itself, plus 3 steps for the logs (one for each item)
    expect(steps.length).toBe(4);
    expect(steps[0].action).toBe("loop");
    expect(steps[1].detail).toBe("Item: A index: 0");
    expect(steps[2].detail).toBe("Item: B index: 1");
    expect(steps[3].detail).toBe("Item: C index: 2");
  });

  it("should handle nested loops", async () => {
    const nestedLoop: Action = {
      type: "loop",
      label: "Outer",
      params: {
        items: [1, 2],
        actions: [
          {
            type: "loop",
            label: "Inner",
            params: {
              items: ["a", "b"],
              actions: [
                { type: "log", params: { message: "{loop_item_outer}-{loop_item}" } }
              ]
            }
          }
        ]
      }
    };

    // We need to fix the context for nested loops to use unique names or handle shadowing.
    // Currently {loop_item} refers to the innermost one.
    // Let's test basic nested execution first.

    const trigger: Trigger = { type: "webhook", config: {} };
    const automation = await prisma.automation.create({
      data: {
        userId,
        name: "Nested Loop",
        active: true,
        triggerJson: JSON.stringify(trigger),
        actionsJson: JSON.stringify([nestedLoop]),
      }
    });

    const { steps } = await runAutomation(automation.id, {});

    // Outer loop (1)
    //   Inner iteration 1: loop action (1), log 1 (1), log 2 (1) = 3
    //   Inner iteration 2: loop action (1), log 1 (1), log 2 (1) = 3
    // Total steps: 1 + 3 + 3 = 7
    expect(steps.length).toBe(7);
  });

  it("should resume a paused loop", async () => {
    const loopAction: Action = {
      type: "loop",
      label: "My Loop",
      params: {
        items: "A, B",
        actions: [
          { type: "log", params: { message: "Item: {loop_item}" } },
          { type: "wait_for_approval", params: { to: "test@example.com" } },
          { type: "log", params: { message: "After approval: {loop_item}" } }
        ]
      }
    };

    const trigger: Trigger = { type: "webhook", config: {} };
    const automation = await prisma.automation.create({
      data: {
        userId,
        name: "Resume Loop",
        active: true,
        triggerJson: JSON.stringify(trigger),
        actionsJson: JSON.stringify([loopAction]),
      }
    });

    // 1st run: will pause at 1st item's wait_for_approval
    const res1 = await runAutomation(automation.id, {});
    expect(res1.status).toBe("waiting");
    // Steps: Loop (1), Log 1 (1), Wait (1) = 3
    expect(res1.steps.length).toBe(3);
    expect(res1.steps[2].status).toBe("paused");

    const { prisma: db } = await import("../db");
    const execution = await db.execution.findUnique({ where: { id: res1.executionId } });
    expect(execution?.pausedPath).toBe("0.0.1"); // action 0, iteration 0, sub-action 1

    // 2nd run: resume
    const { resumeAutomation } = await import("./index");
    const res2 = await resumeAutomation(res1.executionId, execution!.resumeToken!);
    expect(res2.status).toBe("waiting"); // should pause again at 2nd item's wait_for_approval

    // Previous steps (3) + After approval 1 (1) + Log 2 (1) + Wait 2 (1) = 6
    expect(res2.steps.length).toBe(6);
    expect(res2.steps[3].detail).toBe("After approval: A");
    expect(res2.steps[4].detail).toBe("Item: B");
    expect(res2.steps[5].status).toBe("paused");

    const execution2 = await db.execution.findUnique({ where: { id: res1.executionId } });
    expect(execution2?.pausedPath).toBe("0.1.1"); // action 0, iteration 1, sub-action 1

    // 3rd run: resume again
    const res3 = await resumeAutomation(res1.executionId, execution2!.resumeToken!);
    expect(res3.status).toBe("success");
    // Previous (6) + After approval 2 (1) = 7
    expect(res3.steps.length).toBe(7);
    expect(res3.steps[6].detail).toBe("After approval: B");
  });
});
