import {
  BlocksIcon,
  BotIcon,
  BriefcaseIcon,
  ChartColumnIcon,
  ClapperboardIcon,
  CodeIcon,
  GraduationCapIcon,
  LandmarkIcon,
  ShieldCheckIcon,
  type LucideIcon,
  type LucideProps,
} from "lucide-react"
import { RenderIcon } from "@/components/shared/render-icon"

/**
 * `School.icon` (lib/schools.ts) is a lucide NAME so the config stays
 * icon-set agnostic; this is the one place a name becomes a component.
 * Unknown names fall back to the graduation cap rather than rendering
 * nothing.
 */
const SCHOOL_ICONS: Record<string, LucideIcon> = {
  landmark: LandmarkIcon,
  blocks: BlocksIcon,
  bot: BotIcon,
  code: CodeIcon,
  "shield-check": ShieldCheckIcon,
  "chart-column": ChartColumnIcon,
  clapperboard: ClapperboardIcon,
  briefcase: BriefcaseIcon,
}

export function SchoolIcon({ name, ...props }: LucideProps & { name: string }) {
  return <RenderIcon icon={SCHOOL_ICONS[name] ?? GraduationCapIcon} {...props} />
}
