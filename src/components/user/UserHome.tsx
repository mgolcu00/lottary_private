import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Ticket as TicketType, LotterySettings, LotterySession } from '../../types';
import { Ticket } from '../common/Ticket';
import { LotterySelector } from './LotterySelector';
import { Snowflakes, ChristmasDecorations, ChristmasLights } from '../common/ChristmasEffects';
import { toDateSafe } from '../../utils/date';
import './UserHome.css';

export function UserHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedLottery, setSelectedLottery] = useState<LotterySettings | null>(null);
  const [userTickets, setUserTickets] = useState<TicketType[]>([]);
  const [userTicketsLoading, setUserTicketsLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [canBuyTickets, setCanBuyTickets] = useState(true);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [lotterySession, setLotterySession] = useState<LotterySession | null>(null);
  const [lotteryStats, setLotteryStats] = useState({
    total: 0,
    sold: 0,
    pending: 0,
    available: 0,
    percentSold: 0,
    totalValue: 0
  });

  // Listen to lottery session
  useEffect(() => {
    if (!selectedLottery) return;

    const sessionQuery = query(
      collection(db, 'lotterySessions'),
      where('lotteryId', '==', selectedLottery.id)
    );

    const unsubscribe = onSnapshot(sessionQuery, (snapshot) => {
      if (!snapshot.empty) {
        const sessionData = snapshot.docs[0].data() as LotterySession;
        setLotterySession({ ...sessionData, id: snapshot.docs[0].id });
      } else {
        setLotterySession(null);
      }
    });

    return unsubscribe;
  }, [selectedLottery]);

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
      <Snowflakes />
      <ChristmasDecorations />
      <ChristmasLights />

      <div className="user-home-content">
        {/* Main Card - Lottery Info */}
        <div className="lottery-main-card">
          <div className="card-header">
            <div className="event-info">
              <h2 className="event-name">{selectedLottery.lotteryName}</h2>
              <p className="event-date">
                {new Date(selectedLottery.eventDate).toLocaleString('tr-TR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
          </div>

          {/* Countdown */}
          <div className="countdown-section">
            <p className="countdown-label">Çekilişe Kalan Süre</p>
            <div className="countdown-display">{timeLeft || 'Yükleniyor...'}</div>
            {!canBuyTickets && timeLeft !== 'Çekiliş başladı!' && (
              <div className="countdown-warning">
                ⚠️ Bilet satışı kapandı
              </div>
            )}
          </div>

          {/* Progress Bar */}
          <div className="sales-progress">
            <div className="progress-header">
              <span className="progress-title">Satış Durumu</span>
              <span className="progress-percent">{lotteryStats.percentSold.toFixed(1)}%</span>
            </div>
            <div className="progress-bar-container">
              <div
                className="progress-bar-fill"
                style={{ width: `${Math.min(100, lotteryStats.percentSold)}%` }}
              />
            </div>
            <div className="progress-stats">
              <div className="stat-item">
                <span className="stat-label">Satılan</span>
                <span className="stat-value">{lotteryStats.sold}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Kalan</span>
                <span className="stat-value">{lotteryStats.available}</span>
              </div>
              {lotteryStats.pending > 0 && (
                <div className="stat-item">
                  <span className="stat-label">Bekleyen</span>
                  <span className="stat-value">{lotteryStats.pending}</span>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="card-actions">
            {canBuyTickets && !soldOut && (
              <button className="btn-primary" onClick={handleBuyTicket}>
                🎫 Bilet Satın Al
              </button>
            )}
            <button className="btn-secondary" onClick={handleGoToLottery}>
              📺 Canlı Yayını İzle
            </button>
            <button className="btn-rules" onClick={() => setShowRulesModal(true)}>
              📋 Kuralları Gör
            </button>
          </div>

          {soldOut && (
            <div className="sold-out-badge">
              🔥 Tüm Biletler Satıldı!
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">💰</div>
            <div className="stat-content">
              <p className="stat-label">Toplam Kasa</p>
              <p className="stat-value">{lotteryStats.totalValue.toLocaleString('tr-TR')} TL</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">📊</div>
            <div className="stat-content">
              <p className="stat-label">Mevcut Değer</p>
              <p className="stat-value">{currentValue.toLocaleString('tr-TR')} TL</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🎟️</div>
            <div className="stat-content">
              <p className="stat-label">Bilet Sayısı</p>
              <p className="stat-value">{selectedLottery.maxTickets}</p>
            </div>
          </div>
        </div>

        {/* User Tickets Section */}
        <div className="my-tickets-section">
          <div className="section-title-row">
            <div>
              <p className="section-eyebrow">Biletlerim</p>
              <h2 className="section-title">Sahip Olduğun Biletler</h2>
            </div>
            {canBuyTickets && !soldOut && userTickets.length > 0 && (
              <button onClick={handleBuyTicket} className="btn-add">
                + Bilet Ekle
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
            <div className="empty-state">
              <div className="empty-icon">🎫</div>
              <h3 className="empty-title">Henüz Biletiniz Yok</h3>
              <p className="empty-text">
                Çekilişe katılmak için bilet satın alın ve şansınızı deneyin!
              </p>
              {canBuyTickets && !soldOut && (
                <button onClick={handleBuyTicket} className="btn-primary-large">
                  İlk Biletini Al
                </button>
              )}
            </div>
          ) : (
            <div className="tickets-grid">
              {userTickets.map(ticket => (
                <Ticket key={ticket.id} ticket={ticket} showStatus={true} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Rules Modal */}
      {showRulesModal && (
        <div className="modal-overlay" onClick={() => setShowRulesModal(false)}>
          <div className="modal-content rules-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Çekiliş Kuralları</h2>
              <button className="modal-close" onClick={() => setShowRulesModal(false)}>×</button>
            </div>
            <div className="modal-body">
              {selectedLottery.rules ? (
                <div className="rules-content">
                  {selectedLottery.rules.split('\n').map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>
              ) : (
                <p className="no-rules">Kurallar henüz tanımlanmamış.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Live/Results Banner */}
      {lotterySession && lotterySession.status === 'completed' && (
        <div className="live-banner">
          <button onClick={handleGoToLottery} className="results-banner-btn">
            🏆 SONUÇLAR AÇIKLANDI - GÖRÜNTÜLE
          </button>
        </div>
      )}
      {lotterySession && lotterySession.status === 'active' && (
        <div className="live-banner">
          <button onClick={handleGoToLottery} className="live-banner-btn">
            🔴 CANLI YAYIN - ŞİMDİ İZLE
          </button>
        </div>
      )}
    </div>
  );
}
