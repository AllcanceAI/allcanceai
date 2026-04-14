import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { CRMProvider } from './components/crm/CRMContext'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <CRMProvider>
      <App />
    </CRMProvider>
  </React.StrictMode>,
)
