import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Ticket as TicketType, LotterySettings } from '../../types';
import { Ticket } from '../common/Ticket';
import './BuyTicket.css';

export function BuyTicket() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const lotteryId = searchParams.get('lotteryId');
  const [lottery, setLottery] = useState<LotterySettings | null>(null);
  const [availableTickets, setAvailableTickets] = useState<TicketType[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<TicketType | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
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
          eventDate: lotteryData.eventDate.toDate ? lotteryData.eventDate.toDate() : new Date(lotteryData.eventDate),
          createdAt: lotteryData.createdAt.toDate ? lotteryData.createdAt.toDate() : new Date(lotteryData.createdAt),
          updatedAt: lotteryData.updatedAt.toDate ? lotteryData.updatedAt.toDate() : new Date(lotteryData.updatedAt)
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
    setSelectedTicket(ticket);
  };

  const handleRequestTicket = async () => {
    if (!selectedTicket || !user || !lottery) return;

    setLoading(true);
    try {
      // Bilet isteği oluştur
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

      // Bileti requested olarak işaretle
      await updateDoc(doc(db, 'tickets', selectedTicket.id), {
        status: 'requested',
        userId: user.uid,
        userName: user.displayName,
        requestedAt: new Date()
      });

      setShowConfirmation(true);
    } catch (error) {
      console.error('Error requesting ticket:', error);
      alert('Bilet isteği gönderilemedi. Lütfen tekrar deneyin.');
    }
    setLoading(false);
  };

  const handleClose = () => {
    navigate('/');
  };

  if (!lottery) {
    return null;
  }

  if (showConfirmation) {
    return (
      <div className="buy-ticket-page">
        <div className="buy-ticket-container">
          <div className="confirmation-card">
            <div className="success-icon">✅</div>
            <h1>İstek Gönderildi!</h1>
            <p className="confirmation-message">
              Bilet talebiniz başarıyla gönderildi.
              <br />
              <br />
              <strong>Yapmanız Gerekenler:</strong>
            </p>
            <div className="instructions">
              <div className="instruction-item">
                <span className="step-number">1</span>
                <p>
                  <strong>{lottery.ticketPrice} TL</strong> ödeme yapın
                </p>
              </div>
              <div className="instruction-item">
                <span className="step-number">2</span>
                <p>Admin onayını bekleyin</p>
              </div>
              <div className="instruction-item">
                <span className="step-number">3</span>
                <p>Onaylandıktan sonra biletiniz aktif olacak</p>
              </div>
            </div>
            <div className="warning-box">
              ⚠️ Çekiliş tarihine 1 saat kala onaylanmayan biletler iptal edilecektir.
            </div>
            <button onClick={handleClose} className="close-button">
              Ana Sayfaya Dön
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="buy-ticket-page">
      <div className="buy-ticket-container">
        <div className="buy-ticket-header">
          <button onClick={() => navigate('/')} className="back-button">
            ← Geri
          </button>
          <h1>Bilet Seç</h1>
          <div className="price-tag">
            💰 {lottery.ticketPrice} TL
          </div>
        </div>

        {selectedTicket && (
          <div className="selected-ticket-section">
            <h2>Seçilen Bilet</h2>
            <Ticket ticket={selectedTicket} showStatus={false} />
            <button
              onClick={handleRequestTicket}
              disabled={loading}
              className="request-button"
            >
              {loading ? 'Gönderiliyor...' : 'Satın Alma İsteği Gönder'}
            </button>
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
    </div>
  );
}
