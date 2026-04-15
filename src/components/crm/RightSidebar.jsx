import React, { useState } from 'react';
import { useCRM } from './CRMContext';
import './crmOverlay.css';

import CrmModal from './CrmModal';

const RightSidebar = ({ activeChat }) => {
  const [activeTab, setActiveTab ] = useState('Etiquetas');
  const [tabSelectorOpen, setTabSelectorOpen] = useState(false);
  const { 
    tags, setTags, removeTag, 
    schedules, 
    archivedIds, unarchiveContact, 
    gateway, setGateway,
    globalAiEnabled, toggleGlobalAi
  } = useCRM();
  
  // UI States
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#0088cc');
  const [showColorModal, setShowColorModal] = useState(false);
  const [tagToDelete, setTagToDelete] = useState(null);

  // Gateway Config States
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');

  const PRESET_COLORS = [
    '#ff4444', '#ff8800', '#ffbb33', '#00C851', '#007E33', 
    '#33b5e5', '#0099CC', '#2BBBAD', '#4285F4', '#aa66cc', 
    '#a6c', '#4b515d', '#3E4551', '#212121', '#ffffff'
  ];

  const GATEWAY_ICONS = {
    'PushinPay': <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>,
    'Mercado Pago': <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h7"/><path d="M16 19h6"/><path d="M19 16v6"/><circle cx="9" cy="12" r="3"/></svg>,
    'Stripe': <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20"/><path d="m17 5-5-3-5 3"/><path d="m17 19-5 3-5-3"/><path d="M2 12h20"/></svg>,
    'OmegaPay': <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
  };

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
      {/* Universal Auto-Pilot Toggle */}
      <div style={{ padding: '1.5rem 2rem 0.5rem', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
        <div 
          className="ai-universal-card" 
          onClick={toggleGlobalAi}
          style={{ 
            background: globalAiEnabled ? 'rgba(0,136,204,0.1)' : 'rgba(255,255,255,0.02)',
            border: `1px solid ${globalAiEnabled ? 'rgba(0,136,204,0.3)' : 'rgba(255,255,255,0.05)'}`,
            borderRadius: '20px',
            padding: '1.25rem',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ 
              width: '40px', 
              height: '40px', 
              borderRadius: '12px', 
              background: globalAiEnabled ? '#0088cc' : '#222',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: globalAiEnabled ? '0 0 15px rgba(0,136,204,0.4)' : 'none',
              transition: 'all 0.3s'
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/><circle cx="12" cy="12" r="3"/></svg>
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: '800', color: '#fff' }}>Piloto Automático</div>
              <div style={{ fontSize: '0.65rem', color: globalAiEnabled ? '#0088cc' : '#555', textTransform: 'uppercase', fontWeight: '700', marginTop: '2px' }}>
                {globalAiEnabled ? 'Sistema Ativo' : 'Desativado'}
              </div>
            </div>
          </div>
          <div style={{ 
            width: '44px', 
            height: '24px', 
            borderRadius: '12px', 
            background: globalAiEnabled ? '#0088cc' : '#333',
            position: 'relative',
            transition: 'all 0.3s'
          }}>
            <div style={{ 
              position: 'absolute', 
              top: '3px', 
              left: globalAiEnabled ? '23px' : '3px', 
              width: '18px', 
              height: '18px', 
              borderRadius: '50%', 
              background: '#fff',
              transition: 'all 0.3s'
            }} />
          </div>
        </div>
      </div>

      {/* Submenu Dropdown Selector */}
      <div className="crm-tabs-selector-area" style={{ position: 'relative', zIndex: 1001 }}>
          <div className={`tg-custom-filter ${tabSelectorOpen ? 'open' : ''}`} onClick={() => setTabSelectorOpen(!tabSelectorOpen)}>
            <span>Módulo: {activeTab}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ transform: tabSelectorOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><polyline points="6 9 12 15 18 9"/></svg>
          </div>
          {tabSelectorOpen && (
            <div className="tg-filter-dropdown" style={{ display: 'block', top: '100%', left: '1.25rem', right: '1.25rem', zIndex: 1002 }}>
              {['Etiquetas', 'Agendamentos', 'Arquivados', 'Gateway'].map(tab => (
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

        {activeTab === 'Gateway' && (
          <div className="tab-pane">
            {!gateway ? (
              <div className="gateway-choice-card" style={{ textAlign: 'center', padding: '1rem 0' }}>
                <div className="crm-section-title">Selecione o Gateway</div>
                <p style={{ fontSize: '0.85rem', color: '#555', marginBottom: '2rem' }}>Conecte seu provedor para automação de pagamentos.</p>
                <div className="gateway-grid">
                  {['PushinPay', 'Mercado Pago', 'Stripe', 'OmegaPay'].map(g => (
                    <div key={g} className="gateway-option" onClick={() => setGateway(g)}>
                      <div className="gateway-icon-wrapper">{GATEWAY_ICONS[g]}</div>
                      <span className="gateway-name">{g}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="subscribers-list">
                 <div className="crm-section-title">
                   Configurações {gateway}
                   <button onClick={() => setGateway(null)} style={{ fontSize: '0.65rem', color: '#ff4444', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>Trocar Gateway</button>
                 </div>
                 
                 <div className="tag-creation-card" style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <div style={{ marginBottom: '1.5rem' }}>
                      <label style={{ display: 'block', fontSize: '0.65rem', color: '#555', textTransform: 'uppercase', marginBottom: '0.5rem', fontWeight: '800' }}>Chave API (Public)</label>
                      <input 
                        className="tg-input" 
                        type="password" 
                        placeholder="pk_live_..." 
                        style={{ background: '#000', border: '1px solid #111' }}
                        value={apiKey}
                        onChange={e => setApiKey(e.target.value)}
                      />
                    </div>
                    <div style={{ marginBottom: '1.5rem' }}>
                      <label style={{ display: 'block', fontSize: '0.65rem', color: '#555', textTransform: 'uppercase', marginBottom: '0.5rem', fontWeight: '800' }}>Token de Acesso (Secret)</label>
                      <input 
                        className="tg-input" 
                        type="password" 
                        placeholder="sk_live_..." 
                        style={{ background: '#000', border: '1px solid #111' }}
                        value={apiSecret}
                        onChange={e => setApiSecret(e.target.value)}
                      />
                    </div>
                    <button className="tag-add-confirm" onClick={() => alert('Configurações salvas!')} style={{ background: '#0088cc', color: '#fff' }}>
                      Salvar e Conectar
                    </button>
                 </div>

                 <div style={{ marginTop: '2rem', background: 'rgba(0,136,204,0.05)', padding: '1rem', borderRadius: '16px', border: '1px solid rgba(0,136,204,0.1)' }}>
                   <p style={{ fontSize: '0.75rem', color: '#0088cc', margin: 0, lineHeight: '1.5' }}>
                     <strong>Webhook Ativo:</strong><br/>
                     Use o endpoint abaixo no seu painel da {gateway}:<br/>
                     <code style={{ fontSize: '0.6rem', color: '#aaa', display: 'block', marginTop: '0.5rem', background: '#000', padding: '0.4rem', borderRadius: '4px' }}>https://api.allcanceai.com/webhooks/{gateway.toLowerCase()}</code>
                   </p>
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
