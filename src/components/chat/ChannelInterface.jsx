import React from 'react';

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
  closeCrmMenu = () => {}
}) => {
  const [aiFilter, setAiFilter] = React.useState('all');
  const [inlineTagsOpen, setInlineTagsOpen] = React.useState(false);

  // Helper context tag
  const toggleContactTag = (chatId, tagId) => {
    // Isso é uma simplificação baseada no handleCrmMenu que era usado, 
    // idealmente o toggleTcontactTag existiria no CRMContext. 
    // Como a instrução diz "só muda onde ficam e continua funcionando igual", 
    // usarei handleCrmMenu para disparar o dropdown original, ou replicar o click de tags aqui
    // Porém, handleCrmMenu chama o CrmMenu que tem as tags. 
  };

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

        <div style={{ display: 'flex', gap: '6px', padding: '0 1rem 0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)', overflowX: 'auto' }}>
           <button onClick={() => setAiFilter('all')} style={{ padding: '4px 10px', borderRadius: '15px', background: aiFilter === 'all' ? '#333' : 'transparent', border: '1px solid #333', color: '#ccc', fontSize: '0.7rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>Todos</button>
           <button onClick={() => setAiFilter('active')} style={{ padding: '4px 10px', borderRadius: '15px', background: aiFilter === 'active' ? 'rgba(0,230,118,0.15)' : 'transparent', border: '1px solid rgba(0,230,118,0.3)', color: '#00e676', fontSize: '0.7rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>IA Ativa</button>
           <button onClick={() => setAiFilter('paused')} style={{ padding: '4px 10px', borderRadius: '15px', background: aiFilter === 'paused' ? 'rgba(255,255,255,0.1)' : 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#aaa', fontSize: '0.7rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>Aguardando Humano</button>
        </div>

        <div className="tg-chat-list">
          {loadingChats ? (
            <div className="tg-loading"><div className="pro-spinner"></div></div>
          ) : dialogs
            .filter(d => !archivedIds.includes(d.id?.toString()))
            .filter(d => selectedFilterTag === 'all' || (contactTags[d.id?.toString()] || []).includes(selectedFilterTag))
            .filter(d => {
               if (aiFilter === 'all') return true;
               const isAiActive = globalAiEnabled && !disabledAiChatIds.includes(d.id?.toString());
               if (aiFilter === 'active') return isAiActive;
               if (aiFilter === 'paused') return !isAiActive;
               return true;
            })
            .map((dialog, i) => {
              const contactId = dialog.id?.toString();
              const avatarUrl = avatarUrls[contactId];
              const activeContactTags = contactTags[contactId] || [];
              const lastTagId = activeContactTags[activeContactTags.length - 1];
              const lastTag = tags.find(t => t.id === lastTagId);
              const isAiActive = globalAiEnabled && !disabledAiChatIds.includes(contactId);

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
                        <span className="tg-chat-name" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {dialog.name || 'Sem nome'}
                          <span title={isAiActive ? "IA Ativa" : "Aguardando / Pausada"} style={{ fontSize: '0.7rem', opacity: isAiActive ? 1 : 0.6 }}>
                            {isAiActive ? '⚡' : '⏸️'}
                          </span>
                        </span>
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

              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem', position: 'relative' }}>
                <button 
                  onClick={(e) => { e.stopPropagation(); setInlineTagsOpen(!inlineTagsOpen); }}
                  style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '0.4rem', color: '#ccc', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  title="Etiquetas"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                </button>
                
                {/* Drowpdown Inline de Etiquetas reaproveito o menu CrmMenu mas via hook de clique */}
                {inlineTagsOpen && (
                  <div style={{ position: 'absolute', top: '40px', right: '40px', zIndex: 100 }}>
                    <CrmMenu x={0} y={0} contactId={selectedChat.id?.toString()} entity={selectedChat.entity} onClose={() => setInlineTagsOpen(false)} isOverlay={false} />
                  </div>
                )}

                <button 
                  onClick={() => {
                    const isActive = globalAiEnabled && !disabledAiChatIds.includes(selectedChat.id?.toString());
                    if (isActive) {
                      if (window.confirm("Desativar IA nesta conversa?")) {
                         toggleChatAi(selectedChat.id?.toString());
                      }
                    } else {
                      toggleChatAi(selectedChat.id?.toString());
                    }
                  }}
                  style={{
                    background: (globalAiEnabled && !disabledAiChatIds.includes(selectedChat.id?.toString())) ? 'rgba(0,230,118,0.15)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${(globalAiEnabled && !disabledAiChatIds.includes(selectedChat.id?.toString())) ? 'rgba(0,230,118,0.4)' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: '8px', padding: '0.4rem 0.85rem', 
                    color: (globalAiEnabled && !disabledAiChatIds.includes(selectedChat.id?.toString())) ? '#00e676' : '#aaa',
                    fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s'
                  }}
                >
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: (globalAiEnabled && !disabledAiChatIds.includes(selectedChat.id?.toString())) ? '#00e676' : '#555' }} />
                  {(globalAiEnabled && !disabledAiChatIds.includes(selectedChat.id?.toString())) ? 'IA Ativa' : 'IA Pausada'}
                </button>
                <div className="tg-item-more" style={{ padding: '0.5rem', cursor: 'pointer' }} onClick={(e) => handleCrmMenu(e, selectedChat.id?.toString(), selectedChat.entity)}>⋮</div>
              </div>
            </div>

            {/* Container Relativo para Posição do 'Assumir Conversa' */}
            <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              
              {/* Botão Flutuante de Assumir */}
              {(globalAiEnabled && !disabledAiChatIds.includes(selectedChat.id?.toString())) && (
                <div 
                  onClick={() => {
                    if (window.confirm("Assumir esta conversa? A IA será desativada temporariamente para este contato.")) {
                      toggleChatAi(selectedChat.id?.toString());
                    }
                  }}
                  style={{ 
                    position: 'absolute', top: '16px', left: '50%', transform: 'translateX(-50%)', zIndex: 10,
                    background: 'linear-gradient(135deg, #FF6B6B 0%, #EE5253 100%)',
                    padding: '8px 18px', borderRadius: '24px', color: 'white', fontSize: '0.75rem', fontWeight: 'bold', 
                    cursor: 'pointer', boxShadow: '0 4px 15px rgba(255, 107, 107, 0.4)', display: 'flex', alignItems: 'center', gap: '8px',
                    transition: 'transform 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.transform = 'translateX(-50%) scale(1.05)'}
                  onMouseOut={(e) => e.currentTarget.style.transform = 'translateX(-50%) scale(1)'}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                  Assumir Conversa
                </div>
              )}

            <div className="tg-messages-area">
              {messages.map((msg, i) => (
                <div key={i} className={`tg-bubble ${msg.out ? 'out' : 'in'}`}>
                  <p>{msg.message}</p>
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
            
            </div> {/* Encerra o container relativo do hover */}
          </>
        ) : (
          <div className="tg-empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
            <p>Selecione uma conversa para começar no {platform === 'wa' ? 'WhatsApp' : 'Telegram'}</p>
          </div>
        )}
      </div>

      {/* 3. PAINEL CRM (RIGHT SIDEBAR) Ocultado sob demanda caso as Inline tags substituam tudo, mas mantido pra não quebrar profile configs caso existam. */}
      {/* <RightSidebar activeChat={selectedChat} /> */}

      {/* 4. MENU DE CONTEXTO */}
      {crmMenuState.visible && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1999 }} onClick={closeCrmMenu}>
          <CrmMenu x={crmMenuState.x} y={crmMenuState.y} contactId={crmMenuState.contactId} entity={crmMenuState.entity} onClose={closeCrmMenu} />
        </div>
      )}
    </div>
  );
};
