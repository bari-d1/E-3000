import crypto from "crypto";
export function makeSignature({ userId, sessionDate, locationText, engagedCount, gospelCount, witnessCount, decisionCount, prayedCount }) {
  const base = `${userId}|${new Date(sessionDate).toISOString()}|${locationText || ""}|${engagedCount}|${gospelCount}|${witnessCount}|${decisionCount}|${prayedCount}`;
  return crypto.createHash("sha256").update(base).digest("hex");
}
