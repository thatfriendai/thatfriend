export interface OptionTally {
  id: string;
  label: string;
  count: number;
}

export interface DecisionOutcome {
  isTied: boolean;
  decidedOptionId: string | null;
  leaders: OptionTally[];
}

/**
 * Picks the winner of a closed decision from its options' vote tallies, in
 * listed order (position, then creation — the same order the caller must
 * pass options in). A genuine tie (two or more options sharing the top,
 * nonzero count) returns no winner rather than silently taking the
 * first-listed one — see close/route.ts and P2-2 in KNOWN_ISSUES.md. Zero
 * votes cast isn't a tie in the useful sense (every option is "tied" at 0),
 * so that case still resolves to the first-listed option.
 */
export function computeDecisionOutcome(optionsInOrder: OptionTally[]): DecisionOutcome {
  const maxCount = optionsInOrder.reduce((m, o) => Math.max(m, o.count), 0);
  const leaders = optionsInOrder.filter((o) => o.count === maxCount);
  const isTied = maxCount > 0 && leaders.length > 1;
  return {
    isTied,
    decidedOptionId: isTied ? null : (leaders[0]?.id ?? null),
    leaders,
  };
}
