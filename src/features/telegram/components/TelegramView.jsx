import { QRCodeCanvas } from 'qrcode.react'
import { ChannelUI } from '../../../components/chat/ChannelInterface'

export function TelegramView({
  telegramStatus,
  tgDialogs,
  selectedTgChat,
  tgMessages,
  tgInput,
  setTgInput,
  handleSendMessage,
  handleSelectChat,
  tgLoadingChats,
  tgAvatarUrls,
  setActiveTab,
  setTelegramStatus,
  setTgDialogs,
  setSelectedTgChat,
  tags,
  contactTags,
  selectedFilterTag,
  setSelectedFilterTag,
  filterOpen,
  setFilterOpen,
  handleCrmMenu,
  globalAiEnabled,
  toggleGlobalAi,
  disabledAiChatIds,
  toggleChatAi,
  tgMessagesEndRef,
  archivedIds,
  RightSidebar,
  CrmMenu,
  crmMenuState,
  closeCrmMenu,
  qrCodeLink,
  setSidebarOpen
}) {
  if (telegramStatus === 'connected') {
    return (
      <ChannelUI 
        platform="tg"
        dialogs={tgDialogs}
        selectedChat={selectedTgChat}
        messages={tgMessages}
        inputValue={tgInput}
        setInputValue={setTgInput}
        onSendMessage={handleSendMessage}
        onSelectChat={handleSelectChat}
        loadingChats={tgLoadingChats}
        avatarUrls={tgAvatarUrls}
        onReturn={() => setActiveTab('agente')}
        onDisconnect={() => {
          import('../../../services/telegramService').then(m => m.clearSession());
          setTelegramStatus('disconnected'); setTgDialogs([]); setSelectedTgChat(null);
        }}
        tags={tags}
        contactTags={contactTags}
        selectedFilterTag={selectedFilterTag}
        setSelectedFilterTag={setSelectedFilterTag}
        filterOpen={filterOpen}
        setFilterOpen={setFilterOpen}
        handleCrmMenu={handleCrmMenu}
        globalAiEnabled={globalAiEnabled}
        toggleGlobalAi={toggleGlobalAi}
        disabledAiChatIds={disabledAiChatIds}
        toggleChatAi={toggleChatAi}
        messagesEndRef={tgMessagesEndRef}
        archivedIds={archivedIds}
        RightSidebar={RightSidebar}
        CrmMenu={CrmMenu}
        crmMenuState={crmMenuState}
        closeCrmMenu={closeCrmMenu}
      />
    )
  }

  return (
    <div className="tab-view">
      <div className="tab-header-flex">
        <div className="tab-title-group">
          <button className="mobile-only-burger" onClick={() => setSidebarOpen(true)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <button className="back-btn" onClick={() => setActiveTab('agente')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg> Voltar
          </button>
          <h2>Conectar Telegram</h2>
        </div>
        <span className="status-badge-disconnected">Desconectado</span>
      </div>
      <div className="integration-container">
        <div className="integration-card-main">
          <div className="integration-info">
            <div className="platform-icon telegram"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg></div>
            <div className="platform-text">
              <h3>Conta Pessoal (User API)</h3>
              <p>Conecte seu Telegram para gerenciar chats e automatizar respostas diretamente pelo AllcanceAI.</p>
            </div>
          </div>
          <div className="connection-form">
            <div className="qr-container-wrapper">
              <div className="qr-box" style={{ background: '#fff', padding: '10px', borderRadius: '12px' }}>
                {qrCodeLink ? <QRCodeCanvas value={qrCodeLink} size={180} /> : (
                  <div className="qr-placeholder"><div className="pro-spinner"></div><span className="loading-text-saas">Gerando QR Code...</span></div>
                )}
              </div>
              <p className="qr-hint">Abra o Telegram {" > "} Configurações {" > "} Dispositivos {" > "} Conectar Dispositivo</p>
            </div>
          </div>
        </div>
        <div className="integration-guide">
          <h4>Passo a Passo</h4>
          <ol>
            <li>Abra o Telegram no seu celular.</li>
            <li>Vá em Configurações &gt; Dispositivos.</li>
            <li>Clique em Conectar Dispositivo.</li>
            <li>Aponte a câmera para este QR Code.</li>
          </ol>
          <div className="guide-alert">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span>Seus dados são protegidos por criptografia de ponta a ponta.</span>
          </div>
        </div>
      </div>
    </div>
  )
}
