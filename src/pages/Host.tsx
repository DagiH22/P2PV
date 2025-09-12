import { useEffect, useRef, useState } from 'react';
import { createRoom, STUN_SERVERS } from '../utils/signaling';

function Host() {
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const [roomId, setRoomId] = useState<string>("");

  useEffect(() => {
    const pc = new RTCPeerConnection(STUN_SERVERS);

    // When a remote track is received
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      }
    };

    // Create room
    (async () => {
      const { roomId } = await createRoom(pc);
      console.log("🆔 Room created:", roomId);
      setRoomId(roomId);
    })();

    // Get local media and add tracks
    (async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      stream.getTracks().forEach((track) => {
        if (pc && pc.signalingState !== "closed") {
          pc.addTrack(track, stream);
        }
      });
    })();

    return () => {
      pc.close();
    };
  }, []);

  // Set local video
  useEffect(() => {
    if (localRef.current && localStream) {
      localRef.current.srcObject = localStream;
      console.log("Local stream set:", localStream);
    }
  }, [localStream]);

  // Set remote video
  useEffect(() => {
    if (remoteRef.current && remoteStream) {
      remoteRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const joinUrl = roomId ? `${location.origin}/join/${roomId}` : "";

  return (
    <div>
      <h1>P2PV</h1>
      <h2>Local Stream</h2>
      <video
        ref={localRef}
        autoPlay
        muted
        playsInline
        width={500}
        height={500}
      ></video>

      <h2>Remote Stream</h2>
      <video
        ref={remoteRef}
        autoPlay
        muted
        playsInline
        width={500}
        height={500}
      ></video>

      <p>{joinUrl}</p>
    </div>
  );
}

export default Host;
