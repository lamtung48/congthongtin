"use server";

import { redirect } from "next/navigation";
import { authService } from "@/server/services/authService";
import { EDITORIAL_LOGIN_PATH } from "@/server/auth/session";

export async function logoutAction(): Promise<void> {
  await authService.logout();
  redirect(EDITORIAL_LOGIN_PATH);
}
