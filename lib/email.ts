import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM_EMAIL = process.env.EMAIL_FROM || "WorldStreet Academy <noreply@worldstreet.academy>"

export type MeetingEmailData = {
  meetingTitle: string
  hostName: string
  hostAvatarUrl?: string
  meetingLink: string
  courseName?: string
  courseThumbnailUrl?: string
  scheduledAt?: string
}

function avatarStack(hostAvatar?: string, hostName?: string, inviteeName?: string) {
  const hostInitial = hostName?.[0]?.toUpperCase() || "H"
  const inviteeInitial = inviteeName?.[0]?.toUpperCase() || "Y"

  const hostCircle = hostAvatar
    ? `<img src="${hostAvatar}" alt="${hostName}" style="width:44px;height:44px;border-radius:50%;border:3px solid #ffffff;object-fit:cover;" />`
    : `<div style="width:44px;height:44px;border-radius:50%;border:3px solid #ffffff;background:#e5e7eb;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:#6b7280;">${hostInitial}</div>`

  const inviteeCircle = `<div style="width:44px;height:44px;border-radius:50%;border:3px solid #ffffff;background:#f3f4f6;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:#9ca3af;margin-left:-14px;">${inviteeInitial}</div>`

  return `
    <div style="display:flex;align-items:center;justify-content:center;margin-bottom:20px;">
      <!--[if mso]><table cellpadding="0" cellspacing="0"><tr><td><![endif]-->
      ${hostCircle}
      <!--[if mso]></td><td><![endif]-->
      ${inviteeCircle}
      <!--[if mso]></td></tr></table><![endif]-->
    </div>
  `
}

function emailWrapper(content: string) {
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0;padding:0;background-color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <div style="max-width:480px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
        ${content}
      </div>
      <div style="text-align:center;padding:16px 20px;">
        <p style="color:#9ca3af;font-size:11px;margin:0;">WorldStreet Academy</p>
      </div>
    </body>
    </html>
  `
}

/**
 * Send a meeting invitation/notification email to a student
 */
export async function sendMeetingNotificationEmail(
  to: string,
  data: MeetingEmailData
) {
  const isScheduled = !!data.scheduledAt
  const subject = isScheduled
    ? `${data.meetingTitle} — Scheduled by ${data.hostName}`
    : `${data.meetingTitle} — ${data.hostName} is live`

  const thumbnailHtml = data.courseThumbnailUrl
    ? `<div style="padding:0;"><img src="${data.courseThumbnailUrl}" alt="${data.courseName || data.meetingTitle}" style="width:100%;display:block;object-fit:cover;max-height:180px;" /></div>`
    : ""

  const scheduleInfo = data.scheduledAt
    ? `<p style="color:#6b7280;font-size:13px;margin:4px 0 0;">Scheduled for ${new Date(data.scheduledAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</p>`
    : `<p style="color:#059669;font-size:13px;font-weight:500;margin:4px 0 0;">Happening right now</p>`

  const html = emailWrapper(`
    ${thumbnailHtml}
    <div style="padding:28px 28px 32px;text-align:center;">
      ${avatarStack(data.hostAvatarUrl, data.hostName)}
      <h1 style="font-size:18px;font-weight:600;color:#111827;margin:0 0 4px;line-height:1.3;">${data.meetingTitle}</h1>
      <p style="color:#6b7280;font-size:13px;margin:0;">Hosted by ${data.hostName}</p>
      ${data.courseName ? `<p style="color:#9ca3af;font-size:12px;margin:4px 0 0;">${data.courseName}</p>` : ""}
      ${scheduleInfo}
      <div style="margin-top:24px;">
        <a href="${data.meetingLink}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:10px 32px;border-radius:10px;font-weight:500;font-size:14px;">
          ${isScheduled ? "View Details" : "Join Meeting"}
        </a>
      </div>
      <p style="color:#d1d5db;font-size:11px;margin-top:20px;">
        <a href="${data.meetingLink}" style="color:#9ca3af;text-decoration:underline;">${data.meetingLink}</a>
      </p>
    </div>
  `)

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    })
    if (error) {
      console.error("[Email] Failed to send:", error)
      return { success: false, error: error.message }
    }
    return { success: true }
  } catch (err) {
    console.error("[Email] Send error:", err)
    return { success: false, error: "Failed to send email" }
  }
}

/**
 * Send a direct meeting invite email (by email search)
 */
export async function sendMeetingInviteEmail(
  to: string,
  data: MeetingEmailData & { inviteeName?: string }
) {
  const subject = `${data.hostName} invited you to ${data.meetingTitle}`

  const html = emailWrapper(`
    <div style="padding:28px 28px 32px;text-align:center;">
      ${avatarStack(data.hostAvatarUrl, data.hostName, data.inviteeName)}
      <h1 style="font-size:18px;font-weight:600;color:#111827;margin:0 0 4px;line-height:1.3;">${data.meetingTitle}</h1>
      <p style="color:#6b7280;font-size:13px;margin:0;">
        ${data.inviteeName ? `${data.inviteeName}, you` : "You"}'ve been invited by ${data.hostName}
      </p>
      ${data.courseName ? `<p style="color:#9ca3af;font-size:12px;margin:4px 0 0;">${data.courseName}</p>` : ""}
      <div style="margin-top:24px;">
        <a href="${data.meetingLink}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:10px 32px;border-radius:10px;font-weight:500;font-size:14px;">
          Join Meeting
        </a>
      </div>
      <p style="color:#d1d5db;font-size:11px;margin-top:20px;">
        <a href="${data.meetingLink}" style="color:#9ca3af;text-decoration:underline;">${data.meetingLink}</a>
      </p>
    </div>
  `)

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    })
    if (error) {
      console.error("[Email] Invite failed:", error)
      return { success: false, error: error.message }
    }
    return { success: true }
  } catch (err) {
    console.error("[Email] Invite error:", err)
    return { success: false, error: "Failed to send invite" }
  }
}
