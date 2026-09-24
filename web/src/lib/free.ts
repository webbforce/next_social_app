export const FREE_INTENTS = ["coffee", "food", "drinks", "anything"] as const;

export type FreeIntent = (typeof FREE_INTENTS)[number];

export const FREE_INTENT_LABEL: Record<FreeIntent, string> = {
  coffee: "Coffee",
  food: "Food",
  drinks: "Drinks",
  anything: "Anything",
};

export function isFreeIntent(value: unknown): value is FreeIntent {
  return FREE_INTENTS.includes(value as FreeIntent);
}

export function sharedFreeTag(intents: (FreeIntent | null)[]): FreeIntent {
  const set = new Set(intents.filter((intent): intent is FreeIntent => !!intent));
  if (set.size === 1) return [...set][0];
  return "anything";
}