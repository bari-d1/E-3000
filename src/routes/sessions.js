// src/routes/sessions.js
import express from "express";
import { PrismaClient } from "@prisma/client";
import { requireAuth, requireSubmit, requireAdmin } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { SessionSchema } from "../lib/zod-schemas.js";
import { makeSignature } from "../lib/duplicateSignature.js";
import { logAudit } from "../lib/audit.js";

const prisma = new PrismaClient();
const router = express.Router();

/**
 * GET /sessions/new
 * Show the form to create a new session.
 */
router.get("/sessions/new", requireAuth, (req, res) => {
  res.render("sessions/new", {
    title: "New Session",
    errors: null,
    values: {},
    csrfToken: req.csrfToken(),
  });
});

/**
 * GET /sessions (MY SESSIONS)
 * Normal users: only their own APPROVED, non-flagged sessions.
 */
router.get("/sessions", requireAuth, async (req, res) => {
  try {
    const sessions = await prisma.session.findMany({
      where: {
        userId: req.user.id,
        flagged: false,
        status: "APPROVED",
      },
      orderBy: { sessionDate: "desc" },
    });

    res.render("sessions/list", {
      title: "My Sessions",
      sessions,
      mine: true, // fixes "mine is not defined"
      csrfToken: req.csrfToken(),
    });
  } catch (err) {
    console.error("Error loading sessions:", err);
    res.status(500).render("errors/500", { title: "Server Error", error: err });
  }
});

/**
 * GET /admin/sessions (ALL SESSIONS)
 * Admins can see all APPROVED, non-flagged sessions from all users.
 */
router.get("/admin/sessions", requireAdmin, async (req, res) => {
  try {
    const sessions = await prisma.session.findMany({
      where: {
        flagged: false,
        status: "APPROVED",
      },
      orderBy: { sessionDate: "desc" },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    res.render("sessions/list", {
      title: "All Sessions",
      sessions,
      mine: false, // distinguishes admin view
      csrfToken: req.csrfToken(),
    });
  } catch (err) {
    console.error("Error loading all sessions:", err);
    res.status(500).render("errors/500", { title: "Server Error", error: err });
  }
});

/**
 * POST /sessions
 * Create a session. Suspicious numbers are auto-flagged as PENDING (not visible until admin reviews).
 * Duplicate detection is optional; if present, duplicates are also auto-flagged.
 */
router.post(
  "/sessions",
  requireSubmit,
  validateBody(SessionSchema, { view: "sessions/new", title: "New Session" }),
  async (req, res) => {
    try {
      const data = req.validated;
      const userId = req.user.id;

      // Auto-flag thresholds (tweak as you like)
      const flagThresholds = {
        engagedCount: 500,
        gospelCount: 300,
        witnessCount: 300,
      };

      let flagged = false;
      const reasons = [];

      for (const [key, limit] of Object.entries(flagThresholds)) {
        if (typeof data[key] === "number" && data[key] > limit) {
          flagged = true;
          reasons.push(`${key} = ${data[key]} exceeds limit ${limit}`);
        }
      }

      // Optional: duplicate detection (if makeSignature util is implemented)
      if (typeof makeSignature === "function") {
        try {
          const sig = makeSignature({
            userId,
            sessionDate: data.sessionDate,
            locationText: data.locationText || "",
            engagedCount: data.engagedCount,
            gospelCount: data.gospelCount,
            witnessCount: data.witnessCount,
            decisionCount: data.decisionCount,
            prayedCount: data.prayedCount,
          });

          const dupe = await prisma.session.findFirst({
            where: {
              userId,
              sessionDate: data.sessionDate,
              engagedCount: data.engagedCount,
              gospelCount: data.gospelCount,
              witnessCount: data.witnessCount,
              decisionCount: data.decisionCount,
              prayedCount: data.prayedCount,
            },
          });

          if (dupe) {
            flagged = true;
            reasons.push(`Possible duplicate of session #${dupe.id}`);
          }
        } catch {
          // signature util missing or errored - ignore silently
          console.log("no signature");
        }
      }

      // Create the session (PENDING if flagged; APPROVED otherwise)
      const created = await prisma.session.create({
        data: {
          ...data,
          userId,
          flagged,
          flagReason: flagged ? reasons.join("; ") : null,
          status: flagged ? "PENDING" : "APPROVED",
        },
      });

      // Optional: audit log
      if (typeof logAudit === "function") {
        await logAudit({
          actorId: userId,
          action: flagged ? "SESSION_SUBMITTED_FLAGGED" : "SESSION_SUBMITTED",
          targetId: created.id,
          meta: flagged ? { reasons } : undefined,
        }).catch(() => {});
      }

      if (flagged) {
        // Keep the user on the form with a clear message
        return res.render("sessions/new", {
          title: "New Session",
          errors: { _form: ["Your entry has been flagged for review by an admin."] },
          values: req.validated,
          csrfToken: req.csrfToken(),
        });
      }

      // Success: redirect to "My Sessions"
      return res.redirect("/dashboard");
    } catch (err) {
      console.error("Error creating session:", err);
      return res
        .status(500)
        .render("errors/500", { title: "Server Error", error: err });
    }
  }
);

// Admin delete session
router.post("/admin/sessions/:id/delete", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).render("errors/400", {
      title: "Bad Request",
      error: new Error("Invalid session id"),
    });
  }

  try {
    const existing = await prisma.session.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).render("errors/404", {
        title: "Not Found",
        error: new Error("Session not found"),
      });
    }

    await prisma.session.delete({ where: { id } });

    if (typeof logAudit === "function") {
      logAudit({
        actorId: req.user.id,
        action: "SESSION_DELETED_ADMIN",
        targetId: id,
        meta: { userId: existing.userId, sessionDate: existing.sessionDate },
      }).catch(() => {});
    }

    return res.redirect("/admin/sessions");
  } catch (err) {
    console.error("Error deleting session:", err);
    return res.status(500).render("errors/500", {
      title: "Server Error",
      error: err,
    });
  }
});

export default router;
