import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import Dashboard from './pages/Dashboard';
import MyGroups from './pages/MyGroups';
import JoinGroup from './pages/JoinGroup';
import CreateGroup from './pages/CreateGroup';
import GroupView from './pages/GroupView';
import Settings from './pages/Settings';
import ProtectedRoute from './components/common/ProtectedRoute';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/my-groups" 
          element={
            <ProtectedRoute>
              <MyGroups />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/join-group" 
          element={
            <ProtectedRoute>
              <JoinGroup />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/create-group" 
          element={
            <ProtectedRoute>
              <CreateGroup />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/groups/:groupId" 
          element={
            <ProtectedRoute>
              <GroupView />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/settings" 
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          } 
        />
      </Routes>
    </Router>
  );
}

export default App;
