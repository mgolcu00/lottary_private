import { useEffect } from 'react';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

interface UsePresenceTrackingParams {
  lotteryId?: string;
  userId?: string;
  userName?: string;
}

export function usePresenceTracking({ lotteryId, userId, userName }: UsePresenceTrackingParams) {
  useEffect(() => {
    if (!lotteryId || !userId) return;

    const presenceRef = doc(db, 'lotteryPresence', `${lotteryId}_${userId}`);
    let presenceInterval: ReturnType<typeof setInterval> | null = null;
    let isMounted = true;

    // Set presence
    const setPresence = async () => {
      if (!isMounted) return;
      try {
        await setDoc(presenceRef, {
          userId,
          userName,
          lotteryId,
          timestamp: new Date()
        });
      } catch (error) {
        console.error('Presence update failed:', error);
      }
    };

    // Initial presence set
    setPresence();

    // Update presence every 30 seconds
    presenceInterval = setInterval(setPresence, 30000);

    // Cleanup on unmount
    return () => {
      isMounted = false;
      if (presenceInterval) {
        clearInterval(presenceInterval);
      }
      deleteDoc(presenceRef).catch(() => {
        // Ignore errors on cleanup
      });
    };
  }, [lotteryId, userId, userName]);
}
