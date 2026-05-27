import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import Home from './pages/Home'
import Notes from './pages/Notes'
import Record from './pages/Record'
import Review from './pages/Review'
import QA from './pages/QA'
import OCR from './pages/OCR'
import Settings from './pages/Settings'

function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <header className="navbar">
        <div className="navbar-inner">
          <div className="navbar-brand">
            <NavLink to="/" className="brand-link">
              <div className="navbar-logo">N</div>
              <span className="navbar-title">多模态智能笔记助手</span>
            </NavLink>
          </div>
          <nav>
            <NavLink to="/notes">笔记管理</NavLink>
            <NavLink to="/record">录课采集</NavLink>
            <NavLink to="/review">复习计划</NavLink>
            <NavLink to="/qa">智能问答</NavLink>
            <NavLink to="/ocr">PPT 识别</NavLink>
            <NavLink to="/settings">设置</NavLink>
          </nav>
        </div>
      </header>
      <main className="container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/notes" element={<Notes />} />
          <Route path="/record" element={<Record />} />
          <Route path="/review" element={<Review />} />
          <Route path="/qa" element={<QA />} />
          <Route path="/ocr" element={<OCR />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </BrowserRouter>
  )
}

export default App
