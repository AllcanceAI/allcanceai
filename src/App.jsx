import { useState, useEffect, useRef } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { supabase } from './supabaseClient'
import Auth from './Auth'
import { startQRLogin, getSavedSession, sendPhoneCode, verifyPhoneCode, getDialogs, getChatMessages, sendTelegramMessage, downloadMediaAsUrl, getProfilePhotoUrl, markChatAsRead, listenToNewMessages } from './services/telegramService'
import { getWaDialogs, getWaMessages, sendWaMessage, getWaQrCode, createWaInstance, fetchWaInstances, deleteWaInstance, getWaProfilePic } from './services/whatsappService'
import { generateAiResponse } from './services/aiService'
import { useCRM } from './components/crm/CRMContext'
import RightSidebar from './components/crm/RightSidebar'
import { CrmMenu } from './components/crm/CrmMenu'
import { ChannelUI } from './components/chat/ChannelInterface'
import { AITraining } from './components/AITraining'
import './components/crm/crmOverlay.css'

function App() {
  const [session, setSession] = useState(null)
  const userId = session?.user?.id
  const [prompt, setPrompt] = useState('')
  const [chats, setChats] = useState([])
  const [currentChatId, setCurrentChatId] = useState(null)
  const [messages, setMessages] = useState([])
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeTab, setActiveTab ] = useState(() => localStorage.getItem('allcance_active_tab') || 'agente')
  const [activeInstruction, setActiveInstruction] = useState(null)

  // Persiste a aba ativa para o refresh
  useEffect(() => {
    localStorage.setItem('allcance_active_tab', activeTab);
  }, [activeTab]);
  
  // CRM States
  const { 
    archivedIds, tags, contactTags, 
    globalAiEnabled, toggleGlobalAi, 
    disabledAiChatIds, toggleChatAi 
  } = useCRM();

  const [selectedFilterTag, setSelectedFilterTag] = useState('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [crmMenu, setCrmMenu] = useState({ x: 0, y: 0, visible: false, contactId: null, entity: null });

  // WhatsApp States
  const [waDialogs, setWaDialogs] = useState([])
  const [selectedWaChat, setSelectedWaChat] = useState(null)
  const [waMessages, setWaMessages] = useState([])
  const [waInput, setWaInput] = useState('')
  const [waStatus, setWaStatus] = useState('disconnected') // Mocking as connected for now
  const [waQrCode, setWaQrCode] = useState('')
  const [waInstanceName, setWaInstanceName] = useState('')
  const [waLoading, setWaLoading] = useState(false)
  const [waAvatarUrls, setWaAvatarUrls] = useState({})
  const waMessagesEndRef = useRef(null)
  const activeWaChatRef = useRef(null)

  useEffect(() => {
    activeWaChatRef.current = selectedWaChat;
  }, [selectedWaChat]);

  // Inicializa Instância WhatsApp baseada no Usuário
  useEffect(() => {
    if (activeTab === 'whatsapp' && userId && !waInstanceName) {
      const name = `allcance_${userId.substring(0, 8)}`;
      setWaInstanceName(name);
      
      const createFreshAndGetQR = async (instanceName) => {
        const res = await createWaInstance(instanceName);
        console.log("Instância Evolution criada:", res);
        // Aguarda a Evolution processar, depois busca QR
        setTimeout(() => {
          getWaQrCode(instanceName).then(qr => { if (qr) setWaQrCode(qr); });
        }, 2000);
      };

      fetchWaInstances().then(async (res) => {
        console.log("🔍 [DEBUG] Nome da Minha Instância:", name);
        
        // A API pode retornar um Array direto ou um Objeto { instances: [] }
        const list = Array.isArray(res) ? res : (res.instances || []);
        
        const myInstance = list.find(i => {
          const iName = i.name || i.instanceName || i.instance?.instanceName;
          return iName === name;
        });
        
        const status = myInstance?.connectionStatus || myInstance?.status || myInstance?.instance?.status;
        console.log("🔍 [DEBUG] Status Identificado:", status);

        if (myInstance && status === 'open') {
          console.log("✅ Instância já está conectada.");
          setWaStatus('connected');
        } else if (myInstance) {
          console.log("🗑️ Instância desconectada encontrada.");
          // Se já tem QR, não vamos ficar deletando toda hora no poll
          getWaQrCode(name).then(qr => { if (qr) setWaQrCode(qr); });
        } else {
          console.log("⚡ Criando instância nova...");
          await createFreshAndGetQR(name);
        }
      });
    }
  }, [activeTab, userId, waInstanceName]);

  // Monitoramento de Conexão (Polling)
  useEffect(() => {
    let interval;
    if (activeTab === 'whatsapp' && waStatus === 'disconnected' && waInstanceName) {
      console.log("⏱️ Iniciando monitoramento de conexão para:", waInstanceName);
      interval = setInterval(() => {
        fetchWaInstances().then(res => {
          const list = Array.isArray(res) ? res : (res.instances || []);
          const myInstance = list.find(i => {
            const iName = i.name || i.instanceName || i.instance?.instanceName;
            return iName === waInstanceName;
          });
          
          const status = myInstance?.connectionStatus || myInstance?.status || myInstance?.instance?.status;
          console.log("⏱️ [Polling] Status atual:", status);

          if (myInstance && status === 'open') {
            console.log("🎉 Conexão detectada!");
            setWaStatus('connected');
            clearInterval(interval);
          }
        });
      }, 5000); // Verifica status a cada 5 segundos
    }
    return () => clearInterval(interval);
  }, [activeTab, waStatus, waInstanceName]);

  // Carrega WhatsApp Dialogs Historicos
  useEffect(() => {
    if (activeTab === 'whatsapp' && waStatus === 'connected' && waInstanceName) {
      setWaLoading(true);
      getWaDialogs(waInstanceName).then(dialogs => {
        setWaDialogs(dialogs);
        setWaLoading(false);
      });
    }
  }, [activeTab, waStatus, waInstanceName]);

  // Efeito assíncrono para garantir o carregamento suave das fotos de perfil sem bloquear a tela
  useEffect(() => {
    if (activeTab === 'whatsapp' && waStatus === 'connected' && waDialogs.length > 0) {
      waDialogs.forEach(dialog => {
        if (!waAvatarUrls[dialog.id]) {
          getWaProfilePic(waInstanceName, dialog.id).then(url => {
            if (url) {
              setWaAvatarUrls(prev => ({ ...prev, [dialog.id]: url }));
            }
          });
        }
      });
    }
  }, [waDialogs, waStatus, activeTab, waInstanceName]);

  // Tempo Real: Recebendo mensagens automáticas (Push) pelo Supabase & Piloto Automático
  useEffect(() => {
    if (waStatus !== 'connected' || !waInstanceName) return;

    console.log("🟢 [Realtime] Ouvindo novas mensagens do WhatsApp e monitorando IA...");
    const waChannel = supabase
      .channel('realtime_wa_messages')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'wa_messages'
      }, (payload) => {
        const newMsg = payload.new;
        
        // Filtro via Front-end para assegurar a chegada
        console.log(`🔔 [Realtime Trigger] Recebido para a instância:`, newMsg.instance_name, "Esperava:", waInstanceName);
        
        if (newMsg.instance_name !== waInstanceName) {
           console.log("❌ Bloqueado pelo filtro do Frontend!");
           return;
        }

        // Filtra JIDs internos para impedir que eventos de sistema revivam chats ocultos
        if (!newMsg.remote_jid.endsWith('@s.whatsapp.net') && !newMsg.remote_jid.endsWith('@c.us')) {
           return;
        }
        
        // 1. Atualizar a aba de conversas (Esquerda) trazendo para o topo
        setWaDialogs(prev => {
          const chatIdx = prev.findIndex(d => d.id === newMsg.remote_jid);
          const isActive = activeWaChatRef.current?.id === newMsg.remote_jid;
          
          if (chatIdx > -1) {
            const updated = [...prev];
            updated[chatIdx] = {
              ...updated[chatIdx],
              message: { message: newMsg.content, date: Math.floor(new Date(newMsg.created_at).getTime() / 1000) },
              unreadCount: isActive ? 0 : (newMsg.is_from_me ? 0 : updated[chatIdx].unreadCount + 1)
            };
            const moved = updated.splice(chatIdx, 1)[0];
            return [moved, ...updated];
          } else {
            // Em caso de chat novo, impedir o uso do próprio nome do usuário como título do chat se ele for o remetente nativo
            const displayChatName = !newMsg.is_from_me && newMsg.push_name ? newMsg.push_name : newMsg.remote_jid.split('@')[0];
            return [{
              id: newMsg.remote_jid,
              name: displayChatName,
              unreadCount: newMsg.is_from_me ? 0 : 1,
              message: { message: newMsg.content, date: Math.floor(new Date(newMsg.created_at).getTime() / 1000) }
            }, ...prev];
          }
        });

        // 2. Se a conversa afetada estiver aberta na tela, insere lá também (Direita)
        if (activeWaChatRef.current?.id === newMsg.remote_jid) {
          const formattedMsg = {
            message: newMsg.content,
            out: newMsg.is_from_me,
            date: Math.floor(new Date(newMsg.created_at).getTime() / 1000)
          };
          setWaMessages(prev => [...prev, formattedMsg]);
          setTimeout(() => waMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 150);
        }

        // 3. Piloto Automático do WhatsApp (Integração Anthropic Claude 3.5 via Supabase Prompt)
        if (!newMsg.is_from_me && globalAiEnabled && !disabledAiChatIds.includes(newMsg.remote_jid)) {
          // Busca o breve histórico das últimas 6 mensagens usando o serviço do WhatsApp para o Claude se situar na conversa
          import('./services/whatsappService').then(({ getWaMessages, sendWaMessage }) => {
            getWaMessages(waInstanceName, newMsg.remote_jid, 6).then(history => {
              
              generateAiResponse(newMsg.content, history, userId, 'whatsapp')
                .then(aiReply => {
                  if (aiReply) {
                    console.log(`🤖 [Claude AI] Respondendo a ${newMsg.remote_jid}...`);
                    sendWaMessage(waInstanceName, newMsg.remote_jid, aiReply);
                    // Não é necessário dar push manual na tela. Nosso backend enviará, nosso próprio webhook ouvirá o Supabase e
                    // retornará o "is_from_me = true" pelo gatilho nativo, injetando a bolha preta visual naturalmente na tela!
                  }
                });

            }).catch(console.error);
          });
        }

      })
      .subscribe((status, err) => {
         console.log("📡 [Supabase Channel Status]:", status);
         if (err) console.error("📡 [Supabase Channel Error]:", err);
      });

    return () => {
      supabase.removeChannel(waChannel);
    }
  }, [waStatus, waInstanceName, globalAiEnabled, disabledAiChatIds, userId]);
  
  const handleCrmMenu = (e, contactId, entity) => {
    e.preventDefault();
    e.stopPropagation();
    
    const menuWidth = 180;
    const menuHeight = 220;
    let posX = e.pageX || e.clientX;
    let posY = e.pageY || e.clientY;

    // Se clicar muito à direita, empurra o menu para a esquerda
    if (posX + menuWidth > window.innerWidth) {
      posX = posX - menuWidth;
    }
    // Se clicar muito embaixo, sobe o menu
    if (posY + menuHeight > window.innerHeight) {
      posY = posY - menuHeight;
    }

    // Garantia de que não fique negativo
    posX = Math.max(10, posX);
    posY = Math.max(10, posY);

    setCrmMenu({ 
      x: posX, 
      y: posY, 
      visible: true, 
      contactId, 
      entity 
    });
  };
  
  const [activeSettingView, setActiveSettingView] = useState('main')
  const [copied, setCopied] = useState(false)
  const [menuOpenId, setMenuOpenId] = useState(null)
  const [telegramStep, setTelegramStep] = useState(1)
  const [loginMethod, setLoginMethod] = useState('qr') 
  const [qrCodeLink, setQrCodeLink] = useState('')
  const [telegramStatus, setTelegramStatus] = useState('disconnected')
  const [telegramUser, setTelegramUser] = useState(null)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [phoneCodeHash, setPhoneCodeHash] = useState('')
  const [telegramLoading, setTelegramLoading] = useState(false)
  const [telegramError, setTelegramError] = useState('')
  const [tgDialogs, setTgDialogs] = useState([])
  const [selectedTgChat, setSelectedTgChat] = useState(null)
  const [tgMessages, setTgMessages] = useState([])
  const [tgInput, setTgInput] = useState('')
  const [tgLoadingChats, setTgLoadingChats] = useState(false)
  const [tgMobileView, setTgMobileView] = useState('list') // 'list' | 'chat'
  const [tgAvatarUrls, setTgAvatarUrls] = useState({}) // { id: url }
  const [tgMediaUrls, setTgMediaUrls] = useState({}) // { msgId: url }
  const tgMessagesEndRef = useRef(null)

  // --- PILOTO AUTOMÁTICO (GROQ) ---
  useEffect(() => {
    if (telegramStatus === 'connected' && globalAiEnabled) {
      console.log("🤖 Auto-Pilot Ativo. Monitorando mensagens...");
      listenToNewMessages(async (msg) => {
        const contactId = msg.peerId?.userId?.toString() || msg.peerId?.chatId?.toString();
        if (disabledAiChatIds.includes(contactId)) return;

        const text = msg.message;
        if (!text) return;
        
        try {
          const history = await getChatMessages(msg.peerId, 5);
          const aiReply = await generateAiResponse(text, history, userId, 'telegram');
          if (aiReply) {
            await sendTelegramMessage(msg.peerId, aiReply);
            if (selectedTgChat && (selectedTgChat.id?.toString() === contactId)) {
              const updatedMsgs = await getChatMessages(msg.peerId, 50);
              setTgMessages(updatedMsgs);
            }
          }
        } catch (error) { console.error("🤖 Erro no Auto-Pilot:", error); }
      });
    }
  }, [telegramStatus, globalAiEnabled, disabledAiChatIds, selectedTgChat]);
  
  const [tokenUsage, setTokenUsage] = useState({ 
    monthlyUsed: 0, 
    periodUsed: 0, 
    totalMonthly: 500000,
    plan: 'monthly' 
  })
  const [userPlan, setUserPlan] = useState('monthly')

  // Verifica sessão salva ao inicializar
  useEffect(() => {
    const saved = getSavedSession();
    if (saved) {
      startQRLogin(
        () => {},
        (_, me) => {
          setTelegramStatus('connected');
          setTelegramUser(me);
        }
      );
    }
  }, [])

  // Inicia Login QR quando o método muda para QR
  useEffect(() => {
    if (loginMethod === 'qr') {
      setQrCodeLink('')
      startQRLogin(
        (link) => setQrCodeLink(link),
        (_, me) => {
          setTelegramStatus('connected');
          setTelegramUser(me);
        }
      );
    }
  }, [loginMethod])

  // Carrega conversas quando conecta
  useEffect(() => {
    if (telegramStatus === 'connected') {
      setTgLoadingChats(true)
      getDialogs(30).then(async (dialogs) => {
        setTgDialogs(dialogs)
        setTgLoadingChats(false)
        // Carrega fotos de perfil de forma lazy (sem bloquear a lista)
        dialogs.forEach(async (dialog) => {
          if (!dialog.entity) return
          const url = await getProfilePhotoUrl(dialog.entity)
          if (url) {
            setTgAvatarUrls(prev => ({ ...prev, [dialog.entity.id?.toString()]: url }))
          }
        })
      }).catch(() => setTgLoadingChats(false))
    }
  }, [telegramStatus])

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

    try {
      const { data: userData, error } = await supabase.from('users').select('token_plan').eq('id', userId).maybeSingle()
      
      let currentPlan = 'monthly'
      if (userData) { 
        setUserPlan(userData.token_plan); 
        currentPlan = userData.token_plan; 
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
      console.warn("Perfil de usuário ainda não criado. Usando plano padrão.");
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
      case 'whatsapp':
        return waStatus === 'connected' ? (
          <ChannelUI 
            platform="wa"
            dialogs={waDialogs}
            selectedChat={selectedWaChat}
            messages={waMessages}
            inputValue={waInput}
            setInputValue={setWaInput}
            onSendMessage={async () => {
              if (!waInput.trim() || !selectedWaChat) return;
              const text = waInput; setWaInput('');
              await sendWaMessage(waInstanceName, selectedWaChat.id, text);
              const msgs = await getWaMessages(waInstanceName, selectedWaChat.id);
              setWaMessages(msgs);
              setTimeout(() => waMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
            }}
            onSelectChat={async (chat) => {
              if (!chat) { setSelectedWaChat(null); return; }
              setSelectedWaChat(chat);
              setWaLoading(true);
              const msgs = await getWaMessages(waInstanceName, chat.id);
              setWaMessages(msgs);
              setWaLoading(false);
              setTimeout(() => waMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
            }}
            loadingChats={waLoading}
            avatarUrls={waAvatarUrls}
            onReturn={() => setActiveTab('agente')}
            onDisconnect={() => { setWaStatus('disconnected'); setWaDialogs([]); setSelectedWaChat(null); }}
            tags={tags}
            contactTags={contactTags}
            selectedFilterTag={selectedFilterTag}
            setSelectedFilterTag={setSelectedFilterTag}
            filterOpen={filterOpen}
            setFilterOpen={setFilterOpen}
            handleCrmMenu={handleCrmMenu}
            globalAiEnabled={globalAiEnabled}
            toggleGlobalAi={toggleGlobalAi}
            disabledAiChatIds={disabledAiChatIds}
            toggleChatAi={toggleChatAi}
            messagesEndRef={waMessagesEndRef}
            archivedIds={archivedIds}
            RightSidebar={RightSidebar}
            CrmMenu={CrmMenu}
            crmMenuState={crmMenu}
            closeCrmMenu={() => setCrmMenu({ ...crmMenu, visible: false })}
          />
        ) : (
          <div className="tab-view">
            <div className="tab-header-flex">
              <div className="tab-title-group">
                <button className="mobile-only-burger" onClick={() => setSidebarOpen(true)}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
                </button>
                <button className="back-btn" onClick={() => setActiveTab('agente')}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg> Voltar
                </button>
                <h2>Conectar WhatsApp</h2>
              </div>
              <span className="status-badge-disconnected">Desconectado</span>
            </div>
            <div className="integration-container">
              <div className="integration-card-main">
                <div className="integration-info">
                  <div className="platform-icon whatsapp" style={{ background: 'none', border: 'none' }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  </div>
                  <div className="platform-text">
                    <h3>WhatsApp</h3>
                    <p>Escaneie o QR Code abaixo para conectar seu WhatsApp ao AllcanceAI.</p>
                  </div>
                </div>
                <div className="connection-form">
                  <div className="qr-container-wrapper">
                    <div className="qr-box" style={{ background: '#fff', padding: '10px', borderRadius: '12px' }}>
                      {waQrCode ? (
                        waQrCode.includes('base64') || waQrCode.startsWith('data:image') ? (
                          <img src={waQrCode} alt="WhatsApp QR Code" style={{ width: '180px', height: '180px', objectFit: 'contain' }} className="fade-in" />
                        ) : (
                          <QRCodeCanvas value={waQrCode} size={180} />
                        )
                      ) : (
                        <div className="qr-placeholder"><div className="pro-spinner"></div><span className="loading-text-saas">Gerando QR Code...</span></div>
                      )}
                    </div>
                    <p className="qr-hint">Use o WhatsApp no seu celular para ler o código</p>
                    <button 
                      onClick={() => {
                         setWaQrCode(''); 
                         getWaQrCode(waInstanceName).then(qr => { if (qr) setWaQrCode(qr); });
                      }}
                      style={{ marginTop: '1rem', background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: '#888', padding: '0.4rem 1rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', transition: 'all 0.2s' }}
                      onMouseOver={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; }}
                      onMouseOut={e => { e.currentTarget.style.color = '#888'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                    >
                      🔄 Atualizar QR Code
                    </button>
                  </div>
                </div>
              </div>
              <div className="integration-guide">
                <h4>Passo a Passo</h4>
                <ol>
                  <li>Abra o WhatsApp no seu celular.</li>
                  <li>Vá em Aparelhos Conectados.</li>
                  <li>Clique em Conectar um Aparelho.</li>
                  <li>Aponte a câmera para este QR Code.</li>
                </ol>
              </div>
            </div>
          </div>
        )

      case 'telegram':
        return telegramStatus === 'connected' ? (
          <ChannelUI 
            platform="tg"
            dialogs={tgDialogs}
            selectedChat={selectedTgChat}
            messages={tgMessages}
            inputValue={tgInput}
            setInputValue={setTgInput}
            onSendMessage={async () => {
              if (!tgInput.trim() || !selectedTgChat) return;
              const text = tgInput; setTgInput('');
              await sendTelegramMessage(selectedTgChat.entity, text);
              const msgs = await getChatMessages(selectedTgChat.entity, 50);
              setTgMessages(msgs);
              setTimeout(() => tgMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
            }}
            onSelectChat={async (chat) => {
              if (!chat) { setSelectedTgChat(null); return; }
              setSelectedTgChat(chat);
              setTgMobileView('chat');
              setTgMessages([]);
              markChatAsRead(chat.entity);
              setTgDialogs(prev => prev.map(d => d.id === chat.id ? { ...d, unreadCount: 0 } : d));
              const msgs = await getChatMessages(chat.entity, 50);
              setTgMessages(msgs);
              setTimeout(() => tgMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
            }}
            loadingChats={tgLoadingChats}
            avatarUrls={tgAvatarUrls}
            onReturn={() => setActiveTab('agente')}
            onDisconnect={() => {
              import('./services/telegramService').then(m => m.clearSession());
              setTelegramStatus('disconnected'); setTgDialogs([]); setSelectedTgChat(null);
            }}
            tags={tags}
            contactTags={contactTags}
            selectedFilterTag={selectedFilterTag}
            setSelectedFilterTag={setSelectedFilterTag}
            filterOpen={filterOpen}
            setFilterOpen={setFilterOpen}
            handleCrmMenu={handleCrmMenu}
            globalAiEnabled={globalAiEnabled}
            toggleGlobalAi={toggleGlobalAi}
            disabledAiChatIds={disabledAiChatIds}
            toggleChatAi={toggleChatAi}
            messagesEndRef={tgMessagesEndRef}
            archivedIds={archivedIds}
            RightSidebar={RightSidebar}
            CrmMenu={CrmMenu}
            crmMenuState={crmMenu}
            closeCrmMenu={() => setCrmMenu({ ...crmMenu, visible: false })}
          />
        ) : (
          <div className="tab-view">
            <div className="tab-header-flex">
              <div className="tab-title-group">
                <button className="mobile-only-burger" onClick={() => setSidebarOpen(true)}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
                </button>
                <button className="back-btn" onClick={() => setActiveTab('agente')}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg> Voltar
                </button>
                <h2>Conectar Telegram</h2>
              </div>
              <span className="status-badge-disconnected">Desconectado</span>
            </div>
            <div className="integration-container">
              <div className="integration-card-main">
                <div className="integration-info">
                  <div className="platform-icon telegram"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg></div>
                  <div className="platform-text">
                    <h3>Conta Pessoal (User API)</h3>
                    <p>Conecte seu Telegram para gerenciar chats e automatizar respostas diretamente pelo AllcanceAI.</p>
                  </div>
                </div>
                <div className="connection-form">
                  <div className="qr-container-wrapper">
                    <div className="qr-box" style={{ background: '#fff', padding: '10px', borderRadius: '12px' }}>
                      {qrCodeLink ? <QRCodeCanvas value={qrCodeLink} size={180} /> : (
                        <div className="qr-placeholder"><div className="pro-spinner"></div><span className="loading-text-saas">Gerando QR Code...</span></div>
                      )}
                    </div>
                    <p className="qr-hint">Abra o Telegram {" > "} Configurações {" > "} Dispositivos {" > "} Conectar Dispositivo</p>
                  </div>
                </div>
              </div>
              <div className="integration-guide">
                <h4>Passo a Passo</h4>
                <ol>
                  <li>Abra o Telegram no seu celular.</li>
                  <li>Vá em Configurações &gt; Dispositivos.</li>
                  <li>Clique em Conectar Dispositivo.</li>
                  <li>Aponte a câmera para este QR Code.</li>
                </ol>
                <div className="guide-alert">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <span>Seus dados são protegidos por criptografia de ponta a ponta.</span>
                </div>
              </div>
            </div>
          </div>
        )

      case 'arquivos': return <div className="tab-view"><h2>Arquivos</h2><div className="notes-container"><textarea placeholder="..." className="notepad" /></div></div>
      case 'instruções': return <div className="tab-view"><h2>Instruções Gerais</h2><p style={{color:'#888', marginTop:'10px'}}>As instruções de IA específicas para canais estão na aba "Treinamento IA".</p></div>
      case 'treinamento': return <AITraining userId={userId} />
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
        <div className="sidebar-header-main">
          <div className="sidebar-brand">
             <div className="brand-logo-container">
               <img src="/logo.png" alt="Logo" className="brand-logo-main" />
             </div>
             <span className="logo-text">AllcanceAI</span>
          </div>
          <button className="sidebar-collapse-btn" onClick={() => setSidebarOpen(false)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
          </button>
        </div>

        <div className="sidebar-search">
          <div className="search-wrapper">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" placeholder="Search..." />
          </div>
        </div>

        <div className="sidebar-scroll-area">
          <button className="new-chat-btn-norse" onClick={() => { setActiveTab('agente'); setCurrentChatId(null); setMessages([]); setSidebarOpen(false); }}>
            <div className="plus-icon-orange">+</div>
            <span>Novo Chat</span>
          </button>

          <div className="sidebar-section">
            <p className="section-label-norse">Atividades</p>
            <button className={`nav-link-norse ${activeTab === 'histórico' ? 'active' : ''}`} onClick={() => { setActiveTab('histórico'); setSidebarOpen(false); }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              Histórico
            </button>
            <button className={`nav-link-norse ${activeTab === 'instruções' ? 'active' : ''}`} onClick={() => { setActiveTab('instruções'); setSidebarOpen(false); }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
              Manuais Genéricos
            </button>
            <button className={`nav-link-norse ${activeTab === 'treinamento' ? 'active' : ''}`} onClick={() => { setActiveTab('treinamento'); setSidebarOpen(false); }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              Treinamento IA
            </button>
          </div>

          <div className="sidebar-divider"></div>

          <div className="sidebar-section">
            <p className="section-label-norse">Canais</p>
            <button className={`nav-link-norse ${activeTab === 'whatsapp' ? 'active' : ''}`} onClick={() => { setActiveTab('whatsapp'); setSidebarOpen(false); }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              WhatsApp
            </button>
            <button className={`nav-link-norse ${activeTab === 'telegram' ? 'active' : ''}`} onClick={() => { setActiveTab('telegram'); setSidebarOpen(false); }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
              Telegram
            </button>
          </div>

          <div className="sidebar-divider"></div>

          <div className="sidebar-section">
            <p className="section-label-norse">Recentes</p>
            <div className="recent-list-norse">
              {sortedChats.slice(0, 6).map(chat => (
                <div key={chat.id} className={`recent-item-norse ${currentChatId === chat.id ? 'active' : ''}`} onClick={() => { setCurrentChatId(chat.id); setActiveTab('agente'); setSidebarOpen(false); }}>
                  <span className="item-text-norse">{chat.title}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="sidebar-footer-norse">
          <div className="usage-tracker-mini">
            <div className="usage-progress-bar"><div className="usage-progress-fill" style={{ width: `${Math.min((tokenUsage.periodUsed / PLAN_LIMITS[tokenUsage.plan]) * 100, 100)}%` }} /></div>
          </div>
          <button className={`nav-link-norse ${activeTab === 'configurações' ? 'active' : ''}`} onClick={() => { setActiveTab('configurações'); setSidebarOpen(false); setActiveSettingView('main'); }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            Configurações
          </button>
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
