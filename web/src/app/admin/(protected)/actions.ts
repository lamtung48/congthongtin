"use server";

import { redirect } from "next/navigation";
import { authService } from "@/server/services/authService";

export async function logoutAction(): Promise<void> {
  await authService.logout();
  redirect("/admin/login");
}
