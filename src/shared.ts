// Approval string to be shared across frontend and backend
export const APPROVAL = {
  YES: "Yes, confirmed.",
  NO: "No, denied.",
} as const;

// Event types for agent storage updates
export const STORAGE_EVENTS = {
  SCHEDULE_UPDATED: "schedule_updated",
  SCHEDULE_REMOVED: "schedule_removed",
} as const;
