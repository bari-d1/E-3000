import helmet from "helmet";
import morgan from "morgan";
import csrf from "csurf";

export function applySecurity(app) {
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(helmet.contentSecurityPolicy({
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://unpkg.com", "https://cdn.tailwindcss.com"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: [
        "'self'",
        "data:",
        "https://img.youtube.com",
        "https://i.ytimg.com",    // <-- many thumbnails come from here
      ],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'self'"]
    }
  }));
  app.use(morgan("combined"));
  app.use(csrf());
  app.use((req, res, next) => {
    res.locals.csrfToken = req.csrfToken();
    next();
  });
}
