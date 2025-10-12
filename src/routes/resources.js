// src/routes/resources.js
import express from "express";

const router = express.Router();

/**
 * Replace the placeholder URLs below with your 4 YouTube links.
 * You can also move these to env/config or fetch from DB later.
 */
const YT_VIDEOS = [
  { title: "The 3-Story Method: Engaging People In Evangelism", url: "https://youtu.be/riprTjAK75M?si=-nXumWyc_YMmZIWg" },
  { title: "Who Has God Called You To? Speaking the Language of the Lost", url: "https://youtu.be/afzNqcrrjyo?si=fufyCV7qaf_hWkEv" },
  { title: "Everything You Need To Know About Evangelism ", url: "https://www.youtube.com/live/unzkmG2bdxU?si=EzwGXgii2MUclSD3" },
  { title: "Before You Evangelise, Watch This! | Witness with Boldness & Clarity", url: "https://youtu.be/5oQngZU0zRU?si=2Vv5DP51xaLyC3o6" },
];

// helper to extract the videoId and thumbnail
function getVideoId(yurl) {
  try {
    const u = new URL(yurl);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1);
    if (u.searchParams.has("v")) return u.searchParams.get("v");
    return ""; // fallback
  } catch {
    return "";
  }
}
function toThumb(yurl) {
  const id = getVideoId(yurl);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : "";
}

router.get("/resources", (req, res) => {
  const videos = YT_VIDEOS.map(v => ({
    ...v,
    id: getVideoId(v.url),
    thumb: toThumb(v.url),
  }));
  res.render("resources/index", {
    title: "Resources",
    videos,
  });
});

export default router;
