import {useRef} from 'react' 
import createRoom from '../utils/signaling';


function Host(pc: RTCPeerConnection) {
 
createRoom(pc)






  const videoRef = useRef<HTMLVideoElement | null >(null)
  navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((stream) => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  })

    
  return (
    <div>
        <h1>P2PV</h1>
        <video ref={videoRef} autoPlay width={500} height={500} muted src=""></video>
    </div>
  )
}

export default Host