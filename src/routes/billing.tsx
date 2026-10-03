import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { RequireAuth } from "@/components/RequireAuth";

export const Route = createFileRoute("/billing")({
  head: () => ({
    meta: [
      { title: "Billing — DroneCores" },
      { name: "description", content: "Billing for DroneCores." },
    ],
  }),
  component: BillingPage,
});

function BillingPage() {
  return (
    <RequireAuth>
      <PageShell
        title="Billing"
        description="Billing is not available in the demo yet."
      >
        <p className="text-sm text-muted-foreground">
          Plans and payments will appear here once a backend is connected.
        </p>
      </PageShell>
    </RequireAuth>
  );
}
