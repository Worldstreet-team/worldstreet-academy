"use client"

export function GenericData({ data }: { data: unknown }) {
  if (!data) return <p className="text-sm text-muted-foreground">No data.</p>
  return (
    <pre className="text-xs text-muted-foreground bg-accent/10 p-4 rounded-2xl overflow-auto max-h-80 border border-border/20">
      {JSON.stringify(data, null, 2)}
    </pre>
  )
}
