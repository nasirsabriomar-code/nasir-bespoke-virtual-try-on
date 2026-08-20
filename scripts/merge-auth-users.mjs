#!/usr/bin/env node
import { mergeAuthUserBlobs } from "../lib/auth/merge-users.ts";

const blobs = process.argv.slice(2).filter(Boolean).map((arg) => arg.replace(/^AUTH_USERS_JSON_BASE64=/, ""));

if (blobs.length === 0) {
  console.error("Usage: npm run auth:merge-users -- <AUTH_USERS_JSON_BASE64_value> [<AUTH_USERS_JSON_BASE64_value> ...]");
  console.error('Each argument is one full output line of "npm run auth:create-user" (the "AUTH_USERS_JSON_BASE64=" prefix is optional).');
  process.exit(1);
}

try {
  const merged = mergeAuthUserBlobs(blobs);
  console.log(`AUTH_USERS_JSON_BASE64=${merged}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Could not merge allowlist entries.");
  process.exit(1);
}
