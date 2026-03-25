import { statusBadgeProps, type JobStatus } from "@/lib/status";

export default function StatusBadge({ status }: { status: JobStatus }) {
  const props = statusBadgeProps(status);
  return (
    <span
      className={[
        "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border animate-badge-pop",
        props.className,
      ].join(" ")}
    >
      {props.label}
    </span>
  );
}
