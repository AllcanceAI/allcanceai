import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../../supabaseClient'

const PLAN_LIMITS = {
  daily: 16666,
  weekly: 125000,
  monthly: 500000
}

export function useAgent(userId) {
  const [chats, setChats] = useState([])
  const [currentChatId, setCurrentChatId] = useState(null)
  const [messages, setMessages] = useState([])
  const [prompt, setPrompt] = useState('')
  const [tokenUsage, setTokenUsage] = useState({ 
    monthlyUsed: 0, 
    periodUsed: 0, 
    totalMonthly: 500000,
    plan: 'monthly' 
  })
  const [userPlan, setUserPlan] = useState('monthly')
  
  const typingBufferRef = useRef('')
  const typingIntervalRef = useRef(null)

  // Load chats from localStorage
  useEffect(() => {
    if (userId) {
      const saved = localStorage.getItem(`allcance_chats_${userId}`)
      setChats(saved ? JSON.parse(saved) : [])
    } else {
      setChats([])
    }
  }, [userId])

  // Save chats to localStorage
  useEffect(() => {
    if (userId) {
      localStorage.setItem(`allcance_chats_${userId}`, JSON.stringify(chats))
    }
  }, [chats, userId])

  // Sync messages with current chat
  useEffect(() => {
    const currentChat = chats.find(c => c.id === currentChatId)
    if (currentChat) setMessages(currentChat.messages)
    else setMessages([])
  }, [currentChatId, chats])

  const fetchUserData = async () => {
    if (!userId) return

    try {
      const { data: userData } = await supabase.from('users').select('token_plan').eq('id', userId).maybeSingle()
      
      let currentPlan = 'monthly'
      if (userData) { 
        setUserPlan(userData.token_plan)
        currentPlan = userData.token_plan 
      }
      
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
    } catch (err) {
      console.warn("Erro ao buscar dados do usuário:", err)
    }
  }

  useEffect(() => { fetchUserData() }, [userId])

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
    const currentPrompt = prompt
    setPrompt('')
    
    try {
      await supabase.from('messages').insert([{ chat_id: chatId, user_id: userId, role: 'user', content: currentPrompt }])
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
    } catch (error) { 
      setMessages(prev => [...prev, { role: 'assistant', content: 'Erro na requisição.' }]) 
    }
  }

  const handlePlanChange = async (newMode) => {
    if (!userId) return
    const { error } = await supabase.from('users').update({ token_plan: newMode }).eq('id', userId)
    if (!error) { setUserPlan(newMode); fetchUserData(); }
  }

  const handleRenameChat = (id, newName) => {
    if (newName && newName.trim()) { setChats(prev => prev.map(c => c.id === id ? { ...c, title: newName } : c)) }
  }

  const handlePinChat = (id) => { setChats(prev => prev.map(c => c.id === id ? { ...c, pinned: !c.pinned } : c)) }

  const handleDeleteChat = (id) => {
    setChats(prev => prev.filter(c => c.id !== id))
    if (currentChatId === id) setCurrentChatId(null)
  }

  return {
    chats,
    currentChatId,
    setCurrentChatId,
    messages,
    prompt,
    setPrompt,
    tokenUsage,
    userPlan,
    handleSend,
    handlePlanChange,
    handleRenameChat,
    handlePinChat,
    handleDeleteChat,
    PLAN_LIMITS
  }
}
