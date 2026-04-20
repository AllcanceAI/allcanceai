import React, { createContext, useContext, useState, useEffect } from 'react';
import { sendTelegramMessage } from '../../services/telegramService';
import { supabase } from '../../supabaseClient';

const CRMContext = createContext();

export const CRMProvider = ({ children }) => {
  // --- ETIQUETAS ---
  const [tags, setTags] = useState(() => {
    const saved = localStorage.getItem('crm_tags');
    return saved ? JSON.parse(saved) : [
      { id: '1', name: 'Lead Quente', color: '#ff4444' },
      { id: '2', name: 'Aguardando Pagto', color: '#ffbb33' },
      { id: '3', name: 'Cliente VIP', color: '#00C851' }
    ];
  });

  const [contactTags, setContactTags] = useState(() => {
    const saved = localStorage.getItem('crm_contact_tags');
    return saved ? JSON.parse(saved) : {}; // { contactId: [tagIds] }
  });

  // --- AGENDAMENTOS ---
  const [schedules, setSchedules] = useState(() => {
    const saved = localStorage.getItem('crm_schedules');
    return saved ? JSON.parse(saved) : [];
  });

  // --- ARQUIVADOS ---
  const [archivedIds, setArchivedIds] = useState(() => {
    const saved = localStorage.getItem('crm_archived');
    return saved ? JSON.parse(saved) : [];
  });

  // --- GATEWAY ---
  const [gateway, setGateway] = useState(() => {
    return localStorage.getItem('crm_gateway_config') || null;
  });

  // Persistência CRM
  useEffect(() => { localStorage.setItem('crm_tags', JSON.stringify(tags)); }, [tags]);
  useEffect(() => { localStorage.setItem('crm_contact_tags', JSON.stringify(contactTags)); }, [contactTags]);
  useEffect(() => { localStorage.setItem('crm_schedules', JSON.stringify(schedules)); }, [schedules]);
  useEffect(() => { localStorage.setItem('crm_archived', JSON.stringify(archivedIds)); }, [archivedIds]);

  // --- ENGINE DE AGENDAMENTO ---
  useEffect(() => {
    const interval = setInterval(async () => {
      const now = new Date().getTime();
      const toSend = schedules.filter(s => !s.sent && new Date(s.datetime).getTime() <= now);
      if (toSend.length > 0) {
        for (const item of toSend) {
          try {
            await sendTelegramMessage(item.entity, item.message);
            setSchedules(prev => prev.map(s => s.id === item.id ? { ...s, sent: true } : s));
          } catch (e) { console.error('Falha no disparo agendado:', e); }
        }
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [schedules]);

  // Auxiliares CRM
  const archiveContact = (id) => setArchivedIds(prev => [...new Set([...prev, id])]);
  const unarchiveContact = (id) => setArchivedIds(prev => prev.filter(i => i !== id));
  
  const tagContact = (contactId, tagId) => {
    setContactTags(prev => {
      const current = prev[contactId] || [];
      if (current.includes(tagId)) return prev;
      return { ...prev, [contactId]: [...current, tagId] };
    });
  };

  const untagContact = (contactId, tagId) => {
    setContactTags(prev => {
        const current = prev[contactId] || [];
        return { ...prev, [contactId]: current.filter(id => id !== tagId) };
    });
  };

  const removeTag = (tagId) => {
    setTags(prev => prev.filter(t => t.id !== tagId));
    setContactTags(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(contactId => {
        next[contactId] = next[contactId].filter(id => id !== tagId);
      });
      return next;
    });
  };

  // --- INTELIGÊNCIA ARTIFICIAL (AUTO-PILOT) ---
  const [globalAiEnabled, setGlobalAiEnabled] = useState(() => {
    return localStorage.getItem('crm_ai_global') === 'true';
  });

  const [disabledAiChatIds, setDisabledAiChatIds] = useState(() => {
    const saved = localStorage.getItem('crm_ai_disabled_chats');
    return saved ? JSON.parse(saved) : [];
  });

  // Persistência AI
  useEffect(() => { localStorage.setItem('crm_ai_global', globalAiEnabled); }, [globalAiEnabled]);
  useEffect(() => { localStorage.setItem('crm_ai_disabled_chats', JSON.stringify(disabledAiChatIds)); }, [disabledAiChatIds]);

  const toggleGlobalAi = async () => {
    const newState = !globalAiEnabled;
    setGlobalAiEnabled(newState);
    
    // Sincroniza o botão com o banco de dados para a Edge Function respeitar a trava
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) {
       await supabase.from('ai_training').update({ is_active: newState }).eq('user_id', session.user.id);
    }
  };
  const toggleChatAi = async (contactId) => {
    const isCurrentlyDisabled = disabledAiChatIds.includes(contactId);
    setDisabledAiChatIds(prev => 
      isCurrentlyDisabled ? prev.filter(id => id !== contactId) : [...prev, contactId]
    );

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) {
       if (isCurrentlyDisabled) {
         await supabase.from('ai_disabled_chats')
           .delete()
           .eq('user_id', session.user.id)
           .eq('chat_id', contactId)
           .eq('channel', 'whatsapp');
       } else {
         await supabase.from('ai_disabled_chats')
           .insert({ user_id: session.user.id, chat_id: contactId, channel: 'whatsapp' });
       }
    }
  };
   
  // Carregar dados iniciais do banco
  useEffect(() => {
    const syncWithDb = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        const { data: disabled } = await supabase
          .from('ai_disabled_chats')
          .select('chat_id')
          .eq('user_id', session.user.id)
          .eq('channel', 'whatsapp');
        
        if (disabled) {
          setDisabledAiChatIds(disabled.map(d => d.chat_id));
        }
      }
    };
    syncWithDb();
  }, []);

  return (
    <CRMContext.Provider value={{
      tags, setTags, removeTag,
      contactTags, tagContact, untagContact,
      schedules, setSchedules,
      archivedIds, archiveContact, unarchiveContact,
      gateway, setGateway,
      globalAiEnabled, toggleGlobalAi,
      disabledAiChatIds, toggleChatAi
    }}>
      {children}
    </CRMContext.Provider>
  );
};

export const useCRM = () => useContext(CRMContext);
