import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const USERS_KEY = "dronecores.users";
const SESSION_KEY = "dronecores.session";
export const MIN_PASSWORD_LENGTH = 8;
const SIGN_IN_ERROR = "Email or password is incorrect.";

export type AuthUser = { id: string; email: string; name: string };
type StoredUser = AuthUser & { salt: string; passwordHash: string };
export type AuthStatus = "loading" | "signedIn" | "signedOut";
export type AuthResult = { ok: true; user: AuthUser } | { ok: false; error: string };

type AuthContextValue = {
  user: AuthUser | null;
  status: AuthStatus;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string, name?: string) => Promise<AuthResult>;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocal(key: string, value: unknown): boolean {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hashPassword(password: string, salt: string) {
  const bytes = new TextEncoder().encode(`${salt}:${password}`);
  return toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)));
}

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const publicUser = ({ id, email, name }: StoredUser): AuthUser => ({ id, email, name });

function currentSession(): AuthUser | null {
  const session = readLocal<{ userId: string } | null>(SESSION_KEY, null);
  if (!session?.userId) return null;
  const users = readLocal<StoredUser[]>(USERS_KEY, []);
  if (!Array.isArray(users)) return null;
  const user = users.find((entry) => entry.id === session.userId);
  return user ? publicUser(user) : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  const syncFromStorage = useCallback(() => {
    const nextUser = currentSession();
    setUser(nextUser);
    setStatus(nextUser ? "signedIn" : "signedOut");
  }, []);

  useEffect(() => {
    syncFromStorage();
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === USERS_KEY || event.key === SESSION_KEY) {
        syncFromStorage();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [syncFromStorage]);

  const startSession = useCallback((stored: StoredUser): AuthResult => {
    if (!writeLocal(SESSION_KEY, { userId: stored.id })) {
      return { ok: false, error: "Your browser could not save this demo session." };
    }
    const nextUser = publicUser(stored);
    setUser(nextUser);
    setStatus("signedIn");
    return { ok: true, user: nextUser };
  }, []);

  const signIn = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      try {
        const normalized = normalizeEmail(email);
        const stored = readLocal<StoredUser[]>(USERS_KEY, []).find(
          (entry) => entry.email === normalized,
        );
        if (!stored || (await hashPassword(password, stored.salt)) !== stored.passwordHash) {
          return { ok: false, error: SIGN_IN_ERROR };
        }
        return startSession(stored);
      } catch {
        return { ok: false, error: SIGN_IN_ERROR };
      }
    },
    [startSession],
  );

  const signUp = useCallback(
    async (email: string, password: string, name = ""): Promise<AuthResult> => {
      const normalized = normalizeEmail(email);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || normalized.length > 255) {
        return { ok: false, error: "Enter a valid email address." };
      }
      if (password.length < MIN_PASSWORD_LENGTH) {
        return {
          ok: false,
          error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
        };
      }

      try {
        const users = readLocal<StoredUser[]>(USERS_KEY, []);
        if (users.some((entry) => entry.email === normalized)) {
          return { ok: false, error: "An account with this email already exists." };
        }
        const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
        const stored: StoredUser = {
          id: crypto.randomUUID(),
          email: normalized,
          name: name.trim().slice(0, 100) || normalized.split("@")[0] || "Pilot",
          salt,
          passwordHash: await hashPassword(password, salt),
        };
        if (!writeLocal(USERS_KEY, [...users, stored])) {
          return { ok: false, error: "Your browser blocked saving the account." };
        }
        return startSession(stored);
      } catch {
        return { ok: false, error: "Could not create the account. Please try again." };
      }
    },
    [startSession],
  );

  const signOut = useCallback(() => {
    writeLocal(SESSION_KEY, null);
    setUser(null);
    setStatus("signedOut");
  }, []);

  const value = useMemo(
    () => ({ user, status, signIn, signUp, signOut }),
    [user, status, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
