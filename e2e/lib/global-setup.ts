import { resetDatabase } from "./db";
import { API_URL } from "./session";

export default async function globalSetup() {
  await resetDatabase();
  // The fake Clerk keeps users' metadata in memory, like Clerk would; clear it too.
  const res = await fetch(`${API_URL}/api/__e2e/reset`, { method: "POST" });
  if (!res.ok) throw new Error(`Could not reset the fake Clerk (${res.status}); is the stack running with E2E_AUTH_BYPASS=1?`);
}
