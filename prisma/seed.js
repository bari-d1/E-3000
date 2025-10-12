import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
const prisma = new PrismaClient();
import "dotenv/config";

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL;
  console.log(adminEmail)
  const annual_target = process.env.ANNUAL_TARGET;
  const raw = process.env.ADMIN_PASSWORD;
  const exists = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!exists) {
    await prisma.user.create({
      data: {
        name: "Admin",
        email: "admin@example.com",
        password: await bcrypt.hash(1234, 12),
        role: "ADMIN",
        gender: "Other",
        ageRange: "25-34",
        nationality: "GB"
      }
    });
  }
  await prisma.setting.upsert({
    where: { key: "annual_target" },
    update: { valueJson: JSON.stringify({ value: annual_target }) },
    create: { key: "annual_target", valueJson: JSON.stringify({ value: annual_target }) }
  });
  console.log("Seed complete");
}
main().finally(() => prisma.$disconnect());
