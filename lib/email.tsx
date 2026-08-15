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

/* ─── Shared Styles ───
   Email HTML can't read CSS variables, so the DS v2 LIGHT values are inlined
   as literals (design-tokens/tokens.css, light mode, sRGB approximations):
   body #F8F7F6 (sunken) · surface #FFFFFF · raised #F5F4F3 · hairline #E9E7E5 ·
   ink #292524 · muted #837A72 · subtle #8A8177 · gold #EAB308 on ink #1C1917 ·
   success #047857. Keep these in sync with the token file. */

const base = {
  fontFamily: "'Public Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
}

const body: React.CSSProperties = {
  backgroundColor: "#F8F7F6",
  margin: 0,
  padding: "40px 0",
}

const card: React.CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: "20px",
  maxWidth: "460px",
  margin: "0 auto",
  overflow: "hidden",
  border: "1px solid #E9E7E5",
}

const contentPad: React.CSSProperties = {
  padding: "32px 32px 36px",
  textAlign: "center" as const,
}

const heading: React.CSSProperties = {
  fontFamily: "'Poppins', 'Public Sans', -apple-system, 'Segoe UI', Roboto, sans-serif",
  fontSize: "20px",
  fontWeight: 600,
  color: "#292524",
  margin: "0 0 6px",
  lineHeight: "1.35",
}

const sub: React.CSSProperties = {
  fontSize: "13px",
  color: "#837A72",
  margin: "0",
  lineHeight: "1.5",
}

const muted: React.CSSProperties = {
  fontSize: "12px",
  color: "#8A8177",
  margin: "4px 0 0",
}

const cta: React.CSSProperties = {
  display: "inline-block",
  backgroundColor: "#EAB308", // brand/primary
  color: "#1C1917", // brand/on-primary
  borderRadius: "7px",
  padding: "11px 36px",
  fontWeight: 600,
  fontSize: "14px",
  textDecoration: "none",
}

const linkSmall: React.CSSProperties = {
  fontSize: "11px",
  color: "#8A8177",
  textDecoration: "underline",
  wordBreak: "break-all" as const,
}

const footer: React.CSSProperties = {
  textAlign: "center" as const,
  padding: "20px 0 8px",
}

const footerText: React.CSSProperties = {
  fontSize: "11px",
  color: "#8A8177",
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
        backgroundColor: offset ? "#F5F4F3" : "#E9E7E5",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "18px",
        fontWeight: 700,
        color: offset ? "#8A8177" : "#837A72",
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
              <Text style={{ ...muted, color: "#837A72" }}>
                Scheduled for{" "}
                {new Date(data.scheduledAt).toLocaleString("en-US", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </Text>
            ) : (
              <Text style={{ ...muted, color: "#047857", fontWeight: 500 }}>
                Happening right now
              </Text>
            )}

            <Section style={{ marginTop: "28px" }}>
              <Button href={data.meetingLink} style={cta}>
                {isScheduled ? "View Details" : "Join Meeting"}
              </Button>
            </Section>

            <Hr style={{ borderColor: "#E9E7E5", margin: "24px 0 16px" }} />

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

            <Hr style={{ borderColor: "#E9E7E5", margin: "24px 0 16px" }} />

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

/* ─── Instructor Application Emails ─── */

export type ApplicationEmailData = {
  applicantName: string
  applicantAvatarUrl?: string
  /** Where the applicant can track their application. */
  statusUrl: string
  /** Only for decision emails. */
  decision?: "approved" | "rejected"
  decisionNote?: string
}

function ApplicationReceivedEmail({ data }: { data: ApplicationEmailData }) {
  return (
    <Html style={base}>
      <Head />
      <Preview>We received your instructor application</Preview>
      <Body style={body}>
        <Container style={card}>
          <Section style={contentPad}>
            <AvatarStack
              hostAvatar={data.applicantAvatarUrl}
              hostName={data.applicantName}
            />
            <Text style={heading}>Application received</Text>
            <Text style={sub}>
              Thanks {data.applicantName} — your instructor application is in.
              Our team reviews every application and may invite you to a short
              interview call. You&apos;ll hear from us soon.
            </Text>

            <Section style={{ marginTop: "28px" }}>
              <Button href={data.statusUrl} style={cta}>
                Track your application
              </Button>
            </Section>

            <Hr style={{ borderColor: "#E9E7E5", margin: "24px 0 16px" }} />

            <Link href={data.statusUrl} style={linkSmall}>
              {data.statusUrl}
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

function ApplicationDecisionEmail({ data }: { data: ApplicationEmailData }) {
  const approved = data.decision === "approved"
  return (
    <Html style={base}>
      <Head />
      <Preview>
        {approved
          ? "You're approved — welcome to the instructor team!"
          : "An update on your instructor application"}
      </Preview>
      <Body style={body}>
        <Container style={card}>
          <Section style={contentPad}>
            <AvatarStack
              hostAvatar={data.applicantAvatarUrl}
              hostName={data.applicantName}
            />
            <Text style={heading}>
              {approved ? "Welcome aboard" : "Application update"}
            </Text>
            <Text style={sub}>
              {approved
                ? `Congratulations ${data.applicantName} — your instructor application was approved. Your instructor portal is ready: create your first course whenever you like.`
                : `Hi ${data.applicantName} — after review, we weren't able to approve your instructor application this time. You're welcome to apply again in the future.`}
            </Text>

            {data.decisionNote && (
              <Text style={{ ...muted, color: "#837A72", marginTop: "10px" }}>
                “{data.decisionNote}”
              </Text>
            )}

            <Section style={{ marginTop: "28px" }}>
              <Button href={data.statusUrl} style={cta}>
                {approved ? "Open Instructor Portal" : "View details"}
              </Button>
            </Section>

            <Hr style={{ borderColor: "#E9E7E5", margin: "24px 0 16px" }} />

            <Link href={data.statusUrl} style={linkSmall}>
              {data.statusUrl}
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

/* ─── Interview Invite Email ─── */

export type InterviewEmailData = {
  applicantName: string
  applicantAvatarUrl?: string
  hostName: string
  hostAvatarUrl?: string
  scheduledAt: string
  joinUrl: string
}

function InterviewInviteEmail({ data }: { data: InterviewEmailData }) {
  const when = new Date(data.scheduledAt).toLocaleString("en-US", {
    dateStyle: "full",
    timeStyle: "short",
  })
  return (
    <Html style={base}>
      <Head />
      <Preview>Your instructor interview is scheduled</Preview>
      <Body style={body}>
        <Container style={card}>
          <Section style={contentPad}>
            <AvatarStack
              hostAvatar={data.hostAvatarUrl}
              hostName={data.hostName}
              inviteeName={data.applicantName}
              inviteeAvatar={data.applicantAvatarUrl}
            />
            <Text style={heading}>Interview scheduled</Text>
            <Text style={sub}>
              {data.applicantName}, the next step of your instructor application is a short
              video call with {data.hostName}.
            </Text>
            <Text style={{ ...muted, color: "#047857", fontWeight: 500, marginTop: "10px" }}>
              {when}
            </Text>
            <Text style={muted}>
              Join from this link at the scheduled time — you&apos;ll be admitted from the
              waiting room.
            </Text>

            <Section style={{ marginTop: "28px" }}>
              <Button href={data.joinUrl} style={cta}>
                Join Interview
              </Button>
            </Section>

            <Hr style={{ borderColor: "#E9E7E5", margin: "24px 0 16px" }} />

            <Link href={data.joinUrl} style={linkSmall}>
              {data.joinUrl}
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

/* ─── Pipeline Emails (Phase 7) ─── */

function SimplePipelineEmail({
  preview,
  title,
  bodyText,
  ctaLabel,
  ctaUrl,
  avatarUrl,
  avatarName,
  extra,
}: {
  preview: string
  title: string
  bodyText: string
  ctaLabel: string
  ctaUrl: string
  avatarUrl?: string
  avatarName?: string
  extra?: React.ReactNode
}) {
  return (
    <Html style={base}>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={card}>
          <Section style={contentPad}>
            <AvatarStack hostAvatar={avatarUrl} hostName={avatarName} />
            <Text style={heading}>{title}</Text>
            <Text style={sub}>{bodyText}</Text>
            {extra}
            <Section style={{ marginTop: "28px" }}>
              <Button href={ctaUrl} style={cta}>
                {ctaLabel}
              </Button>
            </Section>
            <Hr style={{ borderColor: "#E9E7E5", margin: "24px 0 16px" }} />
            <Link href={ctaUrl} style={linkSmall}>
              {ctaUrl}
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

/** New-application alert to admins. */
export async function sendNewApplicationAdminEmail(
  to: string,
  data: { applicantName: string; applicantAvatarUrl?: string; headline: string; reviewUrl: string }
) {
  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `New instructor application — ${data.applicantName}`,
      react: React.createElement(SimplePipelineEmail, {
        preview: `${data.applicantName} applied to teach`,
        title: "New instructor application",
        bodyText: `${data.applicantName} applied: “${data.headline}”`,
        ctaLabel: "Review application",
        ctaUrl: data.reviewUrl,
        avatarUrl: data.applicantAvatarUrl,
        avatarName: data.applicantName,
      }),
    })
    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (err) {
    console.error("[Email] Admin new-application error:", err)
    return { success: false, error: "Failed to send email" }
  }
}

/** "Your application is now under review." */
export async function sendUnderReviewEmail(
  to: string,
  data: { applicantName: string; applicantAvatarUrl?: string; statusUrl: string }
) {
  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: "Your instructor application is under review",
      react: React.createElement(SimplePipelineEmail, {
        preview: "A reviewer picked up your application",
        title: "Application under review",
        bodyText: `${data.applicantName}, a member of our team is now reviewing your instructor application. Next step is usually a short interview call — watch your inbox.`,
        ctaLabel: "Track your application",
        ctaUrl: data.statusUrl,
        avatarUrl: data.applicantAvatarUrl,
        avatarName: data.applicantName,
      }),
    })
    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (err) {
    console.error("[Email] Under-review error:", err)
    return { success: false, error: "Failed to send email" }
  }
}

/** Interview slots proposed — applicant picks one. */
export async function sendSlotsProposedEmail(
  to: string,
  data: {
    applicantName: string
    applicantAvatarUrl?: string
    hostName: string
    slots: string[]
    pickUrl: string
  }
) {
  const slotList = React.createElement(
    Section,
    { style: { marginTop: "14px" } },
    ...data.slots.map((iso, i) =>
      React.createElement(
        Text,
        { key: i, style: { ...muted, color: "#047857", fontWeight: 500, margin: "2px 0" } },
        new Date(iso).toLocaleString("en-US", { dateStyle: "full", timeStyle: "short" })
      )
    )
  )
  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: "Pick a time for your instructor interview",
      react: React.createElement(SimplePipelineEmail, {
        preview: `${data.hostName} proposed interview times`,
        title: "Pick your interview time",
        bodyText: `${data.applicantName}, ${data.hostName} proposed ${data.slots.length} time${data.slots.length === 1 ? "" : "s"} for your interview call. Choose whichever works best:`,
        ctaLabel: "Choose a slot",
        ctaUrl: data.pickUrl,
        avatarUrl: data.applicantAvatarUrl,
        avatarName: data.applicantName,
        extra: slotList,
      }),
    })
    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (err) {
    console.error("[Email] Slots-proposed error:", err)
    return { success: false, error: "Failed to send email" }
  }
}

/** T-24h / T-1h interview reminder (sent by the cron route). */
export async function sendInterviewReminderEmail(
  to: string,
  data: {
    recipientName: string
    counterpartName: string
    scheduledAt: string
    joinUrl: string
    window: "24h" | "1h"
  }
) {
  const when = new Date(data.scheduledAt).toLocaleString("en-US", {
    dateStyle: "full",
    timeStyle: "short",
  })
  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject:
        data.window === "1h"
          ? "Your interview starts in about an hour"
          : "Reminder: your interview is tomorrow",
      react: React.createElement(SimplePipelineEmail, {
        preview: `Interview with ${data.counterpartName} — ${when}`,
        title: data.window === "1h" ? "Starting soon" : "Interview tomorrow",
        bodyText: `${data.recipientName}, your interview with ${data.counterpartName} is scheduled for ${when}. Join a couple of minutes early — you'll be admitted from the waiting room.`,
        ctaLabel: "Open interview room",
        ctaUrl: data.joinUrl,
        avatarName: data.recipientName,
      }),
    })
    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (err) {
    console.error("[Email] Interview reminder error:", err)
    return { success: false, error: "Failed to send email" }
  }
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
 * Send the "we received your instructor application" confirmation.
 */
export async function sendApplicationReceivedEmail(to: string, data: ApplicationEmailData) {
  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: "We received your instructor application",
      react: React.createElement(ApplicationReceivedEmail, { data }),
    })
    if (error) {
      console.error("[Email] Application received failed:", error)
      return { success: false, error: error.message }
    }
    return { success: true }
  } catch (err) {
    console.error("[Email] Application received error:", err)
    return { success: false, error: "Failed to send email" }
  }
}

/**
 * Send the instructor-interview invitation (scheduled interview call).
 * Pass `ics` to attach a calendar file.
 */
export async function sendInterviewInviteEmail(to: string, data: InterviewEmailData, ics?: string) {
  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: "Your instructor interview is scheduled",
      react: React.createElement(InterviewInviteEmail, { data }),
      ...(ics
        ? {
            attachments: [
              { filename: "interview.ics", content: Buffer.from(ics).toString("base64") },
            ],
          }
        : {}),
    })
    if (error) {
      console.error("[Email] Interview invite failed:", error)
      return { success: false, error: error.message }
    }
    return { success: true }
  } catch (err) {
    console.error("[Email] Interview invite error:", err)
    return { success: false, error: "Failed to send email" }
  }
}

/**
 * Send the instructor application decision (approved / rejected).
 */
export async function sendApplicationDecisionEmail(to: string, data: ApplicationEmailData) {
  const subject =
    data.decision === "approved"
      ? "You're approved — welcome to the WorldStreet instructor team"
      : "An update on your instructor application"
  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      react: React.createElement(ApplicationDecisionEmail, { data }),
    })
    if (error) {
      console.error("[Email] Application decision failed:", error)
      return { success: false, error: error.message }
    }
    return { success: true }
  } catch (err) {
    console.error("[Email] Application decision error:", err)
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

/* ─── Course enrollment lifecycle ─── */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://academy.worldstreetgold.com"

export type EnrollmentEmailData = {
  to: string
  firstName: string
  courseTitle: string
  courseId: string
  /** null = live immediately (plain confirmation, no countdown framing). */
  availableAtIso: string | null
  isPaid: boolean
  price: number
}

function formatLaunch(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  })
}

function EnrollmentConfirmationEmail({ data }: { data: EnrollmentEmailData }) {
  const courseUrl = `${APP_URL}/dashboard/courses/${data.courseId}`
  return (
    <Html style={base}>
      <Head />
      <Preview>You&apos;re enrolled in {data.courseTitle}</Preview>
      <Body style={body}>
        <Container style={card}>
          <Section style={contentPad}>
            <Text style={heading}>You&apos;re enrolled</Text>
            <Text style={sub}>
              {data.firstName ? `${data.firstName} — you` : "You"}&apos;re in.
              Your seat on <strong>{data.courseTitle}</strong> is reserved.
            </Text>
            {data.availableAtIso ? (
              <>
                <Text style={sub}>
                  The course isn&apos;t live yet — it opens on{" "}
                  <strong>{formatLaunch(data.availableAtIso)}</strong>. Nothing
                  was charged today{data.isPaid
                    ? ` — payment ($${data.price.toFixed(2)}) is only asked for when the course is live and you choose to start`
                    : ""}.
                </Text>
                <Text style={muted}>
                  We&apos;ll email you the moment it goes live.
                </Text>
              </>
            ) : (
              <Text style={sub}>The course is live — you can start right away.</Text>
            )}

            <Section style={{ marginTop: "28px" }}>
              <Button href={courseUrl} style={cta}>
                View the course
              </Button>
            </Section>

            <Hr style={{ borderColor: "#E4E4E9", margin: "24px 0 16px" }} />

            <Link href={courseUrl} style={linkSmall}>
              {courseUrl}
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

export async function sendEnrollmentConfirmationEmail(data: EnrollmentEmailData) {
  if (!data.to) return { success: false, error: "No recipient" }
  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: data.to,
      subject: `You're enrolled: ${data.courseTitle}`,
      react: React.createElement(EnrollmentConfirmationEmail, { data }),
    })
    if (error) {
      console.error("[Email] Enrollment confirmation failed:", error)
      return { success: false, error: error.message }
    }
    return { success: true }
  } catch (err) {
    console.error("[Email] Enrollment confirmation error:", err)
    return { success: false, error: "Failed to send email" }
  }
}

export type CourseLiveEmailData = {
  to: string
  firstName: string
  courseTitle: string
  courseId: string
  isPaid: boolean
  price: number
}

function CourseLiveEmail({ data }: { data: CourseLiveEmailData }) {
  const courseUrl = `${APP_URL}/dashboard/courses/${data.courseId}`
  return (
    <Html style={base}>
      <Head />
      <Preview>{data.courseTitle} is now live</Preview>
      <Body style={body}>
        <Container style={card}>
          <Section style={contentPad}>
            <Text style={heading}>Your course is now live</Text>
            <Text style={sub}>
              {data.firstName ? `${data.firstName} — the` : "The"} wait is over:{" "}
              <strong>{data.courseTitle}</strong> just went live.
            </Text>
            <Text style={sub}>
              {data.isPaid
                ? `Start whenever you're ready — payment ($${data.price.toFixed(2)}) happens at the door, and your seat is already reserved.`
                : "It's free and your seat is already reserved — jump straight in."}
            </Text>

            <Section style={{ marginTop: "28px" }}>
              <Button href={courseUrl} style={cta}>
                {data.isPaid ? `Start course — $${data.price.toFixed(2)}` : "Start course"}
              </Button>
            </Section>

            <Hr style={{ borderColor: "#E4E4E9", margin: "24px 0 16px" }} />

            <Link href={courseUrl} style={linkSmall}>
              {courseUrl}
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

export async function sendCourseLiveEmail(data: CourseLiveEmailData) {
  if (!data.to) return { success: false, error: "No recipient" }
  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: data.to,
      subject: `Now live: ${data.courseTitle}`,
      react: React.createElement(CourseLiveEmail, { data }),
    })
    if (error) {
      console.error("[Email] Course live failed:", error)
      return { success: false, error: error.message }
    }
    return { success: true }
  } catch (err) {
    console.error("[Email] Course live error:", err)
    return { success: false, error: "Failed to send email" }
  }
}
