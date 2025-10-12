// src/server.js
import express from "express";
import expressLayouts from "express-ejs-layouts";
import path from "path";
import { fileURLToPath } from "url";
import session from "express-session";
import SQLiteStoreFactory from "connect-sqlite3";
import passport from "passport";
import methodOverride from "method-override";
import csrf from "csurf";
import compression from "compression";
import resourcesRouter from "./routes/resources.js";
import authRoutes from "./routes/auth.js";
import sessionRoutes from "./routes/sessions.js";
import dashboardRoutes from "./routes/dashboard.js";
import adminRoutes from "./routes/admin.js";
// import adminFlagsRoutes from "./routes/adminFlags.js";
import { applySecurity } from "./middleware/security.js";
import { env } from "./config/env.js";
import { configurePassport } from "./config/passport.js";
import faqRouter from "./routes/faq.js";





const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SQLiteStore = SQLiteStoreFactory(session);

const app = express();
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

/* Session */
app.use(
  session({
    store: new SQLiteStore({ db: "sessions.sqlite", dir: "./" }),
    secret: env.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: env.nodeEnv === "production",
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 8,
    },
  })
);

/* Passport */
app.use(passport.initialize());
app.use(passport.session());

/* Security headers, rate limits, etc */
applySecurity(app);

/* CSRF, then expose helpers to views */
app.use(csrf());
app.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  res.locals.user = req.user || null; // passport populates req.user
  res.locals.env = env.nodeEnv;
  next();
});

/* for static files*/
app.use(express.static(path.join(__dirname, "../public")));

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
// app.use((err, req, res, next) => {
//   console.error(err);
//   const status = err.status || 500;
//   res.status(status).render("errors/500", { title: "Server Error", error: env.nodeEnv === "production" ? null : err });
// });

app.use((err, req, res, next) => {
  console.error(err);

  if (res.headersSent) return next(err);

  const status = err.statusCode || err.status || 500;
  const isProd = process.env.NODE_ENV === "production";
  const view = status === 404 ? "errors/404" : "errors/500";

  res.status(status).render(view, {
    title: status === 404 ? "Not Found" : "Server Error",
    error: isProd ? null : err,   // your 500.ejs must handle null/undefined
  });
});







/* Start */
app.listen(env.port, () => {
  console.log(`E-3000 up on http://localhost:${env.port}`);
});
