import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { CRMProvider } from './components/crm/CRMContext'
import { AuthProvider } from './features/auth/AuthContext'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <CRMProvider>
        <App />
      </CRMProvider>
    </AuthProvider>
  </React.StrictMode>,
)
