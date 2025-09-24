import { useEffect, useRef, useState } from "react";
import { joinRoom, STUN_SERVERS } from "../utils/signaling";
import { useParams } from "react-router-dom";
import {
  getListOfCameras,
  getListOfMicrophones,
  getMediaStream,
} from "../utils/cameras";
import MessageBox from "../components/MessageBox";

type ChatMessage = {
  id: string;
  text: string;
  sender: "host" | "guest";
  time: string;
};

function Join({
  chatMessages,
  setChatMessages,
}: {
  chatMessages: ChatMessage[];
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}) {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream>(new MediaStream());

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>("");
  const [selectedMicrophone, setSelectedMicrophone] = useState<string>("");
  const [channel, setChannel] = useState<RTCDataChannel>();
  const [shareScreen, setShareScreen] = useState<boolean>(false);

  const { roomId } = useParams<{ roomId: string }>();

  // Load available devices
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

  // Setup PeerConnection when joining
  useEffect(() => {
    if (!roomId) {
      console.warn("No room ID provided");
      return;
    }

    let pc: RTCPeerConnection | null = null;

    (async () => {
      try {
        const stream = await getMediaStream(selectedCamera, selectedMicrophone);
        setLocalStream(stream);
        localStreamRef.current = stream;

        pc = new RTCPeerConnection(STUN_SERVERS);
        pcRef.current = pc;

        pc.ondatachannel = (e) => {
          const chan = e.channel;
          setChannel(chan);
        };

        // Add local tracks
        stream.getTracks().forEach((track) => pc?.addTrack(track, stream));

        // Remote track handler
        pc.ontrack = (event) => {
          console.log("📡 Remote track received:", event.track.kind);
          if (!remoteStreamRef.current.getTracks().includes(event.track)) {
            remoteStreamRef.current.addTrack(event.track);
          }
          if (remoteRef.current) {
            remoteRef.current.srcObject = remoteStreamRef.current;
            remoteRef.current
              .play()
              .catch((err) => console.warn("Autoplay blocked:", err));
          }
        };

        await joinRoom(roomId, pc);
      } catch (err) {
        console.error("Failed to join room:", err);
      }
    })();

    return () => {
      if (pc && pc.signalingState !== "closed") {
        pc.close();
      }
      pcRef.current = null;
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [roomId, selectedCamera, selectedMicrophone]);

  // Local preview
  useEffect(() => {
    if (localRef.current && localStream) {
      localRef.current.srcObject = localStream;
      localRef.current.muted = true;
    }
  }, [localStream]);

  // Handle data channel messages
  useEffect(() => {
    if (!channel) return;
    channel.onmessage = (e) => {
      const receivedMessage: ChatMessage = JSON.parse(e.data);
      setChatMessages((prev) => [...prev, receivedMessage]);
    };
  }, [channel]);

  // Switch camera
  async function handleCameraChange(deviceId: string) {
    setSelectedCamera(deviceId);
    const newStream = await getMediaStream(deviceId, selectedMicrophone);
    setLocalStream(newStream);
    localStreamRef.current = newStream;

    const videoTrack = newStream.getVideoTracks()[0];
    const sender = pcRef.current
      ?.getSenders()
      .find((s) => s.track?.kind === "video");

    if (sender && videoTrack) {
      sender.replaceTrack(videoTrack);
    }
  }

  // Switch microphone
  async function handleMicrophoneChange(deviceId: string) {
    setSelectedMicrophone(deviceId);
    const newStream = await getMediaStream(selectedCamera, deviceId);
    setLocalStream(newStream);
    localStreamRef.current = newStream;

    const audioTrack = newStream.getAudioTracks()[0];
    const sender = pcRef.current
      ?.getSenders()
      .find((s) => s.track?.kind === "audio");

    if (sender && audioTrack) {
      sender.replaceTrack(audioTrack);
    }
  }

  // Toggle audio
  function toggleAudio() {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
    }
  }

  // Toggle video
  function toggleVideo() {
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
    }
  }

  // Screen share
  function screenShare() {
    if (!pcRef.current) return;

    if (!shareScreen) {
      navigator.mediaDevices
        .getDisplayMedia({ video: true })
        .then((stream) => {
          const screenTrack = stream.getVideoTracks()[0];
          const sender = pcRef.current
            ?.getSenders()
            .find((s) => s.track?.kind === "video");

          if (sender && screenTrack) {
            sender.replaceTrack(screenTrack);
            setShareScreen(true);

            if (localStreamRef.current) {
              const audioTrack = localStreamRef.current.getAudioTracks()[0];
              if (audioTrack) {
                stream.addTrack(audioTrack);
              }
            }

            setLocalStream(stream);
            localStreamRef.current = stream;

            screenTrack.onended = () => {
              console.log('🛑 Screen sharing stopped');
              handleCameraChange(selectedCamera);
              setShareScreen(false);
            };
          }
        });
    } else {
      console.log('🛑 Screen sharing stopped');
      handleCameraChange(selectedCamera);
      setShareScreen(false);
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
      <video ref={localRef} autoPlay muted playsInline width={500} height={300} />

      <h3>Remote Stream</h3>
      <video ref={remoteRef} autoPlay playsInline width={500} height={300} />

      <button onClick={toggleAudio}>Toggle audio</button>
      <button onClick={toggleVideo}>Toggle video</button>
      <button onClick={screenShare}>Share screen</button>

      <MessageBox
        channel={channel}
        chats={chatMessages}
        source={"guest"}
        setChatMessages={setChatMessages}
      />
    </div>
  );
}

export default Join;
