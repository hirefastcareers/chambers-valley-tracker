import { statusColorVar, statusLabel, type JobStatus } from "@/lib/status";

const STATUS_PILL_BG: Record<JobStatus, string> = {
  quoted: "#fef3c7",
  completed: "#dcfce7",
  booked: "#dbeafe",
  needs_follow_up: "#fee2e2",
};

export default function StatusIndicator({ status }: { status: JobStatus }) {
  const v = statusColorVar(status);
  const bg = STATUS_PILL_BG[status];
  return (
    <span
      className="inline-flex items-center gap-2 rounded-[20px] py-[3px] px-[10px] text-[12px] font-normal"
      style={{
        backgroundColor: bg,
        color: `var(${v})`,
      }}
    >
      <span
        className="h-[6px] w-[6px] shrink-0 rounded-full"
        style={{ backgroundColor: `var(${v})` }}
        aria-hidden
      />
      {statusLabel(status)}
    </span>
  );
}
