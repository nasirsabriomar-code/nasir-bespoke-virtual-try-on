import "server-only";

import bcrypt from "bcryptjs";
import { findAuthorizedUser } from "@/lib/auth/config";

export async function verifyCredentials(username: string, password: string) {
  if (username.length > 64 || password.length < 1 || password.length > 256) return null;
  const user = findAuthorizedUser(username);
  if (!user) {
    // Keep invalid-user timing closer to an invalid password without using a valid account hash.
    await bcrypt.compare(password, "$2b$12$C6UzMDM.H6dfI/f/IKcEe.5ZPjMZ9i0M2E5kUEHQtS2JbVjFu6K3K");
    return null;
  }

  return (await bcrypt.compare(password, user.passwordHash)) ? user : null;
}
