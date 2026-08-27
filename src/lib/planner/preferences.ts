export const INTERESTS = [
  "Long dinners",
  "Beaches",
  "Live music",
  "Markets",
  "Hiking",
  "Museums",
  "Surf",
  "Nothing scheduled",
  "Day trips",
] as const;

export const PACE_OPTIONS = [
  { key: "Slow", hint: "One thing a day" },
  { key: "Balanced", hint: "A plan, plus naps" },
  { key: "Packed", hint: "Up early, out late" },
] as const;

export const BUDGET_FIELDS = [
  {
    key: "stay_max",
    label: "Per night, your share",
    unit: "USD",
    min: 20,
    max: 300,
    step: 5,
    default: 110,
  },
  {
    key: "flight_max",
    label: "Flights, round trip",
    unit: "USD",
    min: 100,
    max: 1200,
    step: 10,
    default: 550,
  },
  {
    key: "food_max",
    label: "Food and going out, per day",
    unit: "USD",
    min: 20,
    max: 200,
    step: 5,
    default: 60,
  },
] as const;

export type BudgetFieldKey = (typeof BUDGET_FIELDS)[number]["key"];
