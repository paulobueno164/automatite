import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "../db";
import { runAutomation, resumeAutomation } from "./index";
import { Action, Flow } from "../flow-types";

describe("Engine: Human-in-the-Loop (Approval)", () => {
  let userId: string;

  beforeEach(async () => {
    // Limpeza e setup
    await prisma.execution.deleteMany();
    await prisma.automation.deleteMany();
    await prisma.user.deleteMany();

    const user = await prisma.user.create({
      data: { email: "test@example.com", passwordHash: "..." },
    });
    userId = user.id;
  });

  it("should pause execution when wait_for_approval is encountered", async () => {
    const flow: Flow = {
      name: "Test Pause",
      trigger: { type: "webhook" },
      actions: [
        { type: "log", params: { message: "Before pause" } },
        { type: "wait_for_approval", params: { to: "test@example.com" } },
        { type: "log", params: { message: "After pause" } },
      ],
    };

    const automation = await prisma.automation.create({
      data: {
        userId,
        name: flow.name,
        triggerJson: JSON.stringify(flow.trigger),
        actionsJson: JSON.stringify(flow.actions),
        active: true,
      },
    });

    const result = await runAutomation(automation.id, { foo: "bar" });
    expect(result.status).toBe("waiting");
    expect(result.steps).toHaveLength(2);
    expect(result.steps[1].status).toBe("paused");

    const execution = await prisma.execution.findUnique({
      where: { id: result.executionId },
    });
    expect(execution?.status).toBe("waiting");
    expect(execution?.resumeToken).toBeDefined();
    expect(execution?.pausedPath).toBe("1");
  });

  it("should resume execution after approval", async () => {
    const flow: Flow = {
      name: "Test Resume",
      trigger: { type: "webhook" },
      actions: [
        { type: "log", params: { message: "Before" } },
        { type: "wait_for_approval", params: { to: "test@example.com" } },
        { type: "log", params: { message: "After" } },
      ],
    };

    const automation = await prisma.automation.create({
      data: {
        userId,
        name: flow.name,
        triggerJson: JSON.stringify(flow.trigger),
        actionsJson: JSON.stringify(flow.actions),
        active: true,
      },
    });

    const run = await runAutomation(automation.id, { key: "initial" });

    const execution = await prisma.execution.findUnique({ where: { id: run.executionId } });
    const token = execution!.resumeToken!;

    const resume = await resumeAutomation(run.executionId, token);
    expect(resume.status).toBe("success");
    expect(resume.steps).toHaveLength(3);
    expect(resume.steps[1].status).toBe("success");
    expect(resume.steps[2].status).toBe("success");
    expect(resume.steps[2].detail).toBe("After");

    const finalEx = await prisma.execution.findUnique({ where: { id: run.executionId } });
    expect(finalEx?.status).toBe("success");
    expect(finalEx?.resumeToken).toBeNull();
  });

  it("should handle nested pauses in conditions", async () => {
    // Condition test logic...
  });
});
