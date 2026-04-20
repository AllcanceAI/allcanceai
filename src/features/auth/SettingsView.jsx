import { useAuth } from '../auth/AuthContext'

export function SettingsView({ 
  activeSettingView, 
  setActiveSettingView, 
  userPlan, 
  handlePlanChange 
}) {
  const { logout } = useAuth()

  if (activeSettingView === 'token_plan') {
    return (
      <div className="tab-view config-detail">
        <button className="back-btn" onClick={() => setActiveSettingView('main')}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg> Configurações</button>
        <div className="detail-header"><h2>Cota de Tokens</h2><p>Personalize seu limite mensal.</p></div>
        <div className="plan-selection-grid">
          {[{ id: 'daily', title: 'Modo Diário', desc: 'Disciplina diária.', cota: '~16.6k/dia', icon: '⏱️' }, { id: 'weekly', title: 'Modo Semanal', desc: 'Flexibilidade.', cota: '~125k/semana', icon: '📅' }, { id: 'monthly', title: 'Modo Mensal', desc: 'Liberdade total.', cota: '500k/mês', icon: '🚀' }].map(p => (
            <div key={p.id} className={`plan-card-premium ${userPlan === p.id ? 'active' : ''}`} onClick={() => handlePlanChange(p.id)}>
              <div className="plan-icon">{p.icon}</div>
              <div className="plan-info"><h3>{p.title}</h3><p>{p.desc}</p><span className="plan-badge">{p.cota}</span></div>
              {userPlan === p.id && <div className="check-mark">✓</div>}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="tab-view">
      <h2>Configurações</h2>
      <div className="settings-grid">
        <div className="setting-main-card" onClick={() => setActiveSettingView('token_plan')}>
          <div className="card-icon-container"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg></div>
          <div className="card-text"><h3>Plano de Tokens</h3><p>Atualmente: <strong>{userPlan === 'daily' ? 'Diário' : userPlan === 'weekly' ? 'Semanal' : 'Mensal'}</strong></p></div>
          <div className="card-arrow"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg></div>
        </div>
        <div className="setting-main-card" onClick={logout} style={{ border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          <div className="card-icon-container" style={{ color: '#ef4444' }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></div>
          <div className="card-text"><h3>Sair da Conta</h3><p>Encerrar sessão atual</p></div>
        </div>
      </div>
    </div>
  )
}
