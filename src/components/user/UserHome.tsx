import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Ticket as TicketType, LotterySettings } from '../../types';
import { Ticket } from '../common/Ticket';
import { LotterySelector } from './LotterySelector';
import { toDateSafe } from '../../utils/date';
import './UserHome.css';

export function UserHome() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [selectedLottery, setSelectedLottery] = useState<LotterySettings | null>(null);
  const [userTickets, setUserTickets] = useState<TicketType[]>([]);
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [canBuyTickets, setCanBuyTickets] = useState(true);

  useEffect(() => {
    if (!selectedLottery || !user) return;

    // Kullanıcının biletlerini dinle
    const ticketsQuery = query(
      collection(db, 'tickets'),
      where('lotteryId', '==', selectedLottery.id),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(ticketsQuery, (snapshot) => {
      const tickets = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        requestedAt: doc.data().requestedAt ? toDateSafe(doc.data().requestedAt) : undefined,
        confirmedAt: doc.data().confirmedAt ? toDateSafe(doc.data().confirmedAt) : undefined
      } as TicketType));
      setUserTickets(tickets);
    });

    return unsubscribe;
  }, [selectedLottery, user]);

  useEffect(() => {
    if (!selectedLottery) return;

    const timer = setInterval(() => {
      const now = new Date().getTime();
      const eventTime = new Date(selectedLottery.eventDate).getTime();
      const distance = eventTime - now;

      if (distance < 0) {
        setTimeLeft('Çekiliş başladı!');
        setCanBuyTickets(false);
        clearInterval(timer);
        return;
      }

      // 5 dakika kala bilet almayı kapat
      if (distance < 5 * 60 * 1000) {
        setCanBuyTickets(false);
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      setTimeLeft(`${days}g ${hours}s ${minutes}d ${seconds}sn`);
    }, 1000);

    return () => clearInterval(timer);
  }, [selectedLottery]);

  const handleBuyTicket = () => {
    navigate(`/buy-ticket?lotteryId=${selectedLottery?.id}`);
  };

  const handleGoToLottery = () => {
    navigate(`/lottery?lotteryId=${selectedLottery?.id}`);
  };

  const handleBackToSelector = () => {
    setSelectedLottery(null);
  };

  if (!selectedLottery) {
    return <LotterySelector onSelect={setSelectedLottery} />;
  }

  return (
    <div className="user-home">
      <header className="user-header">
        <div className="user-info">
          <h2>Merhaba, {user?.displayName}! 👋</h2>
        </div>
        <div className="header-actions">
          <button onClick={handleBackToSelector} className="back-button">
            ← Çekilişler
          </button>
          <button onClick={signOut} className="logout-button">
            Çıkış Yap
          </button>
        </div>
      </header>

      <div className="countdown-section">
        <div className="countdown-card">
          <div className="countdown-icon">🎊</div>
          <h1>{selectedLottery.lotteryName || 'Yılbaşı Çekilişi'}</h1>
          <div className="countdown-timer">
            {timeLeft}
          </div>
          <p className="countdown-info">
            Çekilişe kalan süre
          </p>
          {!canBuyTickets && (
            <div className="warning-message">
              ⚠️ Bilet alma süresi doldu
            </div>
          )}
        </div>
      </div>

      <div className="tickets-section">
        <div className="section-header">
          <h2>Biletlerim</h2>
          {canBuyTickets && userTickets.length === 0 && (
            <button onClick={handleBuyTicket} className="buy-button">
              + Bilet Al
            </button>
          )}
          {canBuyTickets && userTickets.length > 0 && (
            <button onClick={handleBuyTicket} className="buy-button">
              + Daha Fazla Bilet Al
            </button>
          )}
        </div>

        {userTickets.length === 0 ? (
          <div className="empty-tickets">
            <div className="empty-icon">🎫</div>
            <p>Henüz biletiniz yok</p>
            {canBuyTickets && (
              <button onClick={handleBuyTicket} className="buy-button-large">
                İlk Biletini Al
              </button>
            )}
          </div>
        ) : (
          <div className="tickets-grid">
            {userTickets.map(ticket => (
              <Ticket key={ticket.id} ticket={ticket} />
            ))}
          </div>
        )}
      </div>

      {timeLeft === 'Çekiliş başladı!' && (
        <div className="lottery-live-banner">
          <button onClick={handleGoToLottery} className="join-lottery-button">
            🎉 Canlı Çekilişe Katıl
          </button>
        </div>
      )}
    </div>
  );
}
