import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (status === "signedOut") {
      navigate({ to: "/login", search: { redirect: "/billing" }, replace: true });
    }
  }, [status, navigate]);

  if (status !== "signedIn") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
        Loading your account…
      </div>
    );
  }
  return <>{children}</>;
}
