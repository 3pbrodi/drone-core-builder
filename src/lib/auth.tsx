import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";

export const MIN_PASSWORD_LENGTH = 8;

export type AuthUser = { id: string; email: string; name: string };
export type AuthStatus = "loading" | "signedIn" | "signedOut";
export type AuthResult = { ok: true; user?: AuthUser | undefined; needsConfirmation?: boolean } | { ok: false; error: string };

type AuthContextValue = {
  user: AuthUser | null;
  status: AuthStatus;
  passwordRecovery: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string, name?: string) => Promise<AuthResult>;
  signOut: () => void;
  requestPasswordReset: (email: string) => Promise<AuthResult>;
  updatePassword: (password: string) => Promise<AuthResult>;
  finishPasswordRecovery: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function toAuthUser(user: SupabaseUser): AuthUser {
  const email = user.email ?? "";
  const metadataName = user.user_metadata?.["name"];
  const name =
    typeof metadataName === "string" && metadataName.trim()
      ? metadataName.trim()
      : email.split("@")[0] || "Pilot";
  return { id: user.id, email, name };
}

function unavailable(): AuthResult {
  return {
    ok: false,
    error: "Sign-in is not configured yet. Please try again later.",
  };
}

function signInError(error: { code?: string | undefined; message?: string | undefined }): string {
  if (error.code === "email_not_confirmed") {
    return "Please confirm your email first. Check your inbox.";
  }
  if (/fetch|network/i.test(error.message ?? "")) {
    return "Could not reach the sign-in service. Check your connection and try again.";
  }
  return "Email or password is incorrect.";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [supabase] = useState(() => getSupabase());
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setStatus("signedOut");
      return;
    }

    let active = true;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      setUser(session ? toAuthUser(session.user) : null);
      setStatus(session ? "signedIn" : "signedOut");
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
      if (event === "SIGNED_OUT") setPasswordRecovery(false);
    });

    void supabase.auth.getSession().then(({ data: sessionData }) => {
      if (!active) return;
      setUser(sessionData.session ? toAuthUser(sessionData.session.user) : null);
      setStatus(sessionData.session ? "signedIn" : "signedOut");
    }).catch(() => {
      if (!active) return;
      setUser(null);
      setStatus("signedOut");
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [supabase]);

  const signIn = useCallback<AuthContextValue["signIn"]>(
    async (email, password) => {
      if (!supabase) return unavailable();
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) return { ok: false, error: signInError(error) };
        return { ok: true, user: data.user ? toAuthUser(data.user) : undefined };
      } catch {
        return { ok: false, error: "Could not reach the sign-in service. Check your connection and try again." };
      }
    },
    [supabase],
  );

  const signUp = useCallback<AuthContextValue["signUp"]>(
    async (email, password, name = "") => {
      if (!supabase) return unavailable();
      if (password.length < MIN_PASSWORD_LENGTH) {
        return { ok: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
      }
      try {
        const normalizedEmail = email.trim();
        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: { name: name.trim().slice(0, 100) },
            emailRedirectTo: `${window.location.origin}/login`,
          },
        });
        if (error) return { ok: false, error: error.message };
        if (data.user && data.user.identities?.length === 0) {
          return { ok: false, error: "An account with this email already exists. Try signing in." };
        }
        return data.session
          ? { ok: true, user: data.user ? toAuthUser(data.user) : undefined }
          : { ok: true, needsConfirmation: true };
      } catch {
        return { ok: false, error: "Could not create your account. Check your connection and try again." };
      }
    },
    [supabase],
  );

  const requestPasswordReset = useCallback<AuthContextValue["requestPasswordReset"]>(
    async (email) => {
      if (!supabase) return unavailable();
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        return error ? { ok: false, error: error.message } : { ok: true };
      } catch {
        return { ok: false, error: "Could not send the reset request. Check your connection and try again." };
      }
    },
    [supabase],
  );

  const updatePassword = useCallback<AuthContextValue["updatePassword"]>(
    async (password) => {
      if (!supabase) return unavailable();
      if (password.length < MIN_PASSWORD_LENGTH) {
        return { ok: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
      }
      try {
        const { error } = await supabase.auth.updateUser({ password });
        return error ? { ok: false, error: error.message } : { ok: true };
      } catch {
        return { ok: false, error: "Could not update the password. Request a new reset email and try again." };
      }
    },
    [supabase],
  );

  const signOut = useCallback(() => {
    if (!supabase) return;
    void supabase.auth.signOut();
  }, [supabase]);

  const finishPasswordRecovery = useCallback(() => setPasswordRecovery(false), []);

  const value = useMemo(
    () => ({
      user,
      status,
      passwordRecovery,
      signIn,
      signUp,
      signOut,
      requestPasswordReset,
      updatePassword,
      finishPasswordRecovery,
    }),
    [user, status, passwordRecovery, signIn, signUp, signOut, requestPasswordReset, updatePassword, finishPasswordRecovery],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
