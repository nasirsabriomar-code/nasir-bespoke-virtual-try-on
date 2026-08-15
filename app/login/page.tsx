import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { AuthConfigurationError } from "@/lib/auth/config";
import { getCurrentUserFromToken, getSessionCookieName } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  let configurationError = false;
  try {
    const cookieStore = await cookies();
    const user = await getCurrentUserFromToken(cookieStore.get(getSessionCookieName())?.value);
    if (user) redirect("/");
  } catch (error) {
    if (error instanceof AuthConfigurationError) configurationError = true;
    else throw error;
  }

  return (
    <main className="login-shell">
      <section className="login-card" aria-labelledby="login-title">
        <p className="brand-kicker">NASIR BESPOKE</p>
        <span className="brand-rule" aria-hidden="true" />
        <h1 id="login-title">Virtual Try-On</h1>
        <p className="login-intro">Private staff access</p>
        {configurationError ? (
          <p className="login-error" role="alert">
            Sign-in is not configured. Please contact the administrator.
          </p>
        ) : (
          <LoginForm />
        )}
        <p className="login-privacy">Customer photos are sent securely for try-on generation.</p>
      </section>
    </main>
  );
}
