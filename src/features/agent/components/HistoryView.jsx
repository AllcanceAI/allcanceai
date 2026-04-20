export function HistoryView({ sortedChats, setCurrentChatId, setActiveTab, setMenuOpenId, menuOpenId, handlePinChat, handleRenameChat, handleDeleteChat }) {
  const renderChatMenu = (id, pinned) => (
    menuOpenId === id && (
      <div className="item-menu-dropdown">
        <button onClick={(e) => { e.stopPropagation(); handlePinChat(id); }}>{pinned ? 'Desafixar' : 'Fixar'}</button>
        <button onClick={(e) => { e.stopPropagation(); const newName = window.prompt('Renomear conversa:'); handleRenameChat(id, newName); }}>Renomear</button>
        <button onClick={(e) => { e.stopPropagation(); if (window.confirm('Excluir?')) handleDeleteChat(id); }} className="danger">Excluir</button>
      </div>
    )
  )

  return (
    <div className="tab-view">
      <h2>Histórico de Conversas</h2>
      <div className="list-content">
        {sortedChats.length === 0 ? <p style={{ color: '#666' }}>Nenhuma conversa.</p> : sortedChats.map(chat => (
          <div key={chat.id} className="list-card chat-history-card-unified">
            <div className="card-main" onClick={() => { setCurrentChatId(chat.id); setActiveTab('agente'); }}>
              <p><strong>{chat.title} {chat.pinned && <svg className="discreet-pin" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.5, marginLeft: '6px' }}><path d="M16 9V4l1 0c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1l1 0v5c0 1.66-1.34 3-3 3h0v2h5.97v7l1 1 1-1v-7H19v-2h0c-1.66 0-3-1.34-3-3z"/></svg>}</strong></p>
              <span>{new Date(chat.timestamp).toLocaleString()}</span>
            </div>
            <div className="card-actions-unified">
              <div className="item-menu-trigger" onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === chat.id ? null : chat.id); }}>⋮</div>
              {renderChatMenu(chat.id, chat.pinned)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
