// src/routes/adminFlags.js
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { requireAdmin } from "../middleware/auth.js";

const prisma = new PrismaClient();
const router = Router();

// example page route
router.get("/admin/flags", requireAdmin, async (req, res) => {
  const sessions = await prisma.session.findMany({
    where: { OR: [{ flagged: true }, { status: "PENDING" }] },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true, email: true } } },
  });

  res.render("admin/flags/index", {
    title: "Flagged Sessions",
    sessions,
    page: 1,
    totalPages: 1,
    status: "",
    csrfToken: req.csrfToken(),
  });
});

// approve
router.post("/admin/flags/:id/approve", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.sendStatus(400);
  await prisma.session.update({
    where: { id },
    data: { flagged: false, status: "APPROVED" },
  });
  res.redirect("/admin/flags");
});

// decline
router.post("/admin/flags/:id/decline", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.sendStatus(400);
  await prisma.session.update({
    where: { id },
    data: { flagged: false, status: "DECLINED" },
  });
  res.redirect("/admin/flags");
});

export default router; // <<< important
