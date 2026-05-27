import { redirect } from "next/navigation";
import { requireRoleAccess } from "@/lib/auth";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function CertificatesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRoleAccess(["COMPANY_ADMIN", "SAFETY_ENGINEER"]);
  const params = await searchParams;
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") {
      query.set(key, value);
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        query.append(key, item);
      }
    }
  }

  const nextUrl = query.toString()
    ? `/certificates/biot-experimental?${query.toString()}`
    : "/certificates/biot-experimental";

  redirect(nextUrl);
}
