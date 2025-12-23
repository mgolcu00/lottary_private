import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Ticket as TicketType, LotterySettings, LotterySession } from '../../types';
import { Ticket } from '../common/Ticket';
import { LotterySelector } from './LotterySelector';
import { Snowflakes, ChristmasDecorations, ChristmasLights } from '../common/ChristmasEffects';
import { RulesModal } from '../common/RulesModal';
import { Card, CardHeader, CardBody } from '../common/Card';
import { Button } from '../common/Button';
import { toDateSafe } from '../../utils/date';
import './UserHome.css';

export function UserHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedLottery, setSelectedLottery] = useState<LotterySettings | null>(null);
  const [userTickets, setUserTickets] = useState<TicketType[]>([]);
  const [userTicketsLoading, setUserTicketsLoading] = useState(true);
  const [_statsLoading, setStatsLoading] = useState(true);
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

  // Fixed: Use stable dependencies to prevent multiple interval creation
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
  }, [selectedLottery?.id, selectedLottery?.eventDate]);

  const handleBuyTicket = () => {
    navigate(`/buy-ticket?lotteryId=${selectedLottery?.id}`);
  };

  const handleGoToLottery = () => {
    navigate(`/lottery?lotteryId=${selectedLottery?.id}`);
  };

  if (!selectedLottery) {
    return <LotterySelector onSelect={setSelectedLottery} />;
  }

  // Fixed: Properly check if all tickets are allocated (sold + requested)
  const soldOut = lotteryStats.available === 0 && lotteryStats.total === selectedLottery.maxTickets;
  const currentValue = lotteryStats.sold * (selectedLottery.ticketPrice || 0);

  return (
    <div className="userhome">
      <Snowflakes />
      <ChristmasDecorations />
      <ChristmasLights />

      <div className="userhome__content">
        {/* Main Card - Lottery Info */}
        <Card className="userhome__lottery-card" padding="lg">
          <CardHeader className="userhome__card-header">
            <div className="userhome__event-info">
              <h2 className="userhome__event-name">{selectedLottery.lotteryName}</h2>
              <p className="userhome__event-date">
                {new Date(selectedLottery.eventDate).toLocaleString('tr-TR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
          </CardHeader>

          <CardBody>
            {/* Countdown */}
            <div className="userhome__countdown">
              <p className="userhome__countdown-label">Çekilişe Kalan Süre</p>
              <div className="userhome__countdown-display">{timeLeft || 'Yükleniyor...'}</div>
              {!canBuyTickets && timeLeft !== 'Çekiliş başladı!' && (
                <div className="userhome__countdown-warning">
                  ⚠️ Bilet satışı kapandı
                </div>
              )}
            </div>

            {/* Progress Bar */}
            <div className="userhome__progress">
              <div className="userhome__progress-header">
                <span className="userhome__progress-title">Satış Durumu</span>
                <span className="userhome__progress-percent">{lotteryStats.percentSold.toFixed(1)}%</span>
              </div>
              <div className="userhome__progress-bar-container">
                <div
                  className="userhome__progress-bar-fill"
                  style={{ width: `${Math.min(100, lotteryStats.percentSold)}%` }}
                />
              </div>
              <div className="userhome__progress-stats">
                <div className="userhome__stat-item">
                  <span className="userhome__stat-label">Satılan</span>
                  <span className="userhome__stat-value">{lotteryStats.sold}</span>
                </div>
                <div className="userhome__stat-item">
                  <span className="userhome__stat-label">Kalan</span>
                  <span className="userhome__stat-value">{lotteryStats.available}</span>
                </div>
                {lotteryStats.pending > 0 && (
                  <div className="userhome__stat-item">
                    <span className="userhome__stat-label">Bekleyen</span>
                    <span className="userhome__stat-value">{lotteryStats.pending}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="userhome__actions">
              {canBuyTickets && !soldOut && (
                <Button variant="primary" size="lg" fullWidth onClick={handleBuyTicket} icon="🎫">
                  Bilet Satın Al
                </Button>
              )}
              <Button variant="secondary" size="md" fullWidth onClick={handleGoToLottery} icon="📺">
                Canlı Yayını İzle
              </Button>
              <Button variant="outline" size="md" fullWidth onClick={() => setShowRulesModal(true)} icon="📋">
                Kuralları Gör
              </Button>
            </div>

            {soldOut && (
              <div className="userhome__sold-out">
                🔥 Tüm Biletler Satıldı!
              </div>
            )}
          </CardBody>
        </Card>

        {/* Stats Grid */}
        <div className="userhome__stats-grid">
          <Card className="userhome__stat-card" hover padding="md">
            <div className="userhome__stat-icon">💰</div>
            <div className="userhome__stat-content">
              <p className="userhome__stat-label">Toplam Kasa</p>
              <p className="userhome__stat-value">{lotteryStats.totalValue.toLocaleString('tr-TR')} TL</p>
            </div>
          </Card>
          <Card className="userhome__stat-card" hover padding="md">
            <div className="userhome__stat-icon">📊</div>
            <div className="userhome__stat-content">
              <p className="userhome__stat-label">Mevcut Değer</p>
              <p className="userhome__stat-value">{currentValue.toLocaleString('tr-TR')} TL</p>
            </div>
          </Card>
          <Card className="userhome__stat-card" hover padding="md">
            <div className="userhome__stat-icon">🎟️</div>
            <div className="userhome__stat-content">
              <p className="userhome__stat-label">Bilet Sayısı</p>
              <p className="userhome__stat-value">{selectedLottery.maxTickets}</p>
            </div>
          </Card>
        </div>

        {/* User Tickets Section */}
        <div className="userhome__tickets-section">
          <div className="userhome__section-title-row">
            <div>
              <p className="userhome__section-eyebrow">Biletlerim</p>
              <h2 className="userhome__section-title">Sahip Olduğun Biletler</h2>
            </div>
            {canBuyTickets && !soldOut && userTickets.length > 0 && (
              <Button onClick={handleBuyTicket} variant="primary" size="sm">
                + Bilet Ekle
              </Button>
            )}
          </div>

          {userTicketsLoading ? (
            <div className="userhome__tickets-grid">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="userhome__skeleton" />
              ))}
            </div>
          ) : userTickets.length === 0 ? (
            <div className="userhome__empty">
              <div className="userhome__empty-icon">🎫</div>
              <h3 className="userhome__empty-title">Henüz Biletiniz Yok</h3>
              <p className="userhome__empty-text">
                Çekilişe katılmak için bilet satın alın ve şansınızı deneyin!
              </p>
              {canBuyTickets && !soldOut && (
                <Button onClick={handleBuyTicket} variant="primary" size="lg">
                  İlk Biletini Al
                </Button>
              )}
            </div>
          ) : (
            <div className="userhome__tickets-grid">
              {userTickets.map(ticket => (
                <Ticket key={ticket.id} ticket={ticket} showStatus={true} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Rules Modal */}
      <RulesModal
        isOpen={showRulesModal}
        onClose={() => setShowRulesModal(false)}
        rules={selectedLottery.rules}
      />

      {/* Live/Results Banner */}
      {lotterySession && lotterySession.status === 'completed' && (
        <div className="userhome__live-banner">
          <button onClick={handleGoToLottery} className="userhome__results-btn">
            🏆 SONUÇLAR AÇIKLANDI - GÖRÜNTÜLE
          </button>
        </div>
      )}
      {lotterySession && lotterySession.status === 'active' && (
        <div className="userhome__live-banner">
          <button onClick={handleGoToLottery} className="userhome__live-btn">
            🔴 CANLI YAYIN - ŞİMDİ İZLE
          </button>
        </div>
      )}
    </div>
  );
}
