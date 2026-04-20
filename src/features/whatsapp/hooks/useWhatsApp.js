import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../../supabaseClient'
import { getWaDialogs, getWaMessages, sendText, getWaQrCode, createWaInstance, fetchWaInstances, getWaProfilePic, fetchWaMediaBase64 } from '../../../services/whatsappService'

export function useWhatsApp(userId, activeTab) {
  const [waDialogs, setWaDialogs] = useState([])
  const [selectedWaChat, setSelectedWaChat] = useState(null)
  const [waMessages, setWaMessages] = useState([])
  const [waInput, setWaInput] = useState('')
  const [waStatus, setWaStatus] = useState('disconnected')
  const [waQrCode, setWaQrCode] = useState('')
  const [waInstanceName, setWaInstanceName] = useState('')
  const [waLoading, setWaLoading] = useState(false)
  const [waAvatarUrls, setWaAvatarUrls] = useState({})
  
  const waChannelRef = useRef(null)

  // Initialize WhatsApp Instance
  useEffect(() => {
    if (userId && !waInstanceName) {
      const name = `allcance_${userId.substring(0, 8)}`;
      setWaInstanceName(name);
      
      const createFreshAndGetQR = async (instanceName) => {
        await createWaInstance(instanceName);
        setTimeout(() => {
          getWaQrCode(instanceName).then(qr => { if (qr) setWaQrCode(qr); });
        }, 2000);
      };

      fetchWaInstances().then(async (res) => {
        const list = Array.isArray(res) ? res : (res.instances || []);
        const myInstance = list.find(i => {
          const iName = i.name || i.instanceName || i.instance?.instanceName;
          return iName === name;
        });
        
        const status = myInstance?.connectionStatus || myInstance?.status || myInstance?.instance?.status;

        if (myInstance && status === 'open') {
          setWaStatus('connected');
        } else if (myInstance) {
          getWaQrCode(name).then(qr => { if (qr) setWaQrCode(qr); });
        } else {
          await createFreshAndGetQR(name);
        }
      });
    }
  }, [userId, waInstanceName]);

  // Connection Polling
  useEffect(() => {
    let interval;
    if (waStatus === 'disconnected' && waInstanceName) {
      interval = setInterval(() => {
        fetchWaInstances().then(res => {
          const list = Array.isArray(res) ? res : (res.instances || []);
          const myInstance = list.find(i => {
            const iName = i.name || i.instanceName || i.instance?.instanceName;
            return iName === waInstanceName;
          });
          const status = myInstance?.connectionStatus || myInstance?.status || myInstance?.instance?.status;
          if (myInstance && status === 'open') {
            setWaStatus('connected');
            clearInterval(interval);
          }
        });
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [waStatus, waInstanceName]);

  // Load Dialogs
  useEffect(() => {
    if (activeTab === 'whatsapp' && waStatus === 'connected' && waInstanceName) {
      setWaLoading(true);
      getWaDialogs(waInstanceName).then(dialogs => {
        setWaDialogs(dialogs);
        setWaLoading(false);
      });
    }
  }, [activeTab, waStatus, waInstanceName]);

  // Load Avatars
  useEffect(() => {
    if (activeTab === 'whatsapp' && waStatus === 'connected' && waDialogs.length > 0) {
      waDialogs.forEach(dialog => {
        if (!waAvatarUrls[dialog.id]) {
          getWaProfilePic(waInstanceName, dialog.id).then(url => {
            if (url) setWaAvatarUrls(prev => ({ ...prev, [dialog.id]: url }));
          });
        }
      });
    }
  }, [waDialogs, waStatus, activeTab, waInstanceName]);

  // Realtime Listener for Current Chat
  useEffect(() => {
    if (!selectedWaChat || waStatus !== 'connected') return;

    if (waChannelRef.current) supabase.removeChannel(waChannelRef.current);

    const cleanId = selectedWaChat.id.replace(/[^a-zA-Z0-9]/g, '');
    const channel = supabase
      .channel(`chat_unique_${cleanId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'wa_messages' },
        async (payload) => {
          if (payload.new.remote_jid !== selectedWaChat.id) return;
          if (payload.new.instance_name !== waInstanceName) return;

          const newMsgId = payload.new.message_id;
          setWaMessages(prev => {
            if (newMsgId && prev.some(m => m.id === newMsgId)) return prev;
            return [...prev, {
              id: newMsgId,
              message: payload.new.content,
              out: payload.new.is_from_me,
              date: Math.floor(new Date(payload.new.created_at).getTime() / 1000),
              hasMedia: false, 
              rawMessage: null 
            }];
          });
        }
      )
      .subscribe();

    waChannelRef.current = channel;
    return () => { if (waChannelRef.current) { supabase.removeChannel(waChannelRef.current); waChannelRef.current = null; } };
  }, [selectedWaChat?.id, waStatus, waInstanceName]);

  const handleSendMessage = async () => {
    if (!waInput.trim() || !selectedWaChat) return;
    const text = waInput; setWaInput('');
    const tempMsg = { id: `temp-${Date.now()}`, message: text, out: true, date: Math.floor(Date.now() / 1000) };
    setWaMessages(prev => [...prev, tempMsg]);
    await sendText(waInstanceName, selectedWaChat.id, text);
  }

  const handleSelectChat = async (chat) => {
    if (!chat) { setSelectedWaChat(null); return; }
    setWaMessages([]);
    setWaInput('');
    setSelectedWaChat(chat);
    setWaLoading(true);
    const msgs = await getWaMessages(waInstanceName, chat.id);
    setWaMessages(msgs);
    setWaLoading(false);
  }

  return {
    waDialogs, setWaDialogs,
    selectedWaChat, setSelectedWaChat,
    waMessages, setWaMessages,
    waInput, setWaInput,
    waStatus, setWaStatus,
    waQrCode, setWaQrCode,
    waInstanceName,
    waLoading,
    waAvatarUrls,
    handleSendMessage,
    handleSelectChat,
    fetchMedia: async (msg) => await fetchWaMediaBase64(waInstanceName, msg.rawMessage)
  }
}
