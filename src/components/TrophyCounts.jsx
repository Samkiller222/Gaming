const GRADES = [
  ['platinum', 'Platinum'],
  ['gold', 'Gold'],
  ['silver', 'Silver'],
  ['bronze', 'Bronze'],
]

// Earned/defined trophy counts per grade as small coloured cups.
export default function TrophyCounts({ t, compact = false }) {
  return (
    <span className={`trophy-counts ${compact ? 'compact' : ''}`}>
      {GRADES.filter(([g]) => t[`defined_${g}`] > 0).map(([g, label]) => (
        <span key={g} className={`cup ${g}`} title={label}>
          <Cup />
          <span className="sr-only">{label}</span>
          {t[`earned_${g}`]}
          {!compact && <span className="muted">/{t[`defined_${g}`]}</span>}
        </span>
      ))}
    </span>
  )
}

export function Cup() {
  return (
    <svg className="cup-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M7 3h10v2h3v3a4 4 0 0 1-4 4h-.3A5 5 0 0 1 13 14.9V17h3v4H8v-4h3v-2.1A5 5 0 0 1 8.3 12H8a4 4 0 0 1-4-4V5h3V3zm0 4H6v1a2 2 0 0 0 1 1.7V7zm10 0v2.7A2 2 0 0 0 18 8V7h-1z"
      />
    </svg>
  )
}
