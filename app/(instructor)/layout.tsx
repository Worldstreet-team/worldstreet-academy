import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { InstructorSidebar } from "@/components/instructor/instructor-sidebar"
import { InstructorBottomNav } from "@/components/instructor/bottom-nav"
import { CommandSearch } from "@/components/shared/command-search"

export default function InstructorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider>
      <InstructorSidebar />
      <SidebarInset>
        {children}
      </SidebarInset>
      <InstructorBottomNav />
      <CommandSearch />
    </SidebarProvider>
  )
}
