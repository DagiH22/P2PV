import Host from './pages/Host'
import './App.css'
import Join from "./pages/Join"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

function App() {
  // const pc = new RTCPeerConnection({
  //   iceServers: [
  //     { urls: 'stun:stun.l.google.com:19302' }
  //   ]
  // }) 
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/host" />} />
        <Route path="/host" element={<Host />} />
        <Route path="/join/:roomId" element={<Join />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
