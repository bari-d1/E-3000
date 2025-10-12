export function requireAuth(req, res, next) {
  if (!req.user && !req.session?.user) return res.status(401).send("Not authenticated");
  next();
}
  export function canSubmit(user) {
    return ["ADMIN", "EVANGELIST"].includes(user?.role);
  }
  export function requireSubmit(req, res, next) {
    if (req.isAuthenticated?.() && canSubmit(req.user)) return next();
    res.sendStatus(403);
  }
// middleware/auth.js
export function requireAdmin(req, res, next) {
  const role = req.user?.role || req.session?.user?.role;
  if (!role) return res.status(401).send("Not authenticated");
  if (role !== "ADMIN") return res.status(403).send("Admins only");
  next();
}

  