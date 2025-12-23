import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { Login } from './components/auth/Login';
import { CompleteSignIn } from './components/auth/CompleteSignIn';
import { NameSetup } from './components/auth/NameSetup';
import { DisclaimerPage } from './components/auth/DisclaimerPage';
import { UserHome } from './components/user/UserHome';
import { BuyTicket } from './components/user/BuyTicket';
import { AdminPanel } from './components/admin/AdminPanel';
import { LotterySessionV2 } from './components/lottery/LotterySessionV2';
import { LoadingScreen } from './components/common/LoadingScreen';
import { ThemeToggle } from './components/common/ThemeToggle';
import './App.css';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (!user.displayName) {
    return <Navigate to="/setup-name" />;
  }

  // Kullanıcı şartları kabul etmemişse yönlendir
  if (!user.termsAccepted) {
    return <Navigate to="/disclaimer" />;
  }

  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (!user.displayName) {
    return <Navigate to="/setup-name" />;
  }

  if (!user.termsAccepted) {
    return <Navigate to="/disclaimer" />;
  }

  if (!user.isAdmin) {
    return <Navigate to="/" />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" /> : <Login />}
      />
      <Route path="/complete-signin" element={<CompleteSignIn />} />
      <Route
        path="/setup-name"
        element={
          user && !user.displayName ? <NameSetup /> : <Navigate to="/" />
        }
      />
      <Route
        path="/disclaimer"
        element={
          user && user.displayName && !user.termsAccepted ? (
            <DisclaimerPage />
          ) : (
            <Navigate to="/" />
          )
        }
      />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <UserHome />
          </PrivateRoute>
        }
      />
      <Route
        path="/buy-ticket"
        element={
          <PrivateRoute>
            <BuyTicket />
          </PrivateRoute>
        }
      />
      <Route
        path="/lottery"
        element={
          <PrivateRoute>
            <LotterySessionV2 />
          </PrivateRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminPanel />
          </AdminRoute>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <ThemeToggle />
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
