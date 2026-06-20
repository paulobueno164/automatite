import { PrismaClient } from "@prisma/client";
import { randomBytes } from "crypto";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({ where: { email: "demo@automatite.app" } });
  if (!user) throw new Error("Demo user not found");

  const automation = await prisma.automation.create({
    data: {
      userId: user.id,
      name: "Approval Test",
      active: true,
      triggerJson: JSON.stringify({ type: "webhook" }),
      actionsJson: JSON.stringify([
        { type: "log", params: { message: "Starting" } },
        { type: "wait_for_approval", params: { message: "Review needed" } },
        { type: "log", params: { message: "Finished" } },
      ]),
    },
  });

  const execution = await prisma.execution.create({
    data: {
      automationId: automation.id,
      status: "paused",
      resumeToken: "test-token-123",
      pausedPath: "1",
      inputJson: JSON.stringify({ name: "John Doe", email: "john@example.com" }),
      logJson: JSON.stringify([
        { action: "log", label: "log", status: "success", detail: "Starting" },
        { action: "wait_for_approval", label: "wait_for_approval", status: "paused", detail: "Review needed" },
      ]),
    },
  });

  console.log(`Execution created with token: test-token-123`);
}

main().finally(() => prisma.$disconnect());
