"use client"

import Autoplay from "embla-carousel-autoplay"
import Link from "next/link"
import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from "@/components/ui/carousel"
import type { BrowseCourse } from "@/lib/actions/student"

export function CourseCarousel({ courses, title }: { courses: BrowseCourse[]; title: string }) {
  if (courses.length === 0) return null

  return (
    <div className="space-y-3">
      <Carousel
        opts={{ align: "start", loop: true }}
        plugins={[Autoplay({ delay: 4000, stopOnInteraction: true })]}
        className="w-full"
      >
        {/* Header row: title + controls inline */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">{title}</h3>
          {courses.length > 2 && (
            <div className="flex items-center gap-1">
              <CarouselPrevious className="static translate-x-0 translate-y-0 h-7 w-7" />
              <CarouselNext className="static translate-x-0 translate-y-0 h-7 w-7" />
            </div>
          )}
        </div>

        <CarouselContent className="-ml-3">
          {courses.map((course) => (
            <CarouselItem key={course.id} className="pl-3 basis-[80%] sm:basis-1/2 lg:basis-1/3 xl:basis-1/4">
              <Link href={`/dashboard/courses/${course.id}`}>
                <Card className="group h-full transition-all hover:shadow-md hover:border-primary/30 overflow-hidden">
                  <div className="aspect-video w-full bg-muted relative overflow-hidden">
                    {course.thumbnailUrl ? (
                      <Image
                        src={course.thumbnailUrl}
                        alt={course.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="280px"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-muted-foreground/40 text-xs">No thumbnail</span>
                      </div>
                    )}
                    <Badge
                      className="absolute top-2 left-2 text-[10px] z-10 shadow-sm"
                      variant={course.pricing === "free" ? "default" : "secondary"}
                    >
                      {course.pricing === "free" ? "Free" : `$${course.price}`}
                    </Badge>
                  </div>
                  <CardContent className="p-3 space-y-1.5">
                    <h4 className="font-semibold text-xs leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                      {course.title}
                    </h4>
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Avatar size="sm">
                        {course.instructorAvatarUrl && (
                          <AvatarImage src={course.instructorAvatarUrl} alt={course.instructorName} />
                        )}
                        <AvatarFallback>
                          {course.instructorName.split(" ").map((n) => n[0]).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <span>{course.instructorName}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </div>
  )
}
