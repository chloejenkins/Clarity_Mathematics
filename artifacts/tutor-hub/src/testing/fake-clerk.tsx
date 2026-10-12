// Test-only stand-in for "@clerk/clerk-react", used by the e2e harness (see /e2e).
//
// vite.config.ts aliases "@clerk/clerk-react" to this file only when
// VITE_E2E_AUTH=1, so normal and production builds use the real Clerk SDK.
//
// The signed-in persona is read from localStorage["e2e-identity"]; the harness
// writes it before loading the page. The token sent to the API is
// `e2e.<base64url identity>`, which the API's fake Clerk accepts.
import { useEffect, useSyncExternalStore, type ReactNode } from "react";

interface Identity {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
}

interface FakeUser {
  id: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string;
  publicMetadata: Record<string, unknown>;
  primaryEmailAddress: { emailAddress: string } | null;
  reload: () => Promise<void>;
}

interface State {
  isLoaded: boolean;
  user: FakeUser | null;
}

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

function readIdentity(): Identity | null {
  try {
    const raw = localStorage.getItem("e2e-identity");
    return raw ? (JSON.parse(raw) as Identity) : null;
  } catch {
    return null;
  }
}

function tokenFor(identity: Identity): string {
  const bytes = new TextEncoder().encode(JSON.stringify(identity));
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return "e2e." + btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

let state: State = { isLoaded: false, user: null };
const listeners = new Set<() => void>();
function setState(next: State) {
  state = next;
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

async function load(): Promise<void> {
  const identity = readIdentity();
  if (!identity) {
    document.cookie = "__session=; path=/; max-age=0";
    setState({ isLoaded: true, user: null });
    return;
  }
  const token = tokenFor(identity);
  // Mirrors Clerk's __session cookie so plain fetch(..., {credentials}) works.
  document.cookie = `__session=${token}; path=/`;
  const res = await fetch(`${BASE}/api/__e2e/clerk-user`, { headers: { Authorization: `Bearer ${token}` } });
  const data = res.ok ? await res.json() : { publicMetadata: {} };
  setState({
    isLoaded: true,
    user: {
      id: identity.id,
      username: identity.username ?? null,
      firstName: identity.firstName ?? null,
      lastName: identity.lastName ?? null,
      imageUrl: "",
      publicMetadata: data.publicMetadata ?? {},
      primaryEmailAddress: { emailAddress: identity.email },
      reload: load,
    },
  });
}

let started = false;
function ensureStarted() {
  if (started) return;
  started = true;
  void load();
}

function useFakeState(): State {
  useEffect(ensureStarted, []);
  return useSyncExternalStore(subscribe, () => state);
}

export function ClerkProvider({ children }: { children: ReactNode; [key: string]: unknown }) {
  ensureStarted();
  return <>{children}</>;
}

export function useUser() {
  const { isLoaded, user } = useFakeState();
  return { isLoaded, isSignedIn: Boolean(user), user };
}

export function useAuth() {
  const { isLoaded, user } = useFakeState();
  return { isLoaded, isSignedIn: Boolean(user), userId: user?.id ?? null };
}

export function useSession() {
  const { user } = useFakeState();
  const identity = user ? readIdentity() : null;
  return {
    isLoaded: state.isLoaded,
    session: identity ? { getToken: async () => tokenFor(identity) } : null,
  };
}

export function useClerk() {
  return {
    openSignIn: () => {
      window.dispatchEvent(new CustomEvent("e2e:open-sign-in"));
    },
    openUserProfile: () => {
      window.dispatchEvent(new CustomEvent("e2e:open-user-profile"));
    },
    signOut: async () => {
      localStorage.removeItem("e2e-identity");
      await load();
      window.location.assign(`${BASE}/`);
    },
  };
}
