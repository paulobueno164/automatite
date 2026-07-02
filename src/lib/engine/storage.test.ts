import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "../db";
import { runAction, EngineContext } from "./actions";

describe("Storage Actions", () => {
  let userId: string;

  beforeEach(async () => {
    const user = await prisma.user.upsert({
      where: { email: "test-storage@example.com" },
      update: {},
      create: {
        email: "test-storage@example.com",
        passwordHash: "hash",
      },
    });
    userId = user.id;
    await prisma.storage.deleteMany({ where: { userId } });
  });

  it("should set and get values from storage", async () => {
    const ctx: EngineContext = {
      data: { my_val: "some-secret" },
      userId,
      automationId: "test-auto",
      executionId: "test-exec",
      getIntegrations: async () => ({}),
    };

    // SET
    const setStep = await runAction(
      { type: "storage_set", params: { key: "secret_key", value: "{my_val}" } },
      ctx
    );
    expect(setStep.status).toBe("success");

    // GET
    const getStep = await runAction(
      { type: "storage_get", params: { key: "secret_key", output_key: "result" } },
      ctx
    );
    expect(getStep.status).toBe("success");
    expect(ctx.data.result).toBe("some-secret");
  });

  it("should handle objects in storage", async () => {
     const ctx: EngineContext = {
      data: { user: { name: "John", age: 30 } },
      userId,
      automationId: "test-auto",
      executionId: "test-exec",
      getIntegrations: async () => ({}),
    };

    // SET object (interpolated as JSON string currently, but we want it to handle it)
    await runAction(
      { type: "storage_set", params: { key: "user_data", value: "{user}" } },
      ctx
    );

    // GET
    await runAction(
      { type: "storage_get", params: { key: "user_data", output_key: "recovered" } },
      ctx
    );

    expect(ctx.data.recovered).toEqual({ name: "John", age: 30 });
  });
});
