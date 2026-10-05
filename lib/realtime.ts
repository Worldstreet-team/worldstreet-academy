/**
 * Cloudflare RealtimeKit API helper
 * Server-side only — uses Dyte REST API (which powers RealtimeKit) to create meetings and add participants
 * Auth: Basic Auth with OrgId:ApiKey
 * Docs: https://developers.cloudflare.com/realtime/realtimekit/
 */

const REALTIME_ORG_ID = process.env.CLOUDFLARE_REALTIME_ORG_ID!
const REALTIME_API_KEY = process.env.CLOUDFLARE_REALTIME_API_KEY!

// RealtimeKit uses Dyte's REST API under the hood
const BASE_URL = "https://api.dyte.io/v2"

// Basic Auth with OrgId:ApiKey (base64-encoded)
const BASIC_AUTH = typeof Buffer !== "undefined"
  ? Buffer.from(`${REALTIME_ORG_ID}:${REALTIME_API_KEY}`).toString("base64")
  : btoa(`${REALTIME_ORG_ID}:${REALTIME_API_KEY}`)

type MeetingResponse = {
  success: boolean
  result?: { id: string; title: string }
  data?: { id: string; title: string }
  errors?: Array<{ message: string }>
}

type ParticipantResponse = {
  success: boolean
  result?: {
    id: string
    auth_token: string
    custom_participant_id: string
  }
  data?: {
    id: string
    token: string
    custom_participant_id: string
  }
  errors?: Array<{ message: string }>
}

async function cfFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${BASIC_AUTH}`,
      ...options.headers,
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`RealtimeKit API error ${res.status}: ${text}`)
  }

  return res.json()
}

/**
 * Create a new meeting (call room).
 *
 * `recordOnStart` sets `record_on_start` on POST /v2/meetings: RealtimeKit
 * starts a cloud recording as soon as the first participant joins the room
 * (https://developers.cloudflare.com/realtime/realtimekit/recording-guide/start-recording/).
 * Course classes pass it; mentorship sessions, interviews and ad-hoc meetings
 * never do. Recordings stay on RealtimeKit for 7 days — `/api/cron/recordings`
 * copies them to the private R2 bucket.
 */
export async function createMeeting(
  title: string,
  opts: { recordOnStart?: boolean } = {}
): Promise<string> {
  const data = await cfFetch<MeetingResponse>("/meetings", {
    method: "POST",
    body: JSON.stringify({ title, live: true, ...(opts.recordOnStart ? { record_on_start: true } : {}) }),
  })

  const meeting = data.result || data.data
  if (!meeting) {
    throw new Error(data.errors?.[0]?.message || "Failed to create meeting")
  }

  return meeting.id
}

/**
 * Add a participant to a meeting and return their auth token
 * @param presetName - "group_call_host" for video calls, "webinar_viewer" for audio-only (configure in dashboard)
 */
export async function addParticipant(
  meetingId: string,
  opts: {
    name: string
    customParticipantId: string
    presetName?: string
  }
): Promise<{ participantId: string; authToken: string }> {
  const data = await cfFetch<ParticipantResponse>(
    `/meetings/${meetingId}/participants`,
    {
      method: "POST",
      body: JSON.stringify({
        name: opts.name,
        preset_name: opts.presetName || "group_call_host",
        custom_participant_id: opts.customParticipantId,
      }),
    }
  )

  const participant = data.result || data.data
  if (!participant) {
    throw new Error(data.errors?.[0]?.message || "Failed to add participant")
  }

  return {
    participantId: participant.id,
    authToken: (participant as Record<string, string>).auth_token || (participant as Record<string, string>).token || "",
  }
}

/**
 * End a meeting session (kicks all participants)
 */
export async function endMeeting(meetingId: string): Promise<void> {
  // The meeting auto-ends when last participant leaves
  // This is a force-end via API if needed
  try {
    await cfFetch(`/meetings/${meetingId}`, { method: "DELETE" })
  } catch {
    // Meeting may already be ended — that's ok
  }
}

// ── Recordings ──

/** RealtimeKit recording states (recording-guide/monitor-status). */
export type RTKRecordingStatus = "INVOKED" | "RECORDING" | "UPLOADING" | "UPLOADED" | "ERRORED" | "PAUSED"

/** The fields of a RealtimeKit recording this app reads (GET /v2/recordings). */
export type RTKRecording = {
  id: string
  status: RTKRecordingStatus
  /** Signed download link, present once UPLOADED; expires at `download_url_expiry`. */
  download_url?: string | null
  download_url_expiry?: string | null
  /** Bytes. */
  file_size?: number | null
  /** Seconds. */
  recording_duration?: number | null
  invoked_time?: string | null
  started_time?: string | null
  stopped_time?: string | null
  output_file_name?: string | null
  session_id?: string | null
}

type RecordingListResponse = {
  success: boolean
  data?: RTKRecording[]
  result?: RTKRecording[]
}

type RecordingResponse = {
  success: boolean
  data?: RTKRecording
  result?: RTKRecording
}

/** True when the RealtimeKit org id and API key are set. */
export function realtimeConfigured(): boolean {
  return Boolean(REALTIME_ORG_ID && REALTIME_API_KEY)
}

/**
 * Every recording (past and ongoing) of one RealtimeKit meeting:
 * GET /v2/recordings?meeting_id=<id>. `meetingId` is the RTK room id
 * (`Meeting.meetingId`), not our Mongo _id.
 */
export async function listMeetingRecordings(meetingId: string): Promise<RTKRecording[]> {
  const params = new URLSearchParams({ meeting_id: meetingId, per_page: "50" })
  const data = await cfFetch<RecordingListResponse>(`/recordings?${params.toString()}`, { method: "GET" })
  return data.data ?? data.result ?? []
}

/** One recording with a fresh download link: GET /v2/recordings/<recording_id>. */
export async function getRecording(recordingId: string): Promise<RTKRecording | null> {
  const data = await cfFetch<RecordingResponse>(`/recordings/${encodeURIComponent(recordingId)}`, { method: "GET" })
  return data.data ?? data.result ?? null
}
