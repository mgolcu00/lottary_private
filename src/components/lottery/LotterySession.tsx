import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Ticket as TicketType, LotterySettings, LotterySession as LotterySessionType } from '../../types';
import { Ticket } from '../common/Ticket';
import { RulesModal } from '../common/RulesModal';
import { Button } from '../common/Button';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { toDateSafe } from '../../utils/date';
import { usePresenceTracking } from '../../hooks/usePresenceTracking';
import './LotterySession.css';

export function LotterySession() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const lotteryId = searchParams.get('lotteryId');

  const [lottery, setLottery] = useState<LotterySettings | null>(null);
  const [session, setSession] = useState<LotterySessionType | null>(null);
  const [userTickets, setUserTickets] = useState<TicketType[]>([]);
  const [allTickets, setAllTickets] = useState<TicketType[]>([]);
  const [availableCount, setAvailableCount] = useState(0);
  const [drawnNumbers, setDrawnNumbers] = useState<number[]>([]);
  const [_currentNumber, setCurrentNumber] = useState<number | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [winner, setWinner] = useState<TicketType | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [viewersCount, setViewersCount] = useState(0);
  const [timeUntilStart, setTimeUntilStart] = useState<string>('');
  const [stage, setStage] = useState<'amorti1' | 'amorti2' | 'grand' | 'completed'>('grand');
  const [amortiFirst, setAmortiFirst] = useState<number | null>(null);
  const [amortiSecond, setAmortiSecond] = useState<number | null>(null);
  const [showRulesModal, setShowRulesModal] = useState(false);

  // Presence tracking - Using custom hook (fixed memory leak)
  usePresenceTracking({
    lotteryId: lottery?.id,
    userId: user?.uid,
    userName: user?.displayName
  });

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

  // Countdown to start - Fixed: Use stable dependencies to prevent multiple intervals
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
  }, [lottery?.id, lottery?.eventDate]);

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
          updatedAt: toDateSafe(lotteryData.updatedAt),
          numberRange: lotteryData.numberRange ?? '1-9',
          salesOpen: lotteryData.salesOpen ?? true
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
        setIsDrawing(sessionData.currentPhase === 'drawing');
        setStage(sessionData.stage || (sessionData.status === 'completed' ? 'completed' : 'grand'));
        setAmortiFirst(sessionData.amortiFirstNumber ?? null);
        setAmortiSecond(sessionData.amortiSecondNumber ?? null);

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
        stage: 'amorti1',
        lastInvalidNumber: null,
        drawnNumbers: [],
        winnerTicketIds: [],
        amortiFirstNumber: null,
        amortiSecondNumber: null,
        startedAt: new Date()
      });
    } catch (error) {
      console.error('Error starting lottery:', error);
    }
  };

  // Akıllı algoritma: Mutlaka kazanan çıkacak şekilde numara seç
  const getSmartNumber = (currentSequence: number[]): number => {
    const confirmedTickets = allTickets.filter(t => t.status === 'confirmed');

    // Eğer bilet yoksa random döndür
    if (confirmedTickets.length === 0) {
      return Math.floor(Math.random() * 9) + 1;
    }

    // Şu ana kadar çekilen sequence ile eşleşen biletleri bul
    const matchingTickets = confirmedTickets.filter(ticket =>
      currentSequence.every((num, idx) => ticket.numbers[idx] === num)
    );

    // Eğer eşleşen bilet kalmadıysa (bu olmamalı), random döndür
    if (matchingTickets.length === 0) {
      console.warn('No matching tickets found! Drawing random number.');
      return Math.floor(Math.random() * 9) + 1;
    }

    // Eşleşen biletlerin bir sonraki pozisyonundaki numaraları topla
    const nextPosition = currentSequence.length;
    const possibleNumbers = matchingTickets.map(ticket => ticket.numbers[nextPosition]);

    // Bu sayılardan birini random seç
    const randomIndex = Math.floor(Math.random() * possibleNumbers.length);
    return possibleNumbers[randomIndex];
  };

  const acceptNumber = async (sessionId: string, candidate: number, currentDrawn: number[]) => {
    const nextDrawn = [...currentDrawn, candidate];
    setCurrentNumber(candidate);

    await updateDoc(doc(db, 'lotterySessions', sessionId), {
      currentPhase: 'reveal',
      currentNumber: candidate,
      drawnNumbers: nextDrawn
    });

    if (nextDrawn.length === 5) {
      const winners = findWinners(nextDrawn);
      await updateDoc(doc(db, 'lotterySessions', sessionId), {
        status: 'completed',
        currentPhase: 'completed',
        stage: 'completed',
        winnerTicketIds: winners.map(t => t.id),
        completedAt: new Date(),
        currentNumber: null
      });
      setIsDrawing(false);

      if (winners.length === 0) {
        setWinner(null);
        setShowConfetti(false);
      } else {
        const winnerTicket = winners[0];
        setWinner(winnerTicket);
        setShowConfetti(true);
      }
    }
  };

  const drawNumber = async () => {
    if (!user?.isAdmin || !session || session.status !== 'active' || stage !== 'grand') return;
    if (drawnNumbers.length >= 5) return;

    setIsDrawing(true);
    setCurrentNumber(null);

    // Uzun ve efektli animasyon başlat
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Akıllı algoritma kullan: Mutlaka eşleşen bilet olacak şekilde numara seç
    const candidate = getSmartNumber(drawnNumbers);

    // Valid sayıyı göster
    await updateDoc(doc(db, 'lotterySessions', session.id), {
      currentPhase: 'reveal',
      currentNumber: candidate,
      drawnNumbers
    });

    await acceptNumber(session.id, candidate, drawnNumbers);

    // Numarayı gösterdikten sonra kısa bir süre bekle
    await new Promise(resolve => setTimeout(resolve, 800));
    setIsDrawing(false);
  };


  const drawAmortiFirst = async () => {
    if (!user?.isAdmin || !session || stage !== 'amorti1') return;

    setIsDrawing(true);
    setCurrentNumber(null);

    // Uzun animasyon - 2.5 saniye
    await new Promise(resolve => setTimeout(resolve, 2500));

    const candidate = Math.floor(Math.random() * 5) + 1; // 1-5
    setAmortiFirst(candidate);
    setCurrentNumber(candidate);

    await updateDoc(doc(db, 'lotterySessions', session.id), {
      amortiFirstNumber: candidate,
      stage: 'amorti2',
      currentPhase: 'reveal',
      currentNumber: candidate
    });

    // Numarayı gösterdikten sonra kısa bir süre bekle
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsDrawing(false);
  };

  const drawAmortiSecond = async () => {
    if (!user?.isAdmin || !session || stage !== 'amorti2') return;

    setIsDrawing(true);
    setCurrentNumber(null);

    // Uzun animasyon - 2.5 saniye
    await new Promise(resolve => setTimeout(resolve, 2500));

    let candidate = Math.floor(Math.random() * 5) + 5; // 5-9
    if (amortiFirst !== null) {
      let attempts = 0;
      while (candidate === amortiFirst && attempts < 5) {
        candidate = Math.floor(Math.random() * 5) + 5;
        attempts++;
      }
    }
    setAmortiSecond(candidate);
    setCurrentNumber(candidate);

    // Amorti numarasını kaydet ama stage değiştirme - admin manuel geçecek
    await updateDoc(doc(db, 'lotterySessions', session.id), {
      amortiSecondNumber: candidate,
      currentPhase: 'reveal',
      currentNumber: candidate
    });

    // Numarayı gösterdikten sonra kısa bir süre bekle
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsDrawing(false);
  };

  // Amortiden büyük ödüle geçiş için manuel buton
  const transitionToGrandPrize = async () => {
    if (!user?.isAdmin || !session || stage !== 'amorti2') return;

    await updateDoc(doc(db, 'lotterySessions', session.id), {
      stage: 'grand',
      currentPhase: 'drawing',
      currentNumber: null,
      drawnNumbers: [] // SIFIRLA - büyük ödül için baştan başla
    });

    setDrawnNumbers([]); // Local state'i de sıfırla
    setCurrentNumber(null);
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

  const isAmortiWinner = (ticket: TicketType) => {
    if (amortiFirst === null || amortiSecond === null) return false;
    return ticket.numbers.includes(amortiFirst) && ticket.numbers.includes(amortiSecond);
  };

  const finishSession = async () => {
    if (!user?.isAdmin || !session || session.status === 'completed') return;
    const winners = findWinners(drawnNumbers);
    await updateDoc(doc(db, 'lotterySessions', session.id), {
      status: 'completed',
      currentPhase: 'completed',
      stage: 'completed',
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
  const soldCount = allTickets.filter(t => t.status === 'confirmed').length;
  const totalValue = lottery.ticketPrice * lottery.maxTickets;
  const soldOut = availableCount === 0;
  const potValue = soldCount * (lottery.ticketPrice || 0);
  const isCurrentUserWinner = winner && userTickets.some(t => t.id === winner.id);
  const amortiReady = amortiFirst !== null && amortiSecond !== null;
  const amortiWinners = amortiReady
    ? allTickets.filter(
        t =>
          t.status === 'confirmed' &&
          t.numbers.includes(amortiFirst as number) &&
          t.numbers.includes(amortiSecond as number)
      )
    : [];
  const amortiPayout = amortiWinners.length * (lottery.ticketPrice || 0);
  const remainingPot = Math.max(0, potValue - amortiPayout);
  const grandWinners = session?.winnerTicketIds?.length
    ? allTickets.filter(t => session.winnerTicketIds.includes(t.id))
    : [];

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
              <strong>{totalValue.toLocaleString('tr-TR')} TL</strong>
            </div>
            <div className="pre-stat">
              <span>Kalan Bilet</span>
              <strong>{availableCount}</strong>
            </div>
            <div className="pre-stat">
              <span>Satılan</span>
              <strong>{soldCount}</strong>
            </div>
          </div>
          {soldOut && <div className="sold-out-pill">Tüm biletler satıldı</div>}
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
          <Button variant="primary" size="lg" onClick={startLottery} icon="🎊">
            Çekilişi Şimdi Başlat
          </Button>
          <div className="pre-stats">
            <div className="pre-stat">
              <span>Toplam Değer</span>
              <strong>{totalValue.toLocaleString('tr-TR')} TL</strong>
            </div>
            <div className="pre-stat">
              <span>Satılan</span>
              <strong>{soldCount}</strong>
            </div>
            <div className="pre-stat">
              <span>Kalan</span>
              <strong>{availableCount}</strong>
            </div>
          </div>
          {soldOut && <div className="sold-out-pill">Tüm biletler satıldı</div>}
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
          {soldOut && <div className="sold-out-pill">Tüm biletler satıldı</div>}
        </div>
        {renderRulesCard()}
      </div>
    );
  }

  if (session.status === 'completed') {
    return (
      <div className="lottery-session results-screen">
        {showConfetti && (
          <div className="confetti-container">
            {Array.from({ length: 80 }).map((_, i) => (
              <div
                key={i}
                className="confetti"
                style={{
                  left: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 3}s`,
                  backgroundColor: ['#10b981', '#059669', '#fbbf24', '#f59e0b', '#dc2626'][Math.floor(Math.random() * 5)]
                }}
              />
            ))}
          </div>
        )}

        <div className="results-container">
          <div className="results-header">
            <h1 className="results-title">🎄 Çekiliş Sonuçları 🎄</h1>
            <p className="results-subtitle">{lottery.lotteryName || 'Çekiliş'}</p>
            <p className="results-date">📅 {new Date(lottery.eventDate).toLocaleString('tr-TR')}</p>
          </div>

          {/* Büyük Ödül Kazananı */}
          <div className="grand-prize-section">
            <div className="section-title">
              <span className="title-icon">🏆</span>
              <h2>BÜYÜK ÖDÜL KAZANANı</h2>
              <span className="title-icon">🏆</span>
            </div>

            {grandWinners.length === 0 ? (
              <div className="no-winner-card">
                <p className="no-winner-text">Bu çekilişte büyük ödülü kazanan olmadı</p>
                <p className="no-winner-subtext">Pot bir sonraki çekilişe devredildi</p>
              </div>
            ) : (
              <div className="grand-winner-container">
                {/* Bilet Gösterimi - En üstte */}
                <div className="grand-winner-ticket">
                  {grandWinners.map(t => (
                    <Ticket key={t.id} ticket={t} isGrandWinner={true} showStatus={false} />
                  ))}
                </div>

                {/* Kazanan Bilgisi - Sol altta badge */}
                <div className="grand-winner-info">
                  {grandWinners.map(t => (
                    <div key={t.id} className="winner-badge">
                      <div className="badge-content">
                        <span className="badge-label">Kazanan</span>
                        <span className="badge-name">{t.userName || 'İsimsiz'}</span>
                        <span className="badge-amount">{remainingPot.toLocaleString('tr-TR')} TL</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Amorti Kazananları */}
          {amortiWinners.length > 0 && (
            <div className="amorti-section">
              <div className="section-title amorti-title">
                <span className="title-icon">🎗️</span>
                <h2>AMORTİ KAZANANLAR</h2>
                <span className="title-icon">🎗️</span>
              </div>

              <div className="amorti-numbers">
                <div className="amorti-number-badge">Amorti #1: <strong>{amortiFirst ?? '–'}</strong></div>
                <div className="amorti-number-badge">Amorti #2: <strong>{amortiSecond ?? '–'}</strong></div>
              </div>

              <div className="amorti-winners-grid">
                {amortiWinners.map(t => (
                  <div key={t.id} className="amorti-winner-card">
                    <Ticket ticket={t} isAmortiWinner={true} showStatus={false} />
                    <div className="amorti-winner-prize">{(lottery.ticketPrice || 0).toLocaleString('tr-TR')} TL</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="results-footer">
            <Button variant="primary" size="lg" onClick={() => navigate('/')} icon="🏠">
              Anasayfaya Dön
            </Button>
          </div>
        </div>
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

      {isCurrentUserWinner && winner && (
        <div className="winner-overlay">
          <div className="winner-modal">
            <div className="winner-burst">✨</div>
            <h2>Kazandın!</h2>
            <p className="winner-amount">Toplam: {potValue.toLocaleString('tr-TR')} TL</p>
            <div className="winner-ticket">
              <Ticket ticket={winner} highlightedIndices={getHighlightIndices(winner)} />
            </div>
            <p className="winner-note">Kazanç bilgisi için admin seninle iletişime geçecek.</p>
          </div>
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
            <span>💰 Pot: {potValue.toLocaleString('tr-TR')} TL</span>
          </div>
        </div>

          {/* Stage Indicator */}
          <div className="stage-indicator">
            {stage === 'completed' ? (
              <span className="stage-badge stage-completed">✓ Çekiliş Tamamlandı</span>
            ) : stage === 'amorti1' ? (
              <span className="stage-badge stage-amorti">Amorti #1 Çekiliyor (1-5)</span>
            ) : stage === 'amorti2' ? (
              <span className="stage-badge stage-amorti">Amorti #2 Çekiliyor (5-9)</span>
            ) : (
              <span className="stage-badge stage-grand">Büyük Ödül Çekilişi</span>
            )}
          </div>

          {/* Tüp Sistemi */}
          {(stage === 'amorti1' || stage === 'amorti2') ? (
            /* Amorti: İki büyük tüp yan yana */
            <div className="tubes-container amorti-tube-container">
              {/* Amorti #1 */}
              <div className="tube-wrapper amorti-tube-wrapper">
                <div className="tube-label-amorti">Amorti #1 (1-5)</div>
                <div className={`tube tube-large ${isDrawing && stage === 'amorti1' ? 'tube-spinning' : ''} ${amortiFirst ? 'tube-filled' : ''}`}>
                  <div className="tube-body">
                    <div className="tube-inner">
                      <div className="tube-ball">
                        {isDrawing && stage === 'amorti1' ? (
                          <div className="ball-spinning">?</div>
                        ) : amortiFirst ? (
                          <div className="ball-number">{amortiFirst}</div>
                        ) : (
                          <div className="ball-empty">•</div>
                        )}
                      </div>
                    </div>
                    <div className="tube-shine" />
                  </div>
                </div>
              </div>

              {/* Amorti #2 */}
              <div className="tube-wrapper amorti-tube-wrapper">
                <div className="tube-label-amorti">Amorti #2 (5-9)</div>
                <div className={`tube tube-large ${isDrawing && stage === 'amorti2' ? 'tube-spinning' : ''} ${amortiSecond ? 'tube-filled' : ''}`}>
                  <div className="tube-body">
                    <div className="tube-inner">
                      <div className="tube-ball">
                        {isDrawing && stage === 'amorti2' ? (
                          <div className="ball-spinning">?</div>
                        ) : amortiSecond ? (
                          <div className="ball-number">{amortiSecond}</div>
                        ) : (
                          <div className="ball-empty">•</div>
                        )}
                      </div>
                    </div>
                    <div className="tube-shine" />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Büyük Ödül: 5 Tüp */
            <div className="tubes-container">
              {Array.from({ length: 5 }).map((_, idx) => {
                const value = drawnNumbers[idx];
                const isCurrentlyDrawing = isDrawing && drawnNumbers.length === idx;
                const isFilled = value !== undefined;

                return (
                  <div key={idx} className="tube-wrapper">
                    <div className="tube-label">#{idx + 1}</div>
                    <div className={`tube ${isCurrentlyDrawing ? 'tube-spinning' : ''} ${isFilled ? 'tube-filled' : ''}`}>
                      <div className="tube-body">
                        <div className="tube-inner">
                          <div className="tube-ball">
                            {isCurrentlyDrawing ? (
                              <div className="ball-spinning">?</div>
                            ) : isFilled ? (
                              <div className="ball-number">{value}</div>
                            ) : (
                              <div className="ball-empty">•</div>
                            )}
                          </div>
                        </div>
                        <div className="tube-shine" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Drawing Status */}
          <div className="drawing-status">
            {isDrawing ? (
              <span className="status-message status-drawing">🎲 Numara çekiliyor...</span>
            ) : stage === 'completed' ? (
              <span className="status-message status-success">🎉 Çekiliş tamamlandı!</span>
            ) : drawnNumbers.length === 5 ? (
              <span className="status-message status-success">✓ Tüm sayılar çekildi</span>
            ) : (
              <span className="status-message status-info">
                {drawnNumbers.length}/5 sayı çekildi
              </span>
            )}
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

          <div className="amorti-panel">
            <div className="amorti-item">
              <span className="amorti-label">Amorti #1 (1-5)</span>
              <span className="amorti-value">{amortiFirst ?? '–'}</span>
            </div>
            <div className="amorti-item">
              <span className="amorti-label">Amorti #2 (5-9)</span>
              <span className="amorti-value">{amortiSecond ?? '–'}</span>
            </div>
            <div className="amorti-item">
              <span className="amorti-label">Amorti Kazanan</span>
              <span className="amorti-value">{amortiWinners.length}</span>
            </div>
            <div className="amorti-item">
              <span className="amorti-label">Kalan Ödül</span>
              <span className="amorti-value">{remainingPot.toLocaleString('tr-TR')} TL</span>
            </div>
          </div>

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
              <strong>{soldCount}</strong>
            </div>
            <div className="info-row">
              <span>🔢 Çekilen Hane</span>
              <strong>{drawnNumbers.length}/5</strong>
            </div>
            <div className="info-row">
              <span>🎗️ Amorti #1</span>
              <strong>{amortiFirst ?? '–'}</strong>
            </div>
            <div className="info-row">
              <span>🎗️ Amorti #2</span>
              <strong>{amortiSecond ?? '–'}</strong>
            </div>
            <div className="info-row">
              <span>🏷️ Amorti Kazanan</span>
              <strong>{amortiWinners.length}</strong>
            </div>
          </div>
          {user?.isAdmin && session.status === 'active' && (
            <div className="controls-card">
              {stage === 'amorti1' && (
                <div className="controls-row">
                  <Button variant="primary" size="lg" fullWidth onClick={drawAmortiFirst} icon="🎲">
                    Amorti #1 (1-5) Çek
                  </Button>
                </div>
              )}
              {stage === 'amorti2' && (
                <>
                  {amortiSecond === null ? (
                    <div className="controls-row">
                      <Button variant="primary" size="lg" fullWidth onClick={drawAmortiSecond} icon="🎲">
                        Amorti #2 (5-9) Çek
                      </Button>
                    </div>
                  ) : (
                    <div className="controls-row">
                      <Button variant="success" size="lg" fullWidth onClick={transitionToGrandPrize} icon="✨">
                        Büyük Ödüle Geç
                      </Button>
                    </div>
                  )}
                </>
              )}
              {stage === 'grand' && (
              <div className="controls-row">
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  onClick={drawNumber}
                  disabled={drawnNumbers.length >= 5}
                  icon="🎲"
                >
                  {drawnNumbers.length >= 5 ? 'Tüm numaralar çekildi' : 'Numara Çek'}
                </Button>
              </div>
              )}
              <div className="controls-row">
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => finishSession()}
                  disabled={drawnNumbers.length === 0}
                  icon="🏁"
                >
                  Çekilişi Sonlandır
                </Button>
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
            {userTickets.map(ticket => {
              const isAmortiWin = isAmortiWinner(ticket);
              const isGrandWin = session?.winnerTicketIds?.includes(ticket.id) || false;
              return (
                <Ticket
                  key={ticket.id}
                  ticket={ticket}
                  highlightedIndices={getHighlightIndices(ticket)}
                  isAmortiWinner={isAmortiWin}
                  isGrandWinner={isGrandWin}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Rules Modal */}
      <RulesModal
        isOpen={showRulesModal}
        onClose={() => setShowRulesModal(false)}
        rules={lottery?.rules}
      />
    </div>
  );
}
