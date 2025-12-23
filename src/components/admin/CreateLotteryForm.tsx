import { useState } from 'react';
import { DEFAULT_LOTTERY_RULES } from '../../utils/defaultRules';

interface CreateLotteryFormProps {
  onSubmit: (data: {
    eventDate: string;
    ticketPrice: number;
    maxTickets: number;
    lotteryName: string;
    numberRange: '1-9' | '1-99';
    rules: string;
  }) => void;
  onCancel: () => void;
}

export function CreateLotteryForm({ onSubmit, onCancel }: CreateLotteryFormProps) {
  const [numberRange, setNumberRange] = useState<'1-9' | '1-99'>('1-9');
  const [rulesDraft, setRulesDraft] = useState(DEFAULT_LOTTERY_RULES);
  const [formData, setFormData] = useState({
    eventDate: '',
    ticketPrice: 50,
    maxTickets: 1000,
    lotteryName: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      numberRange,
      rules: rulesDraft
    });
  };

  return (
    <div className="admin-panel">
      <div className="create-lottery-form">
        <h1>Yeni Çekiliş Oluştur</h1>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Çekiliş Adı</label>
            <input
              type="text"
              value={formData.lotteryName}
              onChange={(e) => setFormData({ ...formData, lotteryName: e.target.value })}
              placeholder="Örn: Yılbaşı Çekilişi 2024"
            />
            <small className="form-hint">Boş bırakılırsa otomatik isim verilir</small>
          </div>
          <div className="form-group">
            <label>Çekiliş Tarihi ve Saati</label>
            <input
              type="datetime-local"
              value={formData.eventDate}
              onChange={(e) => setFormData({ ...formData, eventDate: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Bilet Fiyatı (TL)</label>
            <input
              type="number"
              value={formData.ticketPrice}
              onChange={(e) => setFormData({ ...formData, ticketPrice: Number(e.target.value) })}
              min="1"
              required
            />
          </div>
          <div className="form-group">
            <label>Maksimum Bilet Sayısı</label>
            <input
              type="number"
              value={formData.maxTickets}
              onChange={(e) => setFormData({ ...formData, maxTickets: Number(e.target.value) })}
              min="1"
              max="10000"
              required
            />
          </div>
          <div className="form-group">
            <label>Sayı Aralığı</label>
            <select
              value={numberRange}
              onChange={(e) => setNumberRange(e.target.value as '1-9' | '1-99')}
            >
              <option value="1-9">1-9 (Tek haneli)</option>
              <option value="1-99">1-99 (İki haneli)</option>
            </select>
            <small className="form-hint">
              1-9: Her bilette 5 rakam (örn: 1,3,5,7,9)
              <br />
              1-99: Her bilette 5 rakam (örn: 12,45,67,89,3)
            </small>
          </div>
          <div className="form-group">
            <label>Çekiliş Kuralları</label>
            <textarea
              value={rulesDraft}
              onChange={(e) => setRulesDraft(e.target.value)}
              rows={8}
              placeholder="Çekiliş kurallarını buraya yazın..."
            />
          </div>
          <div className="form-actions">
            <button type="button" onClick={onCancel} className="cancel-button">
              İptal
            </button>
            <button type="submit" className="submit-button">
              Çekilişi Oluştur
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
