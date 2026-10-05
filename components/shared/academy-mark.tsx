import Image from "next/image"
import { cn } from "@/lib/utils"

/**
 * The gold wsa-mark on its own, unboxed — what stands in for an instructor's
 * avatar while people are hidden from the public site (FACULTY_PUBLIC in
 * lib/faculty.ts). Decorative: the credit beside it carries the words.
 */
export function AcademyMark({ size, className }: { size: number; className?: string }) {
  return (
    <Image
      src="/brand/wsa-mark.png"
      alt=""
      width={size}
      height={size}
      className={cn("shrink-0 object-contain", className)}
      style={{ width: size, height: size }}
    />
  )
}
