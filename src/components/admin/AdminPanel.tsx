import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, writeBatch, deleteDoc, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { LotterySettings, TicketRequest, Ticket, User } from '../../types';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { toDateSafe } from '../../utils/date';
import { DEFAULT_LOTTERY_RULES as _DEFAULT_LOTTERY_RULES } from '../../utils/defaultRules';
import { CreateLotteryForm } from './CreateLotteryForm';
import './AdminPanel.css';

type TabType = 'dashboard' | 'requests' | 'users' | 'tickets' | 'settings';

export function AdminPanel() {
  const { user, signOut } = useAuth();
  const toast = useToast();
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
          numberRange: data.numberRange ?? '1-9',
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

  const generateTickets = async (lotteryId: string, maxTickets: number, rangeMax: number, ticketPrice: number) => {
    const tickets: any[] = [];
    const generatedCombinations = new Set<string>();

    for (let i = 1; i <= maxTickets; i++) {
      // Generate unique 5-number combination with special algorithm
      let numbers: number[];
      let combination: string;

      do {
        // 1st number: 1, 2, or 3
        // 2nd number: 4, 5, or 6
        // 3rd number: 7, 8, or 9
        // 4th number: 1-9
        // 5th number: 1-9
        numbers = [
          Math.floor(Math.random() * 3) + 1,      // 1-3
          Math.floor(Math.random() * 3) + 4,      // 4-6
          Math.floor(Math.random() * 3) + 7,      // 7-9
          Math.floor(Math.random() * rangeMax) + 1, // 1-9 or 1-99 based on settings
          Math.floor(Math.random() * rangeMax) + 1  // 1-9 or 1-99 based on settings
        ];
        combination = numbers.join('-');
      } while (generatedCombinations.has(combination));

      generatedCombinations.add(combination);

      tickets.push({
        ticketNumber: i,
        lotteryId,
        status: 'available',
        numbers,
        price: ticketPrice
      });
    }

    const batch = writeBatch(db);
    tickets.forEach(ticket => {
      const ticketRef = doc(collection(db, 'tickets'));
      batch.set(ticketRef, ticket);
    });
    await batch.commit();
  };

  const handleCreateLottery = async (data: {
    eventDate: string;
    ticketPrice: number;
    maxTickets: number;
    lotteryName: string;
    numberRange: '1-9' | '1-99';
    rules: string;
  }) => {
    try {
      const rangeMax = data.numberRange === '1-9' ? 9 : 99;
      const maxCap = data.numberRange === '1-9' ? 59049 : 100000;
      const desiredTicketCount = Math.min(data.maxTickets, maxCap);

      const lotteryRef = await addDoc(collection(db, 'lotteries'), {
        lotteryName: data.lotteryName || `Çekiliş ${new Date().toLocaleDateString('tr-TR')}`,
        eventDate: new Date(data.eventDate),
        ticketPrice: data.ticketPrice,
        maxTickets: desiredTicketCount,
        isActive: true,
        salesOpen: true,
        numberRange: data.numberRange,
        status: 'scheduled',
        rules: data.rules,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await generateTickets(lotteryRef.id, desiredTicketCount, rangeMax, data.ticketPrice);

      setShowCreateForm(false);
      toast.success('Çekiliş başarıyla oluşturuldu!');
    } catch (error) {
      console.error('Error creating lottery:', error);
      toast.error('Çekiliş oluşturulamadı. Lütfen tekrar deneyin.');
    }
  };

  const handleApproveRequest = async (request: TicketRequest) => {
    try {
      await updateDoc(doc(db, 'ticketRequests', request.id), {
        status: 'approved'
      });

      await updateDoc(doc(db, 'tickets', request.ticketId), {
        status: 'confirmed',
        userId: request.userId,
        userName: request.userName,
        confirmedAt: new Date()
      });

    } catch (error) {
      console.error('Error approving request:', error);
      toast.error('İstek onaylanamadı. Lütfen tekrar deneyin.');
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

      toast.info('Bilet isteği reddedildi.');
    } catch (error) {
      console.error('Error rejecting request:', error);
      toast.error('İstek reddedilemedi. Lütfen tekrar deneyin.');
    }
  };

  const handleToggleAdmin = async (targetUser: User) => {
    const confirmed = await toast.confirm(`${targetUser.displayName} kullanıcısını ${targetUser.isAdmin ? 'admin olmaktan çıkar' : 'admin yap'}?`);
    if (!confirmed) {
      return;
    }

    try {
      await updateDoc(doc(db, 'users', targetUser.uid), {
        isAdmin: !targetUser.isAdmin
      });
      toast.success('Kullanıcı yetkisi güncellendi!');
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Kullanıcı güncellenemedi.');
    }
  };

  const handleSaveRules = async () => {
    if (!lottery) return;
    try {
      await updateDoc(doc(db, 'lotteries', lottery.id), {
        rules: rulesDraft,
        updatedAt: new Date()
      });
      toast.success('Kurallar güncellendi.');
    } catch (error) {
      console.error('Error updating rules:', error);
      toast.error('Kurallar kaydedilemedi.');
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
      toast.error('Satış durumu güncellenemedi.');
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
      toast.success('Çekiliş tarihi şimdi olarak güncellendi.');
    } catch (error) {
      console.error('Error starting now:', error);
      toast.error('Çekiliş başlatılamadı.');
    }
  };

  const endLottery = async () => {
    if (!lottery) return;
    const confirmed = await toast.confirm('Çekilişi sonlandırmak istediğine emin misin?');
    if (!confirmed) return;
    try {
      await updateDoc(doc(db, 'lotteries', lottery.id), {
        status: 'completed',
        isActive: false,
        salesOpen: false,
        updatedAt: new Date()
      });
      toast.success('Çekiliş sonlandırıldı.');
    } catch (error) {
      console.error('Error ending lottery:', error);
      toast.error('Çekiliş sonlandırılamadı.');
    }
  };

  const deactivateLottery = async () => {
    if (!lottery) return;
    const confirmed = await toast.confirm('Çekilişi pasif hale getirmek istediğine emin misin?');
    if (!confirmed) return;
    try {
      await updateDoc(doc(db, 'lotteries', lottery.id), {
        isActive: false,
        salesOpen: false,
        status: 'cancelled',
        updatedAt: new Date()
      });
      toast.success('Çekiliş pasif yapıldı.');
    } catch (error) {
      console.error('Error deactivating lottery:', error);
      toast.error('Çekiliş pasif yapılamadı.');
    }
  };

  // DELETE LOTTERY (with CASCADE delete of all related tickets and requests)
  const deleteLottery = async () => {
    if (!lottery) return;
    const confirmed = await toast.confirm(
      `⚠️ TEHLİKELİ! "${lottery.lotteryName || 'Çekiliş'}" silinecek ve bağlantılı TÜM biletler ve istekler de silinecek. Emin misiniz?`
    );
    if (!confirmed) return;

    try {
      // 1. Delete all tickets for this lottery
      const ticketsQuery = query(collection(db, 'tickets'), where('lotteryId', '==', lottery.id));
      const ticketsSnapshot = await getDocs(ticketsQuery);
      const ticketDeleteBatch = writeBatch(db);
      ticketsSnapshot.docs.forEach((ticketDoc) => {
        ticketDeleteBatch.delete(ticketDoc.ref);
      });
      await ticketDeleteBatch.commit();

      // 2. Delete all ticket requests for this lottery
      const requestsQuery = query(collection(db, 'ticketRequests'), where('lotteryId', '==', lottery.id));
      const requestsSnapshot = await getDocs(requestsQuery);
      const requestDeleteBatch = writeBatch(db);
      requestsSnapshot.docs.forEach((requestDoc) => {
        requestDeleteBatch.delete(requestDoc.ref);
      });
      await requestDeleteBatch.commit();

      // 3. Delete lottery sessions for this lottery
      const sessionsQuery = query(collection(db, 'lotterySessions'), where('lotteryId', '==', lottery.id));
      const sessionsSnapshot = await getDocs(sessionsQuery);
      const sessionDeleteBatch = writeBatch(db);
      sessionsSnapshot.docs.forEach((sessionDoc) => {
        sessionDeleteBatch.delete(sessionDoc.ref);
      });
      await sessionDeleteBatch.commit();

      // 4. Finally delete the lottery itself
      await deleteDoc(doc(db, 'lotteries', lottery.id));

      toast.success(`Çekiliş ve bağlantılı ${ticketsSnapshot.size} bilet, ${requestsSnapshot.size} istek silindi.`);
      setLottery(null);
    } catch (error) {
      console.error('Error deleting lottery:', error);
      toast.error('Çekiliş silinemedi.');
    }
  };

  // DELETE SINGLE TICKET
  const deleteTicket = async (ticketId: string) => {
    const confirmed = await toast.confirm('Bu bileti silmek istediğine emin misin?');
    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, 'tickets', ticketId));
      toast.success('Bilet silindi.');
    } catch (error) {
      console.error('Error deleting ticket:', error);
      toast.error('Bilet silinemedi.');
    }
  };

  // DELETE USER
  const deleteUser = async (userId: string, displayName: string) => {
    const confirmed = await toast.confirm(
      `⚠️ "${displayName}" kullanıcısını silmek istediğine emin misin? Kullanıcının biletleri de silinecek.`
    );
    if (!confirmed) return;

    try {
      // Delete user's tickets
      const userTicketsQuery = query(collection(db, 'tickets'), where('userId', '==', userId));
      const userTicketsSnapshot = await getDocs(userTicketsQuery);
      const ticketBatch = writeBatch(db);
      userTicketsSnapshot.docs.forEach((ticketDoc) => {
        ticketBatch.delete(ticketDoc.ref);
      });
      await ticketBatch.commit();

      // Delete user's ticket requests
      const userRequestsQuery = query(collection(db, 'ticketRequests'), where('userId', '==', userId));
      const userRequestsSnapshot = await getDocs(userRequestsQuery);
      const requestBatch = writeBatch(db);
      userRequestsSnapshot.docs.forEach((requestDoc) => {
        requestBatch.delete(requestDoc.ref);
      });
      await requestBatch.commit();

      // Delete user document
      await deleteDoc(doc(db, 'users', userId));

      toast.success(`Kullanıcı ve ${userTicketsSnapshot.size} bilet silindi.`);
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Kullanıcı silinemedi.');
    }
  };

  // ADD MANUAL TICKET (for admin to create tickets manually)
  const addManualTicket = async () => {
    if (!lottery) return;

    const ticketNumber = prompt('Bilet numarası:');
    if (!ticketNumber) return;

    const numbersInput = prompt('5 rakam gir (virgül ile ayrılmış, örn: 1,2,3,4,5):');
    if (!numbersInput) return;

    try {
      const numbers = numbersInput.split(',').map(n => parseInt(n.trim()));
      if (numbers.length !== 5 || numbers.some(isNaN)) {
        toast.error('Geçersiz rakamlar. 5 rakam girmelisin.');
        return;
      }

      await addDoc(collection(db, 'tickets'), {
        ticketNumber: parseInt(ticketNumber),
        lotteryId: lottery.id,
        status: 'available',
        numbers,
        price: lottery.ticketPrice
      });

      toast.success('Bilet manuel olarak eklendi!');
    } catch (error) {
      console.error('Error adding manual ticket:', error);
      toast.error('Bilet eklenemedi.');
    }
  };

  if (!user?.isAdmin) {
    return (
      <div className="adminpanel">
        <div className="adminpanel__no-access">
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
      <CreateLotteryForm
        onSubmit={handleCreateLottery}
        onCancel={() => setShowCreateForm(false)}
      />
    );
  }

  return (
    <div className="adminpanel">
      <Card className="adminpanel__header" padding="lg">
        <div className="adminpanel__header-content">
          <h1>Admin Paneli</h1>
          <p className="adminpanel__admin-name">👤 {user.displayName}</p>
        </div>
        <div className="adminpanel__header-actions">
          {allLotteries.length > 1 && (
            <div className="adminpanel__lottery-selector">
              <label>Çekiliş:</label>
              <select
                value={lottery?.id || ''}
                onChange={(e) => {
                  const selected = allLotteries.find(l => l.id === e.target.value);
                  setLottery(selected || null);
                }}
                className="adminpanel__lottery-dropdown"
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
          <Button
            variant="primary"
            size="md"
            icon="+"
            onClick={() => setShowCreateForm(true)}
          >
            Yeni Çekiliş
          </Button>
          <Button
            variant="outline"
            size="md"
            icon="🚪"
            onClick={signOut}
          >
            Çıkış Yap
          </Button>
        </div>
      </Card>

      <div className="adminpanel__tabs">
        <button
          className={`adminpanel__tab ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          📊 Dashboard
        </button>
        <button
          className={`adminpanel__tab ${activeTab === 'requests' ? 'active' : ''}`}
          onClick={() => setActiveTab('requests')}
        >
          📝 İstekler
          {statusCounts.pending > 0 && (
            <span className="adminpanel__tab-badge">{statusCounts.pending}</span>
          )}
        </button>
        <button
          className={`adminpanel__tab ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          👥 Kullanıcılar
        </button>
        <button
          className={`adminpanel__tab ${activeTab === 'tickets' ? 'active' : ''}`}
          onClick={() => setActiveTab('tickets')}
        >
          🎫 Biletler
        </button>
        <button
          className={`adminpanel__tab ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          ⚙️ Ayarlar
        </button>
      </div>

      <div className="adminpanel__content">
        {activeTab === 'dashboard' && (
          <div className="dashboard-tab">
            <h2>İstatistikler</h2>
            <div className="adminpanel__stats-grid">
              <div className="adminpanel__stat-card">
                <div className="adminpanel__stat-icon">👥</div>
                <div className="adminpanel__stat-value">{stats.totalUsers}</div>
                <div className="adminpanel__stat-label">Toplam Kullanıcı</div>
              </div>
              <div className="adminpanel__stat-card">
                <div className="adminpanel__stat-icon">🎫</div>
                <div className="adminpanel__stat-value">{stats.totalTickets}</div>
                <div className="adminpanel__stat-label">Toplam Bilet</div>
              </div>
              <div className="adminpanel__stat-card success">
                <div className="adminpanel__stat-icon">✅</div>
                <div className="adminpanel__stat-value">{stats.soldTickets}</div>
                <div className="adminpanel__stat-label">Satılan Bilet</div>
              </div>
              <div className="adminpanel__stat-card warning">
                <div className="adminpanel__stat-icon">📋</div>
                <div className="adminpanel__stat-value">{stats.pendingRequests}</div>
                <div className="adminpanel__stat-label">Bekleyen İstek</div>
              </div>
              <div className="adminpanel__stat-card info">
                <div className="adminpanel__stat-icon">📦</div>
                <div className="adminpanel__stat-value">{stats.availableTickets}</div>
                <div className="adminpanel__stat-label">Müsait Bilet</div>
              </div>
              <div className="adminpanel__stat-card revenue">
                <div className="adminpanel__stat-icon">💰</div>
                <div className="adminpanel__stat-value">{stats.totalRevenue} TL</div>
                <div className="adminpanel__stat-label">Toplam Gelir</div>
              </div>
            </div>

            <div className="adminpanel__quick-info">
              <h3>Çekiliş Bilgileri</h3>
              <div className="adminpanel__info-grid">
                <div className="adminpanel__info-item">
                  <span className="adminpanel__info-label">📅 Çekiliş Tarihi:</span>
                  <span className="adminpanel__info-value">
                    {new Date(lottery.eventDate).toLocaleString('tr-TR')}
                  </span>
                </div>
                <div className="adminpanel__info-item">
                  <span className="adminpanel__info-label">💵 Bilet Fiyatı:</span>
                  <span className="adminpanel__info-value">{lottery.ticketPrice} TL</span>
                </div>
                <div className="adminpanel__info-item">
                  <span className="adminpanel__info-label">📊 Doluluk Oranı:</span>
                  <span className="adminpanel__info-value">
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
            <div className="adminpanel__requests-toolbar">
              <div className="adminpanel__search-input">
                <input
                  type="text"
                  placeholder="İsim, e-posta, bilet no veya istek ID ile ara"
                  value={requestSearch}
                  onChange={(e) => setRequestSearch(e.target.value)}
                />
              </div>
              <div className="adminpanel__request-filters">
                <div className="adminpanel__status-filters">
                  <button
                    className={`adminpanel__status-filter ${requestStatus === 'pending' ? 'active' : ''}`}
                    onClick={() => setRequestStatus('pending')}
                  >
                    Bekleyen ({statusCounts.pending})
                  </button>
                  <button
                    className={`adminpanel__status-filter ${requestStatus === 'approved' ? 'active' : ''}`}
                    onClick={() => setRequestStatus('approved')}
                  >
                    Onaylanan ({statusCounts.approved})
                  </button>
                  <button
                    className={`adminpanel__status-filter ${requestStatus === 'rejected' ? 'active' : ''}`}
                    onClick={() => setRequestStatus('rejected')}
                  >
                    Reddedilen ({statusCounts.rejected})
                  </button>
                  <button
                    className={`adminpanel__status-filter ${requestStatus === 'all' ? 'active' : ''}`}
                    onClick={() => setRequestStatus('all')}
                  >
                    Tümü ({statusCounts.all})
                  </button>
                </div>
                <div className="adminpanel__user-filter">
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
              <div className="adminpanel__no-data">
                <div className="adminpanel__empty-icon">{ticketRequests.length === 0 ? '📭' : '🔍'}</div>
                <p>
                  {ticketRequests.length === 0
                    ? 'Bekleyen istek yok'
                    : 'Bu filtrelere uyan istek bulunamadı'}
                </p>
              </div>
            ) : (
              <div className="adminpanel__requests-list">
                {filteredRequests.map(request => (
                  <div key={request.id} className="adminpanel__request-card">
                    <div className="adminpanel__request-header">
                      <div className="adminpanel__user-info">
                        <span className="adminpanel__user-avatar">👤</span>
                        <div>
                          <div className="adminpanel__user-name">{request.userName}</div>
                          <div className="adminpanel__user-email">{request.userEmail}</div>
                        </div>
                      </div>
                      <div className="adminpanel__request-badges">
                        <div className="adminpanel__ticket-badge">
                          🎫 #{request.ticketNumber.toString().padStart(3, '0')}
                        </div>
                        <span className={`adminpanel__status-chip ${request.status}`}>
                          {request.status === 'pending' && 'Beklemede'}
                          {request.status === 'approved' && 'Onaylandı'}
                          {request.status === 'rejected' && 'Reddedildi'}
                        </span>
                      </div>
                    </div>
                    <div className="adminpanel__request-meta">
                      <span className="adminpanel__request-time">
                        🕐 {new Date(request.createdAt).toLocaleString('tr-TR')}
                      </span>
                      <span className="adminpanel__request-amount">
                        💰 {lottery.ticketPrice} TL
                      </span>
                    </div>
                    {request.status === 'pending' ? (
                      <div className="adminpanel__request-actions">
                        <button
                          onClick={() => handleApproveRequest(request)}
                          className="adminpanel__approve-button"
                        >
                          ✓ Onayla
                        </button>
                        <button
                          onClick={() => handleRejectRequest(request)}
                          className="adminpanel__reject-button"
                        >
                          ✕ Reddet
                        </button>
                      </div>
                    ) : (
                      <div className="adminpanel__request-actions inactive">
                        <div className="adminpanel__decision-note">
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
            <div className="adminpanel__users-list">
              {allUsers.map(u => (
                <div key={u.uid} className="adminpanel__user-card">
                  <div className="adminpanel__user-avatar-large">👤</div>
                  <div className="adminpanel__user-details">
                    <div className="adminpanel__user-name-large">{u.displayName || 'İsimsiz'}</div>
                    <div className="adminpanel__user-email-small">{u.email}</div>
                    {u.isAdmin && <span className="adminpanel__admin-badge">Admin</span>}
                                        {user.uid !== u.uid && (
                    <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                      <button
                        onClick={() => handleToggleAdmin(u)}
                        className={`adminpanel__toggle-admin-button ${u.isAdmin ? 'remove' : 'add'}`}
                      >
                        {u.isAdmin ? '❌ Admin Kaldır' : '⭐ Admin Yap'}
                      </button>
                      <button
                        onClick={() => deleteUser(u.uid, u.displayName || 'İsimsiz')}
                        className="adminpanel__delete-button"
                      >
                        🗑️ Sil
                      </button>
                    </div>
                  )}
                  </div>
                  <div className="adminpanel__user-stats">
                    <span className="adminpanel__user-stat">
                      🎫 {allTickets.filter(t => t.userId === u.uid && t.status === 'confirmed').length}
                    </span>
                  
                  </div>

                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'tickets' && (
          <div className="tickets-tab">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-lg)' }}>
              <h2>Tüm Biletler</h2>
              <Button variant="primary" size="md" onClick={addManualTicket} icon="➕">
                Manuel Bilet Ekle
              </Button>
            </div>
            <div className="adminpanel__tickets-filter">
              <button className="adminpanel__filter-btn all">Tümü ({allTickets.length})</button>
              <button className="adminpanel__filter-btn available">
                Müsait ({allTickets.filter(t => t.status === 'available').length})
              </button>
              <button className="adminpanel__filter-btn requested">
                Talep ({allTickets.filter(t => t.status === 'requested').length})
              </button>
              <button className="adminpanel__filter-btn confirmed">
                Satıldı ({allTickets.filter(t => t.status === 'confirmed').length})
              </button>
            </div>
            <div className="adminpanel__tickets-table">
              <table>
                <thead>
                  <tr>
                    <th>Bilet No</th>
                    <th>Numaralar</th>
                    <th>Durum</th>
                    <th>Kullanıcı</th>
                    <th>İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {allTickets.slice(0, 50).map(ticket => (
                    <tr key={ticket.id}>
                      <td className="adminpanel__ticket-no">#{ticket.ticketNumber.toString().padStart(3, '0')}</td>
                      <td className="adminpanel__ticket-numbers">
                        {ticket.numbers.map((num, i) => (
                          <span key={i} className="adminpanel__number-pill">{num}</span>
                        ))}
                      </td>
                      <td>
                        <span className={`adminpanel__status-badge ${ticket.status}`}>
                          {ticket.status === 'available' && '📦 Müsait'}
                          {ticket.status === 'requested' && '⏳ Talep'}
                          {ticket.status === 'confirmed' && '✅ Satıldı'}
                          {ticket.status === 'expired' && '❌ Süresi Doldu'}
                        </span>
                      </td>
                      <td>{ticket.userName || '-'}</td>
                      <td>
                        <button
                          onClick={() => deleteTicket(ticket.id)}
                          className="adminpanel__delete-button-small"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {allTickets.length > 50 && (
                <p className="adminpanel__table-note">İlk 50 bilet gösteriliyor</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="settings-tab">
            <h2>Çekiliş Ayarları</h2>
            <div className="adminpanel__settings-card controls">
              <div className="adminpanel__setting-actions">
                <button className={`adminpanel__chip-button ${lottery.salesOpen ?? true ? 'active' : ''}`} onClick={toggleSales}>
                  {(lottery.salesOpen ?? true) ? 'Satışı Kapat' : 'Satışı Aç'}
                </button>
                <button className="adminpanel__chip-button" onClick={startNow}>
                  Çekilişi Şimdi Başlat
                </button>
                <button className="adminpanel__chip-button" onClick={endLottery}>
                  Çekilişi Sonlandır
                </button>
                <button className="adminpanel__chip-button danger" onClick={deactivateLottery}>
                  Çekilişi Pasif Yap
                </button>
              </div>
            </div>
            <div className="adminpanel__settings-card">
              <div className="adminpanel__setting-item">
                <span className="adminpanel__setting-label">Çekiliş ID:</span>
                <span className="adminpanel__setting-value">{lottery.id}</span>
              </div>
              <div className="adminpanel__setting-item">
                <span className="adminpanel__setting-label">Çekiliş Tarihi:</span>
                <span className="adminpanel__setting-value">
                  {new Date(lottery.eventDate).toLocaleString('tr-TR')}
                </span>
              </div>
              <div className="adminpanel__setting-item">
                <span className="adminpanel__setting-label">Bilet Fiyatı:</span>
                <span className="adminpanel__setting-value">{lottery.ticketPrice} TL</span>
              </div>
              <div className="adminpanel__setting-item">
                <span className="adminpanel__setting-label">Numara Aralığı:</span>
                <span className="adminpanel__setting-value">{lottery.numberRange === '1-99' ? 'Her hane 1-99' : 'Her hane 1-9'}</span>
              </div>
              <div className="adminpanel__setting-item">
                <span className="adminpanel__setting-label">Maksimum Bilet:</span>
                <span className="adminpanel__setting-value">{lottery.maxTickets} adet</span>
              </div>
              <div className="adminpanel__setting-item">
                <span className="adminpanel__setting-label">Durum:</span>
                <span className="adminpanel__setting-value">
                  {lottery.isActive ? '✅ Aktif' : '❌ Pasif'}
                </span>
              </div>
              <div className="adminpanel__setting-item">
                <span className="adminpanel__setting-label">Oluşturulma:</span>
                <span className="adminpanel__setting-value">
                  {new Date(lottery.createdAt).toLocaleString('tr-TR')}
                </span>
              </div>
            </div>
            <div className="adminpanel__settings-card">
              <div className="adminpanel__settings-card-header">
                <div>
                  <h3>Kurallar</h3>
                  <p className="adminpanel__settings-description">Bu alan kullanıcıların göreceği şekilde yayınlanır.</p>
                </div>
                <button className="adminpanel__save-button" onClick={handleSaveRules}>Kaydet</button>
              </div>
              <textarea
                className="adminpanel__rules-textarea"
                value={rulesDraft}
                onChange={(e) => setRulesDraft(e.target.value)}
                placeholder="Örn: Çekiliş 5 haneli sayılarla oynanır, her bilet benzersizdir..."
              />
            </div>
            <div className="adminpanel__danger-zone">
              <h3>⚠️ Tehlikeli Bölge</h3>
              <p>Çekilişi silmek tüm bağlantılı biletleri, istekleri ve oturumları da siler. Bu işlem GERİ ALINAMAZ!</p>
              <button className="adminpanel__danger-button" onClick={deleteLottery}>
                🗑️ Çekilişi ve Tüm Verileri Sil
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
