import { useRef, useEffect } from 'react'

export function AgentView({ 
  messages, 
  prompt, 
  setPrompt, 
  handleSend, 
  messagesEndRef 
}) {
  const textareaRef = useRef(null)

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }, [prompt])

  const handleKeyDown = (e) => { 
    if (e.key === 'Enter' && !e.shiftKey) { 
      e.preventDefault(); 
      handleSend(); 
    } 
  }

  return (
    <div className="chat-container">
      <div className="messages-list">
        {messages.length === 0 ? (
          <div className="welcome-screen">
            <h1>O que você deseja?</h1>
            <p className="subtitle">Um prompt: é o que falta para você transformar palavras em dinheiro.</p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`message ${msg.role}`}>
              <div className="message-content"><p>{msg.content}</p></div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="input-area">
        <div className="prompt-wrapper">
          <button className="btn-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></button>
          <textarea ref={textareaRef} placeholder="Comece um novo chat..." value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={handleKeyDown} rows={1} />
          <button className="btn-send" onClick={handleSend} disabled={!prompt.trim()}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg></button>
        </div>
      </div>
    </div>
  )
}
