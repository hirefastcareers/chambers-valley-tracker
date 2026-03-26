export type JobStatus = "quoted" | "booked" | "completed" | "needs_follow_up";

export const JOB_STATUS_OPTIONS: { value: JobStatus; label: string }[] = [
  { value: "quoted", label: "Quoted" },
  { value: "booked", label: "Booked" },
  { value: "completed", label: "Completed" },
  { value: "needs_follow_up", label: "Needs follow-up" },
];

export function statusBadgeProps(status: JobStatus) {
  switch (status) {
    case "quoted":
      return {
        label: "Quoted",
        className: "bg-[var(--color-warning-bg)] text-[var(--color-warning-text)] border-[#fcd34d]",
      };
    case "booked":
      return {
        label: "Booked",
        className: "bg-[var(--color-info-bg)] text-[var(--color-info-text)] border-[#93c5fd]",
      };
    case "completed":
      return {
        label: "Completed",
        className: "bg-[var(--color-success-bg)] text-[var(--color-success-text)] border-[#6ee7b7]",
      };
    case "needs_follow_up":
      return {
        label: "Needs follow-up",
        className: "bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] border-[#fca5a5]",
      };
    default: {
      const _exhaustive: never = status;
      return {
        label: String(_exhaustive),
        className: "bg-[var(--color-surface)] text-[var(--color-text-muted)] border-[var(--color-border)]",
      };
    }
  }
}
