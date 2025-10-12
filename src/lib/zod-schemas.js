// src/lib/zod-schemas.js
import { z } from "zod";
import { COUNTRIES } from "./countries.js";

/* Normalize browser form inputs:
   - "" or null -> undefined
   - trim strings
*/
const normalize = (v) => {
  if (v === "" || v === null) return undefined;
  return typeof v === "string" ? v.trim() : v;
};

/* Small helpers */
const NonEmpty = (msg = "Required") => z.preprocess(normalize, z.string().min(1, msg));
const Email = z.preprocess(normalize, z.string().email("Enter a valid email"));
const Password = z.preprocess(normalize, z.string().min(8, "Password must be at least 8 characters"));
const OptEnum = (vals) => z.preprocess(normalize, z.enum(vals));

/* Roles: include USER to match demotion flow */
export const RoleSchema = z.enum(["ADMIN", "EVANGELIST", "USER"]);

/* Registration (role is NOT user-supplied) */
export const RegistrationSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 chars"),
  gender: z.enum(["Male", "Female", "Other"], { required_error: "Select a gender" }),
  ageRange: z.enum(["<18","18-24","25-34","35-44","45-54","55-64","65+"], { required_error: "Select an age range" }),
  nationality: z.string().refine((v) => COUNTRIES.includes(v), { message: "Select a valid nationality" }),

});
/* Admin create or update user (role set here) */
export const AdminUpsertUserSchema = z.object({
  name: z.preprocess(normalize, z.string().min(2)),
  email: Email,
  password: z.preprocess(normalize, z.string().min(8)).optional(), // optional on update
  role: RoleSchema,                                                // enforced
  gender: NonEmpty(),
  ageRange: NonEmpty(),
  nationality: NonEmpty(),
});

/* Session submission with cross-field checks (kept as you had it) */

const int0 = z.preprocess(
  (v) => (v === "" || v === undefined || v === null ? 0 : Number(v)),
  z.number().int().min(0, { message: "Must be 0 or more" })
);
export const SessionSchema = z.object({
  sessionDate: z.preprocess(
    (v) => (typeof v === "string" ? new Date(v) : v),
    z.date({ required_error: "Date/time is required" })
  )
    .refine((d) => d instanceof Date && !isNaN(d.valueOf()), { message: "Invalid date/time" })
    .refine((d) => d.getTime() <= Date.now() + 60_000, { message: "Session date/time cannot be in the future" }),

    locationText: z
    .string({ required_error: "Location is required" })
    .trim()
    .min(3, "Location is required")
    .max(120, "Location is too long"),

  // Counts — default to 0 if not provided / blank
  engagedCount: int0,
  gospelCount: int0,
  witnessCount: int0,
  decisionCount: int0,
  prayedCount: int0,
})
.superRefine((val, ctx) => {
  const keys = ["gospelCount", "witnessCount", "decisionCount", "prayedCount"];
  for (const k of keys) {
    if (val[k] > val.engagedCount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [k],
        message: "Cannot be greater than Engaged",
      });
    }
  }
});

/* Admin edit of user profile fields (no password here)
   nationality now accepts full country names, not just 2 chars */
export const AdminUserUpdateSchema = z.object({
  name: z.preprocess(normalize, z.string().min(1).max(120)).optional(),
  email: Email.optional(),
  gender: OptEnum(["Male", "Female", "Other"]).optional(),
  ageRange: OptEnum(["Under 18", "18-24", "25-34", "35-44", "45-54", "55+"]).optional(),
  nationality: z.preprocess(normalize, z.string().min(1).max(100)).optional(),
});
