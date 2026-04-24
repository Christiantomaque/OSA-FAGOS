import { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, getDoc, serverTimestamp, setDoc, onAuthStateChanged, User, db, auth, logout, onSnapshot } from '../lib/supabase';
import { LayoutDashboard, LogOut, CheckCircle2, Clock, Users, Loader2, Menu, X, Terminal, Shield, Activity, Database, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type AdminMember = {
  id: string;
  displayName: string;
  role: 'admin' | 'staff' | 'developer' | 'student_assistant';
  lastLogin: any;
  email: string;
};

export default function Developer() {
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [stats, setStats] = useState({ users: 0, tasks: 0, records: 0 });
  const [logs, setLogs] = useState<any[]>([]);
  
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        const docRef = doc(db, 'admins', u.uid);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const role = snap.data().role;
          if (role === 'developer' || role === 'admin') {
            setAuthorized(true);
            await setDoc(docRef, { lastLogin: serverTimestamp() }, { merge: true });
          } else {
            logout().then(() => navigate('/login'));
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

    // Listeners for global stats
    const unsubMembers = onSnapshot(collection(db, 'admins'), (snap) => {
      setMembers(snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as AdminMember)));
      setStats(prev => ({ ...prev, users: snap.size }));
    });

    const unsubTasks = onSnapshot(collection(db, 'tasks'), (snap) => {
      setStats(prev => ({ ...prev, tasks: snap.size }));
    });

    const unsubRecords = onSnapshot(collection(db, 'service_records'), (snap) => {
      setStats(prev => ({ ...prev, records: snap.size }));
    });

    return () => {
      unsubMembers();
      unsubTasks();
      unsubRecords();
    };
  }, [user, authorized]);

  const handleLogout = () => logout().then(() => navigate('/login'));

  if (loadingAuth || !authorized) {
    return <div className="min-h-screen bg-black flex items-center justify-center font-mono"><Loader2 className="animate-spin text-[#3ecf8e]" /><span className="ml-4 text-[#3ecf8e]">INITIALIZING SYSTEM...</span></div>;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#3ecf8e] font-mono flex flex-col md:flex-row border-4 border-[#1a1a1a]">
      {/* Dev Sidebar */}
      <aside className="w-full md:w-64 bg-black border-r border-[#1a1a1a] flex flex-col shadow-[10px_0_30px_rgba(0,0,0,0.5)]">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-10 border-b border-[#3ecf8e]/20 pb-6">
            <Terminal className="w-8 h-8 text-[#3ecf8e]" />
            <div>
              <h1 className="font-bold text-lg leading-none tracking-tighter">DEV_CONSOLE</h1>
              <p className="text-[10px] text-[#3ecf8e]/50 mt-1 uppercase tracking-widest">SysAdmin Mode</p>
            </div>
          </div>

          <nav className="space-y-2">
            <div className="px-4 py-2 bg-[#3ecf8e]/10 border border-[#3ecf8e]/30 rounded text-sm flex items-center gap-3">
              <Activity className="w-4 h-4" />
              SYSTEM OVERVIEW
            </div>
            <button onClick={() => navigate('/admin')} className="w-full text-left px-4 py-3 hover:bg-[#3ecf8e]/10 rounded text-sm transition-all border border-transparent hover:border-[#3ecf8e]/30 flex items-center gap-3">
              <Shield className="w-4 h-4" />
              ADMIN CONTROL
            </button>
            <button onClick={() => navigate('/staff')} className="w-full text-left px-4 py-3 hover:bg-[#3ecf8e]/10 rounded text-sm transition-all border border-transparent hover:border-[#3ecf8e]/30 flex items-center gap-3">
              <Users className="w-4 h-4" />
              STAFF PORTAL
            </button>
          </nav>
        </div>

        <div className="mt-auto p-6 bg-black border-t border-[#1a1a1a]">
          <div className="text-[10px] text-[#3ecf8e]/40 mb-4 font-bold border-b border-[#3ecf8e]/10 pb-2 flex items-center gap-2">
             <Database className="w-3 h-3" />
             NODE_V1.1 PREVIEW
          </div>
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded bg-red-500/10 text-red-500 hover:bg-red-500/20 text-sm border border-red-500/30 transition-all font-bold">
            <LogOut className="w-4 h-4" />
            CORE_EXIT
          </button>
        </div>
      </aside>

      {/* Main Console */}
      <main className="flex-1 p-6 md:p-12 overflow-y-auto bg-[radial-gradient(circle_at_top_right,_#111,_#0a0a0a)]">
        <div className="max-w-6xl mx-auto space-y-12">
          {/* System Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between border-b-2 border-[#1a1a1a] pb-8 gap-6">
            <div>
              <div className="text-[10px] text-[#3ecf8e]/30 mb-2 font-bold tracking-[0.3em]">ROOT ACCESS GRANTED</div>
              <h2 className="text-4xl font-black text-white tracking-tighter">ENVIRONMENT METRICS</h2>
            </div>
            <div className="bg-[#1a1a1a] p-4 rounded border border-[#3ecf8e]/10 flex items-center gap-10">
               <div>
                  <div className="text-[9px] text-[#3ecf8e]/40 mb-1 font-bold">STATUS</div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-[#3ecf8e] rounded-full animate-pulse shadow-[0_0_10px_#3ecf8e]" />
                    <span className="text-sm font-bold">LIVE</span>
                  </div>
               </div>
               <div>
                  <div className="text-[9px] text-[#3ecf8e]/40 mb-1 font-bold">UPTIME</div>
                  <div className="text-sm font-bold">99.98%</div>
               </div>
               <div>
                  <div className="text-[9px] text-[#3ecf8e]/40 mb-1 font-bold">SESSION_ID</div>
                  <div className="text-sm font-bold text-[#3ecf8e]/60">{user?.uid.substring(0, 8)}</div>
               </div>
            </div>
          </div>

          {/* Metric Grids */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-black/40 border border-[#1a1a1a] p-8 rounded-lg hover:border-[#3ecf8e]/30 transition-all group">
              <div className="text-[10px] text-[#3ecf8e]/40 mb-4 font-bold tracking-widest group-hover:text-[#3ecf8e] transition-colors">TOTAL_MEMBERS</div>
              <div className="text-5xl font-black text-white mb-2">{stats.users}</div>
              <div className="text-[10px] text-[#3ecf8e]/60">ACROSS ALL ROLES</div>
            </div>
            <div className="bg-black/40 border border-[#1a1a1a] p-8 rounded-lg hover:border-[#3ecf8e]/30 transition-all group">
              <div className="text-[10px] text-[#3ecf8e]/40 mb-4 font-bold tracking-widest group-hover:text-[#3ecf8e] transition-colors">ACTIVE_TASKS</div>
              <div className="text-5xl font-black text-white mb-2">{stats.tasks}</div>
              <div className="text-[10px] text-[#3ecf8e]/60">GLOBAL REPOSITORY</div>
            </div>
            <div className="bg-black/40 border border-[#1a1a1a] p-8 rounded-lg hover:border-[#3ecf8e]/30 transition-all group">
              <div className="text-[10px] text-[#3ecf8e]/40 mb-4 font-bold tracking-widest group-hover:text-[#3ecf8e] transition-colors">SERVICE_ENTRIES</div>
              <div className="text-5xl font-black text-white mb-2">{stats.records}</div>
              <div className="text-[10px] text-[#3ecf8e]/60">DATABASE LOGS</div>
            </div>
          </div>

          {/* User Directory */}
          <div className="bg-black border border-[#1a1a1a] rounded-lg overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-[#1a1a1a] bg-[#111] flex items-center justify-between">
               <h3 className="text-xs font-bold uppercase tracking-[0.2em] flex items-center gap-2">
                 <Shield className="w-4 h-4 text-[#3ecf8e]" />
                 Access Hierarchy
               </h3>
               <div className="text-[10px] text-[#3ecf8e]/40">UID REGISTER</div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-[#0f0f0f] text-[10px] uppercase font-bold text-[#3ecf8e]/40 tracking-widest border-b border-[#1a1a1a]">
                  <tr>
                    <th className="px-8 py-5">IDENTIFIER</th>
                    <th className="px-8 py-5">UID_HASH</th>
                    <th className="px-8 py-5">PERMISSION_LEVEL</th>
                    <th className="px-8 py-5 text-right">LAST_AUTH</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1a1a1a]">
                  {members.map(m => (
                    <tr key={m.id} className="hover:bg-[#3ecf8e]/5 transition-colors group">
                      <td className="px-8 py-6">
                        <div className="font-bold text-white group-hover:text-[#3ecf8e] transition-colors uppercase">{m.displayName}</div>
                        <div className="text-[10px] text-[#3ecf8e]/40 mt-1">{m.email}</div>
                      </td>
                      <td className="px-8 py-6">
                        <code className="text-[#3ecf8e]/30 group-hover:text-[#3ecf8e]/60 text-xs transition-colors">{m.id.substring(0, 16)}...</code>
                      </td>
                      <td className="px-8 py-6">
                        <span className={`text-[10px] px-3 py-1 rounded border font-black uppercase tracking-tighter ${
                          m.role === 'developer' ? 'bg-[#3ecf8e]/10 border-[#3ecf8e]/50 text-[#3ecf8e]' :
                          m.role === 'admin' ? 'bg-white/10 border-white/50 text-white' :
                          'bg-[#1a1a1a] border-[#1a1a1a] text-[#3ecf8e]/50'
                        }`}>
                          {m.role}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-right">
                         <div className="text-[11px] text-[#3ecf8e]/40 font-bold italic">
                           {m.lastLogin ? new Date(m.lastLogin.toDate()).toLocaleString() : 'OFFLINE'}
                         </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="p-8 border-2 border-dashed border-[#1a1a1a] rounded-lg text-center">
             <Settings className="w-12 h-12 text-[#1a1a1a] mx-auto mb-4" />
             <div className="text-[12px] text-[#3ecf8e]/20 font-bold uppercase tracking-widest font-mono">End of Console logs</div>
          </div>
        </div>
      </main>
    </div>
  );
}
