import { useEffect, useRef, useState } from 'react';
import { createRoom, STUN_SERVERS } from '../utils/signaling';

function Host() {
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const localRef = useRef<HTMLVideoElement | null>(null);
  const remoteRef = useRef<HTMLVideoElement | null>(null);
  const [roomId, setRoomId] = useState<string>('');
  const pcRef = useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    const pc = new RTCPeerConnection(STUN_SERVERS);
    pcRef.current = pc;

    // debug hooks — helpful when things look wrong
    pc.oniceconnectionstatechange = () => {
      console.log('ICE state:', pc.iceConnectionState);
    };
    pc.onconnectionstatechange = () => {
      console.log('Connection state:', pc.connectionState);
    };

    // set handler early
    pc.ontrack = (event) => {
      console.log('📡 Host: remote track received', event);
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      } else {
        // fallback: create a stream and add this track (covers some browsers)
        const ms = new MediaStream();
        ms.addTrack(event.track);
        setRemoteStream(ms);
      }
    };

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
        // Add local tracks
        stream.getTracks().forEach((track) => {
          if (pc && pc.signalingState !== 'closed') {
            pc.addTrack(track, stream);
            console.log('Added local track:', track.kind);
          }
        });

        // create room (this should create offer, setLocalDescription, save to your signalling backend)
        const { roomId } = await createRoom(pc);
        console.log('🆔 Room created:', roomId);
        setRoomId(roomId);
      } catch (err) {
        console.error('Host error getting media / creating room:', err);
      }
    })();

    return () => {
      try {
        pc.close();
      } catch (e) {}
      localStream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // set local video
  useEffect(() => {
    if (localRef.current && localStream) {
      localRef.current.srcObject = localStream;
      // local is muted to avoid echo
      localRef.current.muted = true;
    }
  }, [localStream]);

  // set remote video
  useEffect(() => {
    if (remoteRef.current && remoteStream) {
      remoteRef.current.srcObject = remoteStream;
      // remote on host is muted in your original code; keep it muted so autoplay works
      remoteRef.current.muted = true;
      remoteRef.current.play().catch((e) => console.warn('Host: remote autoplay blocked', e));
    }
  }, [remoteStream]);

  const joinUrl = roomId ? `${location.origin}/join/${roomId}` : '';

  return (
    <div>
      <h1>P2PV</h1>
      <h2>host view</h2>
      <h2>Local Stream</h2>
      <video ref={localRef} autoPlay muted playsInline width={500} height={500} />
      <h2>Remote Stream</h2>
      <video ref={remoteRef} autoPlay muted playsInline width={500} height={500} />
      <p>{joinUrl}</p>
    </div>
  );
}

export default Host;
