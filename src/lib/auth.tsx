import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Demo-only client-side auth. Accounts live in this browser's localStorage.
 * Not secure for production — replace with a real backend before launch.
 */
const USERS_KEY = "dronecores.users";
const SESSION_KEY = "dronecores.session";
export const MIN_PASSWORD_LENGTH = 8;
const GENERIC_ERROR = "Email or password is incorrect.";

export type AuthUser = { id: string; email: string; name: string };
type StoredUser = AuthUser & { salt: string; hash: string };
export type AuthStatus = "loading" | "signedIn" | "signedOut";
type Result = { ok: true; user: AuthUser } | { ok: false; error: string };

type AuthContextValue = {
  user: AuthUser | null;
  status: AuthStatus;
  signIn: (email: string, password: string) => Promise<Result>;
  signUp: (email: string, password: string, name?: string) => Promise<Result>;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown): boolean {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

const toHex = (buf: ArrayBuffer | Uint8Array) =>
  Array.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

async function hashPassword(password: string, salt: string) {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  return toHex(await crypto.subtle.digest("SHA-256", data));
}

const normalize = (email: string) => email.trim().toLowerCase();
const publicUser = (u: StoredUser): AuthUser => ({ id: u.id, email: u.email, name: u.name });

function loadSession(): AuthUser | null {
  const session = read<{ userId: string } | null>(SESSION_KEY, null);
  if (!session?.userId) return null;
  const found = read<StoredUser[]>(USERS_KEY, []).find((u) => u.id === session.userId);
  return found ? publicUser(found) : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    let cloudUser: AuthUser | null = null;
    const sync = () => {
      const u = loadSession() ?? cloudUser;
      setUser(u);
      setStatus(u ? "signedIn" : "signedOut");
    };
    const toUser = (s: { user: { id: string; email?: string; user_metadata?: Record<string, unknown> } } | null): AuthUser | null => {
      if (!s?.user) return null;
      const email = s.user.email ?? "";
      const meta = s.user.user_metadata ?? {};
      const name = String(meta.full_name ?? meta.name ?? email.split("@")[0] ?? "Pilot");
      return { id: s.user.id, email, name };
    };
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      cloudUser = toUser(session);
      sync();
    });
    supabase.auth.getSession().then(({ data }) => {
      cloudUser = toUser(data.session);
      sync();
    }).catch(() => sync());
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === SESSION_KEY || e.key === USERS_KEY) sync();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
      sub.subscription.unsubscribe();
    };
  }, []);

  const startSession = (u: StoredUser): Result => {
    write(SESSION_KEY, { userId: u.id });
    const pub = publicUser(u);
    setUser(pub);
    setStatus("signedIn");
    return { ok: true, user: pub };
  };

  const signIn = useCallback(async (email: string, password: string): Promise<Result> => {
    try {
      const found = read<StoredUser[]>(USERS_KEY, []).find((u) => u.email === normalize(email));
      if (!found) return { ok: false, error: GENERIC_ERROR };
      if ((await hashPassword(password, found.salt)) !== found.hash) return { ok: false, error: GENERIC_ERROR };
      return startSession(found);
    } catch {
      return { ok: false, error: GENERIC_ERROR };
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, name?: string): Promise<Result> => {
    const mail = normalize(email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail) || mail.length > 255)
      return { ok: false, error: "Enter a valid email address." };
    if (password.length < MIN_PASSWORD_LENGTH)
      return { ok: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
    try {
      const users = read<StoredUser[]>(USERS_KEY, []);
      if (users.some((u) => u.email === mail))
        return { ok: false, error: "An account with this email already exists." };
      const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
      const newUser: StoredUser = {
        id: crypto.randomUUID(),
        email: mail,
        name: (name ?? "").trim().slice(0, 100) || mail.split("@")[0] || "Pilot",
        salt,
        hash: await hashPassword(password, salt),
      };
      if (!write(USERS_KEY, [...users, newUser]))
        return { ok: false, error: "Your browser blocked saving the account." };
      return startSession(newUser);
    } catch {
      return { ok: false, error: "Could not create the account. Please try again." };
    }
  }, []);

  const signOut = useCallback(() => {
    write(SESSION_KEY, null);
    void supabase.auth.signOut().catch(() => {});
    setUser(null);
    setStatus("signedOut");
  }, []);

  const value = useMemo(() => ({ user, status, signIn, signUp, signOut }), [user, status, signIn, signUp, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
