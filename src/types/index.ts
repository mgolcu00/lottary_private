export type User = {
  uid: string;
  email: string;
  username?: string;
  displayName: string;
  isAdmin?: boolean;
  termsAccepted?: boolean;
  termsAcceptedAt?: Date;
  isOver18?: boolean;
};

export type LotterySettings = {
  id: string;
  lotteryName?: string;
  rules?: string;
  disclaimerText?: string;
  eventDate: Date;
  ticketPrice: number;
  maxTickets: number;
  isActive: boolean;
  salesOpen?: boolean;
  numberRange?: '1-9' | '1-99';
  status?: 'scheduled' | 'active' | 'completed' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
};

export type Ticket = {
  id: string;
  ticketNumber: number;
  userId?: string;
  userName?: string;
  status: 'available' | 'requested' | 'confirmed' | 'expired';
  numbers: number[];
  price?: number;
  requestedAt?: Date;
  confirmedAt?: Date;
  lotteryId: string;
};

export type TicketRequest = {
  id: string;
  ticketId: string;
  ticketNumber: number;
  userId: string;
  userName: string;
  userEmail: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  lotteryId: string;
};

export type LotterySession = {
  id: string;
  lotteryId: string;
  status: 'waiting' | 'active' | 'completed';
  stage?: 'amorti1' | 'amorti2' | 'grand' | 'completed';
  currentPhase?: 'drawing' | 'invalid' | 'reveal' | 'completed';
  lastInvalidNumber?: number | null;
  drawnNumbers: number[];
  currentNumber?: number;
  winnerTicketIds: string[];
  amortiFirstNumber?: number | null;
  amortiSecondNumber?: number | null;
  startedAt?: Date;
  completedAt?: Date;
};
