import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { TEMPLATES } from "../src/lib/templates";

const prisma = new PrismaClient();

const DEMO_EMAIL = "demo@automatite.app";
const DEMO_PASSWORD = "demo123";

async function main() {
  // Cria (ou reutiliza) um usuário demo.
  let user = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: DEMO_EMAIL,
        passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10),
        tier: "pro",
      },
    });
    console.log(`Usuário demo criado: ${DEMO_EMAIL} / senha: ${DEMO_PASSWORD}`);
  }

  // Cria uma automação de exemplo já ativa a partir do primeiro template.
  const t = TEMPLATES[0];
  const existing = await prisma.automation.findFirst({ where: { userId: user.id, name: t.flow.name } });
  if (existing) {
    await prisma.automation.update({
      where: { id: existing.id },
      data: { actionsJson: JSON.stringify(t.flow.actions) },
    });
    console.log("Automação de exemplo atualizada com fluxo interno (CRM + Registros).");
    return;
  }
  await prisma.automation.create({
    data: {
      userId: user.id,
      name: t.flow.name,
      description: t.flow.description,
      category: t.flow.category,
      source: "template",
      triggerJson: JSON.stringify(t.flow.trigger),
      actionsJson: JSON.stringify(t.flow.actions),
      active: true,
    },
  });
  console.log("Automação de exemplo criada:", t.flow.name);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
