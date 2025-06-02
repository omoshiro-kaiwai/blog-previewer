import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './App.css';

import Preview from './pages/Preview';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Preview/>} />
        <Route path="/preview/:slug" element={<Preview />} />
        <Route path="/preview" element={<Preview />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
