import Host from './pages/Host'
import './App.css'
import Join from "./pages/Join"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState } from 'react';

function App() {
  // const pc = new RTCPeerConnection({
  //   iceServers: [
  //     { urls: 'stun:stun.l.google.com:19302' }
  //   ]
  // }) 
  type ChatMessage = {
    id: string;
    text: string;
    sender: "host" | "guest";
    time: string;
  };
  const [chatMessages,setChatMessages] = useState<ChatMessage[]>([])
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/host" />} />
        <Route path="/host" element={<Host chatMessages={chatMessages} setChatMessages={setChatMessages} />} />
        <Route path="/join/:roomId" element={<Join chatMessages={chatMessages} setChatMessages={setChatMessages} />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
