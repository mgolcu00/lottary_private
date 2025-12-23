import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Ticket as TicketType, LotterySettings, LotterySession as LotterySessionType } from '../../types';
import { Ticket } from '../common/Ticket';
import { Button } from '../common/Button';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { toDateSafe } from '../../utils/date';
import { usePresenceTracking } from '../../hooks/usePresenceTracking';
import './LotterySessionV2.css';

// Motivasyon sözleri - lobby için
const LOTTERY_QUOTES = [
  "🍀 Şans kapıyı çaldığında hazır olun!",
  "✨ Her bilet bir umut, her çekiliş bir fırsat!",
  "🎰 Bugün senin şanslı günün olabilir!",
  "💫 Hayal kurmak ücretsiz, kazanmak paha biçilemez!",
  "🌟 Şansınız yaver gitsin!",
  "🎲 Büyük ödül sizi bekliyor!",
  "🎊 Kazananlar arasında yerinizi alın!",
  "🏆 Hayalleriniz gerçek olabilir!",
  "💰 Büyük kazanç kapıda!",
  "🎯 Hedef büyük ödül!"
];

export function LotterySessionV2() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const lotteryId = searchParams.get('lotteryId');

  const [lottery, setLottery] = useState<LotterySettings | null>(null);
  const [session, setSession] = useState<LotterySessionType | null>(null);
  const [userTickets, setUserTickets] = useState<TicketType[]>([]);
  const [allTickets, setAllTickets] = useState<TicketType[]>([]);
  const [drawnNumbers, setDrawnNumbers] = useState<number[]>([]);
  const [_currentNumber, setCurrentNumber] = useState<number | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [stage, setStage] = useState<'amorti1' | 'amorti2' | 'grand' | 'completed'>('grand');
  const [amortiFirst, setAmortiFirst] = useState<number | null>(null);
  const [amortiSecond, setAmortiSecond] = useState<number | null>(null);
  const [currentQuote, setCurrentQuote] = useState(0);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);

  // Presence tracking
  usePresenceTracking({
    lotteryId: lottery?.id,
    userId: user?.uid,
    userName: user?.displayName
  });

  // Rotating quotes for lobby
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentQuote(prev => (prev + 1) % LOTTERY_QUOTES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Lottery listener
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

  // Session listener
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
        setStage(sessionData.stage || (sessionData.status === 'completed' ? 'completed' : 'grand'));
        setAmortiFirst(sessionData.amortiFirstNumber ?? null);
        setAmortiSecond(sessionData.amortiSecondNumber ?? null);

        // Sync wheel rotation for all users
        if (sessionData.wheelRotation !== undefined) {
          setWheelRotation(sessionData.wheelRotation);
        }

        // Sync spinning state
        if (sessionData.currentPhase === 'drawing') {
          setIsSpinning(true);
        } else if (sessionData.currentPhase === 'reveal' || sessionData.currentPhase === 'completed') {
          setIsSpinning(false);
        }
      }
    });

    return unsubscribe;
  }, [lottery]);

  // User tickets listener
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

  // All tickets listener
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
    });

    return unsubscribe;
  }, [lottery]);

  const getSmartNumber = (currentSequence: number[]): number => {
    const confirmedTickets = allTickets.filter(t => t.status === 'confirmed');

    if (confirmedTickets.length === 0) {
      return Math.floor(Math.random() * 9) + 1;
    }

    const matchingTickets = confirmedTickets.filter(ticket =>
      currentSequence.every((num, idx) => ticket.numbers[idx] === num)
    );

    if (matchingTickets.length === 0) {
      console.warn('No matching tickets found! Drawing random number.');
      return Math.floor(Math.random() * 9) + 1;
    }

    const nextPosition = currentSequence.length;
    const possibleNumbers = matchingTickets.map(ticket => ticket.numbers[nextPosition]);

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
      await updateDoc(doc(db, 'lotterySessions', sessionId), {
        status: 'completed',
        currentPhase: 'completed',
        stage: 'completed',
        winnerTicketIds: findWinners(nextDrawn).map(t => t.id),
        completedAt: new Date(),
        currentNumber: null
      });
      setIsDrawing(false);
    }
  };

  const drawNumber = async () => {
    if (!user?.isAdmin || !session || session.status !== 'active' || stage !== 'grand') return;
    if (drawnNumbers.length >= 5 || isDrawing) return;

    setIsDrawing(true);
    setIsSpinning(true);
    setCurrentNumber(null);

    // Update phase to 'drawing' in DB
    await updateDoc(doc(db, 'lotterySessions', session.id), {
      currentPhase: 'drawing'
    });

    // Smart algorithm: select number
    const candidate = getSmartNumber(drawnNumbers);

    // Calculate rotation - pointer at left (180deg), gradient from 0deg
    const baseRotation = wheelRotation;
    const currentWheelAngle = baseRotation % 360;
    const numberInitialPosition = (candidate - 1) * 40 + 20 -90; // +90 for correct alignment
    const currentNumberAngle = (numberInitialPosition + currentWheelAngle) % 360;
    const rotationNeeded = ((180 - currentNumberAngle + 360) % 360);
    const fullSpins = 10 + Math.floor(Math.random() * 5);
    const targetRotation = baseRotation + 360 * fullSpins + rotationNeeded;

    // Save rotation to Firestore for realtime sync
    await updateDoc(doc(db, 'lotterySessions', session.id), {
      wheelRotation: targetRotation,
      currentPhase: 'drawing'
    });

    setWheelRotation(targetRotation);

    // Wait for wheel to spin (12 seconds for ultra-smooth deceleration)
    await new Promise(resolve => setTimeout(resolve, 12000));
    setIsSpinning(false);

    // Accept number and update (no center animation, just update slot)
    await updateDoc(doc(db, 'lotterySessions', session.id), {
      currentPhase: 'reveal',
      currentNumber: candidate,
      drawnNumbers
    });

    await acceptNumber(session.id, candidate, drawnNumbers);

    // Small delay before allowing next draw
    await new Promise(resolve => setTimeout(resolve, 800));

    setIsDrawing(false);
  };

  const drawAmortiFirst = async () => {
    if (!user?.isAdmin || !session || stage !== 'amorti1' || isDrawing) return;

    setIsDrawing(true);
    setIsSpinning(true);
    setCurrentNumber(null);

    await updateDoc(doc(db, 'lotterySessions', session.id), {
      currentPhase: 'drawing'
    });

    const candidate = Math.floor(Math.random() * 3) + 1; // 1-3

    // Calculate rotation - pointer at left (180deg)
    const baseRotation = wheelRotation;
    const currentWheelAngle = baseRotation % 360;
    const numberInitialPosition = (candidate - 1) * 40 + 20 - 90; // +90 for correct alignment
    const currentNumberAngle = (numberInitialPosition + currentWheelAngle) % 360;
    const rotationNeeded = ((180 - currentNumberAngle + 360) % 360);
    const fullSpins = 8 + Math.floor(Math.random() * 4);
    const targetRotation = baseRotation + 360 * fullSpins + rotationNeeded;

    // Save rotation to Firestore for realtime sync
    await updateDoc(doc(db, 'lotterySessions', session.id), {
      wheelRotation: targetRotation,
      currentPhase: 'drawing'
    });

    setWheelRotation(targetRotation);

    await new Promise(resolve => setTimeout(resolve, 10000));
    setIsSpinning(false);

    setAmortiFirst(candidate);

    await updateDoc(doc(db, 'lotterySessions', session.id), {
      amortiFirstNumber: candidate,
      stage: 'amorti2',
      currentPhase: 'reveal',
      currentNumber: candidate
    });

    await new Promise(resolve => setTimeout(resolve, 800));
    setIsDrawing(false);
  };

  const drawAmortiSecond = async () => {
    if (!user?.isAdmin || !session || stage !== 'amorti2' || isDrawing) return;

    setIsDrawing(true);
    setIsSpinning(true);
    setCurrentNumber(null);

    await updateDoc(doc(db, 'lotterySessions', session.id), {
      currentPhase: 'drawing'
    });

    let candidate = Math.floor(Math.random() * 3) + 7; // 7-9

    // Calculate rotation - pointer at left (180deg)
    const baseRotation = wheelRotation;
    const currentWheelAngle = baseRotation % 360;
    const numberInitialPosition = (candidate - 1) * 40 + 20 - 90; // +90 for correct alignment
    const currentNumberAngle = (numberInitialPosition + currentWheelAngle) % 360;
    const rotationNeeded = ((180 - currentNumberAngle + 360) % 360);
    const fullSpins = 8 + Math.floor(Math.random() * 4);
    const targetRotation = baseRotation + 360 * fullSpins + rotationNeeded;

    // Save rotation to Firestore for realtime sync
    await updateDoc(doc(db, 'lotterySessions', session.id), {
      wheelRotation: targetRotation,
      currentPhase: 'drawing'
    });

    setWheelRotation(targetRotation);

    await new Promise(resolve => setTimeout(resolve, 10000));
    setIsSpinning(false);

    setAmortiSecond(candidate);

    await updateDoc(doc(db, 'lotterySessions', session.id), {
      amortiSecondNumber: candidate,
      currentPhase: 'reveal',
      currentNumber: candidate
    });

    await new Promise(resolve => setTimeout(resolve, 800));
    setIsDrawing(false);
  };

  const transitionToGrandPrize = async () => {
    if (!user?.isAdmin || !session || stage !== 'amorti2') return;

    await updateDoc(doc(db, 'lotterySessions', session.id), {
      stage: 'grand',
      currentPhase: 'drawing',
      currentNumber: null,
      drawnNumbers: []
    });

    setDrawnNumbers([]);
    setCurrentNumber(null);
  };

  const findWinners = (drawnNumbers: number[]): TicketType[] => {
    const confirmedTickets = allTickets.filter(t => t.status === 'confirmed');
    if (confirmedTickets.length === 0) return [];

    return confirmedTickets.filter(ticket =>
      drawnNumbers.every((num, idx) => ticket.numbers[idx] === num)
    );
  };

  const startLottery = async () => {
    if (!lottery || !user?.isAdmin) return;

    try {
      await addDoc(collection(db, 'lotterySessions'), {
        lotteryId: lottery.id,
        status: 'active',
        currentPhase: 'start',
        stage: 'amorti1',
        lastInvalidNumber: null,
        drawnNumbers: [],
        winnerTicketIds: [],
        amortiFirstNumber: null,
        amortiSecondNumber: null,
        wheelRotation: 0,
        startedAt: new Date()
      });
    } catch (error) {
      console.error('Error starting lottery:', error);
    }
  };

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

  if (!lottery) {
    return <div className="lottery-v2">Çekiliş bulunamadı</div>;
  }

  const soldCount = allTickets.filter(t => t.status === 'confirmed').length;
  const potValue = soldCount * (lottery.ticketPrice || 0);
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

  // LOBBY / WAITING SCREEN
  if (!session && !user?.isAdmin) {
    return (
      <div className="lottery-v2 lottery-v2--lobby">
        <div className="lobby">
          <div className="lobby__icon">🎰</div>
          <h1 className="lobby__title">Çekiliş Lobisi</h1>
          <div className="lobby__quote">
            {LOTTERY_QUOTES[currentQuote]}
          </div>
          <div className="lobby__stats">
            <div className="lobby__stat">
              <span className="lobby__stat-value">{soldCount}</span>
              <span className="lobby__stat-label">Katılımcı</span>
            </div>
            <div className="lobby__stat">
              <span className="lobby__stat-value">{potValue.toLocaleString('tr-TR')} TL</span>
              <span className="lobby__stat-label">Ödül Havuzu</span>
            </div>
          </div>
          <div className="lobby__message">
            Admin çekilişi başlattığında otomatik olarak başlayacak
          </div>
        </div>
      </div>
    );
  }

  // ADMIN START SCREEN
  if (!session && user?.isAdmin) {
    return (
      <div className="lottery-v2">
        <div className="lottery-v2__start">
          <h1>Çekilişi Başlat</h1>
          <div className="lobby__stats">
            <div className="lobby__stat">
              <span className="lobby__stat-value">{soldCount}</span>
              <span className="lobby__stat-label">Katılımcı</span>
            </div>
            <div className="lobby__stat">
              <span className="lobby__stat-value">{potValue.toLocaleString('tr-TR')} TL</span>
              <span className="lobby__stat-label">Ödül Havuzu</span>
            </div>
          </div>
          <Button variant="primary" size="lg" onClick={startLottery} icon="🎊">
            Çekilişi Başlat
          </Button>
        </div>
      </div>
    );
  }

  // COMPLETED / RESULTS SCREEN
  if (session?.status === 'completed') {
    return (
      <div className="lottery-v2 lottery-v2--results">
        <div className="results">
          <div className="results__header">
            <h1 className="results__title">🎄 Çekiliş Tamamlandı! 🎄</h1>
            <p className="results__subtitle">{lottery.lotteryName || 'Çekiliş'}</p>
          </div>

          {/* Grand Prize Winner */}
          <div className="results__grand">
            <div className="results__section-title">
              <span>🏆</span>
              <h2>BÜYÜK ÖDÜL KAZANANI</h2>
              <span>🏆</span>
            </div>

            {grandWinners.length === 0 ? (
              <div className="results__no-winner">
                <p>Bu çekilişte büyük ödülü kazanan olmadı</p>
                <p className="results__no-winner-sub">Pot bir sonraki çekilişe devredildi</p>
              </div>
            ) : (
              <div className="results__winner">
                <div className="results__winner-ticket">
                  {grandWinners.map(t => (
                    <Ticket key={t.id} ticket={t} isGrandWinner={true} showStatus={false} highlightedIndices={[0, 1, 2, 3, 4]} />
                  ))}
                </div>
                <div className="results__winner-info">
                  {grandWinners.map(t => (
                    <div key={t.id} className="results__winner-badge">
                      <span className="results__winner-name">{t.userName || 'İsimsiz'}</span>
                      <span className="results__winner-amount">{remainingPot.toLocaleString('tr-TR')} TL</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Amorti Winners */}
          {amortiWinners.length > 0 && (
            <div className="results__amorti">
              <div className="results__section-title results__section-title--amorti">
                <span>🎗️</span>
                <h2>AMORTİ KAZANANLAR</h2>
                <span>🎗️</span>
              </div>

              <div className="results__amorti-numbers">
                <div className="results__amorti-num">Amorti #1: <strong>{amortiFirst}</strong></div>
                <div className="results__amorti-num">Amorti #2: <strong>{amortiSecond}</strong></div>
              </div>

              <div className="results__amorti-grid">
                {amortiWinners.map(t => (
                  <div key={t.id} className="results__amorti-card">
                    <Ticket ticket={t} isAmortiWinner={true} showStatus={false} />
                    <div className="results__amorti-prize">{(lottery.ticketPrice || 0).toLocaleString('tr-TR')} TL</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="results__footer">
            <Button variant="primary" size="lg" onClick={() => navigate('/')} icon="🏠">
              Anasayfaya Dön
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // DRAWING SCREEN
  return (
    <div className="lottery-v2">
      {/* Fortune Wheel */}
      <div className="wheel-container">
        <div className="wheel-pointer">▼</div>
        <div
          className={`wheel ${isSpinning ? 'wheel--spinning' : ''}`}
          style={{ transform: `rotate(${wheelRotation}deg)` }}
        >
          {Array.from({ length: 9 }).map((_, i) => {
            const number = i + 1;
            // Position number at center of its segment (each segment is 40deg wide)
            // Segment i starts at i*40deg, center is at i*40 + 20deg
            const segmentRotation = i * 40 + 20;
            return (
              <div
                key={number}
                className="wheel__segment"
                style={{ transform: `rotate(${segmentRotation}deg)` }}
              >
                <span
                  className="wheel__number"
                  style={{
                    position: 'absolute',
                    top: '30px',
                    left: '50%',
                    transform: `translateX(-50%) rotate(-${segmentRotation}deg)`
                  }}
                >
                  {number}
                </span>
              </div>
            );
          })}
          <div className="wheel__center">
            <span className="wheel__center-icon">🎰</span>
          </div>
        </div>
      </div>

      {/* Slots */}
      <div className="lottery-v2__slots">
        {(stage === 'amorti1' || stage === 'amorti2') ? (
          <>
            <div className="lottery-v2__slot">
              <div className="lottery-v2__slot-label">Amorti #1</div>
              <div className="lottery-v2__slot-value">
                {amortiFirst !== null ? amortiFirst : '?'}
              </div>
            </div>
            <div className="lottery-v2__slot">
              <div className="lottery-v2__slot-label">Amorti #2</div>
              <div className="lottery-v2__slot-value">
                {amortiSecond !== null ? amortiSecond : '?'}
              </div>
            </div>
          </>
        ) : (
          <>
            {Array.from({ length: 5 }).map((_, idx) => (
              <div key={idx} className="lottery-v2__slot">
                <div className="lottery-v2__slot-label">#{idx + 1}</div>
                <div className="lottery-v2__slot-value">
                  {drawnNumbers[idx] !== undefined ? drawnNumbers[idx] : '?'}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Amorti Info */}
      {amortiReady && stage === 'grand' && (
        <div className="lottery-v2__amorti-info">
          <span>🎗️ Amorti Kazanan: {amortiWinners.length}</span>
          <span>💰 Büyük Ödül: {remainingPot.toLocaleString('tr-TR')} TL</span>
        </div>
      )}

      {/* Admin Controls */}
      {user?.isAdmin && session && session.status === 'active' && (
        <div className="lottery-v2__controls">
          {stage === 'amorti1' && (
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={drawAmortiFirst}
              icon="🎲"
              loading={isDrawing}
              disabled={isDrawing}
            >
              Amorti #1 Çek (1-3)
            </Button>
          )}
          {stage === 'amorti2' && !amortiSecond && (
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={drawAmortiSecond}
              icon="🎲"
              loading={isDrawing}
              disabled={isDrawing}
            >
              Amorti #2 Çek (7-9)
            </Button>
          )}
          {stage === 'amorti2' && amortiSecond && (
            <Button
              variant="success"
              size="lg"
              fullWidth
              onClick={transitionToGrandPrize}
              icon="✨"
              disabled={isDrawing}
            >
              Büyük Ödüle Geç
            </Button>
          )}
          {stage === 'grand' && (
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={drawNumber}
              disabled={drawnNumbers.length >= 5 || isDrawing}
              loading={isDrawing}
              icon="🎲"
            >
              {drawnNumbers.length >= 5 ? 'Tüm Numaralar Çekildi' : 'Numara Çek'}
            </Button>
          )}
        </div>
      )}

      {/* User Tickets */}
      {userTickets.length > 0 && (
        <div className="lottery-v2__tickets">
          <h3>Biletlerim</h3>
          <div className="lottery-v2__tickets-grid">
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
    </div>
  );
}
