export default function CreateChatChannel(pc:RTCPeerConnection){
    // const messages = []
   const channel = pc.createDataChannel('chat')
   channel.onopen = ()=>{
    console.log('channel created')
   }
//    channel.onmessage = (e)=>{
//     messages.push(e.data)
//    }
   return channel  
}