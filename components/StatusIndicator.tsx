import { statusColorVar, statusLabel, type JobStatus } from "@/lib/status";

export default function StatusIndicator({ status }: { status: JobStatus }) {
  const v = statusColorVar(status);
  return (
    <span
      className="inline-flex items-center gap-2 text-[13px] font-normal"
      style={{ color: `var(${v})` }}
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
