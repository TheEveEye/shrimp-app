import { useEffect, useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

function App() {
  const [count, setCount] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`${API_BASE}/counter`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (!cancelled) setCount(data.count ?? 0)
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Failed to load count')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  async function increment() {
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/counter/increment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setCount(data.count ?? 0)
    } catch (e: any) {
      setError(e?.message ?? 'Failed to increment')
    }
  }

  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Shrimp Counter</h1>
      <div className="card">
        <button onClick={increment} disabled={loading}>
          {loading ? 'Loading…' : `Count is ${count}`}
        </button>
        {error && (
          <p style={{ color: 'crimson', marginTop: 8 }}>Error: {error}</p>
        )}
        <p>
          This button increments a shared counter stored in Postgres.
        </p>
      </div>
      <p className="read-the-docs">API: {API_BASE}</p>
    </>
  )
}

export default App
