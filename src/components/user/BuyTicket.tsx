import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { collection, query, where, onSnapshot, addDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Ticket as TicketType, LotterySettings } from '../../types';
import { Ticket } from '../common/Ticket';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Snowflakes, ChristmasDecorations } from '../common/ChristmasEffects';
import { toDateSafe } from '../../utils/date';
import { ticketRequestLimiter, ValidationError } from '../../utils/validation';
import { secureTicketPurchase } from '../../utils/secureOperations';
import './BuyTicket.css';

export function BuyTicket() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const lotteryId = searchParams.get('lotteryId');
  const [lottery, setLottery] = useState<LotterySettings | null>(null);
  const [availableTickets, setAvailableTickets] = useState<TicketType[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<TicketType | null>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'number' | 'random'>('number');

  useEffect(() => {
    if (!lotteryId) {
      navigate('/');
      return;
    }

    // Seçili çekiliş bilgisini al
    const fetchLottery = async () => {
      const lotteryDoc = await getDoc(doc(db, 'lotteries', lotteryId));
      if (lotteryDoc.exists()) {
        const lotteryData = lotteryDoc.data() as LotterySettings;
        setLottery({
          ...lotteryData,
          id: lotteryDoc.id,
          eventDate: toDateSafe(lotteryData.eventDate),
          createdAt: toDateSafe(lotteryData.createdAt),
          updatedAt: toDateSafe(lotteryData.updatedAt),
          salesOpen: lotteryData.salesOpen ?? true,
          numberRange: lotteryData.numberRange ?? '1-9'
        } as LotterySettings);
      } else {
        navigate('/');
      }
    };

    fetchLottery();
  }, [lotteryId, navigate]);

  useEffect(() => {
    if (!lottery) return;

    // Müsait biletleri dinle
    const ticketsQuery = query(
      collection(db, 'tickets'),
      where('lotteryId', '==', lottery.id),
      where('status', '==', 'available')
    );

    const unsubscribe = onSnapshot(ticketsQuery, (snapshot) => {
      const tickets = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      } as TicketType));
      setAvailableTickets(tickets.sort((a, b) => a.ticketNumber - b.ticketNumber));
    });

    return unsubscribe;
  }, [lottery]);

  const handleTicketSelect = (ticket: TicketType) => {
    if (lottery && lottery.salesOpen === false) {
      toast.warning('Satışlar kapalı.');
      return;
    }
    setSelectedTicket(ticket);
    setShowRequestModal(true);
  };

  const handleRequestTicket = async () => {
    if (!selectedTicket || !user || !lottery) return;

    // Rate limiting check
    if (!ticketRequestLimiter.isAllowed(user.uid)) {
      toast.warning('Çok fazla istek gönderdiniz. Lütfen bir dakika bekleyin.');
      return;
    }

    // Validate lottery state
    if (lottery.salesOpen === false) {
      toast.warning('Satışlar kapalı.');
      return;
    }

    setLoading(true);
    try {
      // Use secure transaction-based ticket purchase
      const ticketRef = doc(db, 'tickets', selectedTicket.id);
      const result = await secureTicketPurchase(
        db,
        ticketRef,
        user.uid,
        user.displayName || 'Unknown'
      );

      if (!result.success) {
        toast.error(result.error || 'Bilet satın alınamadı');
        setLoading(false);
        return;
      }

      // Create ticket request record after successful ticket lock
      await addDoc(collection(db, 'ticketRequests'), {
        ticketId: selectedTicket.id,
        ticketNumber: selectedTicket.ticketNumber,
        userId: user.uid,
        userName: user.displayName,
        userEmail: user.email,
        status: 'pending',
        createdAt: new Date(),
        lotteryId: lottery.id
      });

      setLoading(false);
      setShowRequestModal(false);
      setShowSuccessModal(true);
      toast.success('Bilet isteğiniz başarıyla gönderildi!');
    } catch (error) {
      console.error('Error requesting ticket:', error);

      if (error instanceof ValidationError) {
        toast.error(error.message);
      } else {
        toast.error('Bilet isteği gönderilemedi. Lütfen tekrar deneyin.');
      }
      setLoading(false);
    }
  };

  const handleLuckyPick = () => {
    if (filteredTickets.length === 0) return;
    const randomTicket = filteredTickets[Math.floor(Math.random() * filteredTickets.length)];
    handleTicketSelect(randomTicket);
  };

  // Filter and sort tickets
  const filteredTickets = availableTickets
    .filter(ticket => {
      if (!searchQuery) return true;
      return ticket.ticketNumber.toString().includes(searchQuery);
    })
    .sort((a, b) => {
      if (sortBy === 'random') {
        return Math.random() - 0.5;
      }
      return a.ticketNumber - b.ticketNumber;
    });

  if (!lottery) {
    return null;
  }

  return (
    <div className="buyticket">
      <Snowflakes />
      <ChristmasDecorations />

      <div className="buyticket__container">
        <Card className="buyticket__header" padding="lg">
          <div className="buyticket__header-content">
            <div className="buyticket__header-left">
              <Button variant="ghost" size="sm" icon="←" onClick={() => navigate('/')}>
                Geri
              </Button>
              <h1>Bilet Seç</h1>
            </div>
            <div className="buyticket__price-tag">
              💰 {lottery.ticketPrice} TL
            </div>
          </div>
        </Card>

        {lottery.salesOpen === false && (
          <div className="buyticket__sales-closed-banner">
            ⚠️ Satışlar kapalı. Admin tekrar açana kadar bilet seçemezsin.
          </div>
        )}

        <Card className="buyticket__tickets-section" padding="lg">
          <div className="buyticket__section-header">
            <h2>
              Müsait Biletler
              <span className="buyticket__ticket-count">({filteredTickets.length}/{availableTickets.length})</span>
            </h2>
            {availableTickets.length > 0 && (
              <Button
                variant="primary"
                size="md"
                icon="🍀"
                onClick={handleLuckyPick}
                disabled={filteredTickets.length === 0}
              >
                Şanslı Seçim
              </Button>
            )}
          </div>

          {availableTickets.length > 0 && (
            <div className="buyticket__filters">
              <div className="buyticket__search-box">
                <input
                  type="text"
                  placeholder="Bilet numarası ara..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="buyticket__search-input"
                />
                {searchQuery && (
                  <button className="buyticket__clear-search" onClick={() => setSearchQuery('')}>
                    ✕
                  </button>
                )}
              </div>
              <div className="buyticket__sort-buttons">
                <button
                  className={`buyticket__sort-button ${sortBy === 'number' ? 'active' : ''}`}
                  onClick={() => setSortBy('number')}
                >
                  📊 Sıralı
                </button>
                <button
                  className={`buyticket__sort-button ${sortBy === 'random' ? 'active' : ''}`}
                  onClick={() => setSortBy('random')}
                >
                  🎲 Rastgele
                </button>
              </div>
            </div>
          )}

          {availableTickets.length === 0 ? (
            <div className="buyticket__empty">
              <div className="buyticket__empty-icon">😔</div>
              <p>Müsait bilet kalmadı</p>
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="buyticket__empty">
              <div className="buyticket__empty-icon">🔍</div>
              <p>Aradığınız bilet bulunamadı</p>
              <Button variant="outline" size="sm" onClick={() => setSearchQuery('')}>
                Aramayı Temizle
              </Button>
            </div>
          ) : (
            <div className="buyticket__tickets-grid">
              {filteredTickets.map(ticket => (
                <Ticket
                  key={ticket.id}
                  ticket={ticket}
                  showStatus={false}
                  onClick={() => handleTicketSelect(ticket)}
                />
              ))}
            </div>
          )}
        </Card>
      </div>

      {showRequestModal && selectedTicket && (
        <div className="buyticket__modal-overlay" onClick={() => !loading && setShowRequestModal(false)}>
          <div onClick={(e) => e.stopPropagation()}>
            <Card className="buyticket__modal-card" padding="lg">
              <div className="buyticket__modal-header">
                <h3>Satın al</h3>
                <button
                  className="buyticket__modal-close"
                  onClick={() => !loading && setShowRequestModal(false)}
                  disabled={loading}
                  aria-label="Kapat"
                >
                  ✕
                </button>
              </div>
              <p className="buyticket__modal-subtitle">
                #{selectedTicket.ticketNumber.toString().padStart(6, '0')} numaralı bileti satın almak istiyor musun?
              </p>
              <div className="buyticket__modal-ticket-preview">
                <Ticket ticket={selectedTicket} showStatus={false} />
              </div>
              <div className="buyticket__modal-actions">
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => setShowRequestModal(false)}
                  disabled={loading}
                >
                  Vazgeç
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleRequestTicket}
                  loading={loading}
                  icon="💳"
                >
                  {lottery.ticketPrice} TL - Satın al
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}

      {showSuccessModal && (
        <div className="buyticket__modal-overlay" onClick={() => setShowSuccessModal(false)}>
          <div onClick={(e) => e.stopPropagation()}>
            <Card className="buyticket__modal-card success" padding="lg">
              <div className="buyticket__success-icon">✅</div>
              <h3>İstek Gönderildi!</h3>
              <p className="buyticket__confirmation-message">
                Ödemenizi tamamlayıp admin onayını bekleyin. Onay sonrası biletiniz aktif olacak.
              </p>
              <div className="buyticket__instructions">
                <div className="buyticket__instruction-item">
                  <span className="buyticket__step-number">1</span>
                  <p><strong>{lottery.ticketPrice} TL</strong> ödeyin</p>
                </div>
                <div className="buyticket__instruction-item">
                  <span className="buyticket__step-number">2</span>
                  <p>Onayı bekleyin</p>
                </div>
              </div>
              <div className="buyticket__warning-box">
                ⚠️ Çekiliş tarihine 1 saat kala onaylanmayan biletler iptal edilir.
              </div>
              <div className="buyticket__modal-actions">
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => {
                    setShowSuccessModal(false);
                    setSelectedTicket(null);
                  }}
                >
                  Devam et
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  icon="🏠"
                  onClick={() => navigate('/')}
                >
                  Çekilişe dön
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
