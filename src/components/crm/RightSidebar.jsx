import React, { useState } from 'react';
import { useCRM } from './CRMContext';
import './crmOverlay.css';

import CrmModal from './CrmModal';

const RightSidebar = ({ activeChat }) => {
  const [activeTab, setActiveTab ] = useState('Etiquetas');
  const [tabSelectorOpen, setTabSelectorOpen] = useState(false);
  const { tags, setTags, removeTag, schedules, archivedIds, unarchiveContact, gateway, setGateway } = useCRM();
  
  // UI States
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#0088cc');
  const [showColorModal, setShowColorModal] = useState(false);
  const [tagToDelete, setTagToDelete] = useState(null);

  const PRESET_COLORS = [
    '#ff4444', '#ff8800', '#ffbb33', '#00C851', '#007E33', 
    '#33b5e5', '#0099CC', '#2BBBAD', '#4285F4', '#aa66cc', 
    '#a6c', '#4b515d', '#3E4551', '#212121', '#ffffff'
  ];

  const handleStartAddTag = () => {
    if (!newTagName) return;
    setShowColorModal(true);
  };

  const confirmAddTag = () => {
    setTags(prev => [...prev, { id: Date.now().toString(), name: newTagName, color: newTagColor }]);
    setNewTagName('');
    setShowColorModal(false);
  };

  const handleStartRemoveTag = (tag) => {
    setTagToDelete(tag);
  };

  const confirmRemoveTag = () => {
    if (tagToDelete) {
      removeTag(tagToDelete.id);
      setTagToDelete(null);
    }
  };

  return (
    <div className="crm-sidebar-container" style={{ position: 'relative' }}>
      {/* Submenu Dropdown Selector */}
      <div className="crm-tabs-selector-area" style={{ position: 'relative', zIndex: 1001 }}>
          <div className={`tg-custom-filter ${tabSelectorOpen ? 'open' : ''}`} onClick={() => setTabSelectorOpen(!tabSelectorOpen)}>
            <span>Módulo: {activeTab}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ transform: tabSelectorOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><polyline points="6 9 12 15 18 9"/></svg>
          </div>
          {tabSelectorOpen && (
            <div className="tg-filter-dropdown" style={{ display: 'block', top: '100%', left: '1.25rem', right: '1.25rem', zIndex: 1002 }}>
              {['Etiquetas', 'Agendamentos', 'Arquivados', 'Assinantes'].map(tab => (
                <div key={tab} className="tg-filter-option" onClick={() => { setActiveTab(tab); setTabSelectorOpen(false); }}>
                  {tab}
                </div>
              ))}
            </div>
          )}
      </div>

      <div className="crm-tab-content" style={{ zIndex: 1 }}>
        {activeTab === 'Etiquetas' && (
          <div className="tab-pane">
            <div className="crm-section-title">Gerenciar Etiquetas</div>
            
            <div className="tag-creation-card">
              <div className="tag-input-group">
                <input 
                  type="text" 
                  placeholder="Nome da etiqueta..." 
                  value={newTagName}
                  onChange={e => setNewTagName(e.target.value)}
                />
              </div>
              <button 
                className="tag-add-confirm" 
                onClick={handleStartAddTag}
                disabled={!newTagName}
                style={{ opacity: newTagName ? 1 : 0.5 }}
              >
                Criar Etiqueta
              </button>
            </div>

            <div className="tag-list">
              {tags.map(tag => (
                <div key={tag.id} className="tag-card" style={{ borderLeftColor: tag.color }}>
                  <div className="tag-color-dot" style={{ backgroundColor: tag.color, boxShadow: `0 0 10px ${tag.color}66` }}></div>
                  <span className="tag-name">{tag.name}</span>
                  <button className="tag-remove-btn" onClick={() => handleStartRemoveTag(tag)}>×</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'Agendamentos' && (
          <div className="tab-pane">
            <div className="crm-section-title">Próximos Envios</div>
            {schedules.length === 0 ? (
              <p style={{ color: '#444', fontSize: '0.8rem', textAlign: 'center', marginTop: '2rem' }}>Nenhum agendamento pendente.</p>
            ) : (
              schedules.map(sch => (
                <div key={sch.id} className="schedule-item">
                  <div className="schedule-meta">
                    <span>{new Date(sch.datetime).toLocaleString()}</span>
                    <span className={`status-indicator ${sch.sent ? 'status-sent' : 'status-pending'}`}>
                      {sch.sent ? 'Enviado' : 'Aguardando'}
                    </span>
                  </div>
                  <div className="schedule-text">{sch.message}</div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'Arquivados' && (
          <div className="tab-pane">
            <div className="crm-section-title">Conversas Arquivadas</div>
            {archivedIds.length === 0 ? (
              <p style={{ color: '#444', fontSize: '0.8rem', textAlign: 'center', marginTop: '2rem' }}>Vazio.</p>
            ) : (
              archivedIds.map(id => (
                <div key={id} className="tag-item">
                  <span className="tag-name" style={{ margin: 0 }}>ID: {id}</span>
                  <button onClick={() => unarchiveContact(id)} style={{ fontSize: '0.7rem', color: '#0088cc', background: 'none', border: 'none', cursor: 'pointer' }}>Desarquivar</button>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'Assinantes' && (
          <div className="tab-pane">
            {!gateway ? (
              <div className="gateway-choice-card" style={{ textAlign: 'center', padding: '1rem 0' }}>
                <p style={{ fontSize: '0.85rem', color: '#888', marginBottom: '1.5rem' }}>Conecte um gateway para gerenciar seus assinantes.</p>
                <div className="gateway-grid">
                  {['PushinPay', 'Mercado Pago', 'Stripe', 'OmegaPay'].map(g => (
                    <div key={g} className="gateway-option" onClick={() => setGateway(g)}>
                      <span className="gateway-logo">💰</span>
                      <span className="gateway-name">{g}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="subscribers-list">
                 <div className="crm-section-title">
                   Ativos ({gateway})
                   <button onClick={() => setGateway(null)} style={{ fontSize: '0.6rem', color: '#ff4444', background: 'none', border: 'none', cursor: 'pointer' }}>Trocar</button>
                 </div>
                 {[
                   { name: 'Ana Silva', status: 'ativo', days: 22, progress: 75, color: '#00C851' },
                   { name: 'Bruno Costa', status: 'vencendo', days: 2, progress: 92, color: '#ffbb33' },
                   { name: 'Carla Dias', status: 'cortado', days: 0, progress: 100, color: '#ff4444' }
                 ].map((sub, i) => (
                   <div key={i} className="subscriber-card" style={{ background: 'rgba(255,255,255,0.02)', padding: '0.8rem', borderRadius: '12px', marginBottom: '0.75rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>{sub.name}</span>
                        <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: sub.color }}>{sub.status}</span>
                      </div>
                      <div style={{ height: '4px', background: '#222', borderRadius: '2px', marginBottom: '0.4rem', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${sub.progress}%`, background: sub.color }}></div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#555' }}>
                        <span>Expira em {sub.days} dias</span>
                        <span>R$ 49,90/mês</span>
                      </div>
                   </div>
                 ))}
                 <div style={{ marginTop: '1.5rem', background: 'rgba(0,136,204,0.05)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(0,136,204,0.1)' }}>
                   <p style={{ fontSize: '0.7rem', color: '#0088cc', margin: 0 }}>💡 Use os Webhooks da {gateway} para automatizar essa lista em tempo real.</p>
                 </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAIS CRM */}
      <CrmModal 
        isOpen={showColorModal}
        title={`Escolha uma cor para "${newTagName}"`}
        onClose={() => setShowColorModal(false)}
        onConfirm={confirmAddTag}
        confirmText="Finalizar Cadastro"
      >
        <div className="color-grid">
          {PRESET_COLORS.map(c => (
            <div 
              key={c} 
              className={`color-swatch ${newTagColor === c ? 'active' : ''}`}
              style={{ backgroundColor: c }}
              onClick={() => setNewTagColor(c)}
            />
          ))}
        </div>
      </CrmModal>

      <CrmModal
        isOpen={!!tagToDelete}
        title="Excluir Etiqueta"
        confirmText="Sim, Excluir"
        confirmColor="#ff4444"
        onClose={() => setTagToDelete(null)}
        onConfirm={confirmRemoveTag}
      >
        <p>Tem certeza que deseja excluir a etiqueta <strong>{tagToDelete?.name}</strong>?</p>
        <p style={{ marginTop: '0.5rem' }}>Atenção: Todos os chats marcados com ela serão desetiquetados permanentemente.</p>
      </CrmModal>
    </div>
  );
};

export default RightSidebar;
