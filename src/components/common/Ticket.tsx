import { Ticket as TicketType } from '../../types';
import './Ticket.css';

interface TicketProps {
  ticket: TicketType;
  highlightedNumbers?: number[];
  highlightedIndices?: number[];
  showStatus?: boolean;
  onClick?: () => void;
  isAmortiWinner?: boolean;
  isGrandWinner?: boolean;
}

export function Ticket({ ticket, highlightedNumbers = [], highlightedIndices = [], showStatus = true, onClick, isAmortiWinner = false, isGrandWinner = false }: TicketProps) {
  const getStatusBadge = () => {
    // Önce kazanan badge'leri göster
    if (isGrandWinner) {
      return <div className="ticket-status-badge badge-grand-winner">🏆 BÜYÜK ÖDÜL!</div>;
    }
    if (isAmortiWinner) {
      return <div className="ticket-status-badge badge-amorti-winner">🎗️ AMORTİ KAZANDI</div>;
    }

    switch (ticket.status) {
      case 'requested':
        return <div className="ticket-status-badge badge-pending">Bekliyor</div>;
      case 'confirmed':
        return <div className="ticket-status-badge badge-confirmed">Onaylandı</div>;
      case 'expired':
        return <div className="ticket-status-badge badge-expired">Süresi Doldu</div>;
      default:
        return null;
    }
  };

  const isNumberHighlighted = (num: number, idx: number) =>
    highlightedNumbers.includes(num) || highlightedIndices.includes(idx);

  return (
    <div className={`ticket-container ${onClick ? 'clickable' : ''} ${isAmortiWinner ? 'amorti-winner-ticket' : ''} ${isGrandWinner ? 'grand-winner-ticket' : ''}`} onClick={onClick}>
      {/* Background image will be ticket_1_5.png */}
      <div className="ticket-background">
        <img src="/src/assets/ticket_2_5.png" alt="Lottery Ticket" />
      </div>

      {/* Serial Number (Bilet No) */}
      <div className="ticket-serial">
        <div className="serial-number">#{ticket.ticketNumber.toString().padStart(6, '0')}</div>
      </div>

      {/* Numbers */}
      <div className="ticket-numbers-overlay">
        {ticket.numbers.map((num, index) => (
          <div
            key={index}
            className={`ticket-number num-${index + 1} ${isNumberHighlighted(num, index) ? 'highlighted' : ''}`}
          >
            {num}
          </div>
        ))}
      </div>

      {/* Price */}
      <div className="ticket-price-overlay">
        {ticket.price && (
          <div className="">
            <span className="price-value">{ticket.price}</span>
            <span className="price-label">TL</span>
          </div>
        )}
      </div>

      {/* Status Badge - floating above ticket */}
      {showStatus && ticket.status !== 'available' && (
        <div className="ticket-status-container">
          {ticket.userName && (
            <div className="ticket-owner-info">
              <span className="owner-icon">👤</span>
              <span className="owner-name">{ticket.userName}</span>
            </div>
          )}
          {getStatusBadge()}
        </div>
      )}
    </div>
  );
}
