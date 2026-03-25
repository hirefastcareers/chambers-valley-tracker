import { statusBadgeProps, type JobStatus } from "@/lib/status";

export default function StatusBadge({ status }: { status: JobStatus }) {
  const props = statusBadgeProps(status);
  return (
    <span
      className={[
        "inline-flex items-center px-3 py-1 rounded-[20px] text-[12px] font-semibold border animate-badge-pop",
        props.className,
      ].join(" ")}
    >
      {props.label}
    </span>
  );
}
