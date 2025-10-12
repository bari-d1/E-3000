// src/middleware/validate.js
export function validateBody(schema, opts = {}) {
  // opts: { view, title, coerce, jsonIfAjax }
  return (req, res, next) => {
    try {
      const src = req.body || {};

      // 1) Normalize "" -> undefined so zod optional().nullable() work naturally
      let normalized = Object.fromEntries(
        Object.entries(src).map(([k, v]) => [k, v === "" ? undefined : v])
      );

      // 2) Optional coercion (numbers, booleans) before zod if you like
      if (opts.coerce && typeof opts.coerce === "function") {
        normalized = opts.coerce(normalized);
      }

      const parsed = schema.safeParse(normalized);

      if (!parsed.success) {
        // Shape errors for templates: _form plus per-field arrays
        const flat = parsed.error.flatten(); // { fieldErrors, formErrors }
        const templateErrors = {
          _form: flat.formErrors && flat.formErrors.length
            ? flat.formErrors
            : ["Please fix the highlighted fields"],
          ...flat.fieldErrors, // { name: ["…"], email: ["…"], ... }
        };

        // If AJAX, optionally return JSON instead of HTML
        if (opts.jsonIfAjax && (req.xhr || req.get("Accept")?.includes("application/json"))) {
          return res.status(400).json({ ok: false, errors: templateErrors });
        }

        // Decide which view to render
        const view = opts.view || res.locals.viewName || "errors/400";
        const title = opts.title || res.locals.title || "Form Error";

        return res.status(400).render(view, {
          title,
          csrfToken: req.csrfToken ? req.csrfToken() : undefined,
          errors: templateErrors,
          values: src, // echo raw inputs so fields keep what the user typed
          next: req.body?.next || req.query?.next || "",
        });
      }

      // Success: stash parsed data
      req.validated = parsed.data;
      return next();
    } catch (err) {
      return next(err);
    }
  };
}
