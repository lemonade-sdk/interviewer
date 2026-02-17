import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Interview from './pages/Interview';
import InterviewHistory from './pages/InterviewHistory';
import Settings from './pages/Settings';
import Landing from './pages/Landing';
import Preparing from './pages/Preparing';
import Feedback from './pages/Feedback';

function App() {
  return (
    <Routes>
      {/* Landing Page as the root */}
      <Route path="/" element={<Landing />} />

      {/* Preparing: transitional phase between Landing and Interview */}
      <Route path="/preparing" element={<Preparing />} />

      {/* Feedback: post-interview scoring and review */}
      <Route path="/feedback/:id" element={<Feedback />} />

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
