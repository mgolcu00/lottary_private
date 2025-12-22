import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './Login.css';

export function CompleteSignIn() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const { confirmEmailLink } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const completeSignIn = async () => {
      const email = window.localStorage.getItem('emailForSignIn');
      if (!email) {
        setError('Email bulunamadı. Lütfen tekrar giriş yapın.');
        setLoading(false);
        return;
      }

      try {
        await confirmEmailLink(email);
        navigate('/');
      } catch (error) {
        console.error('Error completing sign in:', error);
        setError('Giriş tamamlanamadı. Lütfen tekrar deneyin.');
      }
      setLoading(false);
    };

    completeSignIn();
  }, [confirmEmailLink, navigate]);

  if (loading) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="lottery-icon">🎟️</div>
          <h1>Giriş Yapılıyor...</h1>
          <p className="subtitle">Lütfen bekleyin</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="lottery-icon">❌</div>
          <h1>Hata</h1>
          <p className="subtitle">{error}</p>
          <button
            onClick={() => navigate('/login')}
            className="email-button"
          >
            Giriş Sayfasına Dön
          </button>
        </div>
      </div>
    );
  }

  return null;
}
