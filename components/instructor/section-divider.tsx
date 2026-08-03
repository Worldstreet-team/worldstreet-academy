export function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 pb-2 pt-1">
      <span className="shrink-0 text-[11px] font-medium uppercase tracking-wider text-ws-muted">
        {label}
      </span>
      <div className="h-px flex-1 bg-ws-hairline" />
    </div>
  )
}
