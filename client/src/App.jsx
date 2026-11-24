import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import CheckThisArea from './pages/CheckThisArea'
import AdminDashboard from './pages/AdminDashboard'

function App() {
  return (
    <Router>
      <div className="w-full h-screen flex flex-col font-sans bg-paper text-ink">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/check" element={<CheckThisArea />} />
          <Route path="/admin" element={<AdminDashboard />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
