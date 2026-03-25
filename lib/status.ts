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
        className:
          "bg-amber-100 text-amber-800 border-amber-200",
      };
    case "booked":
      return {
        label: "Booked",
        className: "bg-blue-100 text-blue-800 border-blue-200",
      };
    case "completed":
      return {
        label: "Completed",
        className: "bg-green-100 text-[#2d6a4f] border-green-200",
      };
    case "needs_follow_up":
      return {
        label: "Needs follow-up",
        className: "bg-red-100 text-red-700 border-red-200",
      };
  }
}

