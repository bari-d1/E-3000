// src/routes/auth.js
import express from "express";
import passport from "passport";
import Local from "passport-local";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
import { RegistrationSchema } from "../lib/zod-schemas.js";
import { validateBody } from "../middleware/validate.js";
import { COUNTRIES } from "../lib/countries.js";

const prisma = new PrismaClient();
const router = express.Router();
const LocalStrategy = Local.Strategy;

/* ---------------- Passport Local ---------------- */
passport.use(
  new LocalStrategy({ usernameField: "email" }, async (email, password, done) => {
    try {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) return done(null, false);
      const ok = await bcrypt.compare(password, user.password);
      return ok ? done(null, user) : done(null, false);
    } catch (e) {
      return done(e);
    }
  })
);
passport.serializeUser((u, done) => done(null, u.id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    done(null, user || false);
  } catch (e) {
    done(e);
  }
});

/* ---------------- Helpers ---------------- */
function pickNext(nxt) {
  if (typeof nxt !== "string") return "";
  if (!nxt.startsWith("/") || nxt.startsWith("//")) return "";
  return nxt;
}
function roleHome(role) {
  return role === "ADMIN" ? "/admin" : "/dashboard";
}

/* ---------------- LOGIN ---------------- */
router.get("/login", (req, res) => {
  res.render("auth/login", {
    title: "Login",
    csrfToken: req.csrfToken(),
    next: pickNext(req.query.next || ""),
    error: undefined,
    errors: null,
    email: "",
  });
});

router.post("/login", (req, res, next) => {
  const intended = pickNext(req.body.next || req.query.next || "");
  passport.authenticate("local", (err, user) => {
    if (err) return next(err);
    if (!user) {
      return res.status(401).render("auth/login", {
        title: "Login",
        csrfToken: req.csrfToken(),
        next: intended,
        email: req.body.email || "",
        error: "Invalid email or password",
        errors: { _form: ["Invalid email or password"] },
      });
    }
    req.logIn(user, (err2) => {
      if (err2) return next(err2);
      return res.redirect(intended || roleHome(user.role));
    });
  })(req, res, next);
});

/* ---------------- REGISTER ---------------- */
// Render form
router.get("/register", (req, res) => {
  res.render("auth/register", {
    title: "Register",
    csrfToken: req.csrfToken(),
    next: pickNext(req.query.next || ""),
    values: {},
    errors: null,
    countries: COUNTRIES,
  });
});
router.get("/terms", (req, res) => {
  res.render("auth/terms", { title: "Terms & Data Policy" });
});


// Validate + create
router.post(
  "/register",
  // Tell the validator which view to render on error (fixes the previous 500-page render)
  validateBody(RegistrationSchema, { view: "auth/register", title: "Register" }),
  async (req, res, next) => {
    try {
      // Guaranteed by validateBody; fall back to req.body just in case
      const data = req.validated ?? req.body;
      const { name, email, password, gender, ageRange, nationality } = data;

      const hashed = await bcrypt.hash(password, 12);
      const user = await prisma.user.create({
        data: {
          name,
          email,
          password: hashed,
          gender,
          ageRange,
          nationality,
          role: "EVANGELIST",
        },
      });

      // Auto-login then redirect
      req.logIn(user, (err) => {
        if (err) return next(err);
        const intended = pickNext(req.body.next || req.query.next || "");
        return res.redirect(intended || "/dashboard");
      });
    } catch (e) {
      // Handle duplicate email and bounce back to the form with values + errors
      const duplicate = e && e.code === "P2002";
      return res.status(400).render("auth/register", {
        title: "Register",
        csrfToken: req.csrfToken(),
        next: pickNext(req.body.next || req.query.next || ""),
        values: {
          name: req.body.name || "",
          email: req.body.email || "",
          gender: req.body.gender || "",
          ageRange: req.body.ageRange || "",
          nationality: req.body.nationality || "",
        },
        errors: {
          _form: [duplicate ? "Email already in use" : "Please fix the highlighted fields"],
          ...(duplicate ? { email: ["Email already in use"] } : {}),
          countries: COUNTRIES,
        },
      });
    }
  }
);

/* ---------------- LOGOUT ---------------- */
router.post("/logout", (req, res, next) => {
  req.logout((err) => (err ? next(err) : res.redirect("/login")));
});

export default router;
