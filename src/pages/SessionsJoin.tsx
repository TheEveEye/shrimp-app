import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSessions } from '../sessions/SessionsContext'

export default function SessionsJoin() {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { joinWithCode } = useSessions()
  const nav = useNavigate()

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { id } = await joinWithCode(code)
      nav(`/sessions/${id}/dashboard`)
    } catch (e: any) {
      const msg = e?.message
      if (msg === 'invalid') setError('Invalid join code.')
      else if (msg === 'ended') setError('This session has ended.')
      else if (msg === 'forbidden') setError('You do not have access to this session.')
      else setError('Failed to join session.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="panel" style={{ maxWidth: 520 }}>
      <div className="panel-header"><div className="panel-title">Join Session</div></div>
      <div className="panel-body">
        <form onSubmit={onSubmit}>
          <label className="form-label">Join Code</label>
          <input className="input" value={code} onChange={e => setCode(e.target.value)} placeholder="e.g., 12-ABCDEF" required />
          {error ? <div className="form-error" role="alert" style={{ marginTop: 8 }}>{error}</div> : null}
          <div style={{ marginTop: 12 }}>
            <button className="button primary" type="submit" disabled={loading}>{loading ? 'Joining…' : 'Join'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
