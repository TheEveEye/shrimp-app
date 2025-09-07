import './App.css'
import SovCampaignsTable from './components/SovCampaignsTable'

function App() {
  return (
    <div className="container">
      <header className="page-header">
        <div>
          <h1 className="title">Sovereignty Campaigns</h1>
          <p className="subtitle">Live Sovereignty Hub timers streamed from ESI</p>
        </div>
      </header>
      <SovCampaignsTable />
    </div>
  )
}

export default App
