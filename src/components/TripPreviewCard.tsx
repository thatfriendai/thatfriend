const days = [
  { label: "SAT 20", text: "Alfama walk\nDinner, Ramiro" },
  { label: "SUN 21", text: "Market\nTrain to Lagos" },
  { label: "MON 22", text: "open" },
];

const pins = [
  { left: "26%", top: "24%", color: "#8A5A7A" },
  { left: "52%", top: "41%", color: "#8A5A7A" },
  { left: "34%", top: "63%", color: "#1B1917" },
  { left: "66%", top: "76%", color: "#6E8C6A" },
];

export function TripPreviewCard({ dark = false }: { dark?: boolean }) {
  const chromeBg = dark ? "#232120" : "var(--color-card)";
  const chromeBorder = dark ? "#2F2C2B" : "var(--color-border-soft)";
  const paneBg = dark ? "var(--color-dark)" : "var(--color-card)";
  const textInk = dark ? "#F2EDE4" : "var(--color-ink)";
  const textMuted = dark ? "#7E766C" : "var(--color-muted)";
  const aiBoxBg = dark ? "#2B2430" : "var(--color-warm-bg)";
  const aiBoxBorder = dark ? "#4A3F48" : "var(--color-warm-border)";
  const mapBg = dark ? "#262423" : "#EFEDE4";
  const mapGrid = dark ? "#2C2A29" : "#E6E3D7";
  const dayBorder = dark ? "#2F2C2B" : "var(--color-border)";
  const dayPanelBg = dark ? "var(--color-dark)" : "#FBF9F3";

  return (
    <div
      className="w-full max-w-sm overflow-hidden rounded-2xl border"
      style={{ borderColor: dayBorder, background: paneBg }}
    >
      <div
        className="flex items-center gap-1.5 border-b px-3.5 py-2.5"
        style={{ borderColor: chromeBorder, background: chromeBg }}
      >
        <span className="h-2 w-2 rounded-full" style={{ background: chromeBorder }} />
        <span className="h-2 w-2 rounded-full" style={{ background: chromeBorder }} />
        <span className="h-2 w-2 rounded-full" style={{ background: chromeBorder }} />
        <span className="ml-2 font-mono text-[10px]" style={{ color: textMuted }}>
          thatfriend.co/lisbon-sept
        </span>
      </div>
      <div className="grid h-[290px] grid-cols-[1.1fr_1fr]">
        <div className="flex flex-col gap-2.5 overflow-hidden p-4">
          <p className="text-[15px] leading-tight font-display" style={{ color: textInk }}>
            Lisbon &amp; the Algarve
          </p>
          <p className="font-mono text-[8.5px]" style={{ color: textMuted }}>
            19&ndash;27 SEPT &middot; 6 TRAVELLERS
          </p>
          <div className="rounded-lg border px-2.5 py-2" style={{ background: aiBoxBg, borderColor: aiBoxBorder }}>
            <p className="mb-1 font-mono text-[8px] tracking-wide" style={{ color: textMuted }}>
              THAT FRIEND
            </p>
            <p className="text-[10px] leading-snug" style={{ color: textInk }}>
              Day 3 has three dinners and no lunch. Want me to move one to
              Thursday?
            </p>
          </div>
          <div
            className="flex items-center gap-2 rounded-lg border px-2.5 py-2"
            style={{ borderColor: dayBorder, background: dark ? "#232120" : "var(--color-card)" }}
          >
            <div
              className="h-6.5 w-6.5 flex-none rounded"
              style={{
                backgroundImage: `repeating-linear-gradient(135deg, ${mapBg} 0 3px, ${dark ? "#2B2928" : "#FFFDF9"} 3px 6px)`,
              }}
            />
            <div className="min-w-0">
              <p className="text-[9.5px] leading-tight font-medium" style={{ color: textInk }}>
                Time Out Market &middot; Cais do Sodr&eacute;
              </p>
              <p className="mt-0.5 font-mono text-[7.5px]" style={{ color: textMuted }}>
                timeout.com &middot; saved by Maya
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span
              className="mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full text-[6.5px] text-cream"
              style={{ background: dark ? "#4A453E" : "#1B1917" }}
            >
              TN
            </span>
            <p className="text-[9.5px] leading-snug italic" style={{ color: textMuted }}>
              &ldquo;My friend Ana runs a place in Alfama, worth one
              night.&rdquo;
            </p>
          </div>
        </div>
        <div
          className="relative border-l bg-[length:30px_30px]"
          style={{
            borderColor: dayBorder,
            background: mapBg,
            backgroundImage: `linear-gradient(${mapGrid} 1px, transparent 1px), linear-gradient(90deg, ${mapGrid} 1px, transparent 1px)`,
          }}
        >
          {pins.map((pin, i) => (
            <span
              key={i}
              className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
              style={{ left: pin.left, top: pin.top, background: pin.color, borderColor: paneBg }}
            />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2 border-t p-3" style={{ borderColor: dayBorder, background: dayPanelBg }}>
        {days.map((d) => (
          <div key={d.label} className="flex items-baseline gap-2.5">
            <span className="w-14 font-mono text-[8.5px] tracking-wide" style={{ color: textMuted }}>
              {d.label}
            </span>
            <span className="text-[10px] leading-tight whitespace-pre-line" style={{ color: textInk }}>
              {d.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
