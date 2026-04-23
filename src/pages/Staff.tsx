import { useState, useEffect } from 'react';
import { collection, query, getDocs, addDoc, updateDoc, doc, serverTimestamp, orderBy, deleteDoc, setDoc, getDoc, onAuthStateChanged, User, signInWithEmailAndPassword, createUserWithEmailAndPassword, db, auth, logout } from '../lib/supabase';
import { useForm } from 'react-hook-form';
import { LayoutDashboard, LogOut, CheckCircle2, Clock, Users, Plus, Loader2, Edit2, Trash2, History, Search, Settings, Upload, Menu, X } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import { useRef } from 'react';
import { formatDate, formatTime, getTodayYYYYMMDD } from '../lib/utils';
import { Navigate, useNavigate } from 'react-router-dom';


import { AlertModal } from '../components/ui/AlertModal';
import { useAlert } from '../hooks/useAlert';

type Task = {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  staffName: string;
  createdAt: any;
};

type ServiceRecord = {
  id: string;
  studentName: string;
  studentNo: string;
  studentEmail: string;
  program: string;
  section: string;
  bracket: string;
  taskTitle: string;
  date: string;
  timeIn: string;
  timeOut: string;
  creditHours: number;
  status: 'pending' | 'verified';
};

type TaskFormData = {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  staffName: string;
};

type AdminMember = {
  id: string;
  displayName: string;
  email: string;
  photoURL?: string;
  role: 'developer' | 'admin' | 'staff' | 'student_assistant';
  lastLogin: any;
  signature?: string;
};

export default function Staff() {
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [records, setRecords] = useState<ServiceRecord[]>([]);
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [tab, setTab] = useState<'tasks' | 'records' | 'members' | 'history' | 'settings'>('tasks');
  const [submittingTask, setSubmittingTask] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskSearch, setTaskSearch] = useState('');
  const [recordsSearch, setRecordsSearch] = useState('');
  const [editingRecord, setEditingRecord] = useState<ServiceRecord | null>(null);
  const [staffOption, setStaffOption] = useState<'me' | 'other'>('me');
  const [savingSignature, setSavingSignature] = useState(false);
  const staffSigCanvas = useRef<SignatureCanvas>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [profileForm, setProfileForm] = useState({ displayName: '', role: '' });
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  const { register, handleSubmit, reset, setValue } = useForm<TaskFormData>();
  const recordForm = useForm<ServiceRecord>();

  const navigate = useNavigate();
  const { modal, showAlert, hideAlert } = useAlert();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const userRef = doc(db, 'admins', u.uid);
          // Initial setup for first-time login or profile sync
          const userSnap = await getDoc(userRef);
          let userRole = '';
          if (!userSnap.exists() || !userSnap.get('displayName')) {
            userRole = u.email === 'christiantomaque18@gmail.com' ? 'developer' : 'student_assistant';
            await setDoc(userRef, {
              email: u.email,
              photoURL: u.photoURL,
              displayName: u.displayName || 'New User',
              role: userRole,
              lastLogin: serverTimestamp()
            }, { merge: true });
          } else {
            userRole = userSnap.data().role;
            await setDoc(userRef, {
              lastLogin: serverTimestamp()
            }, { merge: true });
          }

          // Strict Role Check for Staff Portal
          if (userRole === 'staff' || userRole === 'student_assistant' || userRole === 'developer' || userRole === 'admin') {
            setAuthorized(true);
          } else {
            showAlert(
              "Access Restricted",
              "You do not have the required permissions to access the Staff Portal. Please contact an administrator if you believe this is an error.",
              "error",
              () => navigate('/portal')
            );
          }
        } catch (e) {
           console.error("Auth init error:", e);
        }
      }
      setLoadingAuth(false);
    });
    return () => unsub();
  }, [showAlert, navigate]);

  const fetchData = async () => {
    try {
      const qTasks = query(collection(db, 'tasks'), orderBy('date', 'desc'));
      const qRecords = query(collection(db, 'service_records'), orderBy('createdAt', 'desc'));
      const qMembers = query(collection(db, 'admins'), orderBy('lastLogin', 'desc'));
      
      const [snapTasks, snapRecords, snapMembers] = await Promise.all([
        getDocs(qTasks), 
        getDocs(qRecords),
        getDocs(qMembers)
      ]);
      
      setTasks(snapTasks.docs.map(d => ({ id: d.id, ...d.data() } as Task)));
      setRecords(snapRecords.docs.map(d => ({ id: d.id, ...d.data() } as ServiceRecord)));
      const membersData = snapMembers.docs.map(d => ({ id: d.id, ...d.data() } as AdminMember));
      setMembers(membersData);

      // Set profile form
      const currentMember = membersData.find(m => m.id === user?.uid);
      if (currentMember) {
        setProfileForm({ 
          displayName: currentMember.displayName, 
          role: currentMember.role 
        });
      }
    } catch (e: any) {
      console.error(e);
      showAlert("Connection Error", "Failed to load data. Make sure you are authenticated.", "error");
    }
  };

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const handleLogout = async () => {
    await logout();
  };

  const handleUploadSignature = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showAlert("Upload Error", "Please upload an image file.", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      setSavingSignature(true);
      try {
        await updateDoc(doc(db, 'admins', user!.uid), {
          signature: base64,
          updatedAt: serverTimestamp()
        });
        showAlert("Success", "Signature uploaded successfully!", "success");
        fetchData();
      } catch (err) {
        console.error(err);
        showAlert("Upload Error", "Upload failed.", "error");
      } finally {
        setSavingSignature(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const saveStaffSignature = async () => {
    if (!staffSigCanvas.current || staffSigCanvas.current.isEmpty()) {
       showAlert("Wait!", "Please provide a signature first.", "warning");
       return;
    }

    setSavingSignature(true);
    try {
      let signatureData = '';
      try {
        signatureData = staffSigCanvas.current.getTrimmedCanvas().toDataURL('image/png');
      } catch (e) {
        console.warn("Trimming failed, saving raw canvas", e);
        signatureData = staffSigCanvas.current.getCanvas().toDataURL('image/png');
      }
      await updateDoc(doc(db, 'admins', user!.uid), {
        signature: signatureData,
        updatedAt: serverTimestamp()
      });
      showAlert("Success", "Signature updated successfully!", "success");
      fetchData();
    } catch (error) {
      console.error('Error saving signature:', error);
      showAlert("Error", "Failed to save signature.", "error");
    } finally {
      setSavingSignature(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsUpdatingProfile(true);
    try {
      await updateDoc(doc(db, 'admins', user.uid), {
        displayName: profileForm.displayName,
        role: profileForm.role,
        updatedAt: serverTimestamp()
      });
      showAlert('Success', 'Profile updated successfully!', 'success');
      fetchData();
    } catch (err) {
      console.error(err);
      showAlert("Error", "Failed to update profile.", "error");
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const onTaskSubmit = async (data: TaskFormData) => {
    setSubmittingTask(true);
    try {
      const [startH, startM] = data.startTime.split(':').map(Number);
      const [endH, endM] = data.endTime.split(':').map(Number);
      let durationHours = (endH + (endM || 0) / 60) - (startH + (startM || 0) / 60);
      if (durationHours < 0) durationHours += 24;

      // Set staffName if 'me' option is active
      if (staffOption === 'me') {
        const currentMember = members.find(m => m.id === user?.uid);
        data.staffName = currentMember?.displayName || user?.displayName || user?.email || '';
      }

      const taskData = {
        title: data.title,
        date: data.date,
        startTime: data.startTime,
        endTime: data.endTime,
        staffName: data.staffName,
        duration: Number(durationHours.toFixed(2)),
        updatedAt: serverTimestamp()
      };

      if (editingTask) {
        await updateDoc(doc(db, 'tasks', editingTask.id), taskData);
        setEditingTask(null);
      } else {
        await addDoc(collection(db, 'tasks'), { ...taskData, createdAt: serverTimestamp() });
      }
      
      reset();
      fetchData();
    } catch (e: any) {
      console.error("Firestore action error:", e);
      showAlert("Error", `Action failed: ${e.message || 'Unknown error'}`, "error");
    } finally {
      setSubmittingTask(false);
    }
  };

  const handleEditTask = (task: Task) => {
    if (records.some(r => r.taskTitle === task.title && r.date === task.date)) {
      showAlert("Action Locked", "This task has already been picked by students and cannot be modified.", "warning");
      return;
    }
    setEditingTask(task);
    setValue('title', task.title);
    setValue('date', task.date);
    setValue('startTime', task.startTime);
    setValue('endTime', task.endTime);
    setValue('staffName', task.staffName);

    // Set dropdown option based on if it matches current user
    const currentUserName = members.find(m => m.id === user?.uid)?.displayName || user?.displayName || user?.email || '';
    if (task.staffName === currentUserName) {
      setStaffOption('me');
    } else {
      setStaffOption('other');
    }

    setTab('tasks');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteTask = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (task && records.some(r => r.taskTitle === task.title && r.date === task.date)) {
      showAlert("Action Locked", "This task has already been picked by students and cannot be deleted.", "warning");
      return;
    }
    if (!window.confirm("Are you sure you want to delete this task?")) return;
    try {
      await deleteDoc(doc(db, 'tasks', id));
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleEditRecord = (record: ServiceRecord) => {
    setEditingRecord(record);
    Object.keys(record).forEach((key) => {
      recordForm.setValue(key as any, (record as any)[key]);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteRecord = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this service log? This cannot be undone.")) return;
    try {
      await deleteDoc(doc(db, 'service_records', id));
      fetchData();
    } catch (e) {
      console.error(e);
      showAlert("Error", "Failed to delete record.", "error");
    }
  };

  const handleClockOut = async (record: ServiceRecord) => {
    try {
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      
      const [startH, startM] = record.timeIn.split(':').map(Number);
      const [endH, endM] = currentTime.split(':').map(Number);
      
      let durationHours = 0;
      if (!isNaN(startH) && !isNaN(endH)) {
        durationHours = (endH + (endM || 0) / 60) - (startH + (startM || 0) / 60);
        if (durationHours < 0) durationHours += 24;
      }
      
      const creditHours = Math.min(20, Number(durationHours.toFixed(1)));
      
      await updateDoc(doc(db, 'service_records', record.id), {
        timeOut: currentTime,
        creditHours: creditHours,
        updatedAt: serverTimestamp()
      });
      fetchData();
    } catch (e) {
      console.error(e);
      showAlert("Error", "Failed to clock out student.", "error");
    }
  };

  const onRecordSubmit = async (data: ServiceRecord) => {
    try {
      const { id, ...payload } = data;

      // Calculate duration
      const [startH, startM] = data.timeIn.split(':').map(Number);
      const [endH, endM] = data.timeOut.split(':').map(Number);
      
      let durationHours = 0;
      if (!isNaN(startH) && !isNaN(endH)) {
        durationHours = (endH + (endM || 0) / 60) - (startH + (startM || 0) / 60);
        if (durationHours < 0) durationHours += 24;
      }
      
      // Cap at 20 hours as requested
      payload.creditHours = Math.min(20, Number(durationHours.toFixed(1)));

      await updateDoc(doc(db, 'service_records', id), payload as any);
      setEditingRecord(null);
      fetchData();
      showAlert("Success", "Service log updated successfully.", "success");
    } catch (e) {
      console.error(e);
      showAlert("Error", "Failed to update service log.", "error");
    }
  };

  const handleVerify = async (recordId: string, currentStatus: string) => {
    try {
      const currentMember = members.find(m => m.id === user?.uid);
      const newStatus = currentStatus === 'pending' ? 'verified' : 'pending';

      await updateDoc(doc(db, 'service_records', recordId), { 
        status: newStatus,
        verifiedBy: user?.displayName || user?.email,
        verifiedById: user?.uid, // We save their ID so we can look up their live signature later!
        verifierRole: currentMember?.role || 'staff',
        verifierSignature: currentMember?.signature || null,
        updatedAt: serverTimestamp()
      });

      fetchData();
      showAlert("Success", `Log has been ${newStatus}.`, "success");
    } catch (e) {
      console.error(e);
      showAlert("Error", "Failed to verify log.", "error");
    }
  };

  const activeTasks = tasks.filter(t => t.date >= getTodayYYYYMMDD());
  const historyTasks = tasks.filter(t => t.date < getTodayYYYYMMDD());

  if (loadingAuth || !authorized) return <div className="min-h-screen bg-[#1c1c1c] flex items-center justify-center"><Loader2 className="animate-spin text-[#3ecf8e]" /></div>;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-[#1c1c1c] text-[#ededed] flex flex-col md:flex-row font-sans relative">
      <div className="md:hidden flex items-center justify-between p-4 border-b border-[#2e2e2e] bg-[#171717] sticky top-0 z-20">
        <div className="text-[#ededed] font-bold text-lg flex items-center gap-2 tracking-tight">
          <div className="w-6 h-6 bg-[#3ecf8e] rounded flex items-center justify-center">
            <Users className="w-4 h-4 text-black" />
          </div>
          Staff Portal
        </div>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-[#ededed]">
          {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      <aside className={`fixed md:sticky top-0 h-[100dvh] z-40 w-64 border-r border-[#2e2e2e] bg-[#171717] flex flex-col transform transition-transform duration-300 ease-in-out md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b border-[#2e2e2e] hidden md:block">
          <div className="text-[#ededed] font-bold text-lg flex items-center gap-2 tracking-tight">
             <div className="w-6 h-6 bg-[#3ecf8e] rounded flex items-center justify-center">
                <Users className="w-4 h-4 text-black" />
             </div>
             Staff Portal
          </div>
          <div className="text-[10px] text-[#a1a1a1] mt-1 italic">Assign & Verify Task</div>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <button onClick={() => { setTab('tasks'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2 rounded-md ${tab === 'tasks' ? 'bg-[#2e2e2e] text-[#3ecf8e]' : 'text-[#a1a1a1] hover:bg-[#2e2e2e]'}`}>
            <Plus className="w-4 h-4" />
            <span className="text-sm font-medium">Assign Task</span>
          </button>
          <button onClick={() => { setTab('records'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2 rounded-md ${tab === 'records' ? 'bg-[#2e2e2e] text-[#3ecf8e]' : 'text-[#a1a1a1] hover:bg-[#2e2e2e]'}`}>
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-sm font-medium">Approve Logs</span>
            {records.filter(r => r.status === 'pending').length > 0 && (
              <span className="ml-auto bg-[#3ecf8e] text-black text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                {records.filter(r => r.status === 'pending').length}
              </span>
            )}
          </button>
          <button onClick={() => { setTab('history'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2 rounded-md ${tab === 'history' ? 'bg-[#2e2e2e] text-[#3ecf8e]' : 'text-[#a1a1a1] hover:bg-[#2e2e2e]'}`}>
            <History className="w-4 h-4" />
            <span className="text-sm font-medium">Task History</span>
          </button>
          <button onClick={() => { setTab('members'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2 rounded-md ${tab === 'members' ? 'bg-[#2e2e2e] text-[#3ecf8e]' : 'text-[#a1a1a1] hover:bg-[#2e2e2e]'}`}>
            <Users className="w-4 h-4" />
            <span className="text-sm font-medium">Members</span>
          </button>
          <button onClick={() => { setTab('settings'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2 rounded-md ${tab === 'settings' ? 'bg-[#2e2e2e] text-[#3ecf8e]' : 'text-[#a1a1a1] hover:bg-[#2e2e2e]'}`}>
            <Settings className="w-4 h-4" />
            <span className="text-sm font-medium">Settings</span>
          </button>
        </nav>
        <div className="p-4 border-t border-[#2e2e2e]">
          <button onClick={logout} className="w-full flex items-center gap-3 px-3 py-2 text-[#a1a1a1] hover:text-[#ededed] text-sm">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 p-6 md:p-10 overflow-y-auto">
        {tab === 'tasks' && (
          <div className="max-w-4xl space-y-10">
            <div className="bg-[#171717] border border-[#2e2e2e] p-6 rounded-xl shadow-lg">
              <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                {editingTask ? <Edit2 className="w-5 h-5 text-amber-500" /> : <Plus className="w-5 h-5 text-[#3ecf8e]" />}
                {editingTask ? 'Edit Task Details' : 'Assign New Service Task'}
              </h2>
              <form onSubmit={handleSubmit(onTaskSubmit)} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-4 space-y-1">
                  <label className="text-[10px] uppercase font-bold text-[#a1a1a1]">Task Title</label>
                  <input {...register('title', { required: true })} className="w-full bg-[#1c1c1c] border border-[#2e2e2e] rounded p-2 text-sm focus:border-[#3ecf8e] outline-none" placeholder="e.g. Stage Maintenance" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-[#a1a1a1]">Date</label>
                  <input type="date" {...register('date', { required: true })} className="w-full bg-[#1c1c1c] border border-[#2e2e2e] rounded p-2 text-sm [color-scheme:dark]" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-[#a1a1a1]">Time Start</label>
                  <input type="time" {...register('startTime', { required: true })} className="w-full bg-[#1c1c1c] border border-[#2e2e2e] rounded p-2 text-sm [color-scheme:dark]" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-[#a1a1a1]">Time End</label>
                  <input type="time" {...register('endTime', { required: true })} className="w-full bg-[#1c1c1c] border border-[#2e2e2e] rounded p-2 text-sm [color-scheme:dark]" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold text-[#a1a1a1]">Staff In-Charge</label>
                  <select 
                    value={staffOption}
                    onChange={(e) => {
                      const opt = e.target.value as 'me' | 'other';
                      setStaffOption(opt);
                      if (opt === 'me') {
                        setValue('staffName', members.find(m => m.id === user?.uid)?.displayName || user?.displayName || user?.email || '');
                      } else {
                        setValue('staffName', '');
                      }
                    }}
                    className="w-full bg-[#1c1c1c] border border-[#2e2e2e] rounded p-2 text-sm focus:border-[#3ecf8e] outline-none text-[#ededed]"
                  >
                    <option value="me">Me ({members.find(m => m.id === user?.uid)?.displayName || user?.displayName || 'Staff'})</option>
                    <option value="other">Specify Name...</option>
                  </select>
                  {staffOption === 'other' && (
                    <input 
                      {...register('staffName', { required: staffOption === 'other' })} 
                      className="w-full bg-[#1c1c1c] border border-[#2e2e2e] rounded p-2 text-sm focus:border-[#3ecf8e] outline-none mt-2" 
                      placeholder="Enter staff name"
                    />
                  )}
                  {staffOption === 'me' && (
                    <input type="hidden" {...register('staffName')} />
                  )}
                </div>
                <div className="md:col-span-4 pt-4 flex gap-3">
                  {editingTask && (
                    <button type="button" onClick={() => { setEditingTask(null); reset(); }} className="flex-1 bg-transparent border border-[#2e2e2e] py-2 rounded font-bold text-sm">Cancel</button>
                  )}
                  <button disabled={submittingTask} className={`flex-[2] py-2 rounded font-bold text-sm text-black transition-colors flex items-center justify-center gap-2 ${editingTask ? 'bg-amber-500' : 'bg-[#3ecf8e]'}`}>
                    {submittingTask ? <Loader2 className="animate-spin w-4 h-4" /> : editingTask ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {editingTask ? 'Update Task' : 'Publish Task'}
                   </button>
                </div>
              </form>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h3 className="font-bold uppercase text-xs tracking-widest text-[#a1a1a1]">Active Published Tasks</h3>
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#a1a1a1]" />
                  <input 
                    type="text" 
                    placeholder="Search tasks..." 
                    value={taskSearch}
                    onChange={(e) => setTaskSearch(e.target.value)}
                    className="w-full bg-[#171717] border border-[#2e2e2e] rounded pl-9 pr-3 py-1.5 text-xs focus:border-[#3ecf8e] outline-none transition-colors"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeTasks.filter(t => t.title.toLowerCase().includes(taskSearch.toLowerCase())).length === 0 && (
                  <div className="md:col-span-2 text-center py-10 border border-dashed border-[#2e2e2e] text-[#a1a1a1] rounded">
                    {taskSearch ? 'No tasks matching your search' : 'No active tasks'}
                  </div>
                )}
                {activeTasks.filter(t => t.title.toLowerCase().includes(taskSearch.toLowerCase())).map(t => (
                  <div key={t.id} className="bg-[#171717] border border-[#2e2e2e] p-5 rounded-lg group">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="font-bold text-[#ededed] group-hover:text-[#3ecf8e] transition-colors">{t.title}</h4>
                        <div className="text-[10px] text-[#a1a1a1] font-mono mt-1">{formatDate(t.date)}</div>
                      </div>
                      <div className="flex gap-1">
                        {records.some(r => r.taskTitle === t.title && r.date === t.date) ? (
                          <span className="text-[9px] text-[#555] uppercase font-bold italic pr-2">Locked</span>
                        ) : (
                          <>
                            <button onClick={() => handleEditTask(t)} className="p-1.5 hover:bg-amber-500/10 text-amber-500 rounded transition-colors" title="Edit Task"><Edit2 className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleDeleteTask(t.id)} className="p-1.5 hover:bg-red-500/10 text-red-500 rounded transition-colors" title="Delete Task"><Trash2 className="w-3.5 h-3.5" /></button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between items-end border-t border-[#2e2e2e] pt-4">
                      <div className="text-[10px] uppercase text-[#a1a1a1]">
                        <div>{formatTime(t.startTime)} - {formatTime(t.endTime)}</div>
                        <div className="mt-1">By: {t.staffName}</div>
                      </div>
                      <div className="text-xl font-bold text-[#3ecf8e]">{t.duration} hrs</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'records' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold">Approve Student Logs</h2>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#a1a1a1]" />
              <input 
                type="text" 
                placeholder="Search logs..." 
                value={recordsSearch}
                onChange={(e) => setRecordsSearch(e.target.value)}
                className="w-full bg-[#171717] border border-[#2e2e2e] rounded-md pl-9 pr-3 py-1.5 text-xs focus:border-[#3ecf8e] outline-none"
              />
            </div>

            {editingRecord && (
              <div className="bg-[#171717] border border-amber-500/50 p-6 rounded-xl space-y-4">
                <div className="flex justify-between items-center">
                   <h3 className="text-amber-500 font-bold flex items-center gap-2 text-sm uppercase tracking-wider">
                     <Edit2 className="w-4 h-4" /> Editing Log: {editingRecord.studentName}
                   </h3>
                   <button onClick={() => setEditingRecord(null)} className="text-xs text-[#a1a1a1] hover:text-[#ededed]">Cancel</button>
                </div>
                <form onSubmit={recordForm.handleSubmit(onRecordSubmit)} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-[#a1a1a1]">Student Name</label>
                    <input {...recordForm.register('studentName', { required: true })} className="w-full bg-[#1c1c1c] border border-[#2e2e2e] rounded p-2 text-xs focus:border-[#3ecf8e] outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-[#a1a1a1]">Student No.</label>
                    <input {...recordForm.register('studentNo', { required: true })} className="w-full bg-[#1c1c1c] border border-[#2e2e2e] rounded p-2 text-xs focus:border-[#3ecf8e] outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-[#a1a1a1]">Program</label>
                    <input {...recordForm.register('program', { required: true })} className="w-full bg-[#1c1c1c] border border-[#2e2e2e] rounded p-2 text-xs focus:border-[#3ecf8e] outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-[#a1a1a1]">Section</label>
                    <input {...recordForm.register('section', { required: true })} className="w-full bg-[#1c1c1c] border border-[#2e2e2e] rounded p-2 text-xs focus:border-[#3ecf8e] outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-[#a1a1a1]">Bracket</label>
                    <input {...recordForm.register('bracket', { required: true })} className="w-full bg-[#1c1c1c] border border-[#2e2e2e] rounded p-2 text-xs focus:border-[#3ecf8e] outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-[#a1a1a1]">Task Title</label>
                    <input {...recordForm.register('taskTitle', { required: true })} className="w-full bg-[#1c1c1c] border border-[#2e2e2e] rounded p-2 text-xs focus:border-[#3ecf8e] outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-[#a1a1a1]">Date</label>
                    <input type="date" {...recordForm.register('date', { required: true })} className="w-full bg-[#1c1c1c] border border-[#2e2e2e] rounded p-2 text-xs [color-scheme:dark]" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-[#a1a1a1]">Time In</label>
                    <input type="time" {...recordForm.register('timeIn', { required: true })} className="w-full bg-[#1c1c1c] border border-[#2e2e2e] rounded p-2 text-xs [color-scheme:dark]" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-[#a1a1a1]">Time Out</label>
                    <input type="time" {...recordForm.register('timeOut', { required: true })} className="w-full bg-[#1c1c1c] border border-[#2e2e2e] rounded p-2 text-xs [color-scheme:dark]" />
                  </div>
                  <div className="flex items-end">
                    <button type="submit" className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold py-2 rounded text-xs transition-colors">
                      Save Changes
                    </button>
                  </div>
                  <div className="md:col-span-4 text-[9px] text-amber-500 italic mt-1">
                    * Credit hours are automatically calculated and capped at 20.0h.
                  </div>
                </form>
              </div>
            )}
            <div className="border border-[#2e2e2e] rounded-xl overflow-hidden bg-[#171717] overflow-x-auto w-full">
               <table className="min-w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-[#262626] text-[#a1a1a1] text-[10px] uppercase font-bold tracking-widest border-b border-[#2e2e2e]">
                    <tr>
                       <th className="px-6 py-4">Student Info</th>
                       <th className="px-6 py-4 text-center">Hours</th>
                       <th className="px-6 py-4">Assigned Task</th>
                       <th className="px-6 py-4 text-center">Status</th>
                       <th className="px-6 py-4 text-right">Verification</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2e2e2e]">
                    {records.filter(r => 
                      r.studentName.toLowerCase().includes(recordsSearch.toLowerCase()) || 
                      r.studentNo.toLowerCase().includes(recordsSearch.toLowerCase()) || 
                      r.taskTitle.toLowerCase().includes(recordsSearch.toLowerCase())
                    ).length === 0 ? <tr><td colSpan={5} className="p-10 text-center text-[#a1a1a1]">No records found</td></tr> : records.filter(r => 
                      r.studentName.toLowerCase().includes(recordsSearch.toLowerCase()) || 
                      r.studentNo.toLowerCase().includes(recordsSearch.toLowerCase()) || 
                      r.taskTitle.toLowerCase().includes(recordsSearch.toLowerCase())
                    ).map(r => (
                      <tr key={r.id} className="hover:bg-[#1c1c1c]">
                        <td className="px-6 py-4">
                          <div className="font-bold">{r.studentName}</div>
                          <div className="text-[10px] text-[#a1a1a1]">{r.studentNo} | {r.program}</div>
                        </td>
                        <td className="px-6 py-4 text-center font-bold text-[#3ecf8e]">{r.creditHours}</td>
                        <td className="px-6 py-4">
                           <div className="text-xs">{r.taskTitle}</div>
                           <div className="text-[9px] text-[#a1a1a1] font-mono uppercase">{formatDate(r.date)}</div>
                        </td>
                        <td className="px-6 py-4 text-center">
                           <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${r.status === 'verified' ? 'bg-[#3ecf8e]/20 text-[#3ecf8e]' : 'bg-amber-500/20 text-amber-500'}`}>
                             {r.status}
                           </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end items-center gap-3">
                            <div className="flex gap-1 pr-2 border-r border-[#2e2e2e]">
                              {r.status === 'pending' && (
                                <button 
                                  onClick={() => handleClockOut(r)}
                                  className="p-1.5 text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                                  title="Finish Duty at Current Time"
                                >
                                  <Clock className="w-3.5 h-3.5" />
                                  <span className="text-[10px] font-bold uppercase">Finish</span>
                                </button>
                              )}
                              <button onClick={() => handleEditRecord(r)} className="p-1.5 text-[#a1a1a1] hover:text-amber-500 transition-colors" title="Edit Log"><Edit2 className="w-3.5 h-3.5" /></button>
                              <button onClick={() => handleDeleteRecord(r.id)} className="p-1.5 text-[#a1a1a1] hover:text-red-500 transition-colors" title="Delete Log"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                            <button onClick={() => handleVerify(r.id, r.status)} className={`text-[10px] px-4 py-1.5 rounded font-bold uppercase transition-all ${r.status === 'pending' ? 'bg-[#3ecf8e] text-black hover:bg-[#3ecf8e]/80 shadow-[0_0_10px_rgba(62,207,142,0.2)]' : 'border border-[#2e2e2e] text-[#a1a1a1] hover:text-[#ededed]'}`}>
                               {r.status === 'pending' ? 'Approve' : 'Unapprove'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
               </table>
            </div>
          </div>
        )}

        {tab === 'history' && (
          <div className="space-y-8">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <History className="w-6 h-6 text-[#a1a1a1]" />
              Task Execution History
            </h2>
            <div className="border border-[#2e2e2e] rounded-xl bg-[#171717] overflow-hidden w-full">
               {/* Desktop View */}
               <div className="hidden lg:block overflow-x-auto w-full">
                 <table className="min-w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-[#262626] text-[#a1a1a1] text-[10px] uppercase font-bold tracking-widest border-b border-[#2e2e2e]">
                       <tr>
                          <th className="px-6 py-4">Task Details</th>
                          <th className="px-6 py-4">Publisher</th>
                          <th className="px-6 py-4 text-center">Duration</th>
                          <th className="px-6 py-4">Executors</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2e2e2e]">
                      {historyTasks.length === 0 ? <tr><td colSpan={5} className="p-10 text-center text-[#a1a1a1]">No task history available</td></tr> : historyTasks.map(t => (
                        <tr key={t.id} className="hover:bg-[#1c1c1c]">
                          <td className="px-6 py-4">
                             <div className="font-bold">{t.title}</div>
                             <div className="text-[10px] text-[#a1a1a1] font-mono">{formatDate(t.date)}</div>
                          </td>
                          <td className="px-6 py-4 text-[#a1a1a1]">
                             <div className="text-xs">{t.staffName}</div>
                             <div className="text-[9px]">{formatTime(t.startTime)} - {formatTime(t.endTime)}</div>
                          </td>
                          <td className="px-6 py-4 text-center font-bold text-[#3ecf8e]">{t.duration}h</td>
                          <td className="px-6 py-4">
                             <div className="flex -space-x-2">
                                {records.filter(r => r.taskTitle === t.title && r.date === t.date).slice(0, 3).map((r, i) => (
                                   <div key={i} className="w-6 h-6 rounded-full border border-[#171717] bg-[#2e2e2e] flex items-center justify-center text-[8px] font-bold" title={r.studentName}>
                                      {r.studentName[0]}
                                   </div>
                                ))}
                                {records.filter(r => r.taskTitle === t.title && r.date === t.date).length > 3 && (
                                   <div className="w-6 h-6 rounded-full border border-[#171717] bg-[#3ecf8e]/20 text-[#3ecf8e] flex items-center justify-center text-[8px] font-bold">
                                      +{records.filter(r => r.taskTitle === t.title && r.date === t.date).length - 3}
                                   </div>
                                )}
                                {records.filter(r => r.taskTitle === t.title && r.date === t.date).length === 0 && (
                                  <span className="text-[10px] italic text-[#666]">No students</span>
                                )}
                             </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                             <div className="flex justify-end gap-1">
                                {records.filter(r => r.taskTitle === t.title && r.date === t.date).length > 0 ? (
                                  <span className="text-[9px] text-[#555] uppercase font-bold italic">Locked</span>
                                ) : (
                                  <>
                                    <button onClick={() => handleEditTask(t)} className="p-1.5 hover:bg-amber-500/10 text-amber-500 rounded transition-colors" title="Edit Task"><Edit2 className="w-3.5 h-3.5" /></button>
                                    <button onClick={() => handleDeleteTask(t.id)} className="p-1.5 hover:bg-red-500/10 text-red-500 rounded transition-colors" title="Delete Task"><Trash2 className="w-3.5 h-3.5" /></button>
                                  </>
                                )}
                             </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                 </table>
               </div>
               
               {/* Mobile Card View */}
               <div className="lg:hidden flex flex-col divide-y divide-[#2e2e2e]">
                 {historyTasks.length === 0 ? (
                   <div className="p-8 text-center text-[#a1a1a1] text-sm">No task history available.</div>
                 ) : historyTasks.map(t => {
                   const executors = records.filter(r => r.taskTitle === t.title && r.date === t.date);
                   return (
                     <div key={t.id} className="p-4 space-y-3 hover:bg-[#1c1c1c] transition-colors">
                       <div className="flex justify-between items-start gap-4">
                         <div className="min-w-0 flex-1">
                           <div className="font-bold text-[#ededed] break-words">{t.title}</div>
                           <div className="text-[10px] text-[#a1a1a1] uppercase font-mono mt-0.5">{formatDate(t.date)}</div>
                         </div>
                         <div className="text-right shrink-0">
                           <div className="text-xs text-[#ededed]">{t.staffName}</div>
                           <div className="text-[10px] text-[#a1a1a1]">{formatTime(t.startTime)} - {formatTime(t.endTime)}</div>
                         </div>
                       </div>
                       
                       <div className="flex items-center justify-between bg-[#1c1c1c] p-2 rounded border border-[#2e2e2e]">
                         <div className="flex items-center gap-3">
                           <span className="text-[10px] uppercase font-bold text-[#a1a1a1]">Duration</span>
                           <span className="text-sm font-bold text-[#3ecf8e]">{t.duration}h</span>
                         </div>
                         
                         <div className="flex -space-x-2">
                           {executors.slice(0, 4).map((ex, i) => (
                              <div key={i} className="w-6 h-6 rounded-full border border-[#1c1c1c] bg-[#2e2e2e] flex items-center justify-center text-[9px] font-bold" title={ex.studentName}>
                                 {ex.studentName.charAt(0)}
                              </div>
                           ))}
                           {executors.length > 4 && (
                              <div className="w-6 h-6 rounded-full border border-[#1c1c1c] bg-[#3ecf8e]/20 text-[#3ecf8e] flex items-center justify-center text-[9px] font-bold">
                                 +{executors.length - 4}
                              </div>
                           )}
                           {executors.length === 0 && <span className="text-[9px] italic text-[#666]">No students</span>}
                         </div>
                       </div>
                       
                       <div className="flex justify-end pt-2 border-t border-[#2e2e2e]/50">
                         {executors.length > 0 ? (
                           <span className="text-[9px] text-[#555] uppercase font-bold italic">Locked</span>
                         ) : (
                           <div className="flex gap-2">
                             <button onClick={() => handleEditTask(t)} className="px-3 py-1.5 hover:bg-amber-500/10 text-amber-500 rounded transition-colors text-xs flex items-center gap-1 font-medium"><Edit2 className="w-3.5 h-3.5" /> Edit</button>
                             <button onClick={() => handleDeleteTask(t.id)} className="px-3 py-1.5 hover:bg-red-500/10 text-red-500 rounded transition-colors text-xs flex items-center gap-1 font-medium"><Trash2 className="w-3.5 h-3.5" /> Delete</button>
                           </div>
                         )}
                       </div>
                     </div>
                   );
                 })}
               </div>
            </div>
          </div>
        )}
        {tab === 'members' && (
          <div className="space-y-8 max-w-6xl">
            <div>
              <h2 className="text-xl font-bold tracking-tight">System Members</h2>
              <p className="text-[#a1a1a1] text-sm mt-1">Directory of Registered OSA Admins and Staff Members.</p>
            </div>

            <div className="border border-[#2e2e2e] rounded-lg overflow-hidden bg-[#171717] w-full">
               {/* Desktop Table View */}
               <div className="hidden md:block overflow-x-auto w-full">
                 <table className="min-w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-[#262626] border-b border-[#2e2e2e] text-[#a1a1a1] text-xs font-medium uppercase tracking-wider">
                      <tr>
                         <th className="px-6 py-4">Status</th>
                         <th className="px-6 py-4">User Details</th>
                         <th className="px-6 py-4">System Role</th>
                         <th className="px-6 py-4">Last Active</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2e2e2e]">
                      {members.length === 0 ? (
                        <tr><td colSpan={4} className="px-6 py-10 text-center text-[#a1a1a1]">No members registered yet.</td></tr>
                      ) : members.map(m => (
                        <tr key={m.id} className="hover:bg-[#1c1c1c]">
                          <td className="px-6 py-4">
                             <div className="flex items-center gap-2">
                               <div className={`w-2 h-2 rounded-full ${Date.now() - (m.lastLogin ? new Date(m.lastLogin).getTime() : 0) < 300000 ? 'bg-[#3ecf8e] shadow-[0_0_8px_rgba(62,207,142,0.4)]' : 'bg-[#a1a1a1]'}`} />
                               <span className="text-[10px] uppercase font-bold text-[#a1a1a1]">
                                 {Date.now() - (m.lastLogin ? new Date(m.lastLogin).getTime() : 0) < 300000 ? 'Online' : 'Offline'}
                               </span>
                             </div>
                          </td>
                          <td className="px-6 py-4">
                             <div className="flex items-center gap-3">
                               {m.photoURL ? (
                                 <img src={m.photoURL} alt={m.displayName} className="w-8 h-8 rounded-full border border-[#2e2e2e]" referrerPolicy="no-referrer" />
                               ) : (
                                 <div className="w-8 h-8 rounded-full bg-[#262626] border border-[#2e2e2e] flex items-center justify-center font-bold text-[#a1a1a1]">
                                   {m.displayName.charAt(0)}
                                 </div>
                               )}
                               <div>
                                 <div className="font-bold text-[#ededed]">{m.displayName}</div>
                                 <div className="text-[10px] text-[#a1a1a1]">{m.email}</div>
                               </div>
                             </div>
                          </td>
                           <td className="px-6 py-4">
                             {(members.find(usr => usr.id === user?.uid)?.role === 'developer' || 
                               (members.find(usr => usr.id === user?.uid)?.role === 'admin' && m.role !== 'developer' && m.role !== 'admin' && m.id !== user?.uid)) ? (
                               <select
                                 value={m.role}
                                 onChange={async (e) => {
                                   const newRole = e.target.value as AdminMember['role'];
                                   try {
                                     await updateDoc(doc(db, 'admins', m.id), { role: newRole });
                                     setMembers(prev => prev.map(member => member.id === m.id ? { ...member, role: newRole } : member));
                                     showAlert('Success', `${m.displayName}'s role updated to ${newRole.replace('_', ' ')}`, 'success');
                                   } catch (err) {
                                     showAlert('Error', 'Failed to update user role.', 'error');
                                   }
                                 }}
                                 className="bg-[#1c1c1c] border border-[#2e2e2e] rounded text-xs px-2 py-1 outline-none focus:border-[#3ecf8e] text-[#ededed]"
                               >
                                  <option value="developer" disabled={members.find(usr => usr.id === user?.uid)?.role !== 'developer'}>Developer</option>
                                  <option value="admin" disabled={members.find(usr => usr.id === user?.uid)?.role !== 'developer' && members.find(usr => usr.id === user?.uid)?.role !== 'admin'}>Administrator</option>
                                  <option value="staff">Staff/Faculty</option>
                                  <option value="student_assistant">Student Assistant</option>
                               </select>
                             ) : (
                               <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${m.role === 'admin' || m.role === 'developer' ? 'bg-[#3ecf8e]/20 text-[#3ecf8e]' : 'bg-[#a1a1a1]/20 text-[#a1a1a1]'}`}>
                                 {m.role?.replace('_', ' ')}
                               </span>
                             )}
                          </td>
                          <td className="px-6 py-4 text-[#a1a1a1] text-xs">
                             {m.lastLogin ? formatDate(new Date(m.lastLogin).toISOString()) : 'Never'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                 </table>
               </div>
               
               {/* Mobile Card View */}
               <div className="md:hidden flex flex-col divide-y divide-[#2e2e2e]">
                 {members.length === 0 ? (
                   <div className="p-8 text-center text-[#a1a1a1] text-sm">No members registered yet.</div>
                 ) : members.map(m => (
                   <div key={m.id} className="p-4 space-y-4 hover:bg-[#1c1c1c] transition-colors">
                     <div className="flex justify-between items-start gap-4">
                       <div className="flex items-center gap-3 overflow-hidden">
                         {m.photoURL ? (
                           <img src={m.photoURL} alt={m.displayName} className="w-10 h-10 rounded-full border border-[#2e2e2e] shrink-0" referrerPolicy="no-referrer" />
                         ) : (
                           <div className="w-10 h-10 rounded-full bg-[#262626] border border-[#2e2e2e] flex items-center justify-center font-bold text-[#a1a1a1] shrink-0">
                             {m.displayName.charAt(0)}
                           </div>
                         )}
                         <div className="min-w-0">
                           <div className="font-bold text-[#ededed] truncate">{m.displayName}</div>
                           <div className="text-[10px] text-[#a1a1a1] truncate">{m.email}</div>
                         </div>
                       </div>
                       <div className="flex flex-col items-end shrink-0 gap-1">
                         <div className="flex items-center gap-1.5">
                           <div className={`w-1.5 h-1.5 rounded-full ${Date.now() - (m.lastLogin ? new Date(m.lastLogin).getTime() : 0) < 300000 ? 'bg-[#3ecf8e] shadow-[0_0_8px_rgba(62,207,142,0.4)]' : 'bg-[#a1a1a1]'}`} />
                           <span className="text-[9px] uppercase font-bold text-[#a1a1a1]">
                             {Date.now() - (m.lastLogin ? new Date(m.lastLogin).getTime() : 0) < 300000 ? 'Online' : 'Offline'}
                           </span>
                         </div>
                         <div className="text-[9px] text-[#666]">
                           {m.lastLogin ? formatDate(new Date(m.lastLogin).toISOString()) : 'Never'}
                         </div>
                       </div>
                     </div>
                     <div className="flex justify-between flex-wrap gap-2 items-center bg-[#1c1c1c] p-2 rounded border border-[#2e2e2e]">
                       <span className="text-[10px] uppercase font-bold text-[#a1a1a1]">System Role</span>
                       {(members.find(usr => usr.id === user?.uid)?.role === 'developer' || 
                         (members.find(usr => usr.id === user?.uid)?.role === 'admin' && m.role !== 'developer' && m.role !== 'admin' && m.id !== user?.uid)) ? (
                         <select
                           value={m.role}
                           onChange={async (e) => {
                             const newRole = e.target.value as AdminMember['role'];
                             try {
                               await updateDoc(doc(db, 'admins', m.id), { role: newRole });
                               setMembers(prev => prev.map(member => member.id === m.id ? { ...member, role: newRole } : member));
                               showAlert('Success', `${m.displayName}'s role updated to ${newRole.replace('_', ' ')}`, 'success');
                             } catch (err) {
                               showAlert('Error', 'Failed to update user role.', 'error');
                             }
                           }}
                           className="bg-[#171717] border border-[#3e3e3e] rounded text-xs px-2 py-1.5 outline-none focus:border-[#3ecf8e] text-[#ededed] max-w-[140px]"
                         >
                            <option value="developer" disabled={members.find(usr => usr.id === user?.uid)?.role !== 'developer'}>Developer</option>
                            <option value="admin" disabled={members.find(usr => usr.id === user?.uid)?.role !== 'developer' && members.find(usr => usr.id === user?.uid)?.role !== 'admin'}>Administrator</option>
                            <option value="staff">Staff/Faculty</option>
                            <option value="student_assistant">Student Assistant</option>
                         </select>
                       ) : (
                         <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${m.role === 'admin' || m.role === 'developer' ? 'bg-[#3ecf8e]/20 text-[#3ecf8e]' : 'bg-[#a1a1a1]/20 text-[#a1a1a1]'}`}>
                           {m.role?.replace('_', ' ')}
                         </span>
                       )}
                     </div>
                   </div>
                 ))}
               </div>
            </div>
          </div>
        )}

        {tab === 'settings' && (
          <div className="space-y-8 max-w-4xl">
            <div>
              <h2 className="text-xl font-bold tracking-tight">Account Settings</h2>
              <p className="text-[#a1a1a1] text-sm mt-1">Manage your staff profile and digital signature for verification.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Profile Information */}
              <div className="bg-[#171717] border border-[#2e2e2e] p-6 rounded-xl shadow-lg space-y-6">
                <h3 className="font-bold flex items-center gap-2 text-sm uppercase tracking-wider text-[#3ecf8e]">
                  <Users className="w-4 h-4" /> Personal Information
                </h3>
                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-[#a1a1a1]">Full Name</label>
                    <input 
                      value={profileForm.displayName}
                      onChange={e => setProfileForm({ ...profileForm, displayName: e.target.value })}
                      className="w-full bg-[#1c1c1c] border border-[#2e2e2e] rounded p-2 text-sm focus:border-[#3ecf8e] outline-none" 
                      placeholder="Your Name"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-[#a1a1a1]">System Role</label>
                    <select 
                      value={profileForm.role}
                      onChange={e => setProfileForm({ ...profileForm, role: e.target.value as any })}
                      disabled
                      className="w-full bg-[#1c1c1c]/50 border border-[#2e2e2e] rounded p-2 text-sm text-[#666] cursor-not-allowed outline-none"
                    >
                      <option value="developer">Developer</option>
                      <option value="admin">Administrator</option>
                      <option value="staff">Staff/Faculty</option>
                      <option value="student_assistant">Student Assistant</option>
                    </select>
                    <p className="text-[9px] text-[#555] italic pt-1">Contact an administrator to change your system role.</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-[#a1a1a1]">Email Address</label>
                    <input 
                      value={user?.email || ''} 
                      disabled 
                      className="w-full bg-[#1c1c1c]/50 border border-[#2e2e2e] rounded p-2 text-sm text-[#666] cursor-not-allowed" 
                    />
                  </div>
                  <button 
                    type="submit" 
                    disabled={isUpdatingProfile}
                    className="w-full bg-[#3ecf8e] hover:bg-[#34b27b] text-black font-bold py-2 rounded text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    {isUpdatingProfile ? <Loader2 className="animate-spin w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
                    Update Profile
                  </button>
                </form>
              </div>

              {/* Digital Signature */}
              <div className="bg-[#171717] border border-[#2e2e2e] p-6 rounded-xl shadow-lg space-y-6">
                <h3 className="font-bold flex items-center gap-2 text-sm uppercase tracking-wider text-[#3ecf8e]">
                   <Edit2 className="w-4 h-4" /> Digital Signature
                </h3>
                <div className="space-y-4">
                   <div className="border border-[#2e2e2e] bg-[#1c1c1c] rounded-lg p-2 flex flex-col items-center">
                     <p className="text-[10px] text-[#a1a1a1] mb-2 uppercase font-bold tracking-widest">Draw your signature</p>
                     <div className="bg-white rounded w-full">
                       <SignatureCanvas 
                         ref={staffSigCanvas}
                         penColor='black'
                         backgroundColor="white"
                         canvasProps={{className: 'signature-canvas w-full h-40'}} 
                       />
                     </div>
                     <div className="flex w-full gap-2 mt-2">
                       <button 
                         onClick={() => staffSigCanvas.current?.clear()}
                         className="flex-1 bg-[#262626] hover:bg-[#2e2e2e] py-1.5 rounded text-[10px] font-bold uppercase transition-colors"
                       >
                         Clear
                       </button>
                       <button 
                         onClick={saveStaffSignature}
                         disabled={savingSignature}
                         className="flex-[2] bg-[#3ecf8e] hover:bg-[#34b27b] text-black py-1.5 rounded text-[10px] font-bold uppercase transition-colors flex items-center justify-center gap-2"
                       >
                         {savingSignature ? <Loader2 className="animate-spin w-4 h-4" /> : 'Save Drawn'}
                       </button>
                     </div>
                   </div>

                   <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-[#2e2e2e]"></span>
                      </div>
                      <div className="relative flex justify-center text-[10px] uppercase">
                        <span className="bg-[#171717] px-2 text-[#a1a1a1] font-bold">OR</span>
                      </div>
                   </div>

                   <div className="space-y-2">
                      <p className="text-[10px] text-[#a1a1a1] uppercase font-bold tracking-widest text-center">Upload Signature Image</p>
                      <input 
                        type="file" 
                        ref={fileInputRef}
                        onChange={handleUploadSignature}
                        accept="image/*"
                        className="hidden" 
                      />
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={savingSignature}
                        className="w-full border border-[#2e2e2e] border-dashed hover:border-[#3ecf8e]/50 hover:bg-[#3ecf8e]/5 py-4 rounded-lg transition-all flex flex-col items-center gap-2 group"
                      >
                         <Upload className="w-6 h-6 text-[#a1a1a1] group-hover:text-[#3ecf8e] transition-colors" />
                         <span className="text-[10px] font-bold uppercase text-[#a1a1a1] group-hover:text-[#ededed]">Click to upload image</span>
                      </button>
                      <p className="text-[9px] text-[#666] text-center italic">Supported: PNG, JPG, JPEG (Max 2MB)</p>
                   </div>

                   {members.find(m => m.id === user?.uid)?.signature && (
                      <div className="pt-4 border-t border-[#2e2e2e]">
                        <p className="text-[10px] text-[#a1a1a1] mb-2 uppercase font-bold tracking-widest">Current Signature</p>
                        <div className="bg-white p-2 rounded flex justify-center">
                          <img src={members.find(m => m.id === user?.uid)?.signature} alt="Current Signature" className="h-16 object-contain" />
                        </div>
                      </div>
                   )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <AlertModal
        isOpen={modal.isOpen}
        onClose={() => {
          hideAlert();
          if (modal.title === 'Access Restricted') {
            window.location.href = '/login';
          }
        }}
        title={modal.title}
        message={modal.message}
        type={modal.type}
      />
    </div>
  );
}
