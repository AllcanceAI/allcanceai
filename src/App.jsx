import { useState, useEffect, useRef } from 'react'
import Auth from './Auth'
import { useCRM } from './components/crm/CRMContext'
import RightSidebar from './components/crm/RightSidebar'
import { CrmMenu } from './components/crm/CrmMenu'
import { AITraining } from './components/AITraining'
import './components/crm/crmOverlay.css'

// New Hooks
import { useAuth } from './features/auth/AuthContext'
import { useAgent } from './features/agent/hooks/useAgent'
import { useWhatsApp } from './features/whatsapp/hooks/useWhatsApp'
import { useTelegram } from './features/telegram/hooks/useTelegram'

// New Components
import { MainLayout } from './layouts/MainLayout'
import { AgentView } from './features/agent/components/AgentView'
import { WhatsAppView } from './features/whatsapp/components/WhatsAppView'
import { TelegramView } from './features/telegram/components/TelegramView'
import { HistoryView } from './features/agent/components/HistoryView'
import { SettingsView } from './features/auth/SettingsView'
import { InstructionsView } from './features/agent/components/InstructionsView'

import { getWaQrCode } from './services/whatsappService'

function App() {
  const { session, userId, loading: authLoading } = useAuth()
  
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeTab, setActiveTab ] = useState(() => localStorage.getItem('allcance_active_tab') || 'agente')
  const [activeSettingView, setActiveSettingView] = useState('main')
  
  // CRM Context
  const { 
    archivedIds, tags, contactTags, 
    globalAiEnabled, toggleGlobalAi, 
    disabledAiChatIds, toggleChatAi 
  } = useCRM();

  // Features Hooks
  const agent = useAgent(userId)
  const wa = useWhatsApp(userId, activeTab)
  const tg = useTelegram(userId, globalAiEnabled, disabledAiChatIds)

  // Shared UI State
  const [selectedFilterTag, setSelectedFilterTag] = useState('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [crmMenu, setCrmMenu] = useState({ x: 0, y: 0, visible: false, contactId: null, entity: null });
  const [menuOpenId, setMenuOpenId] = useState(null)
  
  const messagesEndRef = useRef(null)
  const waMessagesEndRef = useRef(null)
  const tgMessagesEndRef = useRef(null)

  // Tab Persistence
  useEffect(() => {
    localStorage.setItem('allcance_active_tab', activeTab);
  }, [activeTab]);

  // Click Outside for Menus
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.item-menu-dropdown') && !e.target.closest('.item-menu-trigger')) {
        setMenuOpenId(null)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  const handleCrmMenu = (e, contactId, entity) => {
    e.preventDefault();
    e.stopPropagation();
    const menuWidth = 180;
    const menuHeight = 220;
    let posX = e.pageX || e.clientX;
    let posY = e.pageY || e.clientY;

    if (posX + menuWidth > window.innerWidth) posX -= menuWidth;
    if (posY + menuHeight > window.innerHeight) posY -= menuHeight;

    posX = Math.max(10, posX);
    posY = Math.max(10, posY);

    setCrmMenu({ x: posX, y: posY, visible: true, contactId, entity });
  };

  if (authLoading) return <div className="loading-screen"><div className="pro-spinner"></div></div>
  if (!session) return <Auth />

  const sortedChats = [...agent.chats].sort((a, b) => { 
    if (a.pinned === b.pinned) return new Date(b.timestamp) - new Date(a.timestamp); 
    return a.pinned ? -1 : 1; 
  })

  const renderContent = () => {
    switch (activeTab) {
      case 'agente':
        return (
          <AgentView 
            messages={agent.messages}
            prompt={agent.prompt}
            setPrompt={agent.setPrompt}
            handleSend={agent.handleSend}
            messagesEndRef={messagesEndRef}
          />
        )
      case 'histórico':
        return (
          <HistoryView 
            sortedChats={sortedChats}
            setCurrentChatId={agent.setCurrentChatId}
            setActiveTab={setActiveTab}
            menuOpenId={menuOpenId}
            setMenuOpenId={setMenuOpenId}
            handlePinChat={agent.handlePinChat}
            handleRenameChat={agent.handleRenameChat}
            handleDeleteChat={agent.handleDeleteChat}
          />
        )
      case 'whatsapp':
        return (
          <WhatsAppView 
            {...wa}
            setActiveTab={setActiveTab}
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
            waMessagesEndRef={waMessagesEndRef}
            archivedIds={archivedIds}
            RightSidebar={RightSidebar}
            CrmMenu={CrmMenu}
            crmMenuState={crmMenu}
            closeCrmMenu={() => setCrmMenu({ ...crmMenu, visible: false })}
            getWaQrCode={getWaQrCode}
            setSidebarOpen={setSidebarOpen}
          />
        )
      case 'telegram':
        return (
          <TelegramView 
            {...tg}
            setActiveTab={setActiveTab}
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
            tgMessagesEndRef={tgMessagesEndRef}
            archivedIds={archivedIds}
            RightSidebar={RightSidebar}
            CrmMenu={CrmMenu}
            crmMenuState={crmMenu}
            closeCrmMenu={() => setCrmMenu({ ...crmMenu, visible: false })}
            setSidebarOpen={setSidebarOpen}
          />
        )
      case 'instruções': return <InstructionsView />
      case 'treinamento': return <AITraining userId={userId} />
      case 'arquivos': return <div className="tab-view"><h2>Arquivos</h2><div className="notes-container"><textarea placeholder="..." className="notepad" /></div></div>
      case 'configurações':
        return (
          <SettingsView 
            activeSettingView={activeSettingView}
            setActiveSettingView={setActiveSettingView}
            userPlan={agent.userPlan}
            handlePlanChange={agent.handlePlanChange}
          />
        )
      default: return null
    }
  }

  return (
    <MainLayout
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}
      tokenUsage={agent.tokenUsage}
      PLAN_LIMITS={agent.PLAN_LIMITS}
      sortedChats={sortedChats}
      currentChatId={agent.currentChatId}
      setCurrentChatId={agent.setCurrentChatId}
      setMessages={() => agent.setCurrentChatId(null)}
      setActiveSettingView={setActiveSettingView}
    >
      {renderContent()}
    </MainLayout>
  )
}

export default App
