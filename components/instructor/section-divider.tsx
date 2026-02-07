export function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 pt-1 pb-2">
      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider shrink-0">
        {label}
      </span>
      <div className="h-px flex-1 bg-border" />
    </div>
  )
}
