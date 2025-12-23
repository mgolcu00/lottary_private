import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { DEFAULT_LOTTERY_RULES, DEFAULT_DISCLAIMER_TEXT } from '../../utils/defaultRules';
import './DisclaimerPage.css';

export function DisclaimerPage() {
  const { user, acceptTerms } = useAuth();
  const [isOver18, setIsOver18] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!user || !isOver18 || !acceptedTerms) {
      alert('Lütfen tüm onayları işaretleyin.');
      return;
    }

    setLoading(true);
    try {
      await acceptTerms();
    } catch (error) {
      console.error('Error accepting terms:', error);
      alert('Bir hata oluştu. Lütfen tekrar deneyin.');
      setLoading(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="disclaimer-page">
      <div className="disclaimer-container">
        <div className="disclaimer-icon">🎊</div>
        <h1>Son Bir Adım!</h1>
        <p className="disclaimer-subtitle">
          Çekilişe katılmadan önce lütfen aşağıdaki bilgileri okuyun
        </p>

        <div className="disclaimer-content">
          {/* Kurallar Bölümü */}
          <div className="info-card">
            <div className="card-header" onClick={() => setShowRules(!showRules)}>
              <div>
                <span className="card-icon">📋</span>
                <span className="card-title">Çekiliş Kuralları</span>
              </div>
              <span className="toggle-icon">{showRules ? '▲' : '▼'}</span>
            </div>

            {showRules && (
              <div className="card-body">
                {DEFAULT_LOTTERY_RULES.split('\n').filter(r => r.trim()).map((rule, i) => (
                  <div key={i} className="rule-item">
                    <span className="bullet">•</span>
                    <span>{rule}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sorumluluk Reddi */}
          <div className="info-card">
            <div className="card-header">
              <div>
                <span className="card-icon">⚠️</span>
                <span className="card-title">Sorumluluk Reddi</span>
              </div>
            </div>
            <div className="card-body disclaimer-text">
              {DEFAULT_DISCLAIMER_TEXT.split('\n\n').filter(p => p.trim()).map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
          </div>

          {/* Onay Checkboxları */}
          <div className="consent-section">
            <label className="consent-checkbox">
              <input
                type="checkbox"
                checked={isOver18}
                onChange={(e) => setIsOver18(e.target.checked)}
              />
              <span className="checkbox-label">
                18 yaşından büyüğüm ve çekilişe katılmaya yasal olarak yetkiliyim
              </span>
            </label>

            <label className="consent-checkbox">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
              />
              <span className="checkbox-label">
                Kuralları ve sorumluluk reddini okudum, anladım ve kabul ediyorum
              </span>
            </label>
          </div>

          {/* Submit Button */}
          <button
            className="accept-button"
            onClick={handleSubmit}
            disabled={!isOver18 || !acceptedTerms || loading}
          >
            {loading ? 'Kaydediliyor...' : 'Kabul Et ve Başla 🎉'}
          </button>
        </div>
      </div>
    </div>
  );
}
