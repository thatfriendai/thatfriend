/** Read-only star display. For an interactive input, see ReviewsBoard's local StarInput. */
export function Stars({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <span className="font-mono text-[13px] tracking-wide text-accent" aria-label={`${value} of ${max} stars`}>
      {"★".repeat(value)}
      <span className="text-border">{"★".repeat(Math.max(0, max - value))}</span>
    </span>
  );
}
