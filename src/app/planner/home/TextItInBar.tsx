import { formatPhoneDisplay } from "@/lib/planner/phone";

export function TextItInBar({ smsNumber, isIOS }: { smsNumber: string | null; isIOS: boolean }) {
  // A blank compose window leaves a new texter staring at an empty box with
  // no idea what to send — prefill something that reads like a real first
  // message and, once sent, is itself what flips their consent on (see
  // recordConsentEvent in src/lib/planner/consent.ts: any inbound text
  // counts). Same iOS-vs-other "&body=" quirk as src/app/j/[token].
  const draft = "Hi, I'd like to start texting with That Friend!";
  const smsHref = smsNumber
    ? isIOS
      ? `sms:${smsNumber}&body=${encodeURIComponent(draft)}`
      : `sms:${smsNumber}?body=${encodeURIComponent(draft)}`
    : null;

  return (
    <div className="mb-11 flex flex-wrap items-center gap-7 rounded-[18px] border border-warm-border bg-warm-bg px-8 py-7.5">
      <div className="min-w-[280px] flex-1">
        <div className="mb-2.5 font-mono text-[11px] tracking-[0.14em] text-accent uppercase">Text it in</div>
        <div className="mb-2 font-display text-[30px] leading-[1.15] text-ink">Forward any link to That Friend</div>
        <div className="max-w-[42em] text-[16.5px] leading-[1.55] text-body text-pretty">
          Talk with That Friend about the itinerary and send places to be added.
          {smsNumber && ` You can change how often we text you anytime in Settings.`}
        </div>
      </div>
      {smsHref ? (
        <div className="flex flex-none flex-col items-end gap-1.5">
          <a
            href={smsHref}
            className="flex-none rounded-full bg-ink px-7 py-3.5 text-[16px] text-cream hover:bg-accent"
          >
            Start texting
          </a>
          <span className="text-[12.5px] text-muted">
            Or text {smsNumber && formatPhoneDisplay(smsNumber)} yourself
          </span>
        </div>
      ) : (
        <span className="flex-none rounded-full bg-ink px-7 py-3.5 text-[16px] text-cream opacity-50">
          Start texting
        </span>
      )}
    </div>
  );
}
