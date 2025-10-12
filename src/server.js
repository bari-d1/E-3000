// src/server.js
import express from "express";
import expressLayouts from "express-ejs-layouts";
import path from "path";
import { fileURLToPath } from "url";
import session from "express-session";
import SQLiteStoreFactory from "connect-sqlite3";
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use((req, res, next) => {
  res.locals.countries = COUNTRIES;   // available in all EJS templates
  next();
});
/* Auth config */
configurePassport(passport);

/* Views */
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(expressLayouts);
app.set("layout", "layout");

/* Static assets */
app.use(
  "/public",
  express.static(path.join(__dirname, "..", "public"), {
    maxAge: env.nodeEnv === "production" ? "7d" : 0,
    etag: true,
    fallthrough: true,
  })
);

/* Health check (no auth, no csrf) */
app.get("/healthz", (req, res) => res.status(200).send("ok"));

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

/* Session store
   - Local dev: SQLite file store
   - Production: Postgres via connect-pg-simple
*/
const usePg = env.nodeEnv === "production" && !!process.env.DATABASE_URL;

let sessionStore;
if (usePg) {
  const PgSession = connectPgSimple(session);
  // Let Express trust the Render proxy so secure cookies are set correctly
  app.set("trust proxy", 1);
  sessionStore = new PgSession({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    // tableName: "session", // default
  });
} else {
  const SQLiteStore = SQLiteStoreFactory(session);
  sessionStore = new SQLiteStore({ db: "sessions.sqlite", dir: "./" });
}

app.use(
  session({
    store: sessionStore,
    secret: env.sessionSecret, // set SESSION_SECRET in env
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: env.nodeEnv === "production", // only on HTTPS
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 8, // 8 hours
      // If you want the cookie shared across apex and www, uncomment:
      // domain: ".harvestisplenty.uk",
    },
    // name: "e3000.sid", // optional custom cookie name
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
  const isProd = process.env.NODE_ENV === "production";
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
