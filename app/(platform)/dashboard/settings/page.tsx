import { Topbar } from "@/components/platform/topbar"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

const settingSections = [
  {
    title: "Notifications",
    description: "Manage how you receive notifications.",
    items: [
      { label: "Email notifications", value: "Enabled" },
      { label: "Push notifications", value: "Enabled" },
      { label: "Course updates", value: "Enabled" },
    ],
  },
  {
    title: "Preferences",
    description: "Customize your learning experience.",
    items: [
      { label: "Language", value: "English" },
      { label: "Time zone", value: "UTC" },
      { label: "Theme", value: "System" },
    ],
  },
  {
    title: "Privacy",
    description: "Control your data and privacy.",
    items: [
      { label: "Profile visibility", value: "Public" },
      { label: "Show progress", value: "Enabled" },
    ],
  },
]

export default function SettingsPage() {
  return (
    <>
      <Topbar title="Settings" />
      <div className="flex-1 p-4 md:p-6 lg:p-8 space-y-6 max-w-3xl pb-24 md:pb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-1">
            Manage your account preferences.
          </p>
        </div>

        {settingSections.map((section) => (
          <Card key={section.title}>
            <CardContent className="p-6 space-y-4">
              <div>
                <h2 className="text-base font-semibold">{section.title}</h2>
                <p className="text-sm text-muted-foreground">{section.description}</p>
              </div>
              <Separator />
              <div className="space-y-3">
                {section.items.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between py-1"
                  >
                    <span className="text-sm">{item.label}</span>
                    <span className="text-sm text-muted-foreground">{item.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  )
}
