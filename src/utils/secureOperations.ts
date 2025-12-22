/**
 * Secure operations wrapper for Firebase operations
 */

import { DocumentReference, runTransaction, Firestore } from 'firebase/firestore';
import { ValidationError } from './validation';

/**
 * Error types for better error handling
 */
export class DatabaseError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class PermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermissionError';
  }
}

/**
 * Wrapper for safe async operations with proper error handling
 */
export async function safeAsync<T>(
  operation: () => Promise<T>,
  errorMessage: string = 'İşlem başarısız oldu'
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  try {
    const data = await operation();
    return { success: true, data };
  } catch (error) {
    console.error(errorMessage, error);

    if (error instanceof ValidationError || error instanceof PermissionError) {
      return { success: false, error: error.message };
    }

    if (error instanceof Error) {
      // Firebase specific errors
      if (error.message.includes('permission-denied')) {
        return { success: false, error: 'Bu işlem için yetkiniz yok' };
      }

      if (error.message.includes('not-found')) {
        return { success: false, error: 'Kayıt bulunamadı' };
      }

      if (error.message.includes('already-exists')) {
        return { success: false, error: 'Bu kayıt zaten mevcut' };
      }

      return { success: false, error: error.message };
    }

    return { success: false, error: errorMessage };
  }
}

/**
 * Secure ticket purchase with transaction to prevent race conditions
 */
export async function secureTicketPurchase(
  db: Firestore,
  ticketRef: DocumentReference,
  userId: string,
  userName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await runTransaction(db, async (transaction) => {
      const ticketDoc = await transaction.get(ticketRef);

      if (!ticketDoc.exists()) {
        throw new DatabaseError('Bilet bulunamadı');
      }

      const ticket = ticketDoc.data();

      // Verify ticket is still available
      if (ticket.status !== 'available') {
        throw new ValidationError('Bu bilet artık mevcut değil');
      }

      // Check if already requested
      if (ticket.userId) {
        throw new ValidationError('Bu bilet başka bir kullanıcı tarafından talep edilmiş');
      }

      // Update ticket atomically
      transaction.update(ticketRef, {
        status: 'requested',
        userId: userId,
        userName: userName,
        requestedAt: new Date()
      });
    });

    return { success: true };
  } catch (error) {
    if (error instanceof ValidationError || error instanceof DatabaseError) {
      return { success: false, error: error.message };
    }

    console.error('Ticket purchase error:', error);
    return { success: false, error: 'Bilet satın alınamadı. Lütfen tekrar deneyin.' };
  }
}

/**
 * Retry logic for operations that might fail temporarily
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry validation or permission errors
      if (error instanceof ValidationError || error instanceof PermissionError) {
        throw error;
      }

      // Wait before retry (exponential backoff)
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs * Math.pow(2, i)));
      }
    }
  }

  throw lastError || new Error('Operation failed after retries');
}

/**
 * Debounce function to prevent rapid repeated calls
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  waitMs: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      func(...args);
    }, waitMs);
  };
}

/**
 * Throttle function to limit call frequency
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limitMs: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;

  return (...args: Parameters<T>) => {
    const now = Date.now();

    if (now - lastCall >= limitMs) {
      lastCall = now;
      func(...args);
    }
  };
}

/**
 * Sanitize Firestore data before saving
 */
export function sanitizeFirestoreData(data: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(data)) {
    // Skip undefined values (Firestore doesn't allow them)
    if (value === undefined) {
      continue;
    }

    // Sanitize strings
    if (typeof value === 'string') {
      sanitized[key] = value.trim().substring(0, 10000); // Limit string length
    }
    // Validate numbers
    else if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        console.warn(`Invalid number for field ${key}, skipping`);
        continue;
      }
      sanitized[key] = value;
    }
    // Pass through safe types
    else if (
      typeof value === 'boolean' ||
      value instanceof Date ||
      value === null
    ) {
      sanitized[key] = value;
    }
    // Handle arrays
    else if (Array.isArray(value)) {
      sanitized[key] = value.slice(0, 1000); // Limit array length
    }
    // Handle objects recursively
    else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeFirestoreData(value);
    }
  }

  return sanitized;
}
