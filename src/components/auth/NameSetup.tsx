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

export function NameSetup() {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const { updateDisplayName } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      alert('İsminiz en az 2 karakter olmalıdır');
      return;
    }

    setLoading(true);
    try {
      await updateDisplayName(trimmedName);
    } catch (error) {
      console.error('Error updating name:', error);
      alert('İsim güncellenemedi. Lütfen tekrar deneyin.');
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <Snowflakes />
      <div className="login-card">
        <div className="lottery-icon">✨</div>
        <h1>Son Bir Şey!</h1>
        <p className="subtitle">
          Çekilişte görünmesini istediğiniz ismi seçin
        </p>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Takma ad veya görünen isim"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
            maxLength={30}
            className="email-input"
            autoFocus
          />
          <p className="info-text" style={{ fontSize: '13px', marginTop: '8px', marginBottom: '16px', color: '#888' }}>
            💡 İsterseniz gerçek adınız, isterseniz takma ad kullanabilirsiniz
          </p>
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="email-button"
          >
            {loading ? 'Kaydediliyor...' : 'Hadi Başlayalım! 🎊'}
          </button>
        </form>
      </div>
    </div>
  );
}
