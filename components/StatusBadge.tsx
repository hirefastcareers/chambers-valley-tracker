import { statusBadgeProps, type JobStatus } from "@/lib/status";

export default function StatusBadge({ status }: { status: JobStatus }) {
  const props = statusBadgeProps(status);
  return (
    <span
      className={[
        "inline-flex items-center px-[10px] py-[3px] rounded-[20px] text-[11px] font-semibold uppercase tracking-[0.04em] border animate-badge-pop",
        props.className,
      ].join(" ")}
    >
      {props.label}
    </span>
  );
}
