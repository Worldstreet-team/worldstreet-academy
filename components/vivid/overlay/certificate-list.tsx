"use client"

import Image from "next/image"
import { motion } from "motion/react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Certificate01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"

export function CertificateList({ data }: { data: unknown }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = Array.isArray(data) ? data : (data as any)?.certificates || []

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No certificates earned yet.</p>
  }

  return (
    <div className="space-y-3">
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {items.map((cert: any, i: number) => (
        <motion.div
          key={cert.id || cert._id || i}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.05 }}
          className="p-3 rounded-xl bg-card/50 border border-border/30 space-y-2"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <HugeiconsIcon icon={Certificate01Icon} size={16} className="text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {cert.courseTitle || cert.title || "Certificate"}
              </p>
              {cert.issuedAt && (
                <p className="text-xs text-muted-foreground">
                  Issued {new Date(cert.issuedAt).toLocaleDateString()}
                </p>
              )}
            </div>
            {cert.hasSignature && (
              <div className="flex items-center gap-1 text-xs text-green-400">
                <HugeiconsIcon icon={Tick02Icon} size={12} />
                Signed
              </div>
            )}
          </div>
          {cert.certificateUrl && (
            <div className="relative w-full aspect-[1.414] rounded-lg overflow-hidden bg-muted">
              <Image
                src={cert.certificateUrl}
                alt="Certificate"
                fill
                className="object-contain"
                sizes="400px"
              />
            </div>
          )}
        </motion.div>
      ))}
    </div>
  )
}
