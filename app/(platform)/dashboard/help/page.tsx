import Link from "next/link"
import { Topbar } from "@/components/platform/topbar"
import { Card, CardContent } from "@/components/ui/card"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  BookOpen01Icon,
  HelpCircleIcon,
  Mail01Icon,
} from "@hugeicons/core-free-icons"

const helpItems = [
  {
    title: "Getting Started",
    description: "Learn how to navigate the academy, enroll in courses, and track your progress.",
    icon: BookOpen01Icon,
  },
  {
    title: "FAQ",
    description: "Find answers to the most commonly asked questions about WorldStreet Academy.",
    icon: HelpCircleIcon,
  },
  {
    title: "Contact Support",
    description: "Reach out to our support team for any issues or questions.",
    icon: Mail01Icon,
  },
]

export default function HelpPage() {
  return (
    <>
      <Topbar title="Help" />
      <div className="flex-1 p-4 md:p-6 lg:p-8 space-y-6 max-w-3xl pb-24 md:pb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Help & Support</h1>
          <p className="text-muted-foreground mt-1">
            Get help with your WorldStreet Academy experience.
          </p>
        </div>

        <div className="grid gap-4">
          {helpItems.map((item) => (
            <Card key={item.title} className="transition-all hover:shadow-md hover:border-primary/30 cursor-pointer">
              <CardContent className="p-5 flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <HugeiconsIcon icon={item.icon} size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">{item.title}</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {item.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </>
  )
}
