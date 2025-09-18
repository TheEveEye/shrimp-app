import { useAuth } from '../auth/AuthContext'
import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import Panel from '../components/ui/Panel'

export default function LoginPage() {
  const { login } = useAuth()
  const [search] = useSearchParams()
  const onLogin = useCallback(async () => {
    const returnTo = search.get('returnTo')
    if (returnTo) sessionStorage.setItem('shrimp.returnTo', returnTo)
    await login()
  }, [login, search])
  return (
    <Panel noBody style={{ padding: 24 }}>
      <h2>Login Required</h2>
      <p>You need to sign in to access sessions.</p>
      <button className="button" onClick={onLogin}>Log in with EVE Online</button>
    </Panel>
  )
}
