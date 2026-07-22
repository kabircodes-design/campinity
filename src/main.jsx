import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { PostsProvider } from './hooks/usePosts.jsx'
import './index.css'
import './theme.css'

try {
  if (window.localStorage.getItem('campinity:theme') === 'dark') {
    document.documentElement.classList.add('dark')
  }
} catch {
  // Storage unavailable — defaults to light theme for this load.
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <PostsProvider>
        <App />
      </PostsProvider>
    </BrowserRouter>
  </React.StrictMode>
)