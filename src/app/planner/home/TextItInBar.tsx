export function TextItInBar({ smsNumber }: { smsNumber: string | null }) {
  return (
    <div className="mb-11 flex flex-wrap items-center gap-7 rounded-[18px] border border-warm-border bg-warm-bg px-8 py-7.5">
      <div className="min-w-[280px] flex-1">
        <div className="mb-2.5 font-mono text-[11px] tracking-[0.14em] text-accent uppercase">Text it in</div>
        <div className="mb-2 font-display text-[30px] leading-[1.15] text-ink">Forward any link to That Friend</div>
        <div className="max-w-[42em] text-[16.5px] leading-[1.55] text-body text-pretty">
          Talk with That Friend about the itinerary and send places to be added.
        </div>
      </div>
      {smsNumber ? (
        <a
          href={`sms:${smsNumber}`}
          className="flex-none rounded-full bg-ink px-7 py-3.5 text-[16px] text-cream hover:bg-accent"
        >
          Start texting
        </a>
      ) : (
        <span className="flex-none rounded-full bg-ink px-7 py-3.5 text-[16px] text-cream opacity-50">
          Start texting
        </span>
      )}
    </div>
  );
}
