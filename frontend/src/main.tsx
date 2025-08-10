import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css' // Often used for global styles, can be combined with App.css

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
