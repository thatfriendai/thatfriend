export function TripPreviewCard() {
  const days = [
    { label: "SAT 20", items: ["Chill dinner and no rush — we're on Thursday"] },
    { label: "SUN 21", items: ["Market, Time Out Lisboa"] },
    { label: "MON 22", items: [] },
  ];

  return (
    <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-4 shadow-[0_20px_50px_-20px_oklch(0.3_0.05_50/0.35)]">
      <p className="text-[11px] tracking-wide text-muted">
        thatfriend.co/lisbon-sept
      </p>
      <div className="mt-3 flex flex-col gap-1">
        <p className="font-display text-xl text-ink">Lisbon &amp; the Algarve</p>
        <p className="text-xs text-muted">19&ndash;27 SEPT &middot; 6 TRAVELLERS</p>
      </div>

      <div className="mt-4 grid grid-cols-[64px_1fr] gap-3">
        <div className="flex flex-col gap-3">
          {days.map((day) => (
            <div key={day.label} className="flex flex-col items-start">
              <span className="text-[10px] font-medium tracking-wide text-muted">
                {day.label}
              </span>
              <span className="mt-1 h-8 w-px bg-border" />
            </div>
          ))}
        </div>
        <div className="relative rounded-xl bg-dark/90 p-3">
          <div className="absolute left-[18%] top-[30%] h-2.5 w-2.5 rounded-full border-2 border-white bg-accent" />
          <div className="absolute left-[55%] top-[55%] h-2.5 w-2.5 rounded-full border-2 border-white bg-accent-light" />
          <div className="absolute left-[38%] top-[75%] h-2.5 w-2.5 rounded-full border-2 border-white bg-dark-muted" />
          <div className="flex h-full min-h-[132px] items-end">
            <p className="rounded-lg bg-card px-2.5 py-1.5 text-[11px] text-ink shadow-sm">
              &ldquo;My friend Ana said this place is worth the night&rdquo;
            </p>
          </div>
        </div>
      </div>

      <p className="mt-3 text-[10px] uppercase tracking-wide text-muted">
        timeout.com &middot; saved by Maya
      </p>
    </div>
  );
}
