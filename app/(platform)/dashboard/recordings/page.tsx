import { Topbar } from "@/components/platform/topbar"
import { PageHeader } from "@/components/shared/page-header"
import { RecordingsList } from "@/components/recordings/recordings-list"

export const metadata = { title: "Recordings" }

/** Recordings of past live classes, for programs whose package includes live classes. */
export default function RecordingsPage() {
  return (
    <>
      <Topbar title="Recordings" />
      <div className="flex-1 px-4 sm:px-6 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto w-full max-w-4xl space-y-6">
          <PageHeader
            title="Recordings"
            subline="Watch your past live classes again. Recordings play here and can't be downloaded."
          />
          <RecordingsList />
        </div>
      </div>
    </>
  )
}
