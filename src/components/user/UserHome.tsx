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
  const [userTicketsLoading, setUserTicketsLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [canBuyTickets, setCanBuyTickets] = useState(true);
  const [lotteryStats, setLotteryStats] = useState({
    total: 0,
    sold: 0,
    pending: 0,
    available: 0,
    percentSold: 0,
    totalValue: 0
  });

  useEffect(() => {
    if (!selectedLottery || !user) return;
    setUserTicketsLoading(true);

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
      setUserTicketsLoading(false);
    });

    return unsubscribe;
  }, [selectedLottery, user]);

  useEffect(() => {
    if (!selectedLottery) return;
    setStatsLoading(true);

    const ticketsQuery = query(
      collection(db, 'tickets'),
      where('lotteryId', '==', selectedLottery.id)
    );

    const unsubscribe = onSnapshot(ticketsQuery, (snapshot) => {
      const tickets = snapshot.docs.map(doc => doc.data() as TicketType);
      const total = snapshot.size;
      const sold = tickets.filter(t => t.status === 'confirmed').length;
      const pending = tickets.filter(t => t.status === 'requested').length;
      const available = tickets.filter(t => t.status === 'available').length;
      const percentSold = selectedLottery.maxTickets
        ? Math.min(100, ((sold / selectedLottery.maxTickets) * 100))
        : 0;
      const totalValue = (selectedLottery.ticketPrice || 0) * (selectedLottery.maxTickets || 0);

      setLotteryStats({
        total,
        sold,
        pending,
        available,
        percentSold,
        totalValue
      });
      setStatsLoading(false);
    });

    return unsubscribe;
  }, [selectedLottery]);

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

  const soldOut = lotteryStats.available === 0 && lotteryStats.total > 0;
  const currentValue = lotteryStats.sold * (selectedLottery.ticketPrice || 0);

  return (
    <div className="user-home">
      <header className="user-header">
        <div className="user-info">
          <p className="eyebrow">Çekiliş Kontrol Merkezi</p>
          <h2>Merhaba, {user?.displayName}! 👋</h2>
          <p className="subline">{selectedLottery.lotteryName}</p>
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

      <section className="hero-grid">
        <div className="hero-card glass">
          <div className="hero-top">
            <div>
              <h1 className="hero-title">{selectedLottery.lotteryName || 'Çekiliş'}</h1>
              <p className="hero-date">
                {new Date(selectedLottery.eventDate).toLocaleString('tr-TR')}
              </p>
            </div>
            <div className="time-block">
              <span className="time-label">Çekilişe Kalan</span>
              <div className="countdown-timer">{timeLeft || '—'}</div>
              {!canBuyTickets && (
                <div className="warning-message">⚠️ Bilet alma süresi doldu</div>
              )}
            </div>
          </div>

          <div className="progress-wrap">
            <div className="progress-head">
              <span>Satış İlerlemesi</span>
              <strong>%{lotteryStats.percentSold.toFixed(1)}</strong>
            </div>
            <div className="progress-track">
              <div
                className="progress-bar"
                style={{ width: `${Math.min(100, lotteryStats.percentSold)}%` }}
              />
            </div>
            {statsLoading ? (
              <div className="progress-value-loader">
                <div className="skeleton skeleton-line" />
                <div className="skeleton skeleton-line" />
              </div>
            ) : (
              <div className="value-rows">
                <div className="value-row">
                  <span>Anlık Değer</span>
                  <strong>{currentValue.toLocaleString('tr-TR')} TL</strong>
                </div>
                <div className="value-row">
                  <span>Hedef Değer</span>
                  <strong>{lotteryStats.totalValue.toLocaleString('tr-TR')} TL</strong>
                </div>
              </div>
            )}
            <div className="progress-meta">
              <span>Satılan: {lotteryStats.sold}</span>
              <span>Kalan: {lotteryStats.available}</span>
              {lotteryStats.pending > 0 && <span>Talep: {lotteryStats.pending}</span>}
            </div>
            {soldOut && <div className="sold-out-pill">Tüm biletler satıldı</div>}
          </div>

          <div className="hero-actions">
            {canBuyTickets && !soldOut && (
              <button className="primary-cta" onClick={handleBuyTicket}>
                🎫 Bilet Al
              </button>
            )}
            <button className="ghost-cta" onClick={handleGoToLottery}>
              🎉 Canlı Çekiliş
            </button>
          </div>
        </div>

        <div className="stats-card">
          {statsLoading ? (
            <div className="stat-skeleton-grid">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton stat-skeleton" />
              ))}
            </div>
          ) : (
            <div className="metrics-grid">
              <div className="metric-card">
                <span className="metric-label">Satılan</span>
                <div className="metric-value">{lotteryStats.sold}</div>
              </div>
              <div className="metric-card">
                <span className="metric-label">Kalan</span>
                <div className="metric-value">{lotteryStats.available}</div>
              </div>
              <div className="metric-card">
                <span className="metric-label">Talep</span>
                <div className="metric-value">{lotteryStats.pending}</div>
              </div>
              <div className="metric-card">
                <span className="metric-label">Toplam Bilet</span>
                <div className="metric-value">{selectedLottery.maxTickets}</div>
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="tickets-section">
        <div className="section-header">
          <div>
            <p className="eyebrow">Biletlerin</p>
            <h2>Biletlerim</h2>
          </div>
          {canBuyTickets && !soldOut && (
            <button onClick={handleBuyTicket} className="buy-button">
              {userTickets.length === 0 ? '+ Bilet Al' : '+ Daha Fazla Bilet Al'}
            </button>
          )}
        </div>

        {userTicketsLoading ? (
          <div className="tickets-grid">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton ticket-skeleton" />
            ))}
          </div>
        ) : userTickets.length === 0 ? (
          <div className="empty-tickets">
            <div className="empty-icon">🎫</div>
            <p>Henüz biletiniz yok</p>
            {canBuyTickets && !soldOut && (
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
