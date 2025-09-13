import { useEffect, useRef, useState } from "react";
import { joinRoom, STUN_SERVERS } from "../utils/signaling";
import { useParams } from "react-router-dom";

function Join() {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const { roomId } = useParams<{ roomId: string }>();
  const localStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!roomId) {
      console.warn("No room ID provided");
      return;
    }
    let pc: RTCPeerConnection | null = null;

    // if (!pcRef.current) {
    //     pcRef.current = new RTCPeerConnection(STUN_SERVERS);
    //     console.log("Created PeerConnection");
    //   }
    //   const pc = pcRef.current;

    (async () => {
      try {
        // 1️⃣ Get local stream first
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        setLocalStream(stream);
        localStreamRef.current = stream;

        pc = new RTCPeerConnection(STUN_SERVERS);
        pcRef.current = pc;

        // Add local tracks before answering
        stream.getTracks().forEach((track) =>{
            if (pc && pc.signalingState !== "closed") {
            pc.addTrack(track, stream)}});

        if (pc && pc.signalingState !== "closed") {
        pc.ontrack = (event) => {
            console.log("📡 Remote track received");
            if (event.streams && event.streams[0]) {
            setRemoteStream(event.streams[0]);
            // console.log("Remote stream set:", event.streams[0]);
            }
        }}
        // 2️⃣ Now join the room
        await joinRoom(roomId, pc);
      } catch (err) {
        console.error("Failed to join room:", err);
      }
    })();
   

    return () => {
    if (pc && pc.signalingState !== "closed") {
        console.log("Closing peer connection...");
        pc.close()
    }
      pcRef.current = null;
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [roomId]);

  useEffect(() => {
    if (localRef.current && localStream) {
      localRef.current.srcObject = localStream;
      console.log("Local stream set:", localStream);
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteRef.current && remoteStream) {
      remoteRef.current.srcObject = remoteStream;
      remoteRef.current
        .play()
        .catch((err) => console.warn("Autoplay blocked:", err));
    }
  }, [remoteStream]);

  return (
    <div>
      <h1>P2PV</h1>
      <h2>Guest View</h2>

      <h3>Local Stream</h3>
      <video ref={localRef} autoPlay muted playsInline width={500} height={500} />

      <h3>Remote Stream</h3>
      <video ref={remoteRef} autoPlay playsInline width={500} height={500} />
    </div>
  );
}

export default Join;
