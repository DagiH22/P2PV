import Host from './pages/Host'
import './App.css'

function App() {
  const pc = new RTCPeerConnection({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' }
    ]
  }) 
  return (
    <>
    <Host ></Host>
    </>
  )
}

export default App
