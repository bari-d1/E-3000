import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export function configurePassport(passport) {
  passport.use(
    new LocalStrategy(
      { usernameField: "email", passwordField: "password" },
      async (email, password, done) => {
        try {
          const user = await prisma.user.findUnique({ where: { email } });
          if (!user) return done(null, false, { message: "Invalid email or password" });

          const ok = await bcrypt.compare(password, user.password);
          if (!ok) return done(null, false, { message: "Invalid email or password" });

          // only store minimal info
          return done(null, { id: user.id, email: user.email, role: user.role });
        } catch (err) {
          return done(err);
        }
      }
    )
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id },
        select: { id: true, email: true, role: true },
      });
      done(null, user || false);
    } catch (err) {
      done(err);
    }
  });
}
