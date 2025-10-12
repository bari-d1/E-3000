import express from "express";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
import { requireAdmin } from "../middleware/auth.js";
import { AdminUpsertUserSchema, RoleSchema, AdminUserUpdateSchema } from "../lib/zod-schemas.js";
import { validateBody } from "../middleware/validate.js";
import { COUNTRIES } from "../lib/countries.js"; 

const prisma = new PrismaClient();
const router = express.Router();

// Admin home
router.get("/admin", requireAdmin, async (req, res) => {
  const usersCount = await prisma.user.count();
  const adminsCount = await prisma.user.count({ where: { role: "ADMIN" } });
  const sessionsCount = await prisma.session.count();

  res.render("admin/index", {
    title: "Admin Dashboard",
    stats: {
      users: usersCount,
      admins: adminsCount,
      sessions: sessionsCount,
    },
  });
});


// POST /admin/users/:id/role  { role: "ADMIN" | "EVANGELIST" }
router.post("/admin/users/:id/role", requireAdmin, async (req, res) => {
  const parsed = RoleSchema.safeParse(req.body.role);
  if (!parsed.success) return res.status(400).send("Invalid role");
  await prisma.user.update({
    where: { id: Number(req.params.id) },
    data: { role: parsed.data }
  });
  res.redirect("/admin/users");
});
// List users with simple pagination and search
router.get("/admin/users", requireAdmin, async (req, res) => {
  const page = Math.max(parseInt(req.query.page || "1", 10), 1);
  const pageSize = 20;
  const q = (req.query.q || "").trim();


  const where = q
    ? {
        OR: [
          { email: { contains: q } },
          { name:  { contains: q } },
        ],
      }
    : {};

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),                       // no `select` here
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: pageSize,
      skip: (page - 1) * pageSize,
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    }),
  ]);

  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  res.locals.viewName = "admin/users/list";
  res.render("admin/users/list", { title: "Users", users, q, page, totalPages });
});

// List all flagged sessions
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

// Show edit form
router.get("/admin/users/:id/edit", requireAdmin, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: Number(req.params.id) } });
  if (!user) return res.status(404).render("errors/404", { title: "Not Found" });

  res.render("admin/users/edit", {
    title: "Edit User",
    csrfToken: req.csrfToken(),
    user,
    values: {
      name: user.name || "",
      email: user.email || "",
      gender: user.gender || "",
      ageRange: user.ageRange || "",
      nationality: user.nationality || "",
      role: user.role || "USER",
    },
    errors: null,
    countries: COUNTRIES, // <-- pass to view
  });
});

router.post("/admin/users/:id/edit", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, email, gender, ageRange, nationality, role } = req.body;

    // Optional: enforce nationality to be one of the list
    if (!COUNTRIES.includes(nationality)) {
      return res.status(400).render("admin/users/edit", {
        title: "Edit User",
        csrfToken: req.csrfToken(),
        user: { id }, // minimal for the template if it references user.id
        values: { name, email, gender, ageRange, nationality, role },
        errors: { nationality: ["Select a valid nationality"], _form: ["Please fix the highlighted fields"] },
        countries: COUNTRIES,
      });
    }

    await prisma.user.update({
      where: { id },
      data: { name, email, gender, ageRange, nationality, role },
    });

    res.redirect(`/admin/users`);
  } catch (e) {
    return res.status(400).render("admin/users/edit", {
      title: "Edit User",
      csrfToken: req.csrfToken(),
      user: { id: Number(req.params.id) },
      values: req.body,
      errors: { _form: ["Could not update user"] },
      countries: COUNTRIES,
    });
  }
});

// Update user (profile fields only)
router.put("/admin/users/:id", requireAdmin, validateBody(AdminUserUpdateSchema), async (req, res) => {
  const data = req.validated;
  await prisma.user.update({ where: { id: Number(req.params.id) }, data });
  return res.redirect("/admin/users");
});

// Promote to admin
router.post("/admin/users/:id/promote", requireAdmin, async (req, res) => {
  await prisma.user.update({ where: { id: Number(req.params.id) }, data: { role: "ADMIN" } });
  return res.redirect("back");
});

// Demote to user, do not remove the last admin
router.post("/admin/users/:id/demote", requireAdmin, async (req, res) => {
  const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
  if (adminCount <= 1) {
    return res.status(409).send("Cannot demote the last admin");
  }
  await prisma.user.update({ where: { id: Number(req.params.id) }, data: { role: "USER" } });
  return res.redirect("back");
});



// Optional: admin create/update users with full schema
// router.post("/admin/users", requireAdmin, validateBody(AdminUpsertUserSchema), async (req, res) => {
//   const { password, ...rest } = req.body;
//   const data = { ...rest, password: await bcrypt.hash(password, 12) };
//   await prisma.user.create({ data });
//   res.redirect("/admin/users");
// });

export default router;
