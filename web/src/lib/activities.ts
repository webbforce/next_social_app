export type ActivityTag =
  | "coffee"
  | "walk"
  | "food"
  | "gym"
  | "study"
  | "drinks"
  | "party"
  | "anything";

// `phrase` completes "Hana is up for ___"; `hours` is the default plan length (spec §3.2).
export const ACTIVITIES: { tag: ActivityTag; label: string; phrase: string; hours: number }[] = [
  { tag: "coffee", label: "Coffee", phrase: "coffee", hours: 1.5 },
  { tag: "walk", label: "Walk", phrase: "a walk", hours: 1.5 },
  { tag: "food", label: "Food", phrase: "food", hours: 2 },
  { tag: "gym", label: "Gym", phrase: "the gym", hours: 2 },
  { tag: "study", label: "Study", phrase: "studying", hours: 2 },
  { tag: "drinks", label: "Drinks", phrase: "drinks", hours: 5 },
  { tag: "party", label: "Party", phrase: "a party", hours: 5 },
  { tag: "anything", label: "Anything", phrase: "anything", hours: 3 },
];

export const FREE_TEXT_HOURS = 3;

export function isActivityTag(value: unknown): value is ActivityTag {
  return ACTIVITIES.some((a) => a.tag === value);
}
