import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { DEFAULT_LOTTERY_RULES, DEFAULT_DISCLAIMER_TEXT } from '../../utils/defaultRules';
import './DisclaimerPage.css';

export function DisclaimerPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
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
      await updateDoc(doc(db, 'users', user.uid), {
        termsAccepted: true,
        termsAcceptedAt: new Date(),
        isOver18: true
      });

      navigate('/', { replace: true });
    } catch (error) {
      console.error('Error updating user:', error);
      alert('Bir hata oluştu. Lütfen tekrar deneyin.');
    }
    setLoading(false);
  };

  if (!user) {
    return null;
  }

  return (
    <div className="disclaimer-page">
      <div className="disclaimer-container">
        <div className="disclaimer-header">
          <h1>Hoş Geldiniz!</h1>
          <p className="disclaimer-subtitle">
            Devam etmeden önce lütfen aşağıdaki bilgileri okuyun ve onaylayın.
          </p>
        </div>

        <div className="disclaimer-content">
          {/* Kurallar */}
          <div className="rules-section">
            <h2>📋 Çekiliş Kuralları</h2>
            <button
              className="toggle-rules-btn"
              onClick={() => setShowRules(!showRules)}
            >
              {showRules ? 'Gizle' : 'Kuralları Göster'}
            </button>

            {showRules && (
              <div className="rules-box">
                {DEFAULT_LOTTERY_RULES.split('\n').map((rule, i) => (
                  <div key={i} className="rule-item">• {rule}</div>
                ))}
              </div>
            )}
          </div>

          {/* Sorumluluk Reddi */}
          <div className="disclaimer-section">
            <h2>⚠️ Sorumluluk Reddi</h2>
            <div className="disclaimer-box">
              {DEFAULT_DISCLAIMER_TEXT.split('\n\n').map((paragraph, i) => (
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
              <span>
                18 yaşından büyüğüm ve çekilişe katılmaya yasal olarak yetkiliyim.
              </span>
            </label>

            <label className="consent-checkbox">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
              />
              <span>
                Yukarıdaki kuralları ve sorumluluk reddini okudum, anladım ve kabul ediyorum.
              </span>
            </label>
          </div>

          {/* Submit Button */}
          <div className="disclaimer-actions">
            <button
              className="accept-button"
              onClick={handleSubmit}
              disabled={!isOver18 || !acceptedTerms || loading}
            >
              {loading ? 'Kaydediliyor...' : 'Kabul Et ve Devam Et'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
