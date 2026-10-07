import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CatalogueRecovery } from "@/components/CatalogueRecovery";
import { getCurrentUserFromToken, getSessionCookieName } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function Home() {
  const cookieStore = await cookies();
  const tokenUser = await getCurrentUserFromToken(cookieStore.get(getSessionCookieName())?.value);
  const devFallbackUser =
    !tokenUser && process.env.NODE_ENV === "development"
      ? { username: "showroom", displayName: "Showroom Staff" }
      : null;
  const user = tokenUser ?? devFallbackUser;
  if (!user) redirect("/login");

  return <CatalogueRecovery />;
}
