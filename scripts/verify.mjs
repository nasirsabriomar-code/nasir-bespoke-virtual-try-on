import { spawnSync } from "node:child_process";

// Tests use fixtures and mocks, never production storage, identity or provider credentials.
const env = { ...process.env };
for (const key of Object.keys(env)) {
  if (/^(DATABASE_|UPSTASH_|NASIR_|R2_|OPENAI_|AUTH_|BLOB_)/.test(key) || key === "VERCEL_OIDC_TOKEN") delete env[key];
}
for (const script of ["lint", "typecheck", "test"]) {
  const result = spawnSync("npm", ["run", script], { stdio: "inherit", env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
