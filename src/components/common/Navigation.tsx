import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import logoImage from '../../assets/raw_logo.png';
import './Navigation.css';

interface NavigationProps {
  showBack?: boolean;
  backTo?: string;
  showHome?: boolean;
  showRules?: boolean;
  onShowRules?: () => void;
}

export function Navigation({
  showBack = false,
  backTo = '/',
  showHome = false,
  showRules = false,
  onShowRules
}: NavigationProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const isHome = location.pathname === '/';

  const handleBackOrHome = () => {
    if (showBack) {
      navigate(backTo);
    } else if (showHome) {
      navigate('/');
    }
  };

  return (
    <nav className="app-navigation">
      <div className="nav-left">
        {(showBack || showHome) && !isHome && (
          <button onClick={handleBackOrHome} className="nav-icon-btn" title={showBack ? 'Geri' : 'Anasayfa'}>
            {showBack ? '←' : '🏠'}
          </button>
        )}
        {showRules && onShowRules && (
          <button onClick={onShowRules} className="nav-rules-btn">
            📋 Kurallar
          </button>
        )}
      </div>

      <div className="nav-center">
        <div className="nav-logo-container" onClick={() => navigate('/')}>
          <img src={logoImage} alt="Dijital Piyango" className="nav-logo-img" />
          <span className="nav-logo-title">Dijital Piyango</span>
        </div>
      </div>

      <div className="nav-right">
        {user && (
          <>
            <span className="nav-user-name">{user.displayName}</span>
            <button onClick={signOut} className="nav-logout-btn">
              Çıkış
            </button>
          </>
        )}
      </div>
    </nav>
  );
}
