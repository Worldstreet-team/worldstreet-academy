import * as React from "react"
import { Resend } from "resend"
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Button,
  Img,
  Link,
  Hr,
  Preview,
  Row,
  Column,
} from "@react-email/components"

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

/* ─── Shared Styles ─── */

const base = {
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
}

const body: React.CSSProperties = {
  backgroundColor: "#fafafa",
  margin: 0,
  padding: "40px 0",
}

const card: React.CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: "16px",
  maxWidth: "460px",
  margin: "0 auto",
  overflow: "hidden",
  border: "1px solid #f0f0f0",
}

const contentPad: React.CSSProperties = {
  padding: "32px 32px 36px",
  textAlign: "center" as const,
}

const heading: React.CSSProperties = {
  fontSize: "20px",
  fontWeight: 600,
  color: "#111827",
  margin: "0 0 6px",
  lineHeight: "1.35",
}

const sub: React.CSSProperties = {
  fontSize: "13px",
  color: "#6b7280",
  margin: "0",
  lineHeight: "1.5",
}

const muted: React.CSSProperties = {
  fontSize: "12px",
  color: "#9ca3af",
  margin: "4px 0 0",
}

const cta: React.CSSProperties = {
  display: "inline-block",
  backgroundColor: "#111827",
  color: "#ffffff",
  borderRadius: "10px",
  padding: "11px 36px",
  fontWeight: 500,
  fontSize: "14px",
  textDecoration: "none",
}

const linkSmall: React.CSSProperties = {
  fontSize: "11px",
  color: "#c4c4c4",
  textDecoration: "underline",
  wordBreak: "break-all" as const,
}

const footer: React.CSSProperties = {
  textAlign: "center" as const,
  padding: "20px 0 8px",
}

const footerText: React.CSSProperties = {
  fontSize: "11px",
  color: "#b0b0b0",
  margin: 0,
}

/* ─── Avatar Components ─── */

function AvatarCircle({ src, initial, offset }: { src?: string; initial: string; offset?: boolean }) {
  const size = 50
  const base: React.CSSProperties = {
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: "50%",
    border: "3px solid #ffffff",
    ...(offset ? { marginLeft: "-12px" } : {}),
  }

  if (src) {
    return (
      <Img
        src={src}
        alt={initial}
        width={size}
        height={size}
        style={{ ...base, objectFit: "cover" }}
      />
    )
  }

  return (
    <div
      style={{
        ...base,
        backgroundColor: offset ? "#f3f4f6" : "#e5e7eb",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "18px",
        fontWeight: 700,
        color: offset ? "#9ca3af" : "#6b7280",
      }}
    >
      {initial}
    </div>
  )
}

function AvatarStack({
  hostAvatar,
  hostName,
  inviteeName,
  inviteeAvatar,
}: {
  hostAvatar?: string
  hostName?: string
  inviteeName?: string
  inviteeAvatar?: string
}) {
  const hostInitial = hostName?.[0]?.toUpperCase() || "H"
  const inviteeInitial = inviteeName?.[0]?.toUpperCase() || "Y"

  return (
    <Row style={{ marginBottom: "20px" }}>
      <Column align="center">
        <table cellPadding={0} cellSpacing={0} style={{ margin: "0 auto" }}>
          <tr>
            <td>
              <AvatarCircle src={hostAvatar} initial={hostInitial} />
            </td>
            <td>
              <AvatarCircle src={inviteeAvatar} initial={inviteeInitial} offset />
            </td>
          </tr>
        </table>
      </Column>
    </Row>
  )
}

/* ─── Notification Email (student gets notified about a meeting) ─── */

function MeetingNotificationEmail({ data }: { data: MeetingEmailData }) {
  const isScheduled = !!data.scheduledAt
  const previewText = isScheduled
    ? `${data.hostName} scheduled ${data.meetingTitle}`
    : `${data.hostName} is live — join now`

  return (
    <Html style={base}>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={body}>
        <Container style={card}>
          {/* Course thumbnail banner */}
          {data.courseThumbnailUrl && (
            <Section style={{ padding: 0 }}>
              <Img
                src={data.courseThumbnailUrl}
                alt={data.courseName || data.meetingTitle}
                width="460"
                style={{ width: "100%", display: "block", objectFit: "cover", maxHeight: "180px" }}
              />
            </Section>
          )}

          <Section style={contentPad}>
            <AvatarStack hostAvatar={data.hostAvatarUrl} hostName={data.hostName} />

            <Text style={heading}>{data.meetingTitle}</Text>
            <Text style={sub}>Hosted by {data.hostName}</Text>

            {data.courseName && <Text style={muted}>{data.courseName}</Text>}

            {data.scheduledAt ? (
              <Text style={{ ...muted, color: "#6b7280" }}>
                Scheduled for{" "}
                {new Date(data.scheduledAt).toLocaleString("en-US", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </Text>
            ) : (
              <Text style={{ ...muted, color: "#059669", fontWeight: 500 }}>
                Happening right now
              </Text>
            )}

            <Section style={{ marginTop: "28px" }}>
              <Button href={data.meetingLink} style={cta}>
                {isScheduled ? "View Details" : "Join Meeting"}
              </Button>
            </Section>

            <Hr style={{ borderColor: "#f0f0f0", margin: "24px 0 16px" }} />

            <Link href={data.meetingLink} style={linkSmall}>
              {data.meetingLink}
            </Link>
          </Section>
        </Container>

        <Section style={footer}>
          <Text style={footerText}>WorldStreet Academy</Text>
        </Section>
      </Body>
    </Html>
  )
}

/* ─── Invite Email (direct invite by host) ─── */

function MeetingInviteEmail({
  data,
}: {
  data: MeetingEmailData & { inviteeName?: string; inviteeAvatarUrl?: string }
}) {
  return (
    <Html style={base}>
      <Head />
      <Preview>{data.hostName} invited you to {data.meetingTitle}</Preview>
      <Body style={body}>
        <Container style={card}>
          <Section style={contentPad}>
            <AvatarStack
              hostAvatar={data.hostAvatarUrl}
              hostName={data.hostName}
              inviteeName={data.inviteeName}
              inviteeAvatar={data.inviteeAvatarUrl}
            />

            <Text style={heading}>{data.meetingTitle}</Text>
            <Text style={sub}>
              {data.inviteeName ? `${data.inviteeName}, you` : "You"}&apos;ve been invited by{" "}
              {data.hostName}
            </Text>

            {data.courseName && <Text style={muted}>{data.courseName}</Text>}

            <Section style={{ marginTop: "28px" }}>
              <Button href={data.meetingLink} style={cta}>
                Join Meeting
              </Button>
            </Section>

            <Hr style={{ borderColor: "#f0f0f0", margin: "24px 0 16px" }} />

            <Link href={data.meetingLink} style={linkSmall}>
              {data.meetingLink}
            </Link>
          </Section>
        </Container>

        <Section style={footer}>
          <Text style={footerText}>WorldStreet Academy</Text>
        </Section>
      </Body>
    </Html>
  )
}

/* ─── Send Functions ─── */

/**
 * Send a meeting notification email to a student
 */
export async function sendMeetingNotificationEmail(
  to: string,
  data: MeetingEmailData
) {
  const isScheduled = !!data.scheduledAt
  const subject = isScheduled
    ? `${data.meetingTitle} — Scheduled by ${data.hostName}`
    : `${data.meetingTitle} — ${data.hostName} is live`

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      react: React.createElement(MeetingNotificationEmail, { data }),
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
  data: MeetingEmailData & { inviteeName?: string; inviteeAvatarUrl?: string }
) {
  const subject = `${data.hostName} invited you to ${data.meetingTitle}`

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      react: React.createElement(MeetingInviteEmail, { data }),
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
