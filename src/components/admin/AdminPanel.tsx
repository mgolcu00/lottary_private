import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, writeBatch } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { LotterySettings, TicketRequest, Ticket, User } from '../../types';
import { toDateSafe } from '../../utils/date';
import './AdminPanel.css';

type TabType = 'dashboard' | 'requests' | 'users' | 'tickets' | 'settings';

export function AdminPanel() {
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [allLotteries, setAllLotteries] = useState<LotterySettings[]>([]);
  const [lottery, setLottery] = useState<LotterySettings | null>(null);
  const [ticketRequests, setTicketRequests] = useState<TicketRequest[]>([]);
  const [allTickets, setAllTickets] = useState<Ticket[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [requestSearch, setRequestSearch] = useState('');
  const [requestStatus, setRequestStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [requestUser, setRequestUser] = useState<'all' | string>('all');
  const [rulesDraft, setRulesDraft] = useState('');
  const [formData, setFormData] = useState({
    eventDate: '',
    ticketPrice: 50,
    maxTickets: 1000,
    lotteryName: ''
  });

  // Statistics
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalTickets: 0,
    soldTickets: 0,
    availableTickets: 0,
    pendingRequests: 0,
    totalRevenue: 0
  });

  // Tüm çekilişleri dinle
  useEffect(() => {
    const lotteriesQuery = collection(db, 'lotteries');

    const unsubscribe = onSnapshot(lotteriesQuery, (snapshot) => {
      const lotteries = snapshot.docs.map(doc => {
        const data = doc.data() as LotterySettings;
        return {
          ...data,
          id: doc.id,
          eventDate: toDateSafe(data.eventDate),
          createdAt: toDateSafe(data.createdAt),
          updatedAt: toDateSafe(data.updatedAt),
          salesOpen: data.salesOpen ?? true,
          status: data.status ?? (data.isActive ? 'active' : 'scheduled')
        } as LotterySettings;
      }).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      setAllLotteries(lotteries);

      // İlk çekilişi varsayılan olarak seç veya daha önce seçili olanı koru
      if (lotteries.length > 0 && !lottery) {
        // Aktif bir çekiliş varsa onu seç, yoksa en yeniyi seç
        const activeLottery = lotteries.find(l => l.isActive);
        const next = activeLottery || lotteries[0];
        setLottery(next);
        setRulesDraft(next.rules || '');
      } else if (lotteries.length === 0) {
        setLottery(null);
        setShowCreateForm(true);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!lottery) return;
    setRulesDraft(lottery.rules || '');

    const requestsQuery = query(
      collection(db, 'ticketRequests'),
      where('lotteryId', '==', lottery.id)
    );

    const unsubscribe = onSnapshot(requestsQuery, (snapshot) => {
      const requests = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        createdAt: toDateSafe(doc.data().createdAt)
      } as TicketRequest));
      setTicketRequests(requests.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
    });

    return unsubscribe;
  }, [lottery]);

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
      } as Ticket));
      setAllTickets(tickets);

      // Calculate stats
      const sold = tickets.filter(t => t.status === 'confirmed').length;
      const available = tickets.filter(t => t.status === 'available').length;

      setStats(prev => ({
        ...prev,
        totalTickets: tickets.length,
        soldTickets: sold,
        availableTickets: available,
        totalRevenue: sold * (lottery?.ticketPrice || 0)
      }));
    });

    return unsubscribe;
  }, [lottery]);

  useEffect(() => {
    const usersQuery = collection(db, 'users');

    const unsubscribe = onSnapshot(usersQuery, (snapshot) => {
      const users = snapshot.docs.map(doc => ({
        ...doc.data(),
        uid: doc.id
      } as User));
      setAllUsers(users);
      setStats(prev => ({ ...prev, totalUsers: users.length }));
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const pendingCount = ticketRequests.filter(r => r.status === 'pending').length;
    setStats(prev => ({ ...prev, pendingRequests: pendingCount }));
  }, [ticketRequests]);

  const statusCounts = {
    all: ticketRequests.length,
    pending: ticketRequests.filter(r => r.status === 'pending').length,
    approved: ticketRequests.filter(r => r.status === 'approved').length,
    rejected: ticketRequests.filter(r => r.status === 'rejected').length
  };

  const uniqueRequestUsers = Array.from(
    new Map(ticketRequests.map(r => [r.userId, r.userName || r.userEmail || ''])).entries()
  ).map(([uid, name]) => ({ uid, name: name || 'İsimsiz' }))
    .sort((a, b) => a.name.localeCompare(b.name, 'tr'));

  const filteredRequests = ticketRequests
    .filter(req => requestStatus === 'all' ? true : req.status === requestStatus)
    .filter(req => requestUser === 'all' ? true : req.userId === requestUser)
    .filter(req => {
      if (!requestSearch.trim()) return true;
      const term = requestSearch.toLowerCase();
      return (req.userName && req.userName.toLowerCase().includes(term)) ||
        (req.userEmail && req.userEmail.toLowerCase().includes(term)) ||
        req.ticketNumber.toString().padStart(3, '0').includes(term) ||
        req.ticketId.toLowerCase().includes(term);
    });

  const generateTickets = async (lotteryId: string, maxTickets: number) => {
    const tickets: any[] = [];
    const generatedCombinations = new Set<string>();

    for (let i = 1; i <= maxTickets; i++) {
      // Generate unique 5-digit number combination (digits 1-9)
      let numbers: number[];
      let combination: string;

      do {
        numbers = Array.from({ length: 5 }, () => Math.floor(Math.random() * 9) + 1);
        combination = numbers.join('');
      } while (generatedCombinations.has(combination));

      generatedCombinations.add(combination);

      tickets.push({
        ticketNumber: i,
        lotteryId,
        status: 'available',
        numbers
      });
    }

    const batch = writeBatch(db);
    tickets.forEach(ticket => {
      const ticketRef = doc(collection(db, 'tickets'));
      batch.set(ticketRef, ticket);
    });
    await batch.commit();
  };

  const handleCreateLottery = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const lotteryRef = await addDoc(collection(db, 'lotteries'), {
        lotteryName: formData.lotteryName || `Çekiliş ${new Date().toLocaleDateString('tr-TR')}`,
        eventDate: new Date(formData.eventDate),
        ticketPrice: formData.ticketPrice,
        maxTickets: formData.maxTickets,
        isActive: true,
        rules: 'Çekiliş kurallarını buradan güncelleyin.',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await generateTickets(lotteryRef.id, formData.maxTickets);

      setShowCreateForm(false);
      const resetForm = {
        eventDate: '',
        ticketPrice: 50,
        maxTickets: 1000,
        lotteryName: ''
      };
      setFormData(resetForm);
      setRulesDraft('Çekiliş kurallarını buradan güncelleyin.');
      alert('Çekiliş başarıyla oluşturuldu!');
    } catch (error) {
      console.error('Error creating lottery:', error);
      alert('Çekiliş oluşturulamadı. Lütfen tekrar deneyin.');
    }
  };

  const handleApproveRequest = async (request: TicketRequest) => {
    try {
      await updateDoc(doc(db, 'ticketRequests', request.id), {
        status: 'approved'
      });

      await updateDoc(doc(db, 'tickets', request.ticketId), {
        status: 'confirmed',
        confirmedAt: new Date()
      });

    } catch (error) {
      console.error('Error approving request:', error);
      alert('İstek onaylanamadı. Lütfen tekrar deneyin.');
    }
  };

  const handleRejectRequest = async (request: TicketRequest) => {
    try {
      await updateDoc(doc(db, 'ticketRequests', request.id), {
        status: 'rejected'
      });

      await updateDoc(doc(db, 'tickets', request.ticketId), {
        status: 'available',
        userId: null,
        userName: null,
        requestedAt: null
      });

      alert('Bilet isteği reddedildi.');
    } catch (error) {
      console.error('Error rejecting request:', error);
      alert('İstek reddedilemedi. Lütfen tekrar deneyin.');
    }
  };

  const handleToggleAdmin = async (targetUser: User) => {
    if (!confirm(`${targetUser.displayName} kullanıcısını ${targetUser.isAdmin ? 'admin olmaktan çıkar' : 'admin yap'}?`)) {
      return;
    }

    try {
      await updateDoc(doc(db, 'users', targetUser.uid), {
        isAdmin: !targetUser.isAdmin
      });
      alert('Kullanıcı yetkisi güncellendi!');
    } catch (error) {
      console.error('Error updating user:', error);
      alert('Kullanıcı güncellenemedi.');
    }
  };

  const handleSaveRules = async () => {
    if (!lottery) return;
    try {
      await updateDoc(doc(db, 'lotteries', lottery.id), {
        rules: rulesDraft,
        updatedAt: new Date()
      });
      alert('Kurallar güncellendi.');
    } catch (error) {
      console.error('Error updating rules:', error);
      alert('Kurallar kaydedilemedi.');
    }
  };

  const toggleSales = async () => {
    if (!lottery) return;
    try {
      await updateDoc(doc(db, 'lotteries', lottery.id), {
        salesOpen: !(lottery.salesOpen ?? true),
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error toggling sales:', error);
      alert('Satış durumu güncellenemedi.');
    }
  };

  const startNow = async () => {
    if (!lottery) return;
    try {
      await updateDoc(doc(db, 'lotteries', lottery.id), {
        eventDate: new Date(),
        status: 'active',
        isActive: true,
        updatedAt: new Date()
      });
      alert('Çekiliş tarihi şimdi olarak güncellendi.');
    } catch (error) {
      console.error('Error starting now:', error);
      alert('Çekiliş başlatılamadı.');
    }
  };

  const endLottery = async () => {
    if (!lottery) return;
    if (!confirm('Çekilişi sonlandırmak istediğine emin misin?')) return;
    try {
      await updateDoc(doc(db, 'lotteries', lottery.id), {
        status: 'completed',
        isActive: false,
        salesOpen: false,
        updatedAt: new Date()
      });
      alert('Çekiliş sonlandırıldı.');
    } catch (error) {
      console.error('Error ending lottery:', error);
      alert('Çekiliş sonlandırılamadı.');
    }
  };

  const deactivateLottery = async () => {
    if (!lottery) return;
    if (!confirm('Çekilişi pasif hale getirmek istediğine emin misin?')) return;
    try {
      await updateDoc(doc(db, 'lotteries', lottery.id), {
        isActive: false,
        salesOpen: false,
        status: 'cancelled',
        updatedAt: new Date()
      });
      alert('Çekiliş pasif yapıldı.');
    } catch (error) {
      console.error('Error deactivating lottery:', error);
      alert('Çekiliş pasif yapılamadı.');
    }
  };

  if (!user?.isAdmin) {
    return (
      <div className="admin-panel">
        <div className="no-access">
          <h1>Erişim Reddedildi</h1>
          <p>Bu sayfaya erişim yetkiniz yok.</p>
          <button onClick={signOut} className="logout-button">
            Çıkış Yap
          </button>
        </div>
      </div>
    );
  }

  if (showCreateForm || !lottery) {
    return (
      <div className="admin-panel">
        <div className="create-lottery-form">
          <h1>Yeni Çekiliş Oluştur</h1>
          <form onSubmit={handleCreateLottery}>
            <div className="form-group">
              <label>Çekiliş Adı</label>
              <input
                type="text"
                value={formData.lotteryName}
                onChange={(e) => setFormData({ ...formData, lotteryName: e.target.value })}
                placeholder="Örn: Yılbaşı Çekilişi 2024"
              />
              <small className="form-hint">Boş bırakılırsa otomatik isim verilir</small>
            </div>
            <div className="form-group">
              <label>Çekiliş Tarihi ve Saati</label>
              <input
                type="datetime-local"
                value={formData.eventDate}
                onChange={(e) => setFormData({ ...formData, eventDate: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Bilet Fiyatı (TL)</label>
              <input
                type="number"
                value={formData.ticketPrice}
                onChange={(e) => setFormData({ ...formData, ticketPrice: Number(e.target.value) })}
                min="1"
                required
              />
            </div>
            <div className="form-group">
              <label>Maksimum Bilet Sayısı</label>
              <input
                type="number"
                value={formData.maxTickets}
                onChange={(e) => setFormData({ ...formData, maxTickets: Number(e.target.value) })}
                min="1"
                max="10000"
                required
              />
              <small className="form-hint">Max 100,000 farklı kombinasyon mümkün (5 haneli, 0-9 arası)</small>
            </div>
            <button type="submit" className="create-button">
              Çekiliş Oluştur ve Biletleri Oluştur
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-panel">
      <header className="admin-header">
        <div className="header-content">
          <h1>Admin Paneli</h1>
          <p className="admin-name">👤 {user.displayName}</p>
        </div>
        <div className="header-actions">
          {allLotteries.length > 1 && (
            <div className="lottery-selector">
              <label>Çekiliş:</label>
              <select
                value={lottery?.id || ''}
                onChange={(e) => {
                  const selected = allLotteries.find(l => l.id === e.target.value);
                  setLottery(selected || null);
                }}
                className="lottery-dropdown"
              >
                {allLotteries.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.lotteryName || `Çekiliş ${new Date(l.eventDate).toLocaleDateString('tr-TR')}`}
                    {l.isActive ? ' (Aktif)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button onClick={() => setShowCreateForm(true)} className="create-new-button">
            + Yeni Çekiliş
          </button>
          <button onClick={signOut} className="logout-button">
            Çıkış Yap
          </button>
        </div>
      </header>

      <div className="admin-tabs">
        <button
          className={`tab ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          📊 Dashboard
        </button>
        <button
          className={`tab ${activeTab === 'requests' ? 'active' : ''}`}
          onClick={() => setActiveTab('requests')}
        >
          📝 İstekler
          {statusCounts.pending > 0 && (
            <span className="tab-badge">{statusCounts.pending}</span>
          )}
        </button>
        <button
          className={`tab ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          👥 Kullanıcılar
        </button>
        <button
          className={`tab ${activeTab === 'tickets' ? 'active' : ''}`}
          onClick={() => setActiveTab('tickets')}
        >
          🎫 Biletler
        </button>
        <button
          className={`tab ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          ⚙️ Ayarlar
        </button>
      </div>

      <div className="admin-content">
        {activeTab === 'dashboard' && (
          <div className="dashboard-tab">
            <h2>İstatistikler</h2>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">👥</div>
                <div className="stat-value">{stats.totalUsers}</div>
                <div className="stat-label">Toplam Kullanıcı</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">🎫</div>
                <div className="stat-value">{stats.totalTickets}</div>
                <div className="stat-label">Toplam Bilet</div>
              </div>
              <div className="stat-card success">
                <div className="stat-icon">✅</div>
                <div className="stat-value">{stats.soldTickets}</div>
                <div className="stat-label">Satılan Bilet</div>
              </div>
              <div className="stat-card warning">
                <div className="stat-icon">📋</div>
                <div className="stat-value">{stats.pendingRequests}</div>
                <div className="stat-label">Bekleyen İstek</div>
              </div>
              <div className="stat-card info">
                <div className="stat-icon">📦</div>
                <div className="stat-value">{stats.availableTickets}</div>
                <div className="stat-label">Müsait Bilet</div>
              </div>
              <div className="stat-card revenue">
                <div className="stat-icon">💰</div>
                <div className="stat-value">{stats.totalRevenue} TL</div>
                <div className="stat-label">Toplam Gelir</div>
              </div>
            </div>

            <div className="quick-info">
              <h3>Çekiliş Bilgileri</h3>
              <div className="info-grid">
                <div className="info-item">
                  <span className="info-label">📅 Çekiliş Tarihi:</span>
                  <span className="info-value">
                    {new Date(lottery.eventDate).toLocaleString('tr-TR')}
                  </span>
                </div>
                <div className="info-item">
                  <span className="info-label">💵 Bilet Fiyatı:</span>
                  <span className="info-value">{lottery.ticketPrice} TL</span>
                </div>
                <div className="info-item">
                  <span className="info-label">📊 Doluluk Oranı:</span>
                  <span className="info-value">
                    %{((stats.soldTickets / stats.totalTickets) * 100).toFixed(1)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'requests' && (
          <div className="requests-tab">
            <h2>Bilet İstekleri</h2>
            <div className="requests-toolbar">
              <div className="search-input">
                <input
                  type="text"
                  placeholder="İsim, e-posta, bilet no veya istek ID ile ara"
                  value={requestSearch}
                  onChange={(e) => setRequestSearch(e.target.value)}
                />
              </div>
              <div className="request-filters">
                <div className="status-filters">
                  <button
                    className={`status-filter ${requestStatus === 'pending' ? 'active' : ''}`}
                    onClick={() => setRequestStatus('pending')}
                  >
                    Bekleyen ({statusCounts.pending})
                  </button>
                  <button
                    className={`status-filter ${requestStatus === 'approved' ? 'active' : ''}`}
                    onClick={() => setRequestStatus('approved')}
                  >
                    Onaylanan ({statusCounts.approved})
                  </button>
                  <button
                    className={`status-filter ${requestStatus === 'rejected' ? 'active' : ''}`}
                    onClick={() => setRequestStatus('rejected')}
                  >
                    Reddedilen ({statusCounts.rejected})
                  </button>
                  <button
                    className={`status-filter ${requestStatus === 'all' ? 'active' : ''}`}
                    onClick={() => setRequestStatus('all')}
                  >
                    Tümü ({statusCounts.all})
                  </button>
                </div>
                <div className="user-filter">
                  <label>Kullanıcı:</label>
                  <select
                    value={requestUser}
                    onChange={(e) => setRequestUser(e.target.value as 'all' | string)}
                  >
                    <option value="all">Tüm kullanıcılar</option>
                    {uniqueRequestUsers.map(u => (
                      <option key={u.uid} value={u.uid}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {filteredRequests.length === 0 ? (
              <div className="no-data">
                <div className="empty-icon">{ticketRequests.length === 0 ? '📭' : '🔍'}</div>
                <p>
                  {ticketRequests.length === 0
                    ? 'Bekleyen istek yok'
                    : 'Bu filtrelere uyan istek bulunamadı'}
                </p>
              </div>
            ) : (
              <div className="requests-list">
                {filteredRequests.map(request => (
                  <div key={request.id} className="request-card">
                    <div className="request-header">
                      <div className="user-info">
                        <span className="user-avatar">👤</span>
                        <div>
                          <div className="user-name">{request.userName}</div>
                          <div className="user-email">{request.userEmail}</div>
                        </div>
                      </div>
                      <div className="request-badges">
                        <div className="ticket-badge">
                          🎫 #{request.ticketNumber.toString().padStart(3, '0')}
                        </div>
                        <span className={`status-chip ${request.status}`}>
                          {request.status === 'pending' && 'Beklemede'}
                          {request.status === 'approved' && 'Onaylandı'}
                          {request.status === 'rejected' && 'Reddedildi'}
                        </span>
                      </div>
                    </div>
                    <div className="request-meta">
                      <span className="request-time">
                        🕐 {new Date(request.createdAt).toLocaleString('tr-TR')}
                      </span>
                      <span className="request-amount">
                        💰 {lottery.ticketPrice} TL
                      </span>
                    </div>
                    {request.status === 'pending' ? (
                      <div className="request-actions">
                        <button
                          onClick={() => handleApproveRequest(request)}
                          className="approve-button"
                        >
                          ✓ Onayla
                        </button>
                        <button
                          onClick={() => handleRejectRequest(request)}
                          className="reject-button"
                        >
                          ✕ Reddet
                        </button>
                      </div>
                    ) : (
                      <div className="request-actions inactive">
                        <div className="decision-note">
                          {request.status === 'approved' ? '✅ Bu istek onaylandı' : '🚫 Bu istek reddedildi'}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'users' && (
          <div className="users-tab">
            <h2>Kullanıcılar ({allUsers.length})</h2>
            <div className="users-list">
              {allUsers.map(u => (
                <div key={u.uid} className="user-card">
                  <div className="user-avatar-large">👤</div>
                  <div className="user-details">
                    <div className="user-name-large">{u.displayName || 'İsimsiz'}</div>
                    <div className="user-email-small">{u.email}</div>
                    {u.isAdmin && <span className="admin-badge">Admin</span>}
                  </div>
                  <div className="user-stats">
                    <span className="user-stat">
                      🎫 {allTickets.filter(t => t.userId === u.uid && t.status === 'confirmed').length}
                    </span>
                  </div>
                  {user.uid !== u.uid && (
                    <button
                      onClick={() => handleToggleAdmin(u)}
                      className={`toggle-admin-button ${u.isAdmin ? 'remove' : 'add'}`}
                    >
                      {u.isAdmin ? '❌ Admin Kaldır' : '⭐ Admin Yap'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'tickets' && (
          <div className="tickets-tab">
            <h2>Tüm Biletler</h2>
            <div className="tickets-filter">
              <button className="filter-btn all">Tümü ({allTickets.length})</button>
              <button className="filter-btn available">
                Müsait ({allTickets.filter(t => t.status === 'available').length})
              </button>
              <button className="filter-btn requested">
                Talep ({allTickets.filter(t => t.status === 'requested').length})
              </button>
              <button className="filter-btn confirmed">
                Satıldı ({allTickets.filter(t => t.status === 'confirmed').length})
              </button>
            </div>
            <div className="tickets-table">
              <table>
                <thead>
                  <tr>
                    <th>Bilet No</th>
                    <th>Numaralar</th>
                    <th>Durum</th>
                    <th>Kullanıcı</th>
                  </tr>
                </thead>
                <tbody>
                  {allTickets.slice(0, 50).map(ticket => (
                    <tr key={ticket.id}>
                      <td className="ticket-no">#{ticket.ticketNumber.toString().padStart(3, '0')}</td>
                      <td className="ticket-numbers">
                        {ticket.numbers.map((num, i) => (
                          <span key={i} className="number-pill">{num}</span>
                        ))}
                      </td>
                      <td>
                        <span className={`status-badge ${ticket.status}`}>
                          {ticket.status === 'available' && '📦 Müsait'}
                          {ticket.status === 'requested' && '⏳ Talep'}
                          {ticket.status === 'confirmed' && '✅ Satıldı'}
                          {ticket.status === 'expired' && '❌ Süresi Doldu'}
                        </span>
                      </td>
                      <td>{ticket.userName || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {allTickets.length > 50 && (
                <p className="table-note">İlk 50 bilet gösteriliyor</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="settings-tab">
            <h2>Çekiliş Ayarları</h2>
            <div className="settings-card controls">
              <div className="setting-actions">
                <button className={`chip-button ${lottery.salesOpen ?? true ? 'active' : ''}`} onClick={toggleSales}>
                  {(lottery.salesOpen ?? true) ? 'Satışı Kapat' : 'Satışı Aç'}
                </button>
                <button className="chip-button" onClick={startNow}>
                  Çekilişi Şimdi Başlat
                </button>
                <button className="chip-button" onClick={endLottery}>
                  Çekilişi Sonlandır
                </button>
                <button className="chip-button danger" onClick={deactivateLottery}>
                  Çekilişi Pasif Yap
                </button>
              </div>
            </div>
            <div className="settings-card">
              <div className="setting-item">
                <span className="setting-label">Çekiliş ID:</span>
                <span className="setting-value">{lottery.id}</span>
              </div>
              <div className="setting-item">
                <span className="setting-label">Çekiliş Tarihi:</span>
                <span className="setting-value">
                  {new Date(lottery.eventDate).toLocaleString('tr-TR')}
                </span>
              </div>
              <div className="setting-item">
                <span className="setting-label">Bilet Fiyatı:</span>
                <span className="setting-value">{lottery.ticketPrice} TL</span>
              </div>
              <div className="setting-item">
                <span className="setting-label">Maksimum Bilet:</span>
                <span className="setting-value">{lottery.maxTickets} adet</span>
              </div>
              <div className="setting-item">
                <span className="setting-label">Durum:</span>
                <span className="setting-value">
                  {lottery.isActive ? '✅ Aktif' : '❌ Pasif'}
                </span>
              </div>
              <div className="setting-item">
                <span className="setting-label">Oluşturulma:</span>
                <span className="setting-value">
                  {new Date(lottery.createdAt).toLocaleString('tr-TR')}
                </span>
              </div>
            </div>
            <div className="settings-card">
              <div className="settings-card-header">
                <div>
                  <h3>Kurallar</h3>
                  <p className="settings-description">Bu alan kullanıcıların göreceği şekilde yayınlanır.</p>
                </div>
                <button className="save-button" onClick={handleSaveRules}>Kaydet</button>
              </div>
              <textarea
                className="rules-textarea"
                value={rulesDraft}
                onChange={(e) => setRulesDraft(e.target.value)}
                placeholder="Örn: Çekiliş 5 haneli sayılarla oynanır, her bilet benzersizdir..."
              />
            </div>
            <div className="danger-zone">
              <h3>⚠️ Tehlikeli Bölge</h3>
              <p>Çekilişi pasif hale getirmek veya silmek için dikkatli olun.</p>
              <button className="danger-button" disabled>
                Çekilişi Kapat (Yakında)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
