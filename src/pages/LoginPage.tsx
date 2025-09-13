import { useAuth } from '../auth/AuthContext'

export default function LoginPage() {
  const { login } = useAuth()
  return (
    <div className="panel" style={{ padding: 24 }}>
      <h2>Login Required</h2>
      <p>You need to sign in to access sessions.</p>
      <button className="button" onClick={login}>Log in with EVE Online</button>
    </div>
  )
}

