import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Ticket as TicketType, LotterySettings, LotterySession as LotterySessionType } from '../../types';
import { Ticket } from '../common/Ticket';
import { useSearchParams } from 'react-router-dom';
import './LotterySession.css';

export function LotterySession() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const lotteryId = searchParams.get('lotteryId');

  const [lottery, setLottery] = useState<LotterySettings | null>(null);
  const [session, setSession] = useState<LotterySessionType | null>(null);
  const [userTickets, setUserTickets] = useState<TicketType[]>([]);
  const [allTickets, setAllTickets] = useState<TicketType[]>([]);
  const [drawnNumbers, setDrawnNumbers] = useState<number[]>([]);
  const [currentNumber, setCurrentNumber] = useState<number | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [winner, setWinner] = useState<TicketType | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [viewersCount, setViewersCount] = useState(0);
  const [timeUntilStart, setTimeUntilStart] = useState<string>('');

  // Presence tracking
  useEffect(() => {
    if (!lottery || !user) return;

    const presenceRef = doc(db, 'lotteryPresence', `${lottery.id}_${user.uid}`);

    // Set presence
    const setPresence = async () => {
      await setDoc(presenceRef, {
        userId: user.uid,
        userName: user.displayName,
        lotteryId: lottery.id,
        timestamp: new Date()
      });
    };

    setPresence();

    // Update presence every 30 seconds
    const presenceInterval = setInterval(setPresence, 30000);

    // Remove presence on unmount
    return () => {
      clearInterval(presenceInterval);
      deleteDoc(presenceRef).catch(() => {});
    };
  }, [lottery, user]);

  // Count viewers
  useEffect(() => {
    if (!lottery) return;

    const presenceQuery = query(
      collection(db, 'lotteryPresence'),
      where('lotteryId', '==', lottery.id)
    );

    const unsubscribe = onSnapshot(presenceQuery, (snapshot) => {
      // Filter out stale presence (older than 1 minute)
      const now = new Date().getTime();
      const activeViewers = snapshot.docs.filter(doc => {
        const timestamp = doc.data().timestamp?.toDate?.() || new Date(doc.data().timestamp);
        return (now - timestamp.getTime()) < 60000; // 1 minute
      });
      setViewersCount(activeViewers.length);
    });

    return unsubscribe;
  }, [lottery]);

  // Countdown to start
  useEffect(() => {
    if (!lottery) return;

    const timer = setInterval(() => {
      const now = new Date().getTime();
      const eventTime = new Date(lottery.eventDate).getTime();
      const distance = eventTime - now;

      if (distance < 0) {
        setTimeUntilStart('');
        clearInterval(timer);
        return;
      }

      const hours = Math.floor(distance / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      setTimeUntilStart(`${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    }, 1000);

    return () => clearInterval(timer);
  }, [lottery]);

  useEffect(() => {
    if (!lotteryId) return;

    const lotteryRef = doc(db, 'lotteries', lotteryId);
    const unsubscribe = onSnapshot(lotteryRef, (snapshot) => {
      if (snapshot.exists()) {
        const lotteryData = snapshot.data() as LotterySettings;
        setLottery({
          ...lotteryData,
          id: snapshot.id,
          eventDate: lotteryData.eventDate.toDate ? lotteryData.eventDate.toDate() : new Date(lotteryData.eventDate),
          createdAt: lotteryData.createdAt.toDate ? lotteryData.createdAt.toDate() : new Date(lotteryData.createdAt),
          updatedAt: lotteryData.updatedAt.toDate ? lotteryData.updatedAt.toDate() : new Date(lotteryData.updatedAt)
        } as LotterySettings);
      }
    });

    return unsubscribe;
  }, [lotteryId]);

  useEffect(() => {
    if (!lottery) return;

    const sessionQuery = query(
      collection(db, 'lotterySessions'),
      where('lotteryId', '==', lottery.id)
    );

    const unsubscribe = onSnapshot(sessionQuery, (snapshot) => {
      if (!snapshot.empty) {
        const sessionData = snapshot.docs[0].data() as LotterySessionType;
        setSession({
          ...sessionData,
          id: snapshot.docs[0].id
        } as LotterySessionType);
        setDrawnNumbers(sessionData.drawnNumbers || []);
        setCurrentNumber(sessionData.currentNumber || null);

        if (sessionData.status === 'completed' && sessionData.winnerTicketIds.length > 0) {
          checkWinner(sessionData.winnerTicketIds);
        }
      }
    });

    return unsubscribe;
  }, [lottery]);

  useEffect(() => {
    if (!lottery || !user) return;

    const ticketsQuery = query(
      collection(db, 'tickets'),
      where('lotteryId', '==', lottery.id),
      where('userId', '==', user.uid),
      where('status', '==', 'confirmed')
    );

    const unsubscribe = onSnapshot(ticketsQuery, (snapshot) => {
      const tickets = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      } as TicketType));
      setUserTickets(tickets);
    });

    return unsubscribe;
  }, [lottery, user]);

  useEffect(() => {
    if (!lottery) return;

    const ticketsQuery = query(
      collection(db, 'tickets'),
      where('lotteryId', '==', lottery.id),
      where('status', '==', 'confirmed')
    );

    const unsubscribe = onSnapshot(ticketsQuery, (snapshot) => {
      const tickets = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      } as TicketType));
      setAllTickets(tickets);
    });

    return unsubscribe;
  }, [lottery]);

  const checkWinner = (winnerTicketIds: string[]) => {
    const isUserWinner = userTickets.some(ticket => winnerTicketIds.includes(ticket.id));
    if (isUserWinner) {
      setShowConfetti(true);
      const winnerTicket = userTickets.find(ticket => winnerTicketIds.includes(ticket.id));
      setWinner(winnerTicket || null);
    }
  };

  const startLottery = async () => {
    if (!lottery || !user?.isAdmin) return;

    try {
      const sessionRef = await addDoc(collection(db, 'lotterySessions'), {
        lotteryId: lottery.id,
        status: 'active',
        drawnNumbers: [],
        winnerTicketIds: [],
        startedAt: new Date()
      });

      simulateDrawing(sessionRef.id);
    } catch (error) {
      console.error('Error starting lottery:', error);
    }
  };

  const simulateDrawing = async (sessionId: string) => {
    const numbers = Array.from({ length: 10 }, (_, i) => i); // 0-9
    const drawn: number[] = [];

    for (let i = 0; i < 5; i++) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      setIsDrawing(true);

      const randomIndex = Math.floor(Math.random() * numbers.length);
      const drawnNumber = numbers[randomIndex];
      numbers.splice(randomIndex, 1);
      drawn.push(drawnNumber);

      await updateDoc(doc(db, 'lotterySessions', sessionId), {
        currentNumber: drawnNumber,
        drawnNumbers: drawn
      });

      await new Promise(resolve => setTimeout(resolve, 1000));
      setIsDrawing(false);
    }

    // Kazananları bul
    const winners = findWinners(drawn);

    await updateDoc(doc(db, 'lotterySessions', sessionId), {
      status: 'completed',
      winnerTicketIds: winners.map(t => t.id),
      completedAt: new Date(),
      currentNumber: null
    });
  };

  const findWinners = (drawnNumbers: number[]): TicketType[] => {
    // Only consider confirmed tickets
    const confirmedTickets = allTickets.filter(t => t.status === 'confirmed');

    if (confirmedTickets.length === 0) return [];

    const ticketsWithMatches = confirmedTickets.map(ticket => {
      const matches = ticket.numbers.filter(num => drawnNumbers.includes(num)).length;
      return { ticket, matches };
    });

    const maxMatches = Math.max(...ticketsWithMatches.map(t => t.matches));

    // If no matches at all, pick random winner(s) to ensure at least 1 winner
    if (maxMatches === 0) {
      const randomIndex = Math.floor(Math.random() * confirmedTickets.length);
      return [confirmedTickets[randomIndex]];
    }

    return ticketsWithMatches
      .filter(t => t.matches === maxMatches)
      .map(t => t.ticket);
  };

  if (!lottery) {
    return (
      <div className="lottery-session">
        <div className="no-lottery">
          <h1>Çekiliş Bulunamadı</h1>
        </div>
      </div>
    );
  }

  const eventTime = new Date(lottery.eventDate).getTime();
  const now = new Date().getTime();
  const canStart = now >= eventTime || user?.isAdmin;

  if (!session && !canStart) {
    return (
      <div className="lottery-session">
        <div className="waiting">
          <div className="viewers-badge">
            👥 {viewersCount} kişi bekliyor
          </div>
          <div className="lottery-icon">⏳</div>
          <h1>Çekiliş Bekleniyor</h1>
          <div className="time-remaining">
            {timeUntilStart && (
              <>
                <p>Çekilişe kalan süre:</p>
                <div className="countdown-display">{timeUntilStart}</div>
              </>
            )}
          </div>
          <p className="waiting-message">Yönetici çekilişi başlattığında otomatik olarak başlayacak</p>
        </div>
      </div>
    );
  }

  if (!session && user?.isAdmin) {
    return (
      <div className="lottery-session">
        <div className="start-lottery">
          <div className="viewers-badge">
            👥 {viewersCount} kişi izliyor
          </div>
          <div className="lottery-icon">🎊</div>
          <h1>Çekilişi Başlat</h1>
          {timeUntilStart && (
            <div className="time-info">
              <p>Planlanan süreye kalan: {timeUntilStart}</p>
            </div>
          )}
          <p className="admin-note">Admin olarak çekilişi istediğin zaman başlatabilirsin</p>
          <button onClick={startLottery} className="start-button">
            Çekilişi Şimdi Başlat
          </button>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="lottery-session">
        <div className="waiting">
          <div className="viewers-badge">
            👥 {viewersCount} kişi bekliyor
          </div>
          <div className="lottery-icon">⏳</div>
          <h1>Çekiliş Bekleniyor</h1>
          <p>Yönetici çekilişi başlatmasını bekliyoruz...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="lottery-session">
      {showConfetti && <div className="confetti-container">
        {Array.from({ length: 50 }).map((_, i) => (
          <div key={i} className="confetti" style={{
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 2}s`,
            backgroundColor: ['#f093fb', '#f5576c', '#4facfe', '#00f2fe', '#43e97b'][Math.floor(Math.random() * 5)]
          }} />
        ))}
      </div>}

      <div className="viewers-badge-live">
        👥 {viewersCount} kişi izliyor
      </div>

      <div className="drawing-area">
        <h1 className="session-title">🎉 Çekiliş Başladı! 🎉</h1>

        <div className="balloon-container">
          {isDrawing ? (
            <div className="balloon-drawing">
              <div className="balloon">
                <div className="balloon-string"></div>
                🎈
              </div>
              <p className="drawing-text">Numara çekiliyor...</p>
            </div>
          ) : currentNumber !== null && currentNumber !== undefined ? (
            <div className="number-reveal">
              <div className="drawn-number">{currentNumber}</div>
            </div>
          ) : null}
        </div>

        <div className="drawn-numbers">
          <h2>Çekilen Numaralar</h2>
          <div className="numbers-display">
            {drawnNumbers.map((num, index) => (
              <div key={index} className="drawn-number-badge">
                {num}
              </div>
            ))}
            {Array.from({ length: 5 - drawnNumbers.length }).map((_, i) => (
              <div key={`empty-${i}`} className="empty-number-badge">?</div>
            ))}
          </div>
        </div>

        {session.status === 'completed' && (
          <div className="winner-announcement">
            {winner ? (
              <div className="winner-card user-winner">
                <h2>🎊 TEBRİKLER! 🎊</h2>
                <p className="winner-message">KAZANDINIZ!</p>
                <Ticket ticket={winner} highlightedNumbers={drawnNumbers} />
              </div>
            ) : session.winnerTicketIds.length > 0 ? (
              <div className="winner-card">
                <h2>Çekiliş Tamamlandı</h2>
                <p className="winner-message">
                  {session.winnerTicketIds.length} kişi kazandı!
                </p>
              </div>
            ) : (
              <div className="winner-card">
                <h2>Çekiliş Tamamlandı</h2>
                <p className="winner-message">Kazanan belirlendi</p>
              </div>
            )}
          </div>
        )}
      </div>

      {userTickets.length > 0 && (
        <div className="user-tickets-section">
          <h2>Biletlerim</h2>
          <div className="tickets-grid">
            {userTickets.map(ticket => (
              <Ticket
                key={ticket.id}
                ticket={ticket}
                highlightedNumbers={drawnNumbers}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
