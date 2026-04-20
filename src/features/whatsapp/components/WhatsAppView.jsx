import { QRCodeCanvas } from 'qrcode.react'
import { ChannelUI } from '../../../components/chat/ChannelInterface'

export function WhatsAppView({ 
  waStatus, 
  waDialogs, 
  selectedWaChat, 
  waMessages, 
  waInput, 
  setWaInput,
  handleSendMessage,
  handleSelectChat,
  waLoading,
  waAvatarUrls,
  setActiveTab,
  setWaStatus,
  setWaDialogs,
  setSelectedWaChat,
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
  waMessagesEndRef,
  archivedIds,
  RightSidebar,
  CrmMenu,
  crmMenuState,
  closeCrmMenu,
  fetchMedia,
  waQrCode,
  waInstanceName,
  getWaQrCode,
  setWaQrCode,
  setSidebarOpen
}) {
  if (waStatus === 'connected') {
    return (
      <ChannelUI 
        platform="wa"
        dialogs={waDialogs}
        selectedChat={selectedWaChat}
        messages={waMessages}
        inputValue={waInput}
        setInputValue={setWaInput}
        onSendMessage={handleSendMessage}
        onSelectChat={handleSelectChat}
        loadingChats={waLoading}
        avatarUrls={waAvatarUrls}
        onReturn={() => setActiveTab('agente')}
        onDisconnect={() => { setWaStatus('disconnected'); setWaDialogs([]); setSelectedWaChat(null); }}
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
        messagesEndRef={waMessagesEndRef}
        archivedIds={archivedIds}
        RightSidebar={RightSidebar}
        CrmMenu={CrmMenu}
        crmMenuState={crmMenu}
        closeCrmMenu={closeCrmMenu}
        fetchMediaBase64={fetchMedia}
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
          <h2>Conectar WhatsApp</h2>
        </div>
        <span className="status-badge-disconnected">Desconectado</span>
      </div>
      <div className="integration-container">
        <div className="integration-card-main">
          <div className="integration-info">
            <div className="platform-icon whatsapp" style={{ background: 'none', border: 'none' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            </div>
            <div className="platform-text">
              <h3>WhatsApp</h3>
              <p>Escaneie o QR Code abaixo para conectar seu WhatsApp ao AllcanceAI.</p>
            </div>
          </div>
          <div className="connection-form">
            <div className="qr-container-wrapper">
              <div className="qr-box" style={{ background: '#fff', padding: '10px', borderRadius: '12px' }}>
                {waQrCode ? (
                  waQrCode.includes('base64') || waQrCode.startsWith('data:image') ? (
                    <img src={waQrCode} alt="WhatsApp QR Code" style={{ width: '180px', height: '180px', objectFit: 'contain' }} className="fade-in" />
                  ) : (
                    <QRCodeCanvas value={waQrCode} size={180} />
                  )
                ) : (
                  <div className="qr-placeholder"><div className="pro-spinner"></div><span className="loading-text-saas">Gerando QR Code...</span></div>
                )}
              </div>
              <p className="qr-hint">Use o WhatsApp no seu celular para ler o código</p>
              <button 
                onClick={() => {
                   setWaQrCode(''); 
                   getWaQrCode(waInstanceName).then(qr => { if (qr) setWaQrCode(qr); });
                }}
                className="btn-refresh-qr"
              >
                🔄 Atualizar QR Code
              </button>
            </div>
          </div>
        </div>
        <div className="integration-guide">
          <h4>Passo a Passo</h4>
          <ol>
            <li>Abra o WhatsApp no seu celular.</li>
            <li>Vá em Aparelhos Conectados.</li>
            <li>Clique em Conectar um Aparelho.</li>
            <li>Aponte a câmera para este QR Code.</li>
          </ol>
        </div>
      </div>
    </div>
  )
}
