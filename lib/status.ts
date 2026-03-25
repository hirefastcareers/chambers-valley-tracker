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
        className: "bg-[var(--color-amber-bg)] text-[var(--color-amber)] border-[var(--color-border)]",
      };
    case "booked":
      return {
        label: "Booked",
        className: "bg-[var(--color-blue-bg)] text-[var(--color-blue)] border-[var(--color-border)]",
      };
    case "completed":
      return {
        label: "Completed",
        className: "bg-[var(--color-primary-pale)] text-[var(--color-primary)] border-[var(--color-border)]",
      };
    case "needs_follow_up":
      return {
        label: "Needs follow-up",
        className: "bg-[var(--color-red-bg)] text-[var(--color-red)] border-[var(--color-border)]",
      };
  }
}
