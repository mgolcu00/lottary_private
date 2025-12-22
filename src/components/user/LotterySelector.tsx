import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { LotterySettings } from '../../types';
import { toDateSafe } from '../../utils/date';
import './LotterySelector.css';

interface LotterySelectorProps {
  onSelect: (lottery: LotterySettings) => void;
}

export function LotterySelector({ onSelect }: LotterySelectorProps) {
  const [lotteries, setLotteries] = useState<LotterySettings[]>([]);

  useEffect(() => {
    const lotteriesQuery = query(
      collection(db, 'lotteries'),
      where('isActive', '==', true)
    );

    const unsubscribe = onSnapshot(lotteriesQuery, (snapshot) => {
      const lotteriesList = snapshot.docs.map(doc => {
        const data = doc.data() as LotterySettings;
        return {
          ...data,
          id: doc.id,
          eventDate: toDateSafe(data.eventDate),
          createdAt: toDateSafe(data.createdAt),
          updatedAt: toDateSafe(data.updatedAt),
          numberRange: data.numberRange ?? '1-9',
          salesOpen: data.salesOpen ?? true
        } as LotterySettings;
      });
      setLotteries(lotteriesList);

      // Auto-select if only one lottery
      if (lotteriesList.length === 1) {
        onSelect(lotteriesList[0]);
      }
    });

    return unsubscribe;
  }, [onSelect]);

  if (lotteries.length === 0) {
    return (
      <div className="lottery-selector-a">
        <div className="no-lottery-available">
          <div className="christmas-icon">🎄</div>
          <h2>Henüz Aktif Çekiliş Yok</h2>
          <p>Yeni bir çekiliş başladığında burada görünecek!</p>
        </div>
      </div>
    );
  }

  if (lotteries.length === 1) {
    return null; // Auto-selected, no need to show selector
  }

  return (
    <div className="lottery-selector-a">
      <div className="selector-header">
        <h1>🎊 Aktif Çekilişler</h1>
        <p>Katılmak istediğiniz çekilişi seçin</p>
      </div>

      <div className="lotteries-grid">
        {lotteries.map(lottery => (
          <div
            key={lottery.id}
            className="lottery-card"
            onClick={() => onSelect(lottery)}
          >
            <div className="lottery-card-header">
              <div className="lottery-icon">🎟️</div>
              <h3 className="lottery-title">
                {lottery.lotteryName || `Çekiliş ${new Date(lottery.eventDate).toLocaleDateString('tr-TR')}`}
              </h3>
            </div>

            <div className="lottery-card-body">
              <div className="lottery-date">
                📅 {new Date(lottery.eventDate).toLocaleDateString('tr-TR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })}
              </div>
              <div className="lottery-time">
                🕐 {new Date(lottery.eventDate).toLocaleTimeString('tr-TR', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
              <div className="lottery-info">
                <div className="info-item">
                  <span className="info-icon">💰</span>
                  <span className="info-text">{lottery.ticketPrice} TL</span>
                </div>
                <div className="info-item">
                  <span className="info-icon">🎫</span>
                  <span className="info-text">{lottery.maxTickets} bilet</span>
                </div>
              </div>
            </div>

            <button className="select-lottery-button">
              Çekilişe Katıl →
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
