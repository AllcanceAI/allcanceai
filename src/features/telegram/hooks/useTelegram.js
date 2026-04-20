import { useState, useEffect } from 'react'
import { startQRLogin, getSavedSession, getDialogs, getChatMessages, sendTelegramMessage, getProfilePhotoUrl, markChatAsRead, listenToNewMessages } from '../../../services/telegramService'
import { generateAiResponse } from '../../../services/aiService'

export function useTelegram(userId, globalAiEnabled, disabledAiChatIds) {
  const [telegramStatus, setTelegramStatus] = useState('disconnected')
  const [telegramUser, setTelegramUser] = useState(null)
  const [qrCodeLink, setQrCodeLink] = useState('')
  const [tgDialogs, setTgDialogs] = useState([])
  const [selectedTgChat, setSelectedTgChat] = useState(null)
  const [tgMessages, setTgMessages] = useState([])
  const [tgInput, setTgInput] = useState('')
  const [tgLoadingChats, setTgLoadingChats] = useState(false)
  const [tgAvatarUrls, setTgAvatarUrls] = useState({})

  // Check saved session
  useEffect(() => {
    const saved = getSavedSession();
    if (saved) {
      startQRLogin(() => {}, (_, me) => {
        setTelegramStatus('connected');
        setTelegramUser(me);
      });
    }
  }, [])

  // QR Login loop
  useEffect(() => {
    if (telegramStatus === 'disconnected') {
      startQRLogin(
        (link) => setQrCodeLink(link),
        (_, me) => {
          setTelegramStatus('connected');
          setTelegramUser(me);
        }
      );
    }
  }, [telegramStatus])

  // Load Dialogs
  useEffect(() => {
    if (telegramStatus === 'connected') {
      setTgLoadingChats(true)
      getDialogs(30).then(async (dialogs) => {
        setTgDialogs(dialogs)
        setTgLoadingChats(false)
        dialogs.forEach(async (dialog) => {
          if (!dialog.entity) return
          const url = await getProfilePhotoUrl(dialog.entity)
          if (url) setTgAvatarUrls(prev => ({ ...prev, [dialog.entity.id?.toString()]: url }))
        })
      }).catch(() => setTgLoadingChats(false))
    }
  }, [telegramStatus])

  // Auto-Pilot Monitor
  useEffect(() => {
    if (telegramStatus === 'connected' && globalAiEnabled) {
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
  }, [telegramStatus, globalAiEnabled, disabledAiChatIds, selectedTgChat, userId]);

  const handleSendMessage = async () => {
    if (!tgInput.trim() || !selectedTgChat) return;
    const text = tgInput; setTgInput('');
    await sendTelegramMessage(selectedTgChat.entity, text);
    const msgs = await getChatMessages(selectedTgChat.entity, 50);
    setTgMessages(msgs);
  }

  const handleSelectChat = async (chat) => {
    if (!chat) { setSelectedTgChat(null); return; }
    setSelectedTgChat(chat);
    setTgMessages([]);
    markChatAsRead(chat.entity);
    setTgDialogs(prev => prev.map(d => d.id === chat.id ? { ...d, unreadCount: 0 } : d));
    const msgs = await getChatMessages(chat.entity, 50);
    setTgMessages(msgs);
  }

  return {
    telegramStatus, setTelegramStatus,
    telegramUser, setTelegramUser,
    qrCodeLink,
    tgDialogs, setTgDialogs,
    selectedTgChat, setSelectedTgChat,
    tgMessages, setTgMessages,
    tgInput, setTgInput,
    tgLoadingChats,
    tgAvatarUrls,
    handleSendMessage,
    handleSelectChat
  }
}
