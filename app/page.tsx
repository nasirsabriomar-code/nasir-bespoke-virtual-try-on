import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { TryOnApp } from "@/components/TryOnApp";
import { getCurrentUserFromToken, getSessionCookieName } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function Home() {
  const cookieStore = await cookies();
  const user = await getCurrentUserFromToken(cookieStore.get(getSessionCookieName())?.value);
  if (!user) redirect("/login");

  return <TryOnApp displayName={user.displayName} accountId={user.username} />;
}
