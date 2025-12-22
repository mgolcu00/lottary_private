export type User = {
  uid: string;
  email: string;
  displayName: string;
  isAdmin?: boolean;
};

export type LotterySettings = {
  id: string;
  lotteryName?: string;
  eventDate: Date;
  ticketPrice: number;
  maxTickets: number;
  isActive: boolean;
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
  drawnNumbers: number[];
  currentNumber?: number;
  winnerTicketIds: string[];
  startedAt?: Date;
  completedAt?: Date;
};
