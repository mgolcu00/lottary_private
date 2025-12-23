import './RulesModal.css';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  rules?: string;
}

export function RulesModal({ isOpen, onClose, rules }: RulesModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content rules-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Çekiliş Kuralları</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {rules ? (
            <div className="rules-content">
              {rules.split('\n').map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          ) : (
            <p className="no-rules">Kurallar henüz tanımlanmamış.</p>
          )}
        </div>
      </div>
    </div>
  );
}
