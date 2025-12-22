import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Ticket as TicketType, LotterySettings, LotterySession as LotterySessionType } from '../../types';
import { Ticket } from '../common/Ticket';
import { useSearchParams } from 'react-router-dom';
import { toDateSafe } from '../../utils/date';
import './LotterySession.css';

export function LotterySession() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const lotteryId = searchParams.get('lotteryId');

  const [lottery, setLottery] = useState<LotterySettings | null>(null);
  const [session, setSession] = useState<LotterySessionType | null>(null);
  const [userTickets, setUserTickets] = useState<TicketType[]>([]);
  const [allTickets, setAllTickets] = useState<TicketType[]>([]);
  const [availableCount, setAvailableCount] = useState(0);
  const [drawnNumbers, setDrawnNumbers] = useState<number[]>([]);
  const [currentNumber, setCurrentNumber] = useState<number | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [invalidNumber, setInvalidNumber] = useState<number | null>(null);
  const [pendingCandidate, setPendingCandidate] = useState<number | null>(null);
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
          eventDate: toDateSafe(lotteryData.eventDate),
          createdAt: toDateSafe(lotteryData.createdAt),
          updatedAt: toDateSafe(lotteryData.updatedAt)
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
        const sessionDoc = snapshot.docs[0];
        const sessionData = sessionDoc.data() as LotterySessionType;
        const normalizedSession = {
          ...sessionData,
          id: sessionDoc.id
        } as LotterySessionType;
        setSession(normalizedSession);
        setDrawnNumbers(sessionData.drawnNumbers || []);
        setCurrentNumber(sessionData.currentNumber ?? null);
        setInvalidNumber(sessionData.lastInvalidNumber ?? null);
        setIsDrawing(sessionData.currentPhase === 'drawing');

        if (sessionData.status === 'completed' && sessionData.winnerTicketIds.length > 0) {
          checkWinner(sessionData.winnerTicketIds);
        } else {
          setWinner(null);
          setShowConfetti(false);
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
      where('lotteryId', '==', lottery.id)
    );

    const unsubscribe = onSnapshot(ticketsQuery, (snapshot) => {
      const tickets = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      } as TicketType));
      setAllTickets(tickets);
      setAvailableCount(tickets.filter(t => t.status === 'available').length);
    });

    return unsubscribe;
  }, [lottery]);

  const checkWinner = (winnerTicketIds: string[]) => {
    const isUserWinner = userTickets.some(ticket => winnerTicketIds.includes(ticket.id));
    if (isUserWinner) {
      setShowConfetti(true);
      const winnerTicket = userTickets.find(ticket => winnerTicketIds.includes(ticket.id));
      setWinner(winnerTicket || null);
    } else {
      setShowConfetti(false);
      setWinner(null);
    }
  };

  const startLottery = async () => {
    if (!lottery || !user?.isAdmin) return;

    try {
      await addDoc(collection(db, 'lotterySessions'), {
        lotteryId: lottery.id,
        status: 'active',
        currentPhase: 'drawing',
        lastInvalidNumber: null,
        drawnNumbers: [],
        winnerTicketIds: [],
        startedAt: new Date()
      });
    } catch (error) {
      console.error('Error starting lottery:', error);
    }
  };

  const hasMatchingPrefix = (sequence: number[]) => {
    const confirmedTickets = allTickets.filter(t => t.status === 'confirmed');
    if (confirmedTickets.length === 0) return true;
    return confirmedTickets.some(ticket =>
      sequence.every((num, idx) => ticket.numbers[idx] === num)
    );
  };

  const acceptNumber = async (sessionId: string, candidate: number, currentDrawn: number[]) => {
    const nextDrawn = [...currentDrawn, candidate];
    setCurrentNumber(candidate);
    setInvalidNumber(null);
    setPendingCandidate(null);

    await updateDoc(doc(db, 'lotterySessions', sessionId), {
      currentPhase: 'reveal',
      currentNumber: candidate,
      drawnNumbers: nextDrawn,
      lastInvalidNumber: null
    });

    if (nextDrawn.length === 5) {
      const winners = findWinners(nextDrawn);
      await updateDoc(doc(db, 'lotterySessions', sessionId), {
        status: 'completed',
        currentPhase: 'completed',
        winnerTicketIds: winners.map(t => t.id),
        completedAt: new Date(),
        currentNumber: null,
        lastInvalidNumber: null
      });
      setIsDrawing(false);
    }
  };

  const drawNumber = async () => {
    if (!user?.isAdmin || !session || session.status !== 'active') return;
    if (drawnNumbers.length >= 5 || pendingCandidate !== null) return;

    setIsDrawing(true);
    setInvalidNumber(null);

    const candidate = Math.floor(Math.random() * 9) + 1;
    const sequence = [...drawnNumbers, candidate];
    const valid = hasMatchingPrefix(sequence);

    await updateDoc(doc(db, 'lotterySessions', session.id), {
      currentPhase: valid ? 'reveal' : 'invalid',
      currentNumber: candidate,
      lastInvalidNumber: valid ? null : candidate,
      drawnNumbers
    });

    if (valid) {
      await acceptNumber(session.id, candidate, drawnNumbers);
    } else {
      setPendingCandidate(candidate);
      setInvalidNumber(candidate);
      setIsDrawing(false);
    }
  };

  const retryDraw = () => {
    setPendingCandidate(null);
    setInvalidNumber(null);
    drawNumber();
  };

  const acceptInvalid = () => {
    if (!session || pendingCandidate === null) return;
    acceptNumber(session.id, pendingCandidate, drawnNumbers);
  };

  const findWinners = (drawnNumbers: number[]): TicketType[] => {
    // Only consider confirmed tickets
    const confirmedTickets = allTickets.filter(t => t.status === 'confirmed');
    if (confirmedTickets.length === 0) return [];

    return confirmedTickets.filter(ticket =>
      drawnNumbers.every((num, idx) => ticket.numbers[idx] === num)
    );
  };

  const renderRulesCard = () => (
    <div className="rules-card">
      <div className="rules-title">📜 Çekiliş Kuralları</div>
      <p className="rules-text">
        {lottery?.rules?.trim() || 'Kurallar henüz eklenmedi.'}
      </p>
    </div>
  );

  const getHighlightIndices = (ticket: TicketType) => {
    let matchCount = 0;
    for (let i = 0; i < drawnNumbers.length; i++) {
      if (ticket.numbers[i] === drawnNumbers[i]) {
        matchCount++;
      } else {
        break;
      }
    }
    return Array.from({ length: matchCount }, (_, i) => i);
  };

  const finishSession = async () => {
    if (!user?.isAdmin || !session || session.status === 'completed') return;
    const winners = findWinners(drawnNumbers);
    await updateDoc(doc(db, 'lotterySessions', session.id), {
      status: 'completed',
      currentPhase: 'completed',
      winnerTicketIds: winners.map(t => t.id),
      completedAt: new Date(),
      currentNumber: null,
      lastInvalidNumber: null
    });
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
          <div className="pre-stats">
            <div className="pre-stat">
              <span>Toplam Değer</span>
              <strong>{lottery.ticketPrice * lottery.maxTickets} TL</strong>
            </div>
            <div className="pre-stat">
              <span>Kalan Bilet</span>
              <strong>{availableCount}</strong>
            </div>
            <div className="pre-stat">
              <span>Satılan</span>
              <strong>{allTickets.filter(t => t.status === 'confirmed').length}</strong>
            </div>
          </div>
        </div>
        {renderRulesCard()}
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
        {renderRulesCard()}
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
        {renderRulesCard()}
      </div>
    );
  }

  return (
    <div className="lottery-session">
      {showConfetti && (
        <div className="confetti-container">
          {Array.from({ length: 50 }).map((_, i) => (
            <div
              key={i}
              className="confetti"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                backgroundColor: ['#f093fb', '#f5576c', '#4facfe', '#00f2fe', '#43e97b'][Math.floor(Math.random() * 5)]
              }}
            />
          ))}
        </div>
      )}

      <div className="viewers-badge-live">
        👥 {viewersCount} kişi izliyor
      </div>

      <div className="drawing-grid">
        <div className="drawing-card">
          <div className="drawing-header">
            <div>
              <p className="session-subtitle">{lottery.lotteryName || 'Çekiliş'}</p>
              <h1 className="session-title">Canlı Çekiliş</h1>
            </div>
            <div className="session-meta">
              <span>📅 {new Date(lottery.eventDate).toLocaleString('tr-TR')}</span>
              <span>🎟️ {allTickets.length} onaylı bilet</span>
            </div>
          </div>

          <div className="roller-area">
            <div className={`roller ${isDrawing ? 'spinning' : ''}`}>
              <div className="roller-inner">
                <div className="roller-number">{currentNumber ?? '•'}</div>
                <div className="roller-glow" />
              </div>
              <div className="roller-shadow" />
            </div>
            <div className="roller-status">
              {session.status === 'completed' ? (
                <span className="status-pill success">Çekiliş tamamlandı</span>
              ) : session.currentPhase === 'invalid' ? (
                <span className="status-pill danger">
                  Geçersiz numara: {invalidNumber ?? '-'} (prefix eşleşmedi)
                </span>
              ) : session.currentPhase === 'drawing' ? (
                <span className="status-pill info">Numara karıştırılıyor...</span>
              ) : (
                <span className="status-pill info">
                  Çekilen numara: {currentNumber ?? 'Hazırlanıyor'}
                </span>
              )}
            </div>
          </div>

          <div className="slots-row">
            {Array.from({ length: 5 }).map((_, idx) => {
              const value = drawnNumbers[idx];
              const isActive = drawnNumbers.length === idx + 1 && session.currentPhase === 'reveal';
              return (
                <div key={idx} className={`number-slot ${value !== undefined ? 'filled' : ''} ${isActive ? 'active' : ''}`}>
                  <div className="slot-index">{idx + 1}</div>
                  <div className="slot-value">{value !== undefined ? value : '•'}</div>
                </div>
              );
            })}
          </div>

          <div className="drawn-preview">
            <div className="preview-label">Çekilen Sıra</div>
            <div className="preview-digits">
              {drawnNumbers.map((num, index) => (
                <span key={index} className="preview-digit">{num}</span>
              ))}
              {Array.from({ length: 5 - drawnNumbers.length }).map((_, i) => (
                <span key={`p-${i}`} className="preview-placeholder">?</span>
              ))}
            </div>
          </div>

          {session.status === 'completed' && (
            <div className="winner-announcement">
              {winner ? (
                <div className="winner-card user-winner">
                  <h2>🎊 TEBRİKLER! 🎊</h2>
                  <p className="winner-message">KAZANDINIZ!</p>
                  <Ticket ticket={winner} highlightedIndices={getHighlightIndices(winner)} />
                </div>
              ) : session.winnerTicketIds.length > 0 ? (
                <div className="winner-card">
                  <h2>Çekiliş Tamamlandı</h2>
                  <p className="winner-message">
                    {session.winnerTicketIds.length} kazanan var
                  </p>
                </div>
              ) : (
                <div className="winner-card">
                  <h2>Çekiliş Tamamlandı</h2>
                  <p className="winner-message">Uyan bilet bulunamadı</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="side-column">
          {renderRulesCard()}
          <div className="info-card">
            <div className="info-row">
              <span>💰 Bilet Fiyatı</span>
              <strong>{lottery.ticketPrice} TL</strong>
            </div>
            <div className="info-row">
              <span>📦 Onaylı Bilet</span>
              <strong>{allTickets.filter(t => t.status === 'confirmed').length}</strong>
            </div>
            <div className="info-row">
              <span>🔢 Çekilen Hane</span>
              <strong>{drawnNumbers.length}/5</strong>
            </div>
            {invalidNumber !== null && session.currentPhase === 'invalid' && (
              <div className="info-row danger-text">
                <span>Geçersiz</span>
                <strong>{invalidNumber}</strong>
              </div>
            )}
          </div>
          {user?.isAdmin && session.status === 'active' && (
            <div className="controls-card">
              <div className="controls-row">
                <button
                  className="primary-button wide"
                  onClick={drawNumber}
                  disabled={drawnNumbers.length >= 5 || pendingCandidate !== null}
                >
                  {drawnNumbers.length >= 5 ? 'Tüm numaralar çekildi' : 'Numara Çek'}
                </button>
              </div>
              {pendingCandidate !== null && (
                <div className="invalid-box">
                  <p>Geçersiz numara: {pendingCandidate}. Prefix eşleşmedi.</p>
                  <div className="controls-row">
                    <button className="secondary-button" onClick={retryDraw}>Tekrar Çek</button>
                    <button className="primary-button" onClick={acceptInvalid}>Devam Et</button>
                  </div>
                </div>
              )}
              <div className="controls-row">
                <button
                  className="secondary-button"
                  onClick={() => finishSession()}
                  disabled={drawnNumbers.length === 0}
                >
                  Çekilişi Sonlandır
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {userTickets.length > 0 && (
        <div className="user-tickets-section">
          <div className="user-tickets-header">
            <h2>Biletlerim</h2>
            <p className="user-tickets-hint">Soldan sağa sırayla eşleşen rakamlar ışık yanar.</p>
          </div>
          <div className="tickets-grid">
            {userTickets.map(ticket => (
              <Ticket
                key={ticket.id}
                ticket={ticket}
                highlightedIndices={getHighlightIndices(ticket)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
