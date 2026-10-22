/**
 * Typed lesson video links. The lesson player is a plain <video> element, so
 * it needs the video file itself; sites that show a video on a page of their
 * own play nothing there. Pure and client-safe: the add-lesson dialog checks a
 * link before it submits (so nothing typed is lost) and `addLesson` checks it
 * again on the server.
 */

const VIDEO_PAGE_HOSTS = ["youtube.com", "youtu.be", "vimeo.com", "loom.com", "drive.google.com", "dropbox.com", "dailymotion.com", "wistia.com"]

/** Why a typed lesson video link can't play in the lesson player, or null when it can. */
export function lessonVideoUrlError(videoUrl: string): string | null {
  let url: URL
  try {
    url = new URL(videoUrl)
  } catch {
    return "Enter the full link, starting with https://"
  }
  if (url.protocol !== "https:") return "Enter the full link, starting with https://"
  const host = url.hostname.toLowerCase()
  if (VIDEO_PAGE_HOSTS.some((page) => host === page || host.endsWith(`.${page}`))) {
    return "That's a link to a video page, which the lesson player can't play. Upload the video file in the course editor, or paste a direct link to the file (.mp4 or .webm)."
  }
  return null
}
