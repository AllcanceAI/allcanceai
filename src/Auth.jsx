import { useState } from 'react'
import { supabase } from './supabaseClient'

export default function Auth({ onLogin }) {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState(null)

  const handleAuth = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: { emailRedirectTo: window.location.origin }
        })
        if (error) throw error
        alert('E-mail de verificação enviado!')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (err) {
      setError(err.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos' : err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      })
      if (error) throw error
    } catch (err) {
      setError('Erro ao conectar com Google')
    }
  }

  return (
    <div className="auth-immersive-container">
      {/* Luzes removidas conforme solicitado */}
      
      <div className="auth-glass-card">
        <div className="auth-brand-area">
          <div className="brand-logo-container">
            <img src="/logo.png" alt="Allcance Logo" className="brand-logo-main" />
          </div>
          <h1 className="auth-title">AllcanceAI</h1>
          <p className="auth-subtitle">{isSignUp ? 'Crie sua conta agora' : 'Entre na sua conta'}</p>
        </div>

        <button className="auth-google-btn" onClick={handleGoogleLogin}>
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" />
          Continuar com Google
        </button>

        <div className="auth-divider">
          <span>ou use seu e-mail</span>
        </div>

        <form onSubmit={handleAuth} className="auth-premium-form">
          <div className="input-field-group">
            <label>E-MAIL</label>
            <div className="input-wrapper">
              <svg className="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              <input type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
          </div>
          
          <div className="input-field-group">
            <label>SENHA</label>
            <div className="input-wrapper">
              <svg className="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              <input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
          </div>

          {error && (
            <div className="auth-error-message">
               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
               {error}
            </div>
          )}

          <button className="auth-main-btn" disabled={loading}>
            {loading ? <span className="loader"></span> : (isSignUp ? 'Criar Conta' : 'Acessar Plataforma')}
          </button>
        </form>

        <div className="auth-switch-area">
          <p>
            {isSignUp ? 'Já possui acesso?' : 'Ainda não tem conta?'}
            <button onClick={() => setIsSignUp(!isSignUp)} className="auth-toggle-link">
              {isSignUp ? 'Fazer Login' : 'Cadastre-se agora'}
            </button>
          </p>
        </div>
      </div>
      <footer className="auth-page-footer">&copy; 2026 AllcanceAI.</footer>
    </div>
  )
}
