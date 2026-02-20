import { useState } from "react";

export default function SignalDashboard() {
  const [text, setText] = useState("");
  
  return (
    <div style={{ background: "#1C1B1F", height: "100vh", padding: 50 }}>
      <h1 style={{ color: "white", marginBottom: 20 }}>Type test</h1>
      <textarea 
        value={text} 
        onChange={e => setText(e.target.value)}
        style={{ width: 400, height: 200, fontSize: 16, padding: 10 }}
        placeholder="Type here..."
      />
      <p style={{ color: "white", marginTop: 10 }}>You typed: {text}</p>
    </div>
  );
}
