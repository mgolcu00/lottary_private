import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { collection, query, where, onSnapshot, addDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Ticket as TicketType, LotterySettings } from '../../types';
import { Ticket } from '../common/Ticket';
import { Snowflakes, ChristmasDecorations } from '../common/ChristmasEffects';
import { toDateSafe } from '../../utils/date';
import { ticketRequestLimiter, ValidationError } from '../../utils/validation';
import { secureTicketPurchase } from '../../utils/secureOperations';
import './BuyTicket.css';

export function BuyTicket() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const lotteryId = searchParams.get('lotteryId');
  const [lottery, setLottery] = useState<LotterySettings | null>(null);
  const [availableTickets, setAvailableTickets] = useState<TicketType[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<TicketType | null>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [loading, setLoading] = useState(false);

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
      alert('Satışlar kapalı.');
      return;
    }
    setSelectedTicket(ticket);
    setShowRequestModal(true);
  };

  const handleRequestTicket = async () => {
    if (!selectedTicket || !user || !lottery) return;

    // Rate limiting check
    if (!ticketRequestLimiter.isAllowed(user.uid)) {
      alert('Çok fazla istek gönderdiniz. Lütfen bir dakika bekleyin.');
      return;
    }

    // Validate lottery state
    if (lottery.salesOpen === false) {
      alert('Satışlar kapalı.');
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
        alert(result.error || 'Bilet satın alınamadı');
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

      setShowRequestModal(false);
      setShowSuccessModal(true);
    } catch (error) {
      console.error('Error requesting ticket:', error);

      if (error instanceof ValidationError) {
        alert(error.message);
      } else {
        alert('Bilet isteği gönderilemedi. Lütfen tekrar deneyin.');
      }
    }
    setLoading(false);
  };

  if (!lottery) {
    return null;
  }

  return (
    <div className="buy-ticket-page">
      <Snowflakes />
      <ChristmasDecorations />

      <div className="buy-ticket-container">
        <div className="buy-ticket-header">
          <h1>Bilet Seç</h1>
          <div className="price-tag">
            💰 {lottery.ticketPrice} TL
          </div>
        </div>

        {lottery.salesOpen === false && (
          <div className="sales-closed-banner">
            ⚠️ Satışlar kapalı. Admin tekrar açana kadar bilet seçemezsin.
          </div>
        )}

        <div className="available-tickets-section">
          <h2>
            Müsait Biletler
            <span className="ticket-count">({availableTickets.length} adet)</span>
          </h2>

          {availableTickets.length === 0 ? (
            <div className="no-tickets">
              <div className="empty-icon">😔</div>
              <p>Müsait bilet kalmadı</p>
            </div>
          ) : (
            <div className="tickets-grid">
              {availableTickets.map(ticket => (
                <Ticket
                  key={ticket.id}
                  ticket={ticket}
                  showStatus={false}
                  onClick={() => handleTicketSelect(ticket)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {showRequestModal && selectedTicket && (
        <div className="modal-overlay" onClick={() => !loading && setShowRequestModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Satın al</h3>
              <button
                className="modal-close"
                onClick={() => setShowRequestModal(false)}
                aria-label="Kapat"
              >
                ✕
              </button>
            </div>
            <p className="modal-subtitle">
              #{selectedTicket.ticketNumber.toString().padStart(6, '0')} numaralı bileti satın almak istiyor musun?
            </p>
            <div className="modal-ticket-preview">
              <Ticket ticket={selectedTicket} showStatus={false} />
            </div>
            <div className="modal-actions">
              <button
                className="secondary-button"
                onClick={() => setShowRequestModal(false)}
                disabled={loading}
              >
                Vazgeç
              </button>
              <button
                className="primary-button"
                onClick={handleRequestTicket}
                disabled={loading}
              >
                {loading ? 'Gönderiliyor...' : `${lottery.ticketPrice} TL - Satın al`}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSuccessModal && (
        <div className="modal-overlay" onClick={() => setShowSuccessModal(false)}>
          <div className="modal-card success" onClick={(e) => e.stopPropagation()}>
            <div className="success-icon">✅</div>
            <h3>İstek Gönderildi!</h3>
            <p className="confirmation-message">
              Ödemenizi tamamlayıp admin onayını bekleyin. Onay sonrası biletiniz aktif olacak.
            </p>
            <div className="instructions">
              <div className="instruction-item">
                <span className="step-number">1</span>
                <p><strong>{lottery.ticketPrice} TL</strong> ödeyin</p>
              </div>
              <div className="instruction-item">
                <span className="step-number">2</span>
                <p>Onayı bekleyin</p>
              </div>
            </div>
            <div className="warning-box">
              ⚠️ Çekiliş tarihine 1 saat kala onaylanmayan biletler iptal edilir.
            </div>
            <div className="modal-actions">
              <button
                className="secondary-button"
                onClick={() => {
                  setShowSuccessModal(false);
                  setSelectedTicket(null);
                }}
              >
                Devam et
              </button>
              <button
                className="primary-button"
                onClick={() => navigate('/')}
              >
                Çekilişe dön
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
