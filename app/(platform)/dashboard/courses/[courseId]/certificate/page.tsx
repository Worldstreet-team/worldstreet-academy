import { notFound } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowLeft01Icon, Download01Icon, Share08Icon } from "@hugeicons/core-free-icons"
import { fetchCourseForLearning } from "@/lib/actions/student"

export default async function CertificatePage({
  params,
}: {
  params: Promise<{ courseId: string }>
}) {
  const { courseId } = await params
  const course = await fetchCourseForLearning(courseId)
  
  if (!course) notFound()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-muted/30">
      <div className="w-full max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            render={<Link href="/dashboard" />}
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} size={16} />
            Back to Dashboard
          </Button>
          
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <HugeiconsIcon icon={Share08Icon} size={16} />
              Share
            </Button>
            <Button size="sm">
              <HugeiconsIcon icon={Download01Icon} size={16} />
              Download
            </Button>
          </div>
        </div>

        {/* Certificate Preview */}
        <div className="bg-background rounded-lg border shadow-lg p-8 md:p-12 text-center space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl md:text-4xl font-bold">
              Certificate of Completion
            </h1>
            <p className="text-muted-foreground">
              This certifies that
            </p>
          </div>

          <div className="py-4">
            <p className="text-2xl md:text-3xl font-semibold">
              [Your Name]
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-muted-foreground">
              has successfully completed
            </p>
            <h2 className="text-xl md:text-2xl font-bold text-primary">
              {course.title}
            </h2>
          </div>

          <div className="pt-8 text-sm text-muted-foreground">
            <p>Issued on {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Full certificate functionality coming soon
        </p>
      </div>
    </div>
  )
}
