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
        className: "bg-[#fef3c7] text-[#92400e] border-[#fcd34d]",
      };
    case "booked":
      return {
        label: "Booked",
        className: "bg-[#dbeafe] text-[#1e40af] border-[#93c5fd]",
      };
    case "completed":
      return {
        label: "Completed",
        className: "bg-[#d1fae5] text-[#065f46] border-[#6ee7b7]",
      };
    case "needs_follow_up":
      return {
        label: "Needs follow-up",
        className: "bg-[#fee2e2] text-[#991b1b] border-[#fca5a5]",
      };
  }
}
