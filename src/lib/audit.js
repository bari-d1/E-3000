import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export async function logAudit({ entity, entityId, action, diffJson, byUserId }) {
  await prisma.auditLog.create({
    data: { entity, entityId, action, diffJson: diffJson || null, byUserId }
  });
}
