// src/server.js
import express from "express";
import expressLayouts from "express-ejs-layouts";
import path from "path";
import { fileURLToPath } from "url";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import passport from "passport";
import methodOverride from "method-override";
import csrf from "csurf";
import compression from "compression";

import resourcesRouter from "./routes/resources.js";
import authRoutes from "./routes/auth.js";
import sessionRoutes from "./routes/sessions.js";
import dashboardRoutes from "./routes/dashboard.js";
import adminRoutes from "./routes/admin.js";
import faqRouter from "./routes/faq.js";
import { COUNTRIES } from "./lib/countries.js";
// import adminFlagsRoutes from "./routes/adminFlags.js";

import { applySecurity } from "./middleware/security.js";
import { env } from "./config/env.js";
import { configurePassport } from "./config/passport.js";

/* --- bootstrap paths --- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* --- sanity checks (fail fast if misconfigured) --- */
if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set. Set it in your .env (dev) and Render env (prod).'
  );
}
if (!env.sessionSecret) {
  throw new Error('SESSION_SECRET is not set.');
}

const app = express();

/* Make countries available to all EJS templates */
app.use((req, res, next) => {
  res.locals.countries = COUNTRIES;
  next();
});

/* Auth config */
configurePassport(passport);

/* Views */
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(expressLayouts);
app.set("layout", "layout");

/* Static assets — serve /public/* at site root (/js, /css, /images, ...) */
app.use(
  express.static(path.join(__dirname, "..", "public"), {
    maxAge: env.nodeEnv === "production" ? "7d" : 0,
    etag: true,
    fallthrough: true,
  })
);

/* Health check (no auth, no csrf) */
app.get("/healthz", (_req, res) => res.status(200).send("ok"));

/* Parsers */
app.use(express.urlencoded({ extended: false, limit: "200kb" }));
app.use(express.json({ limit: "200kb" }));

/* Method override from form body: <input name="_method" value="PUT"> */
app.use(
  methodOverride((req) => {
    if (req.body && typeof req.body === "object" && "_method" in req.body) {
      const method = req.body._method;
      delete req.body._method;
      return method;
    }
    return undefined;
  })
);

/* Compression */
app.use(compression());

/* --- Sessions (Postgres only) --- */
const PgSession = connectPgSimple(session);

// If behind a proxy (Render/Cloudflare), trust it so secure cookies work
if (env.nodeEnv === "production") {
  app.set("trust proxy", 1);
}

app.use(
  session({
    store: new PgSession({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: true,
      // tableName: "session",
    }),
    secret: env.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: env.nodeEnv === "production", // true on HTTPS
      maxAge: 1000 * 60 * 60 * 8, // 8 hours
      // domain: ".harvestisplenty.uk", // uncomment if sharing across apex & www
    },
    // name: "e3000.sid",
  })
);

/* Passport */
app.use(passport.initialize());
app.use(passport.session());

/* Security headers, rate limits, etc */
applySecurity(app);

/* CSRF then locals for views */
app.use(csrf());
app.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  res.locals.user = req.user || null;
  res.locals.env = env.nodeEnv;
  next();
});

/* Routes */
app.use(authRoutes);
app.use(sessionRoutes);
app.use(dashboardRoutes);
app.use(adminRoutes);
app.use(resourcesRouter);
app.use(faqRouter);
// app.use(adminFlagsRoutes);

/* Home */
app.get("/", (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return res.redirect("/dashboard");
  }
  return res.redirect("/login?next=/dashboard");
});

/* 404 */
app.use((req, res) => {
  res.status(404).render("errors/404", { title: "Not Found" });
});

/* CSRF error handler kept explicit */
app.use((err, req, res, next) => {
  if (err.code === "EBADCSRFTOKEN") {
    return res.status(403).send("Invalid or missing CSRF token.");
  }
  next(err);
});

/* Fallback error handler */
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  const status = err.statusCode || err.status || 500;
  const isProd = env.nodeEnv === "production";
  const view = status === 404 ? "errors/404" : "errors/500";
  res.status(status).render(view, {
    title: status === 404 ? "Not Found" : "Server Error",
    error: isProd ? null : err,
  });
});

/* Start */
app.listen(env.port, () => {
  console.log(`E-3000 up on http://localhost:${env.port}`);
});