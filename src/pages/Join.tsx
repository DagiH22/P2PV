import { useEffect, useRef, useState } from "react";
import { joinRoom, STUN_SERVERS } from "../utils/signaling";
import { useParams } from "react-router-dom";
import {
  getListOfCameras,
  getListOfMicrophones,
  getMediaStream,
} from "../utils/cameras";

function Join() {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>("");
  const [selectedMicrophone, setSelectedMicrophone] = useState<string>("");

  const { roomId } = useParams<{ roomId: string }>();

  // Load available cameras on mount
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

  // Get stream & connect to peer when roomId is available
  useEffect(() => {
    if (!roomId) {
      console.warn("No room ID provided");
      return;
    }

    let pc: RTCPeerConnection | null = null;

    (async () => {
      try {
        const stream = await getMediaStream(selectedCamera);
        setLocalStream(stream);
        localStreamRef.current = stream;

        pc = new RTCPeerConnection(STUN_SERVERS);
        pcRef.current = pc;

        // Add local tracks to connection
        stream.getTracks().forEach((track) => pc?.addTrack(track, stream));

        pc.ontrack = (event) => {
          console.log("📡 Remote track received");
        
          // If we already have a remote stream, reuse it
          setRemoteStream((prevStream) => {
            let stream = prevStream ?? new MediaStream();
        
            // Add the new track if it's not already in the stream
            if (!stream.getTracks().includes(event.track)) {
              stream.addTrack(event.track);
            }
        
            // Attach once when stream is first created
            if (!prevStream && remoteRef.current) {
              remoteRef.current.srcObject = stream;
              remoteRef.current
                .play()
                .catch((err) => console.warn("Autoplay blocked:", err));
            }
        
            return stream;
          });
        };
        
        

        await joinRoom(roomId, pc);
      } catch (err) {
        console.error("Failed to join room:", err);
      }
    })();

    return () => {
      if (pc && pc.signalingState !== "closed") {
        console.log("Closing peer connection...");
        pc.close();
      }
      pcRef.current = null;
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [roomId]);
  
  // Update local video preview when stream changes
  useEffect(() => {
    if (localRef.current && localStream) {
      localRef.current.srcObject = localStream;
      localRef.current.muted = true;
    }
  }, [localStream]);

  // Update remote video when stream changes
  useEffect(() => {
    if (remoteRef.current && remoteStream) {
      remoteRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Handle camera selection change
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
  function toggleAudio() {
    if (!localStream) return
    const audioTrack = localStream.getAudioTracks()[0]
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled
    }

  }
  function toggleVideo() {
      if (!localStream) return;
    
      const videoTrack = localStream.getVideoTracks()[0];
    
      if (videoTrack) {
        // Find the sender for the video track
        const sender = pcRef.current
          ?.getSenders()
          .find((s) => s.track === videoTrack);
    
        if (sender) {
          if (videoTrack.enabled) {
            // If video is currently enabled, disable it by replacing the track with null
            sender.replaceTrack(null);
            videoTrack.enabled = false;
          } else {
            // If video is currently disabled, get a new video stream and replace the track
            getMediaStream(selectedCamera, selectedMicrophone).then((newStream) => {
              const newVideoTrack = newStream.getVideoTracks()[0];
              sender.replaceTrack(newVideoTrack);
              setLocalStream(newStream);
            });
          }
        }
      }
    }
  
  
  return (
    <div>
      <h1>P2PV</h1>
      <h2>Guest View</h2>

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

      <h3>Local Stream</h3>
      <video
        ref={localRef}
        autoPlay
        muted
        playsInline
        width={500}
        height={300}
      />

      <h3>Remote Stream</h3>
      <video
        ref={remoteRef}
        autoPlay
        playsInline
        width={500}
        height={300}
      />
      <button onClick={toggleAudio}> toggle audio</button>
      <button onClick={toggleVideo}> toggle video</button>
    </div>
  );
}

export default Join;
