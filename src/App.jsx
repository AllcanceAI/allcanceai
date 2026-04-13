import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'
import Auth from './Auth'

function App() {
  const [session, setSession] = useState(null)
  const [prompt, setPrompt] = useState('')
  const [chats, setChats] = useState([])
  const [currentChatId, setCurrentChatId] = useState(null)
  const [messages, setMessages] = useState([])
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeTab, setActiveTab ] = useState('agente')
  const [activeInstruction, setActiveInstruction] = useState(null)
  const [activeSettingView, setActiveSettingView] = useState('main')
  const [copied, setCopied] = useState(false)
  const [menuOpenId, setMenuOpenId] = useState(null)
  
  const [tokenUsage, setTokenUsage] = useState({ 
    monthlyUsed: 0, 
    periodUsed: 0, 
    totalMonthly: 500000,
    plan: 'monthly' 
  })
  const [userPlan, setUserPlan] = useState('monthly')

  const textareaRef = useRef(null)
  const messagesEndRef = useRef(null)
  const typingBufferRef = useRef('')
  const typingIntervalRef = useRef(null)

  const PLAN_LIMITS = {
    daily: 16666,
    weekly: 125000,
    monthly: 500000
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const userId = session?.user?.id

  useEffect(() => {
    if (userId) {
      const saved = localStorage.getItem(`allcance_chats_${userId}`)
      setChats(saved ? JSON.parse(saved) : [])
    } else {
      setChats([])
    }
  }, [userId])

  useEffect(() => {
    if (userId) {
      localStorage.setItem(`allcance_chats_${userId}`, JSON.stringify(chats))
    }
  }, [chats, userId])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.item-menu-dropdown') && !e.target.closest('.item-menu-trigger')) {
        setMenuOpenId(null)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  const fetchUserData = async () => {
    if (!userId) return

    const { data: userData } = await supabase.from('users').select('token_plan').eq('id', userId).single()
    let currentPlan = 'monthly'
    if (userData) { setUserPlan(userData.token_plan); currentPlan = userData.token_plan; }

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    let startOfPeriod
    if (currentPlan === 'daily') {
      startOfPeriod = new Date(new Date().setHours(0,0,0,0)).toISOString()
    } else if (currentPlan === 'weekly') {
      const d = new Date(); const day = d.getDay(); const diff = d.getDate() - day + (day === 0 ? -6 : 1)
      const date = new Date(d.setDate(diff)); date.setHours(0,0,0,0)
      startOfPeriod = date.toISOString()
    } else { startOfPeriod = startOfMonth }

    const { data: messagesData } = await supabase.from('messages').select('input_tokens, output_tokens, created_at').eq('user_id', userId).gte('created_at', startOfMonth)
    if (messagesData) {
      const monthlyTotal = messagesData.reduce((acc, curr) => acc + (curr.input_tokens || 0) + (curr.output_tokens || 0), 0)
      const periodTotal = messagesData.filter(m => new Date(m.created_at) >= new Date(startOfPeriod)).reduce((acc, curr) => acc + (curr.input_tokens || 0) + (curr.output_tokens || 0), 0)
      setTokenUsage({ monthlyUsed: monthlyTotal, periodUsed: periodTotal, totalMonthly: 500000, plan: currentPlan })
    }
  }

  useEffect(() => { fetchUserData() }, [userId])

  const currentChat = chats.find(c => c.id === currentChatId)
  useEffect(() => { if (currentChat) setMessages(currentChat.messages); else setMessages([]); }, [currentChatId])

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  useEffect(() => { scrollToBottom() }, [messages])

  const startTypingLoop = () => {
    if (typingIntervalRef.current) return
    typingIntervalRef.current = setInterval(() => {
      if (typingBufferRef.current.length > 0) {
        const char = typingBufferRef.current.charAt(0)
        typingBufferRef.current = typingBufferRef.current.substring(1)
        setMessages(prev => {
          const updated = [...prev]
          const lastMsg = updated[updated.length - 1]
          if (lastMsg && lastMsg.role === 'assistant') {
            updated[updated.length - 1] = { ...lastMsg, content: lastMsg.content + char }
          }
          return updated
        })
      }
    }, 25)
  }

  const stopTypingLoop = () => { clearInterval(typingIntervalRef.current); typingIntervalRef.current = null; }

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }, [prompt])

  const handleSend = async () => {
    if (!prompt.trim() || !userId) return
    const periodLimit = PLAN_LIMITS[tokenUsage.plan]
    if (tokenUsage.monthlyUsed >= 500000) { alert('Limite MENSAL atingido.'); return; }
    if (tokenUsage.periodUsed >= periodLimit) { alert('Cota atingida.'); return; }

    const userMessage = { role: 'user', content: prompt }
    let chatId = currentChatId
    let updatedChats = [...chats]

    if (!chatId) {
      chatId = Date.now().toString()
      const newChat = { id: chatId, title: prompt.substring(0, 30) + (prompt.length > 30 ? '...' : ''), messages: [userMessage], timestamp: new Date().toISOString(), pinned: false }
      updatedChats = [newChat, ...chats]; setChats(updatedChats); setCurrentChatId(chatId)
    } else {
      const chatIndex = updatedChats.findIndex(c => c.id === chatId)
      const currentMessages = [...updatedChats[chatIndex].messages, userMessage]
      updatedChats[chatIndex] = { ...updatedChats[chatIndex], messages: currentMessages }; setChats(updatedChats)
    }
    setPrompt('')
    
    try {
      await supabase.from('messages').insert([{ chat_id: chatId, user_id: userId, role: 'user', content: prompt }])
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_GROQ_API_KEY}` },
        body: JSON.stringify({
          model: import.meta.env.VITE_GROQ_MODEL || 'llama-3.3-70b-versatile',
          messages: [{ role: 'system', content: 'Você é AllcanceAI.' }, ...(updatedChats.find(c => c.id === chatId).messages.map(m => ({ role: m.role, content: m.content })))],
          temperature: 0.7, max_tokens: 2048, stream: true, stream_options: { include_usage: true }
        })
      })

      const reader = response.body.getReader(); const decoder = new TextDecoder()
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]); typingBufferRef.current = ''; startTypingLoop()

      let fullContent = ''; let finalUsage = { input_tokens: 0, output_tokens: 0 }
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value); const lines = chunk.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const data = JSON.parse(line.substring(6))
              if (data.choices?.[0]?.delta?.content) { typingBufferRef.current += data.choices[0].delta.content; fullContent += data.choices[0].delta.content; }
              if (data.usage) { finalUsage = { input_tokens: data.usage.prompt_tokens, output_tokens: data.usage.completion_tokens } }
            } catch (e) {}
          }
        }
      }
      
      const checkEnd = setInterval(() => {
        if (typingBufferRef.current.length === 0) {
          stopTypingLoop(); clearInterval(checkEnd)
          supabase.from('messages').insert([{ chat_id: chatId, user_id: userId, role: 'assistant', content: fullContent, input_tokens: finalUsage.input_tokens, output_tokens: finalUsage.output_tokens }]).then(() => fetchUserData())
          setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages: [...c.messages, { role: 'assistant', content: fullContent }] } : c))
        }
      }, 500)
    } catch (error) { setMessages(prev => [...prev, { role: 'assistant', content: 'Erro na requisição.' }]) }
  }

  const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }

  const handlePlanChange = async (newMode) => {
    if (!userId) return
    const { error } = await supabase.from('users').update({ token_plan: newMode }).eq('id', userId)
    if (!error) { setUserPlan(newMode); fetchUserData(); }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setCurrentChatId(null)
    setChats([])
    setMessages([])
  }

  const handleRenameChat = (id) => {
    const chat = chats.find(c => c.id === id); const newName = window.prompt('Renomear conversa:', chat.title)
    if (newName && newName.trim()) { setChats(prev => prev.map(c => c.id === id ? { ...c, title: newName } : c)) }
    setMenuOpenId(null)
  }

  const handlePinChat = (id) => { setChats(prev => prev.map(c => c.id === id ? { ...c, pinned: !c.pinned } : c)); setMenuOpenId(null); }

  const handleDeleteChat = (id) => {
    if (window.confirm('Excluir esta conversa permanentemente?')) { setChats(prev => prev.filter(c => c.id !== id)); if (currentChatId === id) setCurrentChatId(null); }
    setMenuOpenId(null)
  }

  const sortedChats = [...chats].sort((a, b) => { if (a.pinned === b.pinned) return new Date(b.timestamp) - new Date(a.timestamp); return a.pinned ? -1 : 1; })

  const renderChatMenu = (id, pinned) => (
    menuOpenId === id && (
      <div className="item-menu-dropdown">
        <button onClick={(e) => { e.stopPropagation(); handlePinChat(id); }}>{pinned ? 'Desafixar' : 'Fixar'}</button>
        <button onClick={(e) => { e.stopPropagation(); handleRenameChat(id); }}>Renomear</button>
        <button onClick={(e) => { e.stopPropagation(); handleDeleteChat(id); }} className="danger">Excluir</button>
      </div>
    )
  )

  const renderContent = () => {
    switch (activeTab) {
      case 'agente':
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
      case 'histórico':
        return (
          <div className="tab-view">
            <h2>Histórico de Conversas</h2>
            <div className="list-content">
              {sortedChats.length === 0 ? <p style={{ color: '#666' }}>Nenhuma conversa.</p> : sortedChats.map(chat => (
                <div key={chat.id} className="list-card chat-history-card-unified">
                  <div className="card-main" onClick={() => { setCurrentChatId(chat.id); setActiveTab('agente'); }}>
                    <p><strong>{chat.title} {chat.pinned && <svg className="discreet-pin" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.5, marginLeft: '6px' }}><path d="M16 9V4l1 0c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1l1 0v5c0 1.66-1.34 3-3 3h0v2h5.97v7l1 1 1-1v-7H19v-2h0c-1.66 0-3-1.34-3-3z"/></svg>}</strong></p>
                    <span>{new Date(chat.timestamp).toLocaleString()}</span>
                  </div>
                  <div className="card-actions-unified">
                    <div className="item-menu-trigger" onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === chat.id ? null : chat.id); }}>⋮</div>
                    {renderChatMenu(chat.id, chat.pinned)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      case 'telegram':
        return (
          <div className="tab-view">
            <h2>Integração Telegram</h2>
            <div className="settings-grid">
              <div className="setting-main-card">
                <div className="card-icon-container" style={{ color: '#0088cc' }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg></div>
                <div className="card-text"><h3>Conectar Bot</h3><p>Receba notificações via Telegram</p></div>
                <div className="card-arrow"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg></div>
              </div>
            </div>
          </div>
        )
      case 'arquivos': return <div className="tab-view"><h2>Arquivos</h2><div className="notes-container"><textarea placeholder="..." className="notepad" /></div></div>
      case 'instruções': return <div className="tab-view"><h2>Instruções</h2></div>
      case 'configurações':
        if (activeSettingView === 'token_plan') {
          return (
            <div className="tab-view config-detail">
              <button className="back-btn" onClick={() => setActiveSettingView('main')}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg> Configurações</button>
              <div className="detail-header"><h2>Cota de Tokens</h2><p>Personalize seu limite mensal.</p></div>
              <div className="plan-selection-grid">
                {[{ id: 'daily', title: 'Modo Diário', desc: 'Disciplina diária.', cota: '~16.6k/dia', icon: '⏱️' }, { id: 'weekly', title: 'Modo Semanal', desc: 'Flexibilidade.', cota: '~125k/semana', icon: '📅' }, { id: 'monthly', title: 'Modo Mensal', desc: 'Liberdade total.', cota: '500k/mês', icon: '🚀' }].map(p => (
                  <div key={p.id} className={`plan-card-premium ${userPlan === p.id ? 'active' : ''}`} onClick={() => handlePlanChange(p.id)}>
                    <div className="plan-icon">{p.icon}</div>
                    <div className="plan-info"><h3>{p.title}</h3><p>{p.desc}</p><span className="plan-badge">{p.cota}</span></div>
                    {userPlan === p.id && <div className="check-mark">✓</div>}
                  </div>
                ))}
              </div>
            </div>
          )
        }
        return (
          <div className="tab-view">
            <h2>Configurações</h2>
            <div className="settings-grid">
              <div className="setting-main-card" onClick={() => setActiveSettingView('token_plan')}>
                <div className="card-icon-container"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg></div>
                <div className="card-text"><h3>Plano de Tokens</h3><p>Atualmente: <strong>{userPlan === 'daily' ? 'Diário' : userPlan === 'weekly' ? 'Semanal' : 'Mensal'}</strong></p></div>
                <div className="card-arrow"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg></div>
              </div>
              <div className="setting-main-card" onClick={handleLogout} style={{ border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <div className="card-icon-container" style={{ color: '#ef4444' }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></div>
                <div className="card-text"><h3>Sair da Conta</h3><p>Encerrar sessão atual</p></div>
              </div>
            </div>
          </div>
        )
      default: return null
    }
  }

  if (!session) return <Auth />

  const periodLimit = PLAN_LIMITS[tokenUsage.plan]; const usagePercent = Math.min((tokenUsage.periodUsed / periodLimit) * 100, 100)
  const getUsageColor = () => { if (usagePercent > 85) return '#ef4444'; if (usagePercent > 60) return '#f59e0b'; return '#10b981'; }

  return (
    <div className="layout">
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <button className="sidebar-close-btn" onClick={() => setSidebarOpen(false)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div className="usage-tracker">
          <div className="usage-info"><span className="usage-label">{tokenUsage.plan === 'daily' ? 'Hoje' : 'Cota'}</span><span className="usage-value">{tokenUsage.periodUsed.toLocaleString()} <span className="usage-limit">/ {(periodLimit/1000).toFixed(0)}k</span></span></div>
          <div className="progress-bg"><div className="progress-fill" style={{ width: `${usagePercent}%`, backgroundColor: getUsageColor() }} /></div>
        </div>
        <div className="sidebar-header">
          <div className="sidebar-brand">
             <img src="/logo.png" alt="Logo" className="app-logo-small" />
             <span className="logo-text">AllcanceAI</span>
          </div>
          <button className="new-chat-btn" onClick={() => { setActiveTab('agente'); setCurrentChatId(null); setMessages([]); setSidebarOpen(false); }}><span>Novo Chat</span></button>
        </div>
        <nav className="sidebar-nav">
          <button className={`nav-link ${activeTab === 'histórico' ? 'active' : ''}`} onClick={() => { setActiveTab('histórico'); setSidebarOpen(false); }}>Histórico</button>
          <button className={`nav-link ${activeTab === 'telegram' ? 'active' : ''}`} onClick={() => { setActiveTab('telegram'); setSidebarOpen(false); }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>Telegram
          </button>
          <button className={`nav-link ${activeTab === 'arquivos' ? 'active' : ''}`} onClick={() => { setActiveTab('arquivos'); setSidebarOpen(false); }}>Arquivos</button>
          <button className={`nav-link ${activeTab === 'instruções' ? 'active' : ''}`} onClick={() => { setActiveTab('instruções'); setSidebarOpen(false); }}>Instruções</button>
        </nav>
        <div className="sidebar-recent">
          <p className="section-label">Recentes</p>
          <div className="recent-list">
            {sortedChats.slice(0, 3).map(chat => (
              <div key={chat.id} className={`recent-item ${currentChatId === chat.id ? 'active' : ''}`}>
                <span className="item-text" onClick={() => { setCurrentChatId(chat.id); setActiveTab('agente'); setSidebarOpen(false); }}>
                  {chat.title} {chat.pinned && <svg className="discreet-pin" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M16 9V4l1 0c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1l1 0v5c0 1.66-1.34 3-3 3h0v2h5.97v7l1 1 1-1v-7H19v-2h0c-1.66 0-3-1.34-3-3z"/></svg>}
                </span>
                <div className="item-menu-trigger" onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === chat.id ? null : chat.id); }}>⋮</div>
                {renderChatMenu(chat.id, chat.pinned)}
              </div>
            ))}
          </div>
        </div>
        <div className="sidebar-footer">
          <button className={`nav-link ${activeTab === 'configurações' ? 'active' : ''}`} onClick={() => { setActiveTab('configurações'); setSidebarOpen(false); setActiveSettingView('main'); }}>Configurações</button>
        </div>
      </aside>
      <main className="main-content">
        <header className="mobile-header">
          <button className="mobile-menu-btn" onClick={() => setSidebarOpen(true)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <div className="mobile-brand">
             <img src="/logo.png" alt="Logo" className="app-logo-small" />
             <span className="logo-text">AllcanceAI</span>
          </div>
          <div style={{ width: 40 }} />
        </header>
        <div className="content-area">{renderContent()}</div>
      </main>
    </div>
  )
}

export default App
