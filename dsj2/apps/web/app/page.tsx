import { redirect } from "next/navigation";
import { getCurrentSession, getDefaultAuthenticatedPath } from "../lib/auth";

export default async function HomePage() {
  const session = await getCurrentSession();
  redirect(session ? getDefaultAuthenticatedPath(session.user) : "/login");
}
