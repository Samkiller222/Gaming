import { useEffect, useMemo, useRef, useState } from 'react'
import { trophyTotals } from '../lib/psn.js'
import { rawgConfigured } from '../lib/rawg.js'
import TrophyCounts from './TrophyCounts.jsx'

// Modal for connecting a PSN account, syncing trophies and importing games.
export default function PsnPanel({ psn, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal wide" role="dialog" aria-modal="true" aria-labelledby="psn-title">
        <div className="modal-head">
          <h2 id="psn-title">PlayStation trophies</h2>
          <button className="ghost" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {psn.account ? <Connected psn={psn} /> : <Connect psn={psn} />}
      </div>
    </div>
  )
}

function Connect({ psn }) {
  const [onlineId, setOnlineId] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setError('')
    try {
      setStatus('Finding your account…')
      // Once connected, this view is replaced and <Connected> runs the first sync.
      await psn.connect(onlineId.trim())
    } catch (err) {
      setError(err.message)
    } finally {
      setStatus('')
    }
  }

  return (
    <form className="psn-connect" onSubmit={submit}>
      <p>
        Enter your PSN online ID to pull in trophy progress for your games. Your trophies must be
        public: on your PS5 go to <b>Settings → Users and Accounts → Privacy → Gaming | Media</b>{' '}
        and set <b>Trophies</b> to <b>Anyone</b>.
      </p>
      <div className="row">
        <input
          autoFocus
          placeholder="PSN online ID"
          value={onlineId}
          onChange={(e) => setOnlineId(e.target.value)}
          maxLength={16}
        />
        <button type="submit" disabled={!!status || !onlineId.trim()}>
          Connect
        </button>
      </div>
      {status && <p className="muted">{status}</p>}
      {error && <p className="error">{error}</p>}
    </form>
  )
}

function Connected({ psn }) {
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function run(label, action) {
    setBusy(label)
    setError('')
    setMessage('')
    try {
      await action()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy('')
    }
  }

  const sync = () =>
    run('Syncing…', async () => {
      const { count, matched } = await psn.sync()
      setMessage(
        `Synced ${count} trophy list${count === 1 ? '' : 's'}` +
          (matched ? `; linked ${matched} more game${matched === 1 ? '' : 's'}.` : '.'),
      )
    })

  // First sync right after connecting.
  const firstSync = useRef(false)
  useEffect(() => {
    if (!psn.account.last_synced_at && !firstSync.current) {
      firstSync.current = true
      sync()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const disconnect = () => {
    if (confirm('Disconnect PSN? Trophy data and game links will be removed from this app.'))
      run('Disconnecting…', psn.disconnect)
  }

  const a = psn.account
  const linkedCount = Object.keys(psn.gameByTitle).length

  return (
    <>
      <div className="psn-account">
        {a.avatar_url && <img src={a.avatar_url} alt="" />}
        <div>
          <b>{a.online_id}</b>
          <p className="muted">
            {psn.titles.length} trophy lists · {linkedCount} linked to your library
            <br />
            {a.last_synced_at
              ? `Last synced ${new Date(a.last_synced_at).toLocaleString()}`
              : 'Not synced yet'}
          </p>
        </div>
        <div className="psn-actions">
          <button onClick={sync} disabled={!!busy}>
            {busy === 'Syncing…' ? busy : 'Sync now'}
          </button>
          <button className="ghost danger" onClick={disconnect} disabled={!!busy}>
            Disconnect
          </button>
        </div>
      </div>
      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}
      <ImportList psn={psn} disabled={!!busy} />
    </>
  )
}

function ImportList({ psn, disabled }) {
  const candidates = useMemo(
    () => psn.titles.filter((t) => !psn.gameByTitle[t.np_communication_id]),
    [psn.titles, psn.gameByTitle],
  )
  const [selected, setSelected] = useState(() => new Set())
  const [progress, setProgress] = useState(null)
  const [results, setResults] = useState(null)

  // Forget selections that have since been imported or disappeared.
  const picked = candidates.filter((t) => selected.has(t.np_communication_id))
  const allPicked = candidates.length > 0 && picked.length === candidates.length

  const toggle = (id) =>
    setSelected((s) => {
      const next = new Set(s)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  async function runImport() {
    setResults(null)
    const res = await psn.importTitles(picked, (i, t) =>
      setProgress(t ? `Importing ${i + 1} of ${picked.length}: ${t.title}` : null),
    )
    setSelected(new Set())
    setResults(res)
  }

  return (
    <section className="psn-import">
      <div className="psn-import-head">
        <h3>Import from PSN</h3>
        {candidates.length > 0 && (
          <label className="location-option">
            <input
              type="checkbox"
              checked={allPicked}
              disabled={!!progress}
              onChange={() =>
                setSelected(allPicked ? new Set() : new Set(candidates.map((t) => t.np_communication_id)))
              }
            />
            Select all
          </label>
        )}
      </div>
      {!rawgConfigured ? (
        <p className="muted">Importing needs the RAWG API key to look games up.</p>
      ) : candidates.length === 0 ? (
        <p className="muted">
          {psn.titles.length
            ? 'Every trophy list is already linked to a game in your library.'
            : 'Sync to see the games on your trophy list.'}
        </p>
      ) : (
        <ul className="psn-list">
          {candidates.map((t) => {
            const { earned, defined } = trophyTotals(t)
            return (
              <li key={t.np_communication_id}>
                <label>
                  <input
                    type="checkbox"
                    checked={selected.has(t.np_communication_id)}
                    disabled={!!progress}
                    onChange={() => toggle(t.np_communication_id)}
                  />
                  <img src={t.icon_url} alt="" loading="lazy" />
                  <span className="psn-list-title">
                    {t.title}
                    <span className="muted">
                      {t.platform.replace(/,/g, ' / ')} · {t.progress}% · {earned}/{defined}
                    </span>
                  </span>
                  <TrophyCounts t={t} compact />
                </label>
              </li>
            )
          })}
        </ul>
      )}
      {progress && <p className="muted">{progress}</p>}
      {candidates.length > 0 && rawgConfigured && (
        <button onClick={runImport} disabled={disabled || !!progress || picked.length === 0}>
          {picked.length ? `Import ${picked.length} game${picked.length === 1 ? '' : 's'}` : 'Import'}
        </button>
      )}
      {results && <ImportResults results={results} />}
    </section>
  )
}

function ImportResults({ results }) {
  const { added, linked, failed } = results
  return (
    <div className="psn-results">
      {added.length > 0 && (
        <p className="success">
          Added {added.length} game{added.length === 1 ? '' : 's'} to your library.
        </p>
      )}
      {linked.length > 0 && (
        <p className="success">
          Linked trophies to {linked.length} game{linked.length === 1 ? '' : 's'} you already had.
        </p>
      )}
      {failed.length > 0 && (
        <>
          <p className="error">Couldn’t import {failed.length}:</p>
          <ul className="psn-failed">
            {failed.map((f) => (
              <li key={f.title}>
                {f.title} — <span className="muted">{f.reason}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
