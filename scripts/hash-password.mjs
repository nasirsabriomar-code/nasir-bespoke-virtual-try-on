import bcrypt from "bcryptjs";

const username = String(process.argv[2] ?? "").trim().toLowerCase();
const displayName = String(process.argv[3] ?? "").trim();
const STAFF_ROLES = ["OWNER", "MANAGER", "STAFF", "STYLE_CONSULTANT", "MASTER_TAILOR", "QC_STAFF"];
const role = String(process.argv[4] ?? "STAFF").trim().toUpperCase();

if (
  !/^[a-z0-9._-]{2,64}$/.test(username) ||
  !displayName ||
  displayName.length > 80 ||
  !STAFF_ROLES.includes(role)
) {
  console.error('Usage: npm run auth:create-user -- username "Display Name" [OWNER|MANAGER|STAFF|STYLE_CONSULTANT|MASTER_TAILOR|QC_STAFF]');
  process.exit(1);
}

if (!process.stdin.isTTY || !process.stdout.isTTY) {
  console.error("Run this command in an interactive terminal.");
  process.exit(1);
}

function readHidden(label) {
  return new Promise((resolve, reject) => {
    let value = "";
    process.stdout.write(label);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    function finish(error) {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.off("data", onData);
      process.stdout.write("\n");
      if (error) reject(error);
      else resolve(value);
    }

    function onData(character) {
      if (character === "\u0003") return finish(new Error("Cancelled."));
      if (character === "\r" || character === "\n") return finish();
      if (character === "\u007f") {
        value = value.slice(0, -1);
        return;
      }
      value += character;
    }

    process.stdin.on("data", onData);
  });
}

try {
  const password = await readHidden("Password: ");
  const confirmation = await readHidden("Confirm password: ");
  if (password.length < 12) throw new Error("Use a password with at least 12 characters.");
  if (password !== confirmation) throw new Error("Passwords did not match.");
  const passwordHash = await bcrypt.hash(password, 12);
  const config = JSON.stringify([{ username, displayName, passwordHash, role }]);
  console.log(`AUTH_USERS_JSON_BASE64=${Buffer.from(config).toString("base64")}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Could not create password hash.");
  process.exit(1);
}
