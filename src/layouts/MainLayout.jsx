import { useAuth } from '../features/auth/AuthContext'

export function MainLayout({ 
  children, 
  activeTab, 
  setActiveTab, 
  sidebarOpen, 
  setSidebarOpen,
  tokenUsage,
  PLAN_LIMITS,
  sortedChats,
  currentChatId,
  setCurrentChatId,
  setMessages,
  setActiveSettingView
}) {
  const { logout } = useAuth()

  return (
    <div className="layout">
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header-main">
          <div className="sidebar-brand">
             <div className="brand-logo-container">
               <img src="/logo.png" alt="Logo" className="brand-logo-main" />
             </div>
             <span className="logo-text">AllcanceAI</span>
          </div>
          <button className="sidebar-collapse-btn" onClick={() => setSidebarOpen(false)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
          </button>
        </div>

        <div className="sidebar-search">
          <div className="search-wrapper">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" placeholder="Search..." />
          </div>
        </div>

        <div className="sidebar-scroll-area">
          <button className="new-chat-btn-norse" onClick={() => { setActiveTab('agente'); setCurrentChatId(null); setMessages([]); setSidebarOpen(false); }}>
            <div className="plus-icon-orange">+</div>
            <span>Novo Chat</span>
          </button>

          <div className="sidebar-section">
            <p className="section-label-norse">Atividades</p>
            <button className={`nav-link-norse ${activeTab === 'histórico' ? 'active' : ''}`} onClick={() => { setActiveTab('histórico'); setSidebarOpen(false); }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              Histórico
            </button>
            <button className={`nav-link-norse ${activeTab === 'instruções' ? 'active' : ''}`} onClick={() => { setActiveTab('instruções'); setSidebarOpen(false); }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
              Manuais Genéricos
            </button>
            <button className={`nav-link-norse ${activeTab === 'treinamento' ? 'active' : ''}`} onClick={() => { setActiveTab('treinamento'); setSidebarOpen(false); }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              Treinamento IA
            </button>
          </div>

          <div className="sidebar-divider"></div>

          <div className="sidebar-section">
            <p className="section-label-norse">Canais</p>
            <button className={`nav-link-norse ${activeTab === 'whatsapp' ? 'active' : ''}`} onClick={() => { setActiveTab('whatsapp'); setSidebarOpen(false); }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              WhatsApp
            </button>
            <button className={`nav-link-norse ${activeTab === 'telegram' ? 'active' : ''}`} onClick={() => { setActiveTab('telegram'); setSidebarOpen(false); }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
              Telegram
            </button>
          </div>

          <div className="sidebar-divider"></div>

          <div className="sidebar-section">
            <p className="section-label-norse">Recentes</p>
            <div className="recent-list-norse">
              {sortedChats.slice(0, 6).map(chat => (
                <div key={chat.id} className={`recent-item-norse ${currentChatId === chat.id ? 'active' : ''}`} onClick={() => { setCurrentChatId(chat.id); setActiveTab('agente'); setSidebarOpen(false); }}>
                  <span className="item-text-norse">{chat.title}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="sidebar-footer-norse">
          <div className="usage-tracker-mini">
            <div className="usage-progress-bar"><div className="usage-progress-fill" style={{ width: `${Math.min((tokenUsage.periodUsed / PLAN_LIMITS[tokenUsage.plan]) * 100, 100)}%` }} /></div>
          </div>
          <button className={`nav-link-norse ${activeTab === 'configurações' ? 'active' : ''}`} onClick={() => { setActiveTab('configurações'); setSidebarOpen(false); setActiveSettingView('main'); }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            Configurações
          </button>
        </div>
      </aside>
      <main className="main-content">
        <header className="mobile-header">
          <button className="mobile-menu-btn" onClick={() => setSidebarOpen(true)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <div className="mobile-brand">
             <img src="/logo.png" alt="Logo" className="app-logo-small" />
             <span className="logo-text">AllcanceAI</span>
          </div>
          <div style={{ width: 40 }} />
        </header>
        <div className="content-area">{children}</div>
      </main>
    </div>
  )
}
