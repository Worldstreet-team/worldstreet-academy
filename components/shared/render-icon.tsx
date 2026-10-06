import { type IconComponent, type IconProps } from "@/components/icons"

/**
 * Renders a lucide icon chosen at runtime (ternaries, config maps).
 * Static call sites should use the lucide component directly.
 */
export function RenderIcon({ icon: Icon, ...props }: IconProps & { icon: IconComponent }) {
  return <Icon {...props} />
}
