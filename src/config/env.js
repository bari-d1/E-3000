import "dotenv/config";

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 3000),
  sessionSecret: process.env.SESSION_SECRET || "change_me",
  annualTarget: Number(process.env.ANNUAL_TARGET || 3000),
  appName: process.env.APP_NAME || "E-3000"
};
