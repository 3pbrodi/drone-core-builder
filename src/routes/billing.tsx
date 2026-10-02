import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { RequireAuth } from "@/components/RequireAuth";

export const Route = createFileRoute("/billing")({
  head: () => ({
    meta: [
      { title: "Billing — DroneCores" },
      { name: "description", content: "Manage your DroneCores plan." },
      { property: "og:title", content: "Billing — DroneCores" },
      { property: "og:description", content: "Manage your DroneCores plan." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireAuth>
      <PageShell eyebrow="Account" title="Billing" description="Plans and payments are coming soon.">
        <p className="text-sm text-muted-foreground">Billing is not available in the demo yet.</p>
      </PageShell>
    </RequireAuth>
  ),
});
