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
  const [stage, setStage] = useState<'amorti1' | 'amorti2' | 'grand' | 'completed'>('grand');
  const [amortiFirst, setAmortiFirst] = useState<number | null>(null);
  const [amortiSecond, setAmortiSecond] = useState<number | null>(null);

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
        setInvalidNumber(sessionData.lastInvalidNumber ?? null);
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
        stage: 'completed',
        winnerTicketIds: winners.map(t => t.id),
        completedAt: new Date(),
        currentNumber: null,
        lastInvalidNumber: null
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

  const drawAmortiFirst = async () => {
    if (!user?.isAdmin || !session || stage !== 'amorti1') return;
    const candidate = Math.floor(Math.random() * 5) + 1; // 1-5
    setAmortiFirst(candidate);
    await updateDoc(doc(db, 'lotterySessions', session.id), {
      amortiFirstNumber: candidate,
      stage: 'amorti2',
      currentPhase: 'reveal',
      currentNumber: candidate
    });
  };

  const drawAmortiSecond = async () => {
    if (!user?.isAdmin || !session || stage !== 'amorti2') return;
    let candidate = Math.floor(Math.random() * 5) + 5; // 5-9
    if (amortiFirst !== null) {
      let attempts = 0;
      while (candidate === amortiFirst && attempts < 5) {
        candidate = Math.floor(Math.random() * 5) + 5;
        attempts++;
      }
    }
    setAmortiSecond(candidate);
    await updateDoc(doc(db, 'lotterySessions', session.id), {
      amortiSecondNumber: candidate,
      stage: 'grand',
      currentPhase: 'reveal',
      currentNumber: candidate
    });
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
  const isAdmin = !!user?.isAdmin;
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
          <button onClick={startLottery} className="start-button">
            Çekilişi Şimdi Başlat
          </button>
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

        <div className="result-header">
          <div>
            <p className="session-subtitle">{lottery.lotteryName || 'Çekiliş'}</p>
            <h1 className="session-title">Çekiliş Sonuçları</h1>
            <p className="session-date">📅 {new Date(lottery.eventDate).toLocaleString('tr-TR')}</p>
          </div>
          <div className="result-pot">
            <span>Toplam Pot</span>
            <strong>{potValue.toLocaleString('tr-TR')} TL</strong>
          </div>
        </div>

        <div className="result-grid">
          <div className="result-card">
            <h2>🏆 Büyük Ödül</h2>
            {grandWinners.length === 0 ? (
              <p>Bu çekilişte kazanan bulunamadı.</p>
            ) : (
              <div className="winner-list">
                {grandWinners.map(t => (
                  <div key={t.id} className="winner-row">
                    <div className="winner-info">
                      <span className="winner-name">{t.userName || 'İsimsiz'}</span>
                      <span className="winner-ticket">Bilet #{t.ticketNumber.toString().padStart(6, '0')}</span>
                    </div>
                    <span className="winner-amount">{remainingPot.toLocaleString('tr-TR')} TL</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="result-card">
            <h2>🎗️ Amorti Kazananlar</h2>
            <div className="amorti-summary">
              <div>Amorti #1: {amortiFirst ?? '–'}</div>
              <div>Amorti #2: {amortiSecond ?? '–'}</div>
            </div>
            {amortiWinners.length === 0 ? (
              <p>Amorti kazanan yok.</p>
            ) : (
              <div className="winner-list">
                {amortiWinners.map(t => (
                  <div key={t.id} className="winner-row">
                    <div className="winner-info">
                      <span className="winner-name">{t.userName || 'İsimsiz'}</span>
                      <span className="winner-ticket">Bilet #{t.ticketNumber.toString().padStart(6, '0')}</span>
                    </div>
                    <span className="winner-amount">{(lottery.ticketPrice || 0).toLocaleString('tr-TR')} TL</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="result-actions">
          <button className="primary-button" onClick={() => window.location.reload()}>
            Yeni Çekilişleri Gör
          </button>
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

          <div className="roller-area">
            <div className={`roller ${isDrawing ? 'spinning' : ''}`}>
              <div className="roller-inner">
                <div className="roller-number">
                  {stage === 'amorti1' && amortiFirst !== null ? amortiFirst : null}
                  {stage === 'amorti2' && amortiSecond !== null ? amortiSecond : null}
                  {stage === 'grand' || stage === 'completed' ? (currentNumber ?? '•') : null}
                  {stage === 'amorti1' && amortiFirst === null && '•'}
                  {stage === 'amorti2' && amortiSecond === null && '•'}
                </div>
                <div className="roller-glow" />
              </div>
              <div className="roller-shadow" />
            </div>
            <div className="roller-status">
              {stage === 'completed' ? (
                <span className="status-pill success">Çekiliş tamamlandı</span>
              ) : stage === 'amorti1' ? (
                <span className="status-pill info">
                  Amorti #1 (1-5) {amortiFirst !== null ? `: ${amortiFirst}` : 'çekiliyor'}
                </span>
              ) : stage === 'amorti2' ? (
                <span className="status-pill info">
                  Amorti #2 (5-9) {amortiSecond !== null ? `: ${amortiSecond}` : 'çekiliyor'}
                </span>
              ) : session.currentPhase === 'invalid' && isAdmin ? (
                <span className="status-pill danger">
                  Geçersiz numara: {invalidNumber ?? '-'} (prefix eşleşmedi)
                </span>
              ) : session.currentPhase === 'drawing' ? (
                <span className="status-pill info">Numara karıştırılıyor...</span>
              ) : (
                <span className="status-pill info">
                  Çekilen numara: {session.currentPhase === 'invalid' ? 'Hazırlanıyor' : (currentNumber ?? 'Hazırlanıyor')}
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
            {invalidNumber !== null && session.currentPhase === 'invalid' && (
              <div className="info-row danger-text">
                <span>Geçersiz</span>
                <strong>{invalidNumber}</strong>
              </div>
            )}
          </div>
          {user?.isAdmin && session.status === 'active' && (
            <div className="controls-card">
              {stage === 'amorti1' && (
                <div className="controls-row">
                  <button className="primary-button wide" onClick={drawAmortiFirst}>
                    Amorti #1 (1-5) Çek
                  </button>
                </div>
              )}
              {stage === 'amorti2' && (
                <div className="controls-row">
                  <button className="primary-button wide" onClick={drawAmortiSecond}>
                    Amorti #2 (5-9) Çek
                  </button>
                </div>
              )}
              {stage === 'grand' && (
              <div className="controls-row">
                <button
                  className="primary-button wide"
                  onClick={drawNumber}
                  disabled={drawnNumbers.length >= 5 || pendingCandidate !== null}
                >
                  {drawnNumbers.length >= 5 ? 'Tüm numaralar çekildi' : 'Numara Çek'}
                </button>
              </div>
              )}
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
