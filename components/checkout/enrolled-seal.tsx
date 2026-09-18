/** The drawn seal on "Enrollment confirmed". Success green: money moved the right way. */
export function EnrolledSeal() {
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" fill="none" aria-hidden className="mx-auto text-ws-success">
      <circle cx="36" cy="36" r="28" className="fill-current opacity-10" />
      <circle
        cx="36"
        cy="36"
        r="28"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        transform="rotate(-90 36 36)"
        className="ws-seal-ring"
      />
      <path
        d="M24 37.5 32.5 46 49 28.5"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="ws-seal-tick"
      />
    </svg>
  )
}
