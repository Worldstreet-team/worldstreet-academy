import { BlocksIcon, BotIcon, BriefcaseIcon, ChartColumnIcon, ClapperboardIcon, CodeIcon, GraduationCapIcon, LandmarkIcon, LightbulbIcon, PaletteIcon, ShieldCheckIcon, UsersIcon, type IconComponent, type IconProps } from "@/components/icons"
import { RenderIcon } from "@/components/shared/render-icon"

/**
 * `School.icon` (lib/schools.ts) is a lucide NAME so the config stays
 * icon-set agnostic; this is the one place a name becomes a component.
 * Unknown names fall back to the graduation cap rather than rendering
 * nothing.
 */
const SCHOOL_ICONS: Record<string, IconComponent> = {
  landmark: LandmarkIcon,
  blocks: BlocksIcon,
  bot: BotIcon,
  code: CodeIcon,
  "shield-check": ShieldCheckIcon,
  "chart-column": ChartColumnIcon,
  clapperboard: ClapperboardIcon,
  briefcase: BriefcaseIcon,
  lightbulb: LightbulbIcon,
  palette: PaletteIcon,
  users: UsersIcon,
}

export function SchoolIcon({ name, ...props }: IconProps & { name: string }) {
  return <RenderIcon icon={SCHOOL_ICONS[name] ?? GraduationCapIcon} {...props} />
}
