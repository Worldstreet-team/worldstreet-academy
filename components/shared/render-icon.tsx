import type { LucideIcon, LucideProps } from "lucide-react"

/**
 * Renders a lucide icon chosen at runtime (ternaries, config maps).
 * Static call sites should use the lucide component directly.
 */
export function RenderIcon({ icon: Icon, ...props }: LucideProps & { icon: LucideIcon }) {
  return <Icon {...props} />
}
