import {useState} from 'react'
type ChatMessage ={
    id: string;
    text: string;
    sender: 'host'|'guest'
    time: string;
}

type MessageBoxProps = {
    channel?: RTCDataChannel;
    chats: ChatMessage[],
    source:'host'|'guest',
    setChatMessages:React.Dispatch<React.SetStateAction<ChatMessage[]>>
  };
  // setChatMessages(prev => [
  //   ...prev,
  //   {
  //     id: crypto.randomUUID(),
  //     text: "Hello!",
  //     sender: "me",
  //     time: new Date().toLocaleTimeString(),
  //   },
  // ]);
  
  function MessageBox({ channel, chats, source,setChatMessages}: MessageBoxProps) {
    const [message, setMessage] = useState("");
  
    const handleSend = () => {
      if (channel) {
        const newMessage: ChatMessage = {
          id: crypto.randomUUID(),
          text: message,
          sender: source,
          time: new Date().toLocaleTimeString(),
        };
        console.log("Sending message:", JSON.stringify(newMessage));
        setChatMessages(prev => [...prev, newMessage]); 
        channel.send(JSON.stringify(newMessage));
        setMessage("");
      }
    };
  
    return (
      <div>
         <ul>
      {chats.map((chat,index) => (
        <li key={chat.id ?? index}>
          <strong>{chat.sender}:</strong> {chat.text || '<empty message>'}
          <small> ({chat.time})</small>
        </li>
      ))}
    </ul>
  
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type a message"
        />
  
        <button onClick={handleSend}>Send</button>
      </div>
    );
  }
  

export default MessageBox