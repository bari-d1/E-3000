// src/routes/dashboard.js
import express from "express";
import { PrismaClient } from "@prisma/client";
import { requireAuth } from "../middleware/auth.js";
import { env } from "../config/env.js";

const prisma = new PrismaClient();
const router = express.Router();

router.get("/dashboard", requireAuth, async (req, res) => {
  try {
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);

    // 1) User's own approved sessions (for the table)
    const sessions = await prisma.session.findMany({
      where: { userId: req.user.id, flagged: false, status: "APPROVED" },
      orderBy: { sessionDate: "desc" },
    });

    // 2) Church-wide annual sums (approved, non-flagged, within this year)
    const sumsAgg = await prisma.session.aggregate({
      _sum: {
        engagedCount: true,
        gospelCount: true,
        witnessCount: true,
        decisionCount: true,
        prayedCount: true,
      },
      where: {
        sessionDate: { gte: yearStart, lte: now },
        flagged: false,
        status: "APPROVED",
      },
    });

    const sums = {
      engagedCount: sumsAgg._sum.engagedCount || 0,
      gospelCount: sumsAgg._sum.gospelCount || 0,
      witnessCount: sumsAgg._sum.witnessCount || 0,
      decisionCount: sumsAgg._sum.decisionCount || 0,
      prayedCount: sumsAgg._sum.prayedCount || 0,
    };

    // 3) Goal progress uses Gospel + Witness
    const goal = Number(env.annualTarget) || 0;
    const achieved = sums.gospelCount + sums.witnessCount; // <-- changed logic
    const remaining = Math.max(0, goal - achieved);
    const progressPct = goal > 0 ? Math.min(100, Math.round((achieved / goal) * 100)) : 0;

    // 4) Current user's personal Gospel + Witness contribution (approved only)
    const myAgg = await prisma.session.aggregate({
      _sum: { gospelCount: true, witnessCount: true },
      where: { userId: req.user.id, flagged: false, status: "APPROVED" },
    });
    const myGospel = myAgg._sum.gospelCount || 0;
    const myWitness = myAgg._sum.witnessCount || 0;
    const myReached = myGospel + myWitness;

    // Per-user totals (approved, non-flagged)
const myAggAll = await prisma.session.aggregate({
  _sum: {
    engagedCount: true,
    gospelCount: true,
    witnessCount: true,
    decisionCount: true,
    prayedCount: true,
  },
  where: { userId: req.user.id, flagged: false, status: "APPROVED" },
});

const my = {
  engaged:  myAggAll._sum.engagedCount  || 0,
  gospel:   myAggAll._sum.gospelCount   || 0,
  witness:  myAggAll._sum.witnessCount  || 0,
  decision: myAggAll._sum.decisionCount || 0,
  prayed:   myAggAll._sum.prayedCount   || 0,
};

    return res.render("dashboard/index", {
      title: "Dashboard",
      sums,          // includes all five totals (engaged still available for cards)
      goal,
      achieved,      // gospel + witness (church-wide this year)
      remaining,
      progressPct,
      sessions,      // user's recent sessions
      myGospel,
      myWitness,
      myReached,     // user's gospel + witness total
      my,
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    return res.status(500).render("errors/500", { title: "Server Error", error: err });
  }
});

export default router;
