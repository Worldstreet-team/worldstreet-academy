// Usage: node scripts/optimize-art.mjs <input-dir>
// Converts every .png/.jpg/.jpeg in <input-dir> to a 1600x1000 WebP at
// public/art/schools/<same-name>.webp. Name each source file after its school
// slug (lib/schools.ts), e.g. cybersecurity.png.
import { mkdir, readdir } from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"

const input = process.argv[2]
if (!input) {
  console.error("usage: node scripts/optimize-art.mjs <input-dir>")
  process.exit(1)
}
const out = path.resolve("public/art/schools")
await mkdir(out, { recursive: true })

const sources = (await readdir(input)).filter((f) => /\.(png|jpe?g)$/i.test(f))
for (const file of sources) {
  const slug = path.parse(file).name
  const target = path.join(out, `${slug}.webp`)
  const info = await sharp(path.join(input, file))
    .resize(1600, 1000, { fit: "cover", position: "attention" })
    .webp({ quality: 78 })
    .toFile(target)
  console.log(`${slug}.webp  ${Math.round(info.size / 1024)} KB`)
}
console.log(`${sources.length} file(s) written to ${out}`)
