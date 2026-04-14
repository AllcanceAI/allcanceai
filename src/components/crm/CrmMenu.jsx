import React, { useState, useEffect } from 'react';
import { useCRM } from './CRMContext';

export const CrmMenu = ({ x, y, onClose, contactId, entity }) => {
  const { tags, tagContact, archiveContact, setSchedules } = useCRM();
  const [showTagSubmenu, setShowTagSubmenu] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  // Modal de Agendamento Inline
  const [schDate, setSchDate] = useState('');
  const [schTime, setSchTime] = useState('');
  const [schMsg, setSchMsg] = useState('');

  const handleSchedule = () => {
    if (!schDate || !schTime || !schMsg) return;
    const datetime = `${schDate}T${schTime}`;
    setSchedules(prev => [...prev, {
      id: Date.now().toString(),
      contactId,
      entity,
      message: schMsg,
      datetime,
      sent: false
    }]);
    setShowScheduleModal(false);
    onClose();
  };

  const subMenuWidth = 180;
  const isRightSide = x > window.innerWidth / 2;

  return (
    <>
      <div className="crm-context-menu" style={{ top: y, left: x }}>
        <div 
          className="crm-menu-item" 
          onMouseEnter={() => setShowTagSubmenu(true)}
          onClick={(e) => {
            e.stopPropagation();
            setShowTagSubmenu(!showTagSubmenu);
          }}
          style={{ position: 'relative' }}
        >
          Etiquetar <span style={{ marginLeft: 'auto', fontSize: '0.7rem', opacity: 0.5 }}>{isRightSide ? '◀' : '▶'}</span>
          {showTagSubmenu && (
            <div 
              className="crm-context-menu" 
              style={{ 
                left: isRightSide ? `-${subMenuWidth}px` : '100%', 
                top: 0,
                boxShadow: isRightSide ? '-10px 10px 30px rgba(0,0,0,0.5)' : '10px 10px 30px rgba(0,0,0,0.5)'
              }}
            >
              {tags.map(t => (
                <div key={t.id} className="crm-menu-item" onClick={(e) => { e.stopPropagation(); tagContact(contactId, t.id); onClose(); }}>
                  <div className="tag-color-dot" style={{ backgroundColor: t.color }}></div>
                  {t.name}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="crm-menu-item" onClick={() => setShowScheduleModal(true)}>Agendar Mensagem</div>
        <div className="crm-menu-item" onClick={() => { archiveContact(contactId); onClose(); }}>Arquivar Conversa</div>
        <div className="crm-divider" style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: '0.25rem 0' }}></div>
        <div className="crm-menu-item" style={{ color: '#ff4444' }} onClick={onClose}>Cancelar</div>
      </div>

      {showScheduleModal && (
        <div className="crm-modal-overlay">
          <div className="crm-modal-card">
            <h3 style={{ marginBottom: '1rem' }}>Agendar Mensagem</h3>
            <textarea 
              placeholder="Sua mensagem..." 
              value={schMsg} 
              onChange={e => setSchMsg(e.target.value)}
              style={{ width: '100%', height: '100px', background: '#000', border: '1px solid #333', color: '#fff', borderRadius: '12px', padding: '1rem', marginBottom: '1rem', outline: 'none' }}
            />
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <input type="date" value={schDate} onChange={e => setSchDate(e.target.value)} style={{ flex: 1, background: '#000', border: '1px solid #333', color: '#fff', padding: '0.5rem', borderRadius: '8px' }} />
              <input type="time" value={schTime} onChange={e => setSchTime(e.target.value)} style={{ flex: 1, background: '#000', border: '1px solid #333', color: '#fff', padding: '0.5rem', borderRadius: '8px' }} />
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button onClick={() => setShowScheduleModal(false)} style={{ flex: 1, padding: '0.75rem', background: '#222', border: 'none', color: '#fff', borderRadius: '12px', cursor: 'pointer' }}>Voltar</button>
              <button onClick={handleSchedule} style={{ flex: 1, padding: '0.75rem', background: '#0088cc', border: 'none', color: '#fff', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold' }}>Salvar Agendamento</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
