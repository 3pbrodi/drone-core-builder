/**
 * Full-screen hint shown when a touch device (iPad etc.) is held in portrait.
 * Pure CSS via `portrait` + `pointer-coarse` variants, so there is no JS state
 * and no hydration mismatch. Desktop windows are unaffected.
 */
export function RotatePrompt() {
  return (
    <div
      className="fixed inset-0 z-100 hidden flex-col items-center justify-center gap-6 bg-background px-8 text-center portrait:flex"
      role="status"
      aria-live="polite"
    >
      <div className="flex h-28 w-28 items-center justify-center rounded-4xl bg-brand-soft">
        <svg
          width="56"
          height="56"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="animate-rotate-device text-primary"
          aria-hidden="true"
        >
          <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
          <path d="M11 18.5h2" />
        </svg>
      </div>
      <div className="max-w-sm">
        <p className="font-display text-2xl font-bold text-foreground">
          Please rotate your device
        </p>
        <p className="mt-2 text-base text-muted-foreground">
          DroneCores is built for landscape. Turn your device sideways to
          continue.
        </p>
      </div>
      <div className="flex items-center gap-2 rounded-full bg-brand-soft px-4 py-2 text-sm font-medium text-secondary-foreground">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 12a9 9 0 1 1-9-9" />
          <path d="M21 3v6h-6" />
        </svg>
        Rotate 90°
      </div>
    </div>
  );
}
