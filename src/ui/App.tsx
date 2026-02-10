import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Interview from './pages/Interview';
import InterviewHistory from './pages/InterviewHistory';
import Settings from './pages/Settings';
import Landing from './pages/Landing';
import Preparing from './pages/Preparing';

function App() {
  return (
    <Routes>
      {/* Landing Page as the root */}
      <Route path="/" element={<Landing />} />

      {/* Preparing: transitional phase between Landing and Interview */}
      <Route path="/preparing" element={<Preparing />} />

      {/* Main App Routes wrapped in Layout */}
      <Route element={<Layout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/interview/:id" element={<Interview />} />
        <Route path="/interview-history" element={<InterviewHistory />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

export default App;
