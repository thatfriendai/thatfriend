const days = [
  { label: "FRI 19", city: "Lisbon", color: "#8A5A7A", items: ["Land, drop bags in Alfama", "Dinner, Ramiro"] },
  { label: "SAT 20", city: "Lisbon", color: "#6E8C6A", items: ["Alfama walk", "Time Out Market"] },
  { label: "SUN 21", city: "Lisbon", color: "#B4664A", items: ["Market, open afternoon"] },
  { label: "MON 22", city: "Lagos", color: "#3F6E7A", items: ["Train to Lagos"] },
];

const pins = [
  { left: "58%", top: "30%", color: "#8A5A7A", active: true },
  { left: "44%", top: "48%", color: "#6E8C6A", active: false },
  { left: "63%", top: "60%", color: "#B4664A", active: false },
  { left: "22%", top: "72%", color: "#3F6E7A", active: false },
];

/**
 * A faithful miniature of the real itinerary board (day rail + map,
 * ItineraryBoard.tsx / PlaceMapView.tsx) recolored for the dark
 * "workspace" marketing section — same technique as TripPreviewCard,
 * not a generic placeholder.
 */
export function WorkspacePreviewCard() {
  return (
    <div className="grid h-[400px] grid-cols-[1.1fr_1fr] overflow-hidden rounded-2xl border border-dark-border">
      <div
        className="relative"
        style={{
          background: "#1B1917",
          backgroundImage:
            "linear-gradient(#242220 1px, transparent 1px), linear-gradient(90deg, #242220 1px, transparent 1px)",
          backgroundSize: "26px 26px",
        }}
      >
        {pins.map((p, i) => (
          <div
            key={i}
            className="absolute flex items-center justify-center rounded-full border-2 font-mono text-[10px] transition-all"
            style={{
              left: p.left,
              top: p.top,
              width: p.active ? 22 : 11,
              height: p.active ? 22 : 11,
              margin: p.active ? "-11px 0 0 -11px" : "-5.5px 0 0 -5.5px",
              background: p.color,
              borderColor: "#1B1917",
              color: "#F7F4EE",
              opacity: p.active ? 1 : 0.55,
              boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
            }}
          >
            {p.active ? "1" : ""}
          </div>
        ))}
        <div className="absolute bottom-3 left-3 rounded-md border border-dark-border bg-dark-panel px-2.5 py-1.5 font-mono text-[10px] text-dark-body">
          19&ndash;27 SEPT &middot; Lisbon &amp; the Algarve
        </div>
      </div>

      <div className="flex flex-col gap-2 overflow-hidden bg-dark-panel p-3.5">
        <div className="mb-0.5 font-mono text-[10px] tracking-[0.12em] text-muted uppercase">
          Itinerary
        </div>
        {days.map((d) => (
          <div
            key={d.label}
            className="rounded-[10px] border px-3 py-2.5"
            style={{ borderColor: "#2F2C2B", borderLeft: `3px solid ${d.color}` }}
          >
            <div className="mb-1.5 flex items-center gap-2">
              <span className="font-mono text-[10px] tracking-[0.1em] text-dark-body">{d.label}</span>
              <span className="ml-auto text-[10.5px] text-muted">{d.city}</span>
            </div>
            <div className="flex flex-col gap-1">
              {d.items.map((item) => (
                <div key={item} className="text-[12.5px] leading-[1.4] text-cream">
                  {item}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
