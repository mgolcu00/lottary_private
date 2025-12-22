import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import './Login.css';

export function NameSetup() {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const { updateDisplayName } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      await updateDisplayName(name.trim());
    } catch (error) {
      console.error('Error updating name:', error);
      alert('İsim güncellenemedi. Lütfen tekrar deneyin.');
    }
    setLoading(false);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="lottery-icon">👤</div>
        <h1>Hoş Geldiniz!</h1>
        <p className="subtitle">Lütfen adınızı girin</p>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Adınız Soyadınız"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="email-input"
            autoFocus
          />
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="email-button"
          >
            Devam Et
          </button>
        </form>
      </div>
    </div>
  );
}
