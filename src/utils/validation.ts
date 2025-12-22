/**
 * Validation utilities for input sanitization and security
 */

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validates email format
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Sanitizes user input by removing potentially dangerous characters
 */
export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove HTML tags
    .substring(0, 1000); // Limit length
}

/**
 * Validates lottery name
 */
export function validateLotteryName(name: string): void {
  const sanitized = sanitizeInput(name);

  if (!sanitized || sanitized.length < 3) {
    throw new ValidationError('Çekiliş adı en az 3 karakter olmalıdır');
  }

  if (sanitized.length > 100) {
    throw new ValidationError('Çekiliş adı en fazla 100 karakter olabilir');
  }
}

/**
 * Validates lottery settings
 */
export function validateLotterySettings(settings: {
  lotteryName?: string;
  ticketPrice?: number;
  grandPrize?: number;
  amortiPrize?: number;
  totalTickets?: number;
  drawDate?: Date;
}): void {
  if (settings.lotteryName) {
    validateLotteryName(settings.lotteryName);
  }

  if (settings.ticketPrice !== undefined) {
    if (settings.ticketPrice < 0 || settings.ticketPrice > 1000000) {
      throw new ValidationError('Bilet fiyatı 0 ile 1,000,000 arasında olmalıdır');
    }
  }

  if (settings.grandPrize !== undefined) {
    if (settings.grandPrize < 0 || settings.grandPrize > 100000000) {
      throw new ValidationError('Büyük ödül tutarı geçersiz');
    }
  }

  if (settings.amortiPrize !== undefined) {
    if (settings.amortiPrize < 0 || settings.amortiPrize > 10000000) {
      throw new ValidationError('Amorti ödül tutarı geçersiz');
    }
  }

  if (settings.totalTickets !== undefined) {
    if (settings.totalTickets < 1 || settings.totalTickets > 100000) {
      throw new ValidationError('Bilet sayısı 1 ile 100,000 arasında olmalıdır');
    }
  }

  if (settings.drawDate) {
    const now = new Date();
    const drawDate = new Date(settings.drawDate);

    if (drawDate <= now) {
      throw new ValidationError('Çekiliş tarihi gelecekte olmalıdır');
    }

    // Max 1 year in future
    const oneYearLater = new Date();
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);

    if (drawDate > oneYearLater) {
      throw new ValidationError('Çekiliş tarihi en fazla 1 yıl sonra olabilir');
    }
  }
}

/**
 * Validates ticket numbers
 */
export function validateTicketNumbers(numbers: number[]): void {
  if (!Array.isArray(numbers)) {
    throw new ValidationError('Bilet numaraları geçersiz format');
  }

  if (numbers.length !== 5) {
    throw new ValidationError('Bilet tam olarak 5 numara içermelidir');
  }

  for (const num of numbers) {
    if (!Number.isInteger(num) || num < 1 || num > 9) {
      throw new ValidationError('Bilet numaraları 1-9 arası tam sayılar olmalıdır');
    }
  }

  // Check for duplicates
  const uniqueNumbers = new Set(numbers);
  if (uniqueNumbers.size !== numbers.length) {
    throw new ValidationError('Bilet numaraları tekrar edemez');
  }
}

/**
 * Rate limiting helper - tracks requests per user
 */
class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests: number = 10, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  /**
   * Checks if request is allowed for given key (e.g., user ID)
   */
  isAllowed(key: string): boolean {
    const now = Date.now();
    const requests = this.requests.get(key) || [];

    // Remove old requests outside window
    const recentRequests = requests.filter(time => now - time < this.windowMs);

    if (recentRequests.length >= this.maxRequests) {
      return false;
    }

    recentRequests.push(now);
    this.requests.set(key, recentRequests);

    return true;
  }

  /**
   * Clear rate limit for a key
   */
  clear(key: string): void {
    this.requests.delete(key);
  }
}

// Global rate limiters
export const ticketRequestLimiter = new RateLimiter(5, 60000); // 5 requests per minute
export const lotteryCreationLimiter = new RateLimiter(3, 300000); // 3 lotteries per 5 minutes

/**
 * Validates user permissions
 */
export function validateAdminPermission(isAdmin: boolean | undefined): void {
  if (!isAdmin) {
    throw new ValidationError('Bu işlem için yönetici yetkisi gereklidir');
  }
}

/**
 * Validates lottery state for operations
 */
export function validateLotteryState(
  status: string,
  allowedStates: string[]
): void {
  if (!allowedStates.includes(status)) {
    throw new ValidationError(`Bu işlem şu anki çekiliş durumunda yapılamaz (${status})`);
  }
}
