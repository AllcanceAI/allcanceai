import React, { createContext, useContext, useState, useEffect } from 'react';
import { sendTelegramMessage } from '../../services/telegramService';

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

  // Persistência
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
          } catch (e) {
            console.error('Falha no disparo agendado:', e);
          }
        }
      }
    }, 30000); // Check a cada 30s
    return () => clearInterval(interval);
  }, [schedules]);

  // Auxiliares
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

  return (
    <CRMContext.Provider value={{
      tags, setTags,
      contactTags, tagContact, untagContact,
      schedules, setSchedules,
      archivedIds, archiveContact, unarchiveContact,
      gateway, setGateway
    }}>
      {children}
    </CRMContext.Provider>
  );
};

export const useCRM = () => useContext(CRMContext);
