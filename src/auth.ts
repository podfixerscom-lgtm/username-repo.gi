import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { z } from "zod";
import { UserRole } from "@/generated/prisma/enums";
import { getPrisma } from "@/lib/prisma";

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(1),
});

function isUserRole(role: unknown): role is UserRole {
  return (
    role === UserRole.ADMIN ||
    role === UserRole.MANAGER ||
    role === UserRole.STAFF
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  pages: {
    signIn: "/admin/login",
  },
  session: {
    strategy: "jwt",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "ইমেইল", type: "email" },
        password: { label: "পাসওয়ার্ড", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        const user = await getPrisma().user.findUnique({
          where: { email: parsed.data.email },
          select: {
            id: true,
            email: true,
            name: true,
            passwordHash: true,
            role: true,
            isActive: true,
          },
        });

        if (!user?.isActive) {
          return null;
        }

        const validPassword = await compare(
          parsed.data.password,
          user.passwordHash,
        );
        if (!validPassword) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (!session.user || !token.sub || !isUserRole(token.role)) {
        throw new Error("Authentication session is missing required user claims.");
      }

      session.user.id = token.sub;
      session.user.role = token.role;
      return session;
    },
  },
});
