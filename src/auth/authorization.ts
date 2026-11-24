import type { UserRole } from "@/generated/prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getPrisma } from "@/lib/prisma";

export async function requireStaff(allowedRoles?: readonly UserRole[]) {
  const session = await auth();

  if (!session?.user.id) {
    redirect("/admin/login");
  }

  const user = await getPrisma().user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
    },
  });

  if (!user?.isActive) {
    redirect("/admin/login");
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    redirect("/admin");
  }

  return user;
}
