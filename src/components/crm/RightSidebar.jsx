import React, { useState } from 'react';
import { useCRM } from './CRMContext';
import './crmOverlay.css';

const RightSidebar = ({ activeChat }) => {
  const [activeTab, setActiveTab] = useState('Etiquetas');
  const { tags, setTags, schedules, archivedIds, unarchiveContact, gateway, setGateway } = useCRM();
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#0088cc');

  const addTag = () => {
    if (!newTagName) return;
    setTags([...tags, { id: Date.now().toString(), name: newTagName, color: newTagColor }]);
    setNewTagName('');
  };

  const removeTag = (id) => {
    setTags(tags.filter(t => t.id !== id));
  };

  return (
    <div className="crm-sidebar-container">
      <div className="crm-tabs-header">
        {['Etiquetas', 'Agendamentos', 'Arquivados', 'Assinantes'].map(tab => (
          <button 
            key={tab} 
            className={`crm-tab-btn ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="crm-tab-content">
        {activeTab === 'Etiquetas' && (
          <div className="tab-pane">
            <div className="crm-section-title">Gerenciar Etiquetas</div>
            <div className="tag-creation-box" style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.5rem' }}>
              <input 
                type="text" 
                placeholder="Nova etiqueta" 
                value={newTagName}
                onChange={e => setNewTagName(e.target.value)}
                style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
              />
              <input 
                type="color" 
                value={newTagColor}
                onChange={e => setNewTagColor(e.target.value)}
                style={{ width: '32px', height: '32px', border: 'none', background: 'none', cursor: 'pointer' }}
              />
              <button onClick={addTag} style={{ background: '#333', border: 'none', color: '#fff', borderRadius: '8px', padding: '0 0.75rem', cursor: 'pointer' }}>+</button>
            </div>
            <div className="tag-list">
              {tags.map(tag => (
                <div key={tag.id} className="tag-item">
                  <div className="tag-color-dot" style={{ backgroundColor: tag.color }}></div>
                  <span className="tag-name">{tag.name}</span>
                  <button onClick={() => removeTag(tag.id)} style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', fontSize: '1rem' }}>×</button>
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
    </div>
  );
};

export default RightSidebar;
