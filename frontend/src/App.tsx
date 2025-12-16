import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import '@/index.css';

function App() {
  return (
    <Router>
      <div className="app-container">
        <Routes>
          <Route path="/" element={<h1>Sistema de Notas - Home</h1>} />
          {/* Define more routes here */}
        </Routes>
      </div>
    </Router>
  );
}

export default App;
