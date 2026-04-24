import { useState, useEffect } from 'react';
import { collection, query, getDocs, addDoc, updateDoc, doc, serverTimestamp, orderBy, deleteDoc, setDoc, getDoc, onAuthStateChanged, User, db, auth, logout, onSnapshot } from '../lib/supabase';
import { useForm } from 'react-hook-form';
import { LayoutDashboard, LogOut, CheckCircle2, Clock, Users, Plus, Loader2, Edit2, Trash2, History, Search, Settings, Upload, Menu, X, Terminal } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import { Navigate, useNavigate } from 'react-router-dom';

type Task = {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  slots: number;
  description: string;
  createdAt: any;
};

type AdminMember = {
  id: string;
  displayName: string;
  role: 'admin' | 'staff' | 'developer' | 'student_assistant';
  lastLogin: any;
  signature?: string;
};

type ServiceRecord = {
  id: string;
  studentName: string;
  studentId: string;
  program: string;
  yearSection: string;
  taskTitle: string;
  date: string;
  timeIn: string;
  timeOut: string;
  startTime?: string;
  creditHours: number;
  status: 'pending' | 'verified' | 'active';
  verifiedBy?: string;
  verifiedById?: string;
  verifierRole?: string;
  verifierSignature?: string;
};

export default function StudentAssistant() {
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [records, setRecords] = useState<ServiceRecord[]>([]);
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [tab, setTab] = useState<'dashboard' | 'history' | 'profile'>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [recordSearch, setRecordSearch] = useState('');
  
  const [alert, setAlert] = useState<{ title: string; message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);
  const navigate = useNavigate();

  const showAlert = (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    setAlert({ title, message, type });
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        const docRef = doc(db, 'admins', u.uid);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const role = snap.data().role;
          if (role === 'student_assistant' || role === 'developer' || role === 'admin' || role === 'staff') {
            setAuthorized(true);
            await setDoc(docRef, { lastLogin: serverTimestamp() }, { merge: true });
          } else {
            showAlert("Access Denied", "Your account does not have sufficient privileges.", "warning");
            setTimeout(() => logout().then(() => navigate('/login')), 3000);
          }
        } else {
          logout().then(() => navigate('/login'));
        }
      } else {
        setUser(null);
        navigate('/login');
      }
      setLoadingAuth(false);
    });
    return () => unsub();
  }, [navigate]);

  useEffect(() => {
    if (!user || !authorized) return;

    const unsubTasks = onSnapshot(query(collection(db, 'tasks'), orderBy('date', 'desc')), (snap) => {
      setTasks(snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Task)));
    });

    const unsubRecords = onSnapshot(query(collection(db, 'service_records'), orderBy('createdAt', 'desc')), (snap) => {
      setRecords(snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as ServiceRecord)));
    });

    const unsubMembers = onSnapshot(query(collection(db, 'admins'), orderBy('lastLogin', 'desc')), (snap) => {
      setMembers(snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as AdminMember)));
    });

    return () => {
      unsubTasks();
      unsubRecords();
      unsubMembers();
    };
  }, [user, authorized]);

  const handleLogout = () => logout().then(() => navigate('/login'));

  const checkIsWithinSchedule = (record: ServiceRecord) => {
    const task = tasks.find(t => t.title === record.taskTitle && t.date === record.date);
    if (!task) return true;
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (task.date !== today) return false;
    const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    return currentTimeStr >= task.startTime && currentTimeStr <= task.endTime;
  };

  const handleStartSession = async (record: ServiceRecord) => {
    try {
      const now = new Date();
      const timeString = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      await updateDoc(doc(db, 'service_records', record.id), {
        startTime: now.toISOString(),
        timeIn: timeString,
        status: 'active',
        updatedAt: serverTimestamp()
      });
      showAlert("Success", "Session started.", "success");
    } catch (e: any) {
      showAlert("Error", "Failed to start session.", "error");
    }
  };

  const handleClockOut = async (record: ServiceRecord) => {
    try {
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const start = record.startTime ? new Date(record.startTime) : now;
      const diffMs = now.getTime() - start.getTime();
      const creditHours = Math.max(0, parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2)));
      
      await updateDoc(doc(db, 'service_records', record.id), {
        timeOut: currentTime,
        creditHours: creditHours,
        status: 'pending',
        updatedAt: serverTimestamp()
      });
      showAlert("Success", "Student clocked out successfully.", "success");
    } catch (e) {
      showAlert("Error", "Failed to clock out student.", "error");
    }
  };

  const filteredRecords = records.filter(r => 
    r.studentName.toLowerCase().includes(recordSearch.toLowerCase()) ||
    r.taskTitle.toLowerCase().includes(recordSearch.toLowerCase())
  );

  const getTodayYYYYMMDD = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const activeRecords = filteredRecords.filter(r => r.date === getTodayYYYYMMDD() || r.status === 'active');
  const historyRecords = filteredRecords.filter(r => r.date < getTodayYYYYMMDD() && r.status !== 'active');

  if (loadingAuth || !authorized) {
    return <div className="min-h-screen bg-[#1c1c1c] flex items-center justify-center"><Loader2 className="animate-spin text-[#3ecf8e]" /></div>;
  }

  return (
    <div className="min-h-screen bg-[#1c1c1c] text-[#ededed] flex flex-col md:flex-row font-sans relative">
      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-[#2e2e2e] bg-[#171717] sticky top-0 z-20">
        <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#3ecf8e] rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-black" />
            </div>
            <span className="font-bold tracking-tight text-sm">SA Portal</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X className="w-6 h-6 text-[#a1a1a1]" /> : <Menu className="w-6 h-6 text-[#a1a1a1]" />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`${isMobileMenuOpen ? 'flex' : 'hidden md:flex'} fixed inset-0 z-30 md:relative md:w-64 bg-[#171717] border-r border-[#2e2e2e] flex-col`}>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-[#3ecf8e] rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(62,207,142,0.2)]">
              <Users className="w-6 h-6 text-black" />
            </div>
            <div>
              <h1 className="font-bold tracking-tight text-white leading-none">SA Portal</h1>
              <p className="text-[10px] text-[#a1a1a1] mt-1 font-medium uppercase tracking-widest">Student Assistant</p>
            </div>
          </div>

          <nav className="space-y-1">
            <button onClick={() => { setTab('dashboard'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${tab === 'dashboard' ? 'bg-[#3ecf8e]/10 text-[#3ecf8e]' : 'text-[#a1a1a1] hover:bg-[#2e2e2e]'}`}>
              <LayoutDashboard className="w-4 h-4" />
              Monitoring
              {records.filter(r => r.status === 'active').length > 0 && (
                <span className="ml-auto w-5 h-5 bg-[#3ecf8e] text-black text-[10px] rounded-full flex items-center justify-center font-bold">
                  {records.filter(r => r.status === 'active').length}
                </span>
              )}
            </button>
            <button onClick={() => { setTab('history'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${tab === 'history' ? 'bg-[#3ecf8e]/10 text-[#3ecf8e]' : 'text-[#a1a1a1] hover:bg-[#2e2e2e]'}`}>
              <History className="w-4 h-4" />
              Task History
            </button>
          </nav>
        </div>

        <div className="mt-auto p-4 border-t border-[#2e2e2e] bg-[#1a1a1a]">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-red-500 hover:bg-red-500/10 transition-all">
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-10">
        {tab === 'dashboard' && (
          <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">Queue & Monitoring</h2>
                <p className="text-[#a1a1a1] text-sm">Manage student sessions for today's tasks.</p>
              </div>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#a1a1a1]" />
                <input 
                  type="text" 
                  placeholder="Search logs..." 
                  value={recordSearch}
                  onChange={(e) => setRecordSearch(e.target.value)}
                  className="bg-[#171717] border border-[#2e2e2e] rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-[#3ecf8e] transition-colors w-full md:w-64"
                />
              </div>
            </div>

            <div className="bg-[#171717] border border-[#2e2e2e] rounded-xl overflow-hidden mb-8">
               <div className="p-4 border-b border-[#2e2e2e] bg-[#1a1a1a] flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-[#a1a1a1]">Active & Today's Logs</h3>
               </div>
               <div className="overflow-x-auto">
                 <table className="w-full text-left">
                   <thead className="bg-[#1c1c1c] text-[10px] uppercase font-bold text-[#666] tracking-wider">
                     <tr>
                       <th className="px-6 py-4">Student Info</th>
                       <th className="px-6 py-4">Assigned Task</th>
                       <th className="px-6 py-4">Status</th>
                       <th className="px-6 py-4 text-right">Verification</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-[#2e2e2e]">
                     {activeRecords.length === 0 ? (
                       <tr><td colSpan={4} className="px-6 py-12 text-center text-[#666] text-sm">No active students today.</td></tr>
                     ) : activeRecords.map(r => (
                       <tr key={r.id} className="hover:bg-[#1a1a1a] transition-colors group">
                         <td className="px-6 py-4">
                           <div className="font-medium text-white text-sm">{r.studentName}</div>
                           <div className="text-[10px] text-[#666] mt-0.5">{r.studentId} | {r.program}</div>
                         </td>
                         <td className="px-6 py-4">
                            <div className="text-sm text-[#ededed]">{r.taskTitle}</div>
                            <div className="text-[9px] text-[#a1a1a1] font-mono uppercase">{r.timeIn} - {r.timeOut || '...'}</div>
                         </td>
                         <td className="px-6 py-4">
                           <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${r.status === 'verified' ? 'bg-[#3ecf8e]/20 text-[#3ecf8e]' : r.status === 'active' ? 'bg-blue-500/20 text-blue-500' : 'bg-amber-500/20 text-amber-500'}`}>
                             {r.status}
                           </span>
                         </td>
                         <td className="px-6 py-4 text-right">
                           <div className="flex justify-end gap-2">
                             {(r.status === 'pending' || r.status === 'active') && (
                               <button 
                                 onClick={() => {
                                   if (!checkIsWithinSchedule(r)) {
                                     showAlert("Outside Schedule", "This task can only be started/stopped during its assigned window.", "warning");
                                     return;
                                   }
                                   if (!r.startTime) handleStartSession(r);
                                   else handleClockOut(r);
                                 }}
                                 className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase flex items-center gap-1.5 transition-all ${
                                   !r.startTime ? 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20' : 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
                                 }`}
                               >
                                 <Clock className="w-3 h-3" />
                                 {!r.startTime ? 'Start Duty' : 'Finish Duty'}
                               </button>
                             )}
                             {r.status === 'verified' && (
                               <div className="flex items-center gap-1.5 text-[#3ecf8e]">
                                 <CheckCircle2 className="w-4 h-4" />
                                 <span className="text-[10px] font-bold uppercase">Verified</span>
                               </div>
                             )}
                           </div>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
            </div>
          </div>
        )}

        {tab === 'history' && (
          <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="mb-8 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">Duty History</h2>
                <p className="text-[#a1a1a1] text-sm">Past records for all tasks.</p>
              </div>
            </div>

            <div className="bg-[#171717] border border-[#2e2e2e] rounded-xl overflow-hidden">
               <div className="overflow-x-auto">
                 <table className="w-full text-left">
                   <thead className="bg-[#1c1c1c] text-[10px] uppercase font-bold text-[#666] tracking-wider">
                     <tr>
                       <th className="px-6 py-4">Student</th>
                       <th className="px-6 py-4">Task</th>
                       <th className="px-6 py-4">Duration</th>
                       <th className="px-6 py-4">Hrs</th>
                       <th className="px-6 py-4">Status</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-[#2e2e2e]">
                     {historyRecords.length === 0 ? (
                       <tr><td colSpan={5} className="px-6 py-12 text-center text-[#666] text-sm">No historical records found.</td></tr>
                     ) : historyRecords.map(r => (
                       <tr key={r.id} className="hover:bg-[#1a1a1a] transition-colors">
                         <td className="px-6 py-4">
                           <div className="font-medium text-white text-sm">{r.studentName}</div>
                           <div className="text-[10px] text-[#666]">{r.date}</div>
                         </td>
                         <td className="px-6 py-4 text-sm text-[#ededed]">{r.taskTitle}</td>
                         <td className="px-6 py-4 text-[11px] text-[#a1a1a1] font-mono">{r.timeIn} - {r.timeOut}</td>
                         <td className="px-6 py-4 text-sm font-bold text-[#3ecf8e]">{r.creditHours}</td>
                         <td className="px-6 py-4">
                           <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${r.status === 'verified' ? 'bg-[#3ecf8e]/10 text-[#3ecf8e]' : 'bg-amber-500/10 text-amber-500'}`}>
                             {r.status}
                           </span>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
            </div>
          </div>
        )}
      </main>

      {/* Global Alert Notification */}
      {alert && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-right-4 duration-300">
          <div className={`p-4 rounded-xl border flex items-start gap-4 shadow-2xl min-w-[320px] max-w-md ${
            alert.type === 'success' ? 'bg-[#171717] border-[#3ecf8e]/30' :
            alert.type === 'error' ? 'bg-[#1a1414] border-red-500/30' :
            'bg-[#171717] border-blue-500/30'
          }`}>
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
              alert.type === 'success' ? 'bg-[#3ecf8e]/10 text-[#3ecf8e]' :
              alert.type === 'error' ? 'bg-red-500/10 text-red-500' :
              'bg-blue-500/10 text-blue-400'
            }`}>
              {alert.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : alert.type === 'error' ? <X className="w-5 h-5" /> : <Loader2 className="w-5 h-5" />}
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-bold text-white leading-tight">{alert.title}</h4>
              <p className="text-xs text-[#a1a1a1] mt-1 line-clamp-2">{alert.message}</p>
            </div>
            <button onClick={() => setAlert(null)} className="text-[#666] hover:text-white transition-colors"><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}
    </div>
  );
}
