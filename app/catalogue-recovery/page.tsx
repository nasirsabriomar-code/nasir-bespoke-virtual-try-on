import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CatalogueRecovery } from "@/components/CatalogueRecovery";
import { getCurrentUserFromToken, getSessionCookieName } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function Home() {
  const cookieStore = await cookies();
  const user = await getCurrentUserFromToken(cookieStore.get(getSessionCookieName())?.value);
  if (!user) redirect("/login");

  return <CatalogueRecovery />;
}
