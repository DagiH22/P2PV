import { collection, doc, getDoc, setDoc, onSnapshot, addDoc,serverTimestamp } from "firebase/firestore";
import { db } from "../services/firebase";
import { Timestamp } from "firebase/firestore";
export type RoomRefs = {
    roomRef: ReturnType<typeof doc>;
    offerCandidates: ReturnType<typeof collection>;
    answerCandidates: ReturnType<typeof collection>;
  };
  interface RoomData {
    offer?: RTCSessionDescriptionInit;
    answer?: RTCSessionDescriptionInit;
    createdAt?: Timestamp; // Firebase timestamp (can use Firestore.Timestamp if imported)
  }

export function roomRefs(roomId: string): RoomRefs {
    const roomRef = doc(db, "rooms", roomId);
    const offerCandidates = collection(roomRef, "offerCandidates");
    const answerCandidates = collection(roomRef, "answerCandidates");
    return { roomRef, offerCandidates, answerCandidates };
  }

  function cleanCandidate(candidate: RTCIceCandidateInit) {
    return {
      candidate: candidate.candidate ?? "",
      sdpMid: candidate.sdpMid ?? "",
      sdpMLineIndex: candidate.sdpMLineIndex ?? 0,
      usernameFragment: candidate.usernameFragment ?? "",
    };
  }
  export const STUN_SERVERS: RTCConfiguration = {
    iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }],
  };


export async function createRoom(pc: RTCPeerConnection) {
    const roomRef = doc(collection(db, "rooms"));
    const roomId = roomRef.id;
    
    const offerCandidates = collection(roomRef, "offerCandidates");
    const answerCandidates = collection(roomRef, "answerCandidates");

    pc.onicecandidate = async (e) => {
      if (e.candidate) {
        await addDoc(offerCandidates, cleanCandidate(e.candidate.toJSON()));
      }
    };
    const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true })
    await pc.setLocalDescription(offer);
      const roomWithOffer = {
        'offer': {
          type: offer.type,
          sdp: offer.sdp,
        },
        createdAt: serverTimestamp()
      };
    await setDoc(roomRef, roomWithOffer);
    

    const pendingCandidates: RTCIceCandidateInit[] = [];
    let remoteDescSet = false;


     const unsubAnswer = onSnapshot(roomRef,async (snapshot) => {
      const data = snapshot.data();
      if (!data) return;
      if (!pc.currentRemoteDescription && data?.answer){
          try{
              await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
                remoteDescSet = true;
            }catch (err) {
                console.warn("Failed to set remote description:", err);
            }
    for (const c of pendingCandidates) {
        await pc.addIceCandidate(new RTCIceCandidate(c));
      }
      pendingCandidates.length = 0;
    }
    });
    const unsubCandidates = onSnapshot(answerCandidates, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const candidate = change.doc.data() as RTCIceCandidateInit
            if (!remoteDescSet) {
                pendingCandidates.push(candidate);
                return;
            }
            else{
                pc.addIceCandidate(new RTCIceCandidate(candidate));
            }
        }
      });
    });
    return {roomId, cleanup: () => { unsubAnswer(); unsubCandidates(); }}
  }

 export async function joinRoom(roomId: string ,pc: RTCPeerConnection){
    const {roomRef, answerCandidates, offerCandidates} = roomRefs(roomId)
    pc.onicecandidate = (e) => {
      if (e.candidate) {
      try{
        addDoc(answerCandidates, cleanCandidate(e.candidate.toJSON()));
      } catch (err) {
        console.error("Failed to add mobile ICE candidate:", err, e.candidate);
      }
      }
    };

    const roomSnap= await getDoc(roomRef)
    if(!roomSnap.exists()){
      alert("Room does not exist")
      return
    }
    const roomData = roomSnap.data() as RoomData;
    const offer = roomData.offer
    if(!offer){
      alert("Offer not found")
      return
    }
    await pc.setRemoteDescription(new RTCSessionDescription(offer))

    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    await setDoc(roomRef, {answer:{type: answer.type, sdp:answer.sdp}}, {merge:true})

    const unsub = onSnapshot(offerCandidates, (snapshot) => {
        snapshot.docChanges().forEach(change => {
            if(change.type === "added"){
                const data = change.doc.data()
                pc.addIceCandidate(new RTCIceCandidate(data))
            }
            
        })
    })
    return { cleanup: () => unsub() };
  }

