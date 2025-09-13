import './App.css'
import SovCampaignsTable from './components/SovCampaignsTable'
import { Routes, Route } from 'react-router-dom'
import AuthCallback from './auth/AuthCallback'
import NavBar from './components/NavBar'

function App() {
  return (
    <>
      <NavBar />
      <main className="container main-content">
        <header className="page-header">
          <div>
            <h1 className="title">Sovereignty Campaigns</h1>
            <p className="subtitle">Live Sovereignty Hub timers streamed from ESI</p>
          </div>
        </header>
        <Routes>
          <Route path="/" element={<SovCampaignsTable />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
        </Routes>
      </main>
    </>
  )
}

export default App
