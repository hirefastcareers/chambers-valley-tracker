import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const AUTH_COOKIE = "garden-auth";

export async function isAuthed() {
  const cookieStore = await cookies();
  return Boolean(cookieStore.get(AUTH_COOKIE)?.value);
}

export async function requireAuth() {
  if (!(await isAuthed())) redirect("/login");
}

