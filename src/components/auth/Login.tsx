import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import './Login.css';

// Snowflakes for Christmas theme
const Snowflakes = () => {
  const [snowflakes] = useState(() =>
    Array.from({ length: 20 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      animationDuration: `${Math.random() * 3 + 5}s`,
      animationDelay: `${Math.random() * 5}s`,
      fontSize: `${Math.random() * 10 + 15}px`
    }))
  );

  return (
    <>
      {snowflakes.map((flake) => (
        <div
          key={flake.id}
          className="snowflake"
          style={{
            left: flake.left,
            animationDuration: flake.animationDuration,
            animationDelay: flake.animationDelay,
            fontSize: flake.fontSize
          }}
        >
          ❄
        </div>
      ))}
    </>
  );
};

export function Login() {
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'username' | 'email'>('username');
  const { signInWithGoogle, sendEmailLink, signUpWithUsername, signInWithUsername } = useAuth();

  const handleUsernameAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;

    setLoading(true);
    try {
      // Try to sign in first
      try {
        await signInWithUsername(username, password);
      } catch (signInError) {
        // If user not found, try to sign up
        if (signInError instanceof Error && signInError.message === 'Kullanıcı bulunamadı') {
          await signUpWithUsername(username, password);
        } else {
          throw signInError;
        }
      }
    } catch (error: unknown) {
      console.error('Error with username auth:', error);
      const errorMessage = error instanceof Error ? error.message : 'Bir hata oluştu';
      alert(errorMessage);
      setLoading(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    try {
      await sendEmailLink(email);
      setEmailSent(true);
    } catch (error) {
      console.error('Error sending email link:', error);
      alert('Email gönderilemedi. Lütfen tekrar deneyin.');
    }
    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Error signing in with Google:', error);
      alert('Google ile giriş yapılamadı. Lütfen tekrar deneyin.');
    }
    setLoading(false);
  };

  if (emailSent) {
    return (
      <div className="login-container">
        <Snowflakes />
        <div className="login-card">
          <div className="lottery-icon">📧</div>
          <h1>Email Gönderildi!</h1>
          <p className="success-message">
            <strong>{email}</strong> adresine giriş linki gönderdik.
            <br />
            Email'inizdeki linke tıklayarak giriş yapabilirsiniz.
          </p>
          <button
            onClick={() => setEmailSent(false)}
            className="secondary-button"
          >
            Farklı Email Dene
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <Snowflakes />
      <div className="login-card">
        <div className="lottery-icon">🎄</div>
        <h1>Yılbaşı Çekilişi</h1>
        <p className="subtitle">Giriş yaparak çekilişe katılabilirsiniz</p>

        {/* Google Sign In */}
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="google-button"
        >
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
            <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707 0-.593.102-1.17.282-1.709V4.958H.957C.347 6.173 0 7.548 0 9c0 1.452.348 2.827.957 4.042l3.007-2.335z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
          </svg>
          Google ile Giriş Yap
        </button>

        {/* Email Sign In */}
        <button
          onClick={() => setAuthMode('email')}
          disabled={loading}
          className="email-method-button"
        >
          📧 Email ile Giriş Yap
        </button>

        {/* Email Form (if selected) */}
        {authMode === 'email' && (
          <form onSubmit={handleEmailSignIn} style={{ marginTop: '16px' }}>
            <input
              type="email"
              placeholder="Email adresiniz"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="email-input"
              autoFocus
            />
            <button
              type="submit"
              disabled={loading}
              className="email-button"
            >
              {loading ? 'Gönderiliyor...' : 'Giriş Linki Gönder'}
            </button>
            <button
              type="button"
              onClick={() => setAuthMode('username')}
              className="back-button"
              style={{ marginTop: '8px' }}
            >
              Geri
            </button>
          </form>
        )}

        {authMode !== 'email' && (
          <>
            <div className="divider">
              <span>veya</span>
            </div>

            {/* Username/Password Form */}
            <form onSubmit={handleUsernameAuth}>
              <input
                type="text"
                placeholder="Kullanıcı adı"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="email-input"
                autoComplete="username"
              />
              <input
                type="password"
                placeholder="Şifre"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="email-input"
                autoComplete="current-password"
              />
              <button
                type="submit"
                disabled={loading}
                className="email-button"
              >
                {loading ? 'Yükleniyor...' : 'Giriş Yap / Kayıt Ol'}
              </button>
            </form>

            <p className="info-text">
              İlk kez kullanıyorsanız otomatik kayıt olacaksınız
            </p>
          </>
        )}
      </div>
    </div>
  );
}
