// src/routes/faq.js
import express from "express";
const router = express.Router();

router.get("/faq", (req, res) => {
  res.render("faq/index", {
    title: "FAQ",
  });
});

export default router;
