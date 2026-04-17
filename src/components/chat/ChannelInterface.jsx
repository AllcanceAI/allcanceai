import React, { useState } from 'react';

const WaMediaRenderer = ({ message, fetchMediaBase64 }) => {
  const [base64, setBase64] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const loadMedia = async () => {
    setLoading(true);
    const data = await fetchMediaBase64(message);
    if(data) setBase64(data);
    else setError(true);
    setLoading(false);
  };

  if (base64) {
    if (message.mediaType === 'audio') {
       return <audio src={base64} controls style={{ maxWidth: '100%', height: '40px', borderRadius: '8px' }} />;
    } else if (message.mediaType === 'image' || message.mediaType === 'sticker') {
       return <img src={base64} style={{ maxWidth: '100%', maxHeight: '250px', borderRadius: '8px', objectFit: 'contain' }} alt="Media" />;
    } else if (message.mediaType === 'video') {
       return <video src={base64} controls style={{ maxWidth: '100%', maxHeight: '250px', borderRadius: '8px' }} />;
    } else {
       return <a href={base64} download="documento" style={{ color: '#0088cc', textDecoration: 'underline' }}>Baixar Mídia</a>;
    }
  }

  return (
    <div 
      onClick={loading ? undefined : loadMedia} 
      style={{ 
        padding: '0.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', 
        cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', 
        border: '1px solid rgba(255,255,255,0.1)' 
      }}>
      <div style={{ 
         width: '32px', height: '32px', borderRadius: '50%', background: '#0088cc', 
         display: 'flex', alignItems: 'center', justifyContent: 'center' 
      }}>
        {loading ? <div className="pro-spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div> : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        )}
      </div>
      <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>
        {error ? 'Erro. Tentar Novo?' : `Ver ${message.mediaType === 'audio' ? 'Áudio' : message.mediaType === 'image' ? 'Imagem' : 'Mídia'}`}
      </span>
    </div>
  );
};


/**
 * ChannelUI Component
 * Uma interface de chat universal que replica a estrutura premium do AllcanceAI Telegram CRM
 * para qualquer canal (WhatsApp, Telegram, etc).
 */
export const ChannelUI = ({ 
  dialogs = [], 
  selectedChat = null, 
  messages = [], 
  inputValue = '', 
  setInputValue = () => {}, 
  onSendMessage = () => {}, 
  onSelectChat = () => {}, 
  loadingChats = false, 
  avatarUrls = {}, 
  platform = 'tg',
  status = 'disconnected',
  onReturn = () => {},
  onDisconnect = () => {},
  // CRM Props
  tags = [],
  contactTags = {},
  selectedFilterTag = 'all',
  setSelectedFilterTag = () => {},
  filterOpen = false,
  setFilterOpen = () => {},
  handleCrmMenu = () => {},
  globalAiEnabled = false,
  toggleGlobalAi = () => {},
  disabledAiChatIds = [],
  toggleChatAi = () => {},
  messagesEndRef = null,
  archivedIds = [],
  // Renderers
  RightSidebar = () => null,
  CrmMenu = () => null,
  crmMenuState = { visible: false },
  closeCrmMenu = () => {},
  fetchMediaBase64 = async () => null
}) => {
  return (
    <div className={`tg-interface ${messages.length > 0 ? 'mobile-chat-active' : ''}`}>
      {/* 1. PAINEL ESQUERDO: LISTA DE CHATS */}
      <div className="tg-sidebar-panel">
        <div className="tg-panel-header" style={{ padding: '0.75rem 1rem', height: '64px', display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <button className="tg-return-btn" onClick={onReturn} title="Retornar ao Início" style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', width: '36px', height: '36px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          
          <div className="tg-filter-area" style={{ flex: 1, marginLeft: '0.25rem', position: 'relative' }}>
             <div className={`tg-custom-filter ${filterOpen ? 'open' : ''}`} onClick={() => setFilterOpen(!filterOpen)}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                 {selectedFilterTag !== 'all' && <div className="tag-color-dot" style={{ backgroundColor: tags.find(t => t.id === selectedFilterTag)?.color }}></div>}
                 <span>{selectedFilterTag === 'all' ? 'Filtrar por Tag' : tags.find(t => t.id === selectedFilterTag)?.name}</span>
               </div>
               <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ transform: filterOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><polyline points="6 9 12 15 18 9"/></svg>
             </div>
             
             {filterOpen && (
               <>
                 <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }} onClick={() => setFilterOpen(false)} />
                 <div className="tg-filter-dropdown">
                   <div className="tg-filter-option" onClick={() => { setSelectedFilterTag('all'); setFilterOpen(false); }}>Todas as Mensagens</div>
                   {tags.map(tag => (
                     <div key={tag.id} className="tg-filter-option" onClick={() => { setSelectedFilterTag(tag.id); setFilterOpen(false); }}>
                       <div className="tag-color-dot" style={{ backgroundColor: tag.color }}></div>
                       {tag.name}
                     </div>
                   ))}
                 </div>
               </>
             )}
          </div>
          
          <button className="tg-disconnect-btn" title="Desconectar" onClick={onDisconnect} style={{ padding: '0.4rem', background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer' }}>
             <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        </div>

        {/* Mobile AI Quick Control */}
        <div className="mobile-only-ai-toggle" style={{ padding: '0.75rem 1rem', display: 'none' }}>
          <div onClick={toggleGlobalAi} style={{
              background: globalAiEnabled ? 'rgba(0,136,204,0.1)' : 'rgba(255,255,255,0.02)',
              border: `1px solid ${globalAiEnabled ? 'rgba(0,136,204,0.3)' : 'rgba(255,255,255,0.05)'}`,
              borderRadius: '12px', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer'
            }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: globalAiEnabled ? '#0088cc' : '#222', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: globalAiEnabled ? '0 0 10px rgba(0,136,204,0.3)' : 'none' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/><circle cx="12" cy="12" r="3"/></svg>
              </div>
              <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#fff' }}>I.A. Ativa</div>
            </div>
            <div style={{ width: '36px', height: '20px', borderRadius: '10px', background: globalAiEnabled ? '#0088cc' : '#333', position: 'relative' }}>
              <div style={{ position: 'absolute', top: '2px', left: globalAiEnabled ? '18px' : '2px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'all 0.3s' }} />
            </div>
          </div>
        </div>

        <div className="tg-chat-list">
          {loadingChats ? (
            <div className="tg-loading"><div className="pro-spinner"></div></div>
          ) : dialogs
            .filter(d => !archivedIds.includes(d.id?.toString()))
            .filter(d => selectedFilterTag === 'all' || (contactTags[d.id?.toString()] || []).includes(selectedFilterTag))
            .map((dialog, i) => {
              const contactId = dialog.id?.toString();
              const avatarUrl = avatarUrls[contactId];
              const activeContactTags = contactTags[contactId] || [];
              const lastTagId = activeContactTags[activeContactTags.length - 1];
              const lastTag = tags.find(t => t.id === lastTagId);

              return (
                <div key={i}
                  className={`tg-chat-item ${selectedChat?.id === dialog.id ? 'active' : ''} ${lastTag ? 'has-tag' : ''}`}
                  onContextMenu={(e) => handleCrmMenu(e, contactId, dialog.entity)}
                  onClick={() => onSelectChat(dialog)}
                >
                  {lastTag && <div className="tag-border-indicator" style={{ backgroundColor: lastTag.color }}></div>}
                  <div className="tg-chat-content-flex">
                    {avatarUrl ? <img src={avatarUrl} alt="" className="tg-avatar tg-avatar-photo" /> : <div className="tg-avatar">{(dialog.name || '?')[0]}</div>}
                    <div className="tg-chat-details">
                      <div className="tg-chat-top-row">
                        <span className="tg-chat-name">{dialog.name || 'Sem nome'}</span>
                        <span className="tg-chat-time">{dialog.message?.date ? new Date(dialog.message.date * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                      </div>
                      <div className="tg-chat-bottom-row">
                        <span className="tg-last-msg">{dialog.message?.message?.slice(0, 32) || (dialog.message?.media ? '📎 Mídia' : '')}</span>
                        <div className="tg-indicators">
                          {dialog.unreadCount > 0 && <span className="tg-unread-badge">{dialog.unreadCount}</span>}
                          <button className="tg-item-more-btn" onClick={(e) => { e.stopPropagation(); handleCrmMenu(e, contactId, dialog.entity); }}>⋮</button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
          })}
        </div>
      </div>

      {/* 2. PAINEL DIREITO: ÁREA DE CHAT */}
      <div className="tg-chat-view">
        {selectedChat ? (
          <>
            <div className="tg-chat-header">
              <button className="tg-back-btn" onClick={() => onSelectChat(null)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              {avatarUrls[selectedChat.id?.toString()] ? (
                <img src={avatarUrls[selectedChat.id?.toString()]} alt="" className="tg-avatar tg-avatar-photo" />
              ) : (
                <div className="tg-avatar">{(selectedChat.name || '?')[0]}</div>
              )}
              <p className="tg-chat-name">{selectedChat.name}</p>

              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <button 
                  onClick={() => toggleChatAi(selectedChat.id?.toString())}
                  style={{
                    background: disabledAiChatIds.includes(selectedChat.id?.toString()) ? 'rgba(255,255,255,0.03)' : 'rgba(0,136,204,0.15)',
                    border: `1px solid ${disabledAiChatIds.includes(selectedChat.id?.toString()) ? 'rgba(255,255,255,0.1)' : 'rgba(0,136,204,0.4)'}`,
                    borderRadius: '8px', padding: '0.4rem 0.85rem', color: disabledAiChatIds.includes(selectedChat.id?.toString()) ? '#888' : '#0088cc',
                    fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem'
                  }}
                >
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: disabledAiChatIds.includes(selectedChat.id?.toString()) ? '#444' : '#0088cc' }} />
                  {disabledAiChatIds.includes(selectedChat.id?.toString()) ? 'Ativar IA' : 'IA Ativa'}
                </button>
                <div className="tg-item-more" style={{ padding: '0.5rem', cursor: 'pointer' }} onClick={(e) => handleCrmMenu(e, selectedChat.id?.toString(), selectedChat.entity)}>⋮</div>
              </div>
            </div>

            <div className="tg-messages-area">
              {messages.map((msg, i) => (
                <div key={i} className={`tg-bubble ${msg.out ? 'out' : 'in'}`}>
                  {msg.hasMedia && platform === 'wa' && (
                    <div style={{ marginBottom: msg.message ? '0.5rem' : '0' }}>
                      <WaMediaRenderer message={msg} fetchMediaBase64={fetchMediaBase64} />
                    </div>
                  )}
                  {msg.message && <p>{msg.message}</p>}
                  <span className="tg-bubble-time">{new Date(msg.date * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="tg-input-bar">
              <input className="tg-input" placeholder="Digite uma mensagem..." value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') onSendMessage(); }}
              />
              <button className="tg-send-btn" onClick={onSendMessage}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
              </button>
            </div>
          </>
        ) : (
          <div className="tg-empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
            <p>Selecione uma conversa para começar no {platform === 'wa' ? 'WhatsApp' : 'Telegram'}</p>
          </div>
        )}
      </div>

      {/* 3. PAINEL CRM (RIGHT SIDEBAR) */}
      <RightSidebar activeChat={selectedChat} />

      {/* 4. MENU DE CONTEXTO */}
      {crmMenuState.visible && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1999 }} onClick={closeCrmMenu}>
          <CrmMenu x={crmMenuState.x} y={crmMenuState.y} contactId={crmMenuState.contactId} entity={crmMenuState.entity} onClose={closeCrmMenu} />
        </div>
      )}
    </div>
  );
};
