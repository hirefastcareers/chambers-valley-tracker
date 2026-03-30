export type JobStatus = "quoted" | "booked" | "completed" | "needs_follow_up";

export const JOB_STATUS_OPTIONS: { value: JobStatus; label: string }[] = [
  { value: "quoted", label: "Quoted" },
  { value: "booked", label: "Booked" },
  { value: "completed", label: "Completed" },
  { value: "needs_follow_up", label: "Needs follow-up" },
];

/** CSS variable for status dot + label colour (functional status colours). */
export function statusColorVar(status: JobStatus): string {
  switch (status) {
    case "quoted":
      return "--c-warning";
    case "booked":
      return "--c-info";
    case "completed":
      return "--c-success";
    case "needs_follow_up":
      return "--c-danger";
    default: {
      const _exhaustive: never = status;
      return String(_exhaustive);
    }
  }
}

export function statusLabel(status: JobStatus): string {
  const found = JOB_STATUS_OPTIONS.find((o) => o.value === status);
  return found?.label ?? status;
}
