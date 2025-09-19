import { useEffect, useRef, useState } from 'react';
import { createRoom, STUN_SERVERS } from '../utils/signaling';
import {
  getListOfCameras,
  getListOfMicrophones,
  getMediaStream,
} from "../utils/cameras";

function Host() {
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const localRef = useRef<HTMLVideoElement | null>(null);
  const remoteRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const [roomId, setRoomId] = useState<string>('');
  const pcRef = useRef<RTCPeerConnection | null>(null);

  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>("");
  const [selectedMicrophone, setSelectedMicrophone] = useState<string>("");

  useEffect(() => {
    async function loadDevices() {
      const camList = await getListOfCameras();
      const micList = await getListOfMicrophones();
      setCameras(camList);
      setMicrophones(micList);
      if (camList.length > 0 && !selectedCamera) {
        setSelectedCamera(camList[0].deviceId);
      }
      if (micList.length > 0 && !selectedMicrophone) {
        setSelectedMicrophone(micList[0].deviceId);
      }
    }

    loadDevices();

    navigator.mediaDevices.addEventListener("devicechange", loadDevices);

    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", loadDevices);
    };
  }, []);

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
  async function handleCameraChange(deviceId: string) {
    setSelectedCamera(deviceId);

    // Get new stream with selected camera
    const audioDeviceId = selectedMicrophone ? selectedCamera : undefined;
    const newStream = await getMediaStream(deviceId, audioDeviceId);
    setLocalStream(newStream);
    localStreamRef.current = newStream;

    // Replace track in RTCPeerConnection
    const videoTrack = newStream.getVideoTracks()[0];
    const sender = pcRef.current
      ?.getSenders()
      .find((s) => s.track?.kind === "video");

    if (sender && videoTrack) {
      sender.replaceTrack(videoTrack);
    }
  }
  async function handleMicrophoneChange(deviceId: string) {
    setSelectedMicrophone(deviceId);
    const videoDeviceId = selectedCamera ? selectedCamera : undefined;

    // Get new stream with selected microphone
    const newStream = await getMediaStream(videoDeviceId, deviceId);
    setLocalStream(newStream);
    localStreamRef.current = newStream;

    // Replace track in RTCPeerConnection
    const audioTrack = newStream.getAudioTracks()[0];
    const sender = pcRef.current
      ?.getSenders()
      .find((s) => s.track?.kind === "audio");

    if (sender && audioTrack) {
      sender.replaceTrack(audioTrack);
    }
  }

  const joinUrl = roomId ? `${location.origin}/join/${roomId}` : '';

  return (
    <div>
      <h1>P2PV</h1>
      <h2>host view</h2>
      <label htmlFor="device" className="block mb-2 font-medium">
        Choose a Camera:
      </label>
      <select
        id="device"
        value={selectedCamera}
        onChange={(e) => handleCameraChange(e.target.value)}
        className="border rounded-lg p-2"
      >
        {cameras.map((device) => (
          <option key={device.deviceId} value={device.deviceId}>
            {device.label || `Camera ${device.deviceId}`}
          </option>
        ))}
      </select>
      <br />
      <label htmlFor="audioDevice" className="block mb-2 font-medium">
        Choose a Microphone:
      </label>
      <select
        id="audioDevice"
        value={selectedMicrophone}
        onChange={(e) => handleMicrophoneChange(e.target.value)}
        className="border rounded-lg p-2"
      >
        {microphones.map((device) => (
          <option key={device.deviceId} value={device.deviceId}>
            {device.label || `Microphone ${device.deviceId}`}
          </option>
        ))}
      </select>





      <h2>Local Stream</h2>
      <video ref={localRef} autoPlay muted playsInline width={500} height={500} />
      <h2>Remote Stream</h2>
      <video ref={remoteRef} autoPlay muted playsInline width={500} height={500} />
      <p>{joinUrl}</p>
    </div>
  );
}

export default Host;
