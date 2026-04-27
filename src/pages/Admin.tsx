import { useState, useEffect, useRef } from 'react';

const LiveClock = ({ startTime, accumulatedSeconds = 0, scheduledEndTime, onTimeUp }: { startTime?: string, accumulatedSeconds?: number, scheduledEndTime?: string, onTimeUp?: () => void }) => {
  const [totalSeconds, setTotalSeconds] = useState(accumulatedSeconds);
  const [isAutoStopped, setIsAutoStopped] = useState(false);
  const hasFired = useRef(false);

  useEffect(() => {
    if (!startTime) {
      setTotalSeconds(accumulatedSeconds);
      return;
    }

    const start = new Date(startTime).getTime();
    let endTarget = Infinity;

    if (scheduledEndTime) {
       const end = new Date(scheduledEndTime).getTime();
       endTarget = end;
       if (endTarget <= start) {
          const d = new Date(endTarget);
          d.setDate(d.getDate() + 1);
          endTarget = d.getTime();
       }
    }

    const updateClock = () => {
      const now = Date.now();
      
      if (now >= endTarget) {
        const delta = Math.floor((endTarget - start) / 1000);
        setTotalSeconds(accumulatedSeconds + delta);
        
        if (!isAutoStopped) {
           setIsAutoStopped(true);
           if (onTimeUp && !hasFired.current) {
               hasFired.current = true;
               onTimeUp(); 
           }
        }
        return true; 
      } else {
        setTotalSeconds(accumulatedSeconds + Math.floor((now - start) / 1000));
        return false; 
      }
    };

    if (updateClock()) return;
    const interval = setInterval(() => {
      if (updateClock()) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime, accumulatedSeconds, scheduledEndTime, isAutoStopped, onTimeUp]);

  const formatDynamicTime = (secs: number) => {
    if (secs < 60) return `${secs} SEC${secs !== 1 ? 'S' : ''}`;
    if (secs < 3600) {
      const mins = Math.floor(secs / 60);
      return `${mins} MIN${mins !== 1 ? 'S' : ''}`;
    }
    const hrs = Number((secs / 3600).toFixed(1));
    return `${hrs} HR${hrs !== 1 ? 'S' : ''}`;
  };

  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  
  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-2">
        <span className={`font-mono text-lg font-black tracking-tighter ${isAutoStopped ? 'text-red-500' : 'text-[#3ecf8e]'}`}>
          {hrs.toString().padStart(2, '0')}:{mins.toString().padStart(2, '0')}:{secs.toString().padStart(2, '0')}
        </span>
        <span className="text-[10px] font-bold text-[#a1a1a1] uppercase bg-[#262626] px-1.5 py-0.5 rounded border border-[#2e2e2e]">
          {formatDynamicTimeDisplay(totalSeconds)}
        </span>
      </div>
      {isAutoStopped && (
        <span className="text-[9px] font-black text-red-500 uppercase tracking-widest mt-1 bg-red-500/10 px-2 py-0.5 rounded">
          Auto-Stopped
        </span>
      )}
    </div>
  );
};
import { collection, query, getDocs, addDoc, updateDoc, doc, getDoc, serverTimestamp, orderBy, deleteDoc, setDoc, onAuthStateChanged, User, signInWithEmailAndPassword, createUserWithEmailAndPassword, db, auth, logout, onSnapshot } from '../lib/supabase';
import { useForm } from 'react-hook-form';
import { LayoutDashboard, LogOut, CheckCircle2, Clock, Users, Plus, Loader2, Mail, Edit2, Trash2, History, ChevronRight, Search, AlertCircle, Settings, Upload, Printer, RotateCcw, Menu, X, CheckSquare } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import { generateObligationPDF } from '../utils/pdfGenerator';
import { formatDate, formatTime, getTodayYYYYMMDD, getHHMM, formatDynamicTimeDisplay } from '../lib/utils';
import { Link, Navigate, useNavigate } from 'react-router-dom';

import { AlertModal } from '../components/ui/AlertModal';
import { useAlert } from '../hooks/useAlert';

type Task = {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  capacity: number;
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
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  taskId?: string;
  creditHours: number;
  staffName?: string;
  status: 'pending' | 'verified' | 'active' | 'paused' | 'auto_stopped';
  startTime?: any;
  accumulated_seconds?: number;
};

type TaskFormData = {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  capacity: number;
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

type StudentProgress = {
  studentNo: string;
  studentName: string;
  studentEmail: string;
  program: string;
  section: string;
  bracket: string;
  totalHours: number;
  verifiedHours: number;
  records: ServiceRecord[];
  hasNameMismatch?: boolean;
  allNames?: string[];
  approval?: CompletionApproval;
};

type CompletionApproval = {
  id: string;
  studentNo: string;
  approverName: string;
  approverRole: string;
  approverSignature: string;
  approvedAt: any;
};

export default function Admin() {
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  
  const getAdjustedEndTime = (record: ServiceRecord) => {
    const endStr = record.scheduledEndTime || tasks.find(t => t.id === record.taskId)?.endTime;
    const startStr = record.scheduledStartTime || tasks.find(t => t.id === record.taskId)?.startTime || record.timeIn;
    if (!endStr) return null;
    const end = new Date(endStr).getTime();
    const start = new Date(startStr).getTime();
    return end <= start ? end + 86400000 : end;
  };

  const isAutoStoppedIllusion = (record: ServiceRecord) => {
    if (record.status !== 'active') return false;
    const adjustedEnd = getAdjustedEndTime(record);
    return adjustedEnd ? Date.now() > adjustedEnd : false;
  };

  const [authorized, setAuthorized] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [records, setRecords] = useState<ServiceRecord[]>([]);
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [approvals, setApprovals] = useState<CompletionApproval[]>([]);
  const [tab, setTab] = useState<'tasks' | 'records' | 'progress' | 'members' | 'history' | 'settings'>(() => {
    return (localStorage.getItem('admin_active_tab') as any) || 'tasks';
  });

  useEffect(() => {
    localStorage.setItem('admin_active_tab', tab);
  }, [tab]);
  const [submittingTask, setSubmittingTask] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskSearch, setTaskSearch] = useState('');
  const [editingRecord, setEditingRecord] = useState<ServiceRecord | null>(null);
  const [staffOption, setStaffOption] = useState<'me' | 'other'>('me');
  const [searchTerm, setSearchTerm] = useState('');
  // ============================================================================
  // LAZY SNAPSHOT TRIGGER: Run piggyback sweeper once on mount
  // ============================================================================
  useEffect(() => {
    const triggerSweep = async () => {
      try {
        console.log("[Lazy Sweep] Triggering backend piggyback cleanup...");
        await fetch('/api/service-records'); // This GET triggers sweepActiveRecords() on backend
      } catch (e) {
        console.error("[Lazy Sweep] Trigger failed", e);
      }
    };
    if (authorized) triggerSweep();
  }, [authorized]);

  const [recordsSearch, setRecordsSearch] = useState('');
  const [progressSearch, setProgressSearch] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [membersSearch, setMembersSearch] = useState('');
  const [savingSignature, setSavingSignature] = useState(false);
  const adminSigCanvas = useRef<SignatureCanvas>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [profileForm, setProfileForm] = useState({ displayName: '', role: '' });
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // Settings
  const [allowSignups, setAllowSignups] = useState(true);

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
          
          // Initial setup for first-time login
          const userDoc = await getDoc(userRef);
          let userRole = '';
          if (!userDoc.exists() || !userDoc.data().role) {
             userRole = u.email === 'christiantomaque18@gmail.com' ? 'developer' : 'student_assistant';
             await setDoc(userRef, {
              email: u.email,
              photoURL: u.photoURL,
              displayName: u.displayName || 'New User',
              role: userRole, 
              lastLogin: serverTimestamp()
            }, { merge: true });
          } else {
             userRole = userDoc.data().role;
             // Update admin profile on every login (only essential info)
             await setDoc(userRef, {
               email: u.email,
               photoURL: u.photoURL,
               lastLogin: serverTimestamp()
             }, { merge: true });
          }

          // Strict Role Check for Admin Dashboard
          if (userRole === 'admin' || userRole === 'developer') {
            setAuthorized(true);
          } else {
            showAlert(
              "Access Restricted",
              "You do not have the required permissions to access the Admin Dashboard. Only Developers and Administrators can access this portal.",
              "error",
              () => {
                if (userRole === 'staff' || userRole === 'student_assistant') {
                  navigate('/staff');
                } else {
                  navigate('/portal');
                }
              }
            );
          }
        } catch (e) {
          console.error("Auth routing init error", e);
        }
      }
      setLoadingAuth(false);
    });
    return () => unsub();
  }, [showAlert, navigate]);

  useEffect(() => {
    if (!user) return;

    // 1. Tasks Listener
    const unsubTasks = onSnapshot(
      query(collection(db, 'tasks'), orderBy('date', 'desc')),
      (snap) => {
        setTasks(snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Task)));
      }
    );

    // 2. Records Listener
    const unsubRecords = onSnapshot(
      query(collection(db, 'service_records'), orderBy('createdAt', 'desc')),
      (snap) => {
        setRecords(snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as ServiceRecord)));
      }
    );

    // 3. Members Listener
    const unsubMembers = onSnapshot(
      query(collection(db, 'admins'), orderBy('lastLogin', 'desc')),
      (snap) => {
        const membersData = snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as AdminMember));
        setMembers(membersData);
        
        // Update profile form if current user is found
        const currentMember = membersData.find((m: any) => m.id === user?.uid);
        if (currentMember) {
          setProfileForm({ 
            displayName: currentMember.displayName, 
            role: currentMember.role 
          });
        }
      }
    );

    // 4. Approvals Listener
    const unsubApprovals = onSnapshot(
      query(collection(db, 'completions')),
      (snap) => {
        setApprovals(snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as CompletionApproval)));
      }
    );

    // 5. Settings Listener
    const unsubSettings = onSnapshot(
      doc(db, 'settings', 'global'),
      (snap: any) => {
        if (snap.exists() && snap.data().allowSignups !== undefined) {
          setAllowSignups(snap.data().allowSignups);
        }
      }
    );

    return () => {
      unsubTasks();
      unsubRecords();
      unsubMembers();
      unsubApprovals();
      unsubSettings();
    };
  }, [user]);

  const handleToggleSignups = async () => {
    try {
      const newValue = !allowSignups;
      await setDoc(doc(db, 'settings', 'global'), { allowSignups: newValue }, { merge: true });
      setAllowSignups(newValue);
      showAlert("Settings Updated", newValue ? "System signups enabled." : "System signups disabled.", "success");
    } catch (error) {
       console.error("Failed to update settings", error);
       showAlert("Error", "Failed to update system settings.", "error");
    }
  };

  const handleUploadSignature = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showAlert("Invalid File", "Please upload an image file.", "warning");
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
      } catch (err) {
        console.error(err);
        showAlert("Error", "Upload failed.", "error");
      } finally {
        setSavingSignature(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsUpdatingProfile(true);
    try {
      // SECURITY FIX: Completely removed the ability to push a 'role' update from the personal profile form.
      await updateDoc(doc(db, 'admins', user.uid), {
        displayName: profileForm.displayName,
        updatedAt: serverTimestamp()
      });
      showAlert("Profile Updated", "Your profile information has been successfully updated.", "success");
      // Result handled by onSnapshot
    } catch (err) {
      console.error(err);
      showAlert("Error", "Failed to update profile.", "error");
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const saveAdminSignature = async () => {
    if (!adminSigCanvas.current || adminSigCanvas.current.isEmpty()) {
       showAlert("Wait!", "Please provide a signature first.", "warning");
       return;
    }

    setSavingSignature(true);
    try {
      if (!user) throw new Error("No authenticated user");
      let signatureData = '';
      try {
        const svgData = adminSigCanvas.current?.getSignaturePad().toDataURL('image/svg+xml');
        if (svgData) {
          signatureData = svgData;
        }
      } catch (e) {
        console.error("Signature capture failed", e);
      }
      
      const userRef = doc(db, 'admins', user.uid);
      await setDoc(userRef, {
        signature: signatureData,
        lastLogin: serverTimestamp() 
      }, { merge: true });
      
      showAlert("Success", "Signature saved successfully!", "success");
      // Result handled by onSnapshot
    } catch (error: any) {
      console.error('Error saving signature:', error);
      showAlert("Error", "Failed to save signature: " + error.message, "error");
    } finally {
      setSavingSignature(false);
    }
  };

  const onTaskSubmit = async (data: TaskFormData) => {
    setSubmittingTask(true);
    try {
      // --- TIME VALIDATION CHECKS ---
      const today = getTodayYYYYMMDD();
      const now = new Date();
      const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      // Prevent selecting a past time if the task is scheduled for today
      if (data.date === today && data.startTime < currentTimeStr) {
        showAlert("Invalid Time", "You cannot schedule a task to start in the past today.", "warning");
        setSubmittingTask(false);
        return;
      }

      // Prevent the end time from being before the start time
      if (data.endTime <= data.startTime) {
         showAlert("Invalid Schedule", "End time must be after the start time.", "warning");
         setSubmittingTask(false);
         return;
      }

      // Calculate duration robustly
      const [startH, startM] = data.startTime.split(':').map(Number);
      const [endH, endM] = data.endTime.split(':').map(Number);
      
      let durationHours = 0;
      if (!isNaN(startH) && !isNaN(endH)) {
        durationHours = (endH + (endM || 0) / 60) - (startH + (startM || 0) / 60);
        if (durationHours < 0) durationHours += 24;
      }

      if (isNaN(durationHours) || durationHours < 0) durationHours = 0;

      // Set staffName if 'me' option is active
      if (staffOption === 'me') {
        const currentMember = members.find(m => m.id === user?.uid);
        data.staffName = currentMember?.displayName || user?.displayName || user?.email || '';
      }

      let isoStart = data.startTime;
      let isoEnd = data.endTime;
      if (data.startTime && !data.startTime.includes('T')) {
         const startObj = new Date(`${data.date}T${data.startTime}:00`);
         const endObj = new Date(`${data.date}T${data.endTime}:00`);
         if (endObj.getTime() <= startObj.getTime()) {
            endObj.setDate(endObj.getDate() + 1);
         }
         isoStart = startObj.toISOString();
         isoEnd = endObj.toISOString();
      }

      const taskPayload = {
        title: data.title,
        date: data.date,
        startTime: isoStart,
        endTime: isoEnd,
        staffName: data.staffName,
        capacity: Number(data.capacity) || 1,
        duration: Number(durationHours.toFixed(2)),
        updatedAt: serverTimestamp()
      };

      if (editingTask) {
        await updateDoc(doc(db, 'tasks', editingTask.id), taskPayload);
        setEditingTask(null);
      } else {
        await addDoc(collection(db, 'tasks'), {
          ...taskPayload,
          createdAt: serverTimestamp()
        });
      }
      
      reset();
      // Result handled by onSnapshot
    } catch (e: any) {
      console.error("Task submission error:", e);
      showAlert("Error", `Error saving task: ${e.message || 'Unknown error'}`, "error");
    } finally {
      setSubmittingTask(false);
    }
  };

  const handleUpdateRole = async (targetId: string, newRole: AdminMember['role'], targetDisplayName: string, targetCurrentRole: AdminMember['role']) => {
    const currentUserRole = members.find(usr => usr.id === user?.uid)?.role;
    if (!currentUserRole) return;

    // 1. Hierarchy Locks
    if (currentUserRole === 'staff' || currentUserRole === 'student_assistant') {
      showAlert('Error', 'You do not have permission to manage roles.', 'error');
      return;
    }

    if (currentUserRole === 'admin') {
      if (targetCurrentRole === 'developer') {
        showAlert('Error', 'Administrators cannot modify Developer accounts.', 'error');
        return;
      }
      if (targetCurrentRole === 'admin' && targetId !== user?.uid) {
         showAlert('Error', 'Administrators cannot modify other Administrator accounts.', 'error');
         return;
      }
      if (newRole === 'developer') {
        showAlert('Error', 'Administrators cannot promote accounts to Developer.', 'error');
        return;
      }
    }

    // Developer can do anything

    try {
      await updateDoc(doc(db, 'admins', targetId), { role: newRole, updatedAt: serverTimestamp() });
      setMembers(prev => prev.map(member => member.id === targetId ? { ...member, role: newRole } : member));
      showAlert('Success', `${targetDisplayName}'s role updated to ${newRole.replace('_', ' ').toUpperCase()}`, 'success');
    } catch (err) {
      showAlert('Error', 'Failed to update user role.', 'error');
    }
  };

  const handleEditTask = (task: Task) => {
    if (records.some(r => r.taskTitle === task.title && r.date === task.date)) {
      showAlert("Task Locked", "This task has already been picked by students and cannot be modified.", "warning");
      return;
    }
    setEditingTask(task);
    setValue('title', task.title);
    setValue('date', task.date);
    setValue('startTime', getHHMM(task.startTime));
    setValue('endTime', getHHMM(task.endTime));
    setValue('staffName', task.staffName);
    setValue('capacity', task.capacity || 1);
    
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
      showAlert("Task Locked", "This task has already been picked by students and cannot be deleted.", "warning");
      return;
    }
    if (!window.confirm("Delete this task? All records linked to it will remain but orphaned from the schedule.")) return;
    try {
      await deleteDoc(doc(db, 'tasks', id));
      // Result handled by onSnapshot
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
      // Result handled by onSnapshot
      showAlert("Success", "Service log has been deleted.", "success");
    } catch (e) {
      console.error(e);
      showAlert("Error", "Failed to delete record.", "error");
    }
  };

  const handleStartSession = async (record: ServiceRecord) => {
    try {
      const now = new Date();
      await updateDoc(doc(db, 'service_records', record.id), {
        startTime: now.toISOString(),
        timeIn: record.timeIn || now.toISOString(),
        status: 'active',
        updatedAt: serverTimestamp()
      });
      showAlert("Success", "Session started.", "success");
    } catch (e: any) {
      console.error("FULL ERROR OBJECT:", e);
      showAlert("Error", `Failed to start session: ${e.message || "Unknown error"}`, "error");
    }
  };

  const handlePauseSession = async (record: ServiceRecord) => {
    try {
      if (!record.startTime) return;
      const now = new Date();
      const start = new Date(record.startTime);
      const deltaSeconds = Math.floor((now.getTime() - start.getTime()) / 1000);
      const newAccumulated = (record.accumulated_seconds || 0) + deltaSeconds;

      await updateDoc(doc(db, 'service_records', record.id), {
        accumulated_seconds: newAccumulated,
        startTime: null,
        status: 'paused',
        updatedAt: serverTimestamp()
      });
      showAlert("Success", "Session paused.", "success");
    } catch (e: any) {
      showAlert("Error", "Failed to pause session", "error");
    }
  };

  const handleClockOut = async (record: ServiceRecord) => {
    try {
      const now = new Date();
      let deltaSeconds = 0;
      if (record.startTime) {
        const start = new Date(record.startTime);
        deltaSeconds = Math.floor((now.getTime() - start.getTime()) / 1000);
      }
      const newAccumulated = (record.accumulated_seconds || 0) + deltaSeconds;
      
      let durationHours = newAccumulated / 3600;

      // Late Penalty Logic
      const startTimeObj = record.timeIn ? new Date(record.timeIn) : now;
      if (record.scheduledEndTime) {
        const schEndObj = new Date(record.scheduledEndTime);
        if (schEndObj.getTime() <= (record.scheduledStartTime ? new Date(record.scheduledStartTime).getTime() : startTimeObj.getTime())) {
           schEndObj.setDate(schEndObj.getDate() + 1);
        }
        
        if (now.getTime() > schEndObj.getTime()) {
           durationHours = (schEndObj.getTime() - startTimeObj.getTime()) / (1000 * 60 * 60);
        }
      }
      
      if (durationHours < 0) durationHours = 0;
      const creditHours = Math.max(0, Math.min(20, Number(durationHours.toFixed(1))));
      
      await updateDoc(doc(db, 'service_records', record.id), {
        timeOut: now.toISOString(),
        creditHours: creditHours,
        accumulated_seconds: newAccumulated,
        startTime: null,
        status: 'pending', // Reset to pending for approval
        updatedAt: serverTimestamp()
      });
      // Result handled by onSnapshot
      showAlert("Success", "Student clocked out successfully.", "success");
    } catch (e: any) {
      console.error(e);
      showAlert("Error", `Failed to clock out student: ${e.message || "Unknown error"}`, "error");
    }
  };

  const handleAutoComplete = async (record: ServiceRecord) => {
    // Only act if the record is currently running
    if (record.status !== 'active') return; 

    try {
      const endObj = new Date(record.scheduledEndTime || tasks.find(t => t.title === record.taskTitle && t.date === record.date)?.endTime || Date.now());
      const startObj = new Date(record.timeIn || record.startTime || Date.now());
      
      let durationHours = (endObj.getTime() - startObj.getTime()) / (1000 * 60 * 60);
      if (durationHours < 0) durationHours = 0;
      const creditHours = Math.max(0, Math.min(20, Number(durationHours.toFixed(1))));

      // "Clock them out" but wait for Admin verification
      await updateDoc(doc(db, 'service_records', record.id), {
        timeOut: endObj.toISOString(),
        creditHours: creditHours,
        accumulated_seconds: Math.floor((endObj.getTime() - startObj.getTime()) / 1000),
        startTime: null,
        status: 'pending', // <--- CRITICAL: Must be 'pending' so the Admin can manually click Approve
        updatedAt: serverTimestamp()
      });
      
      showAlert("Time Up", `${record.studentName}'s session has automatically ended. Awaiting your approval.`, "success");
    } catch (e: any) {
      console.error("Auto-complete failed: ", e);
    }
  };

  const onRecordSubmit = async (data: ServiceRecord) => {
    try {
      const { id, ...payload } = data;

      // If they are just "HH:MM", we need to prepend the date
      let startDateTime: Date;
      let endDateTime: Date;

      if (data.timeIn.includes(':') && !data.timeIn.includes('T')) {
          startDateTime = new Date(`${data.date}T${data.timeIn}:00`);
      } else {
          startDateTime = new Date(data.timeIn);
      }

      if (data.timeOut.includes(':') && !data.timeOut.includes('T')) {
          endDateTime = new Date(`${data.date}T${data.timeOut}:00`);
          if (endDateTime.getTime() <= startDateTime.getTime()) {
             endDateTime.setDate(endDateTime.getDate() + 1);
          }
      } else {
          endDateTime = new Date(data.timeOut);
      }

      payload.timeIn = startDateTime.toISOString();
      payload.timeOut = endDateTime.toISOString();

      // Calculate duration
      let durationHours = (endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60);
      
      // Cap at 20 hours as requested
      payload.creditHours = Math.min(20, Number(durationHours.toFixed(1)));

      await updateDoc(doc(db, 'service_records', id), payload as any);
      setEditingRecord(null);
      // Result handled by onSnapshot
      showAlert("Success", "Service log updated successfully.", "success");
    } catch (e: any) {
      console.error(e);
      showAlert("Error", "Failed to update service log.", "error");
    }
  };

  const sendCompletionEmail = async (student: StudentProgress) => {
    try {
      // 1. KILLED THE 405 BUG: Removed the rogue '/api/generate-pdf' fetch call

      const latestRecord = [...student.records].sort((a, b) => b.date.localeCompare(a.date))[0];
      const adminDoc = members.find(m => m.email === user?.email);

      // Generate the PDF
      const pdfBase64 = await generateObligationPDF({
        studentName: student.studentName,
        studentNo: student.studentNo,
        program: student.program,
        section: student.section,
        bracket: student.bracket || 'N/A',
        totalVerifiedHours: student.verifiedHours,
        semester: (latestRecord as any)?.semester || '1st Semester',
        academicYear: (latestRecord as any)?.academicYear || `A.Y. ${new Date().getFullYear()} - ${new Date().getFullYear() + 1}`,
        studentSignature: (latestRecord as any)?.studentSignature,
        approverName: student.approval?.approverName || adminDoc?.displayName || 'Authorized Representative',
        approverRole: student.approval?.approverRole || (adminDoc?.role === 'admin' ? 'OSA Admin' : 'OSA Staff'),
        approverSignature: adminDoc?.signature || student.approval?.approverSignature,
        records: student.records.filter(r => r.status === 'verified').map(r => {
          
          // ADDED: Live signature lookup for the email attachment just like the preview
          const liveStaff = members.find(m => m.id === (r as any).verifiedById);
          
          return {
            date: r.date,
            taskTitle: r.taskTitle,
            staffName: (r as any).staffName || 'OSA Staff',
            timeIn: formatTime(r.timeIn),
            timeOut: formatTime(r.timeOut),
            creditHours: r.creditHours,
            verifierSignature: liveStaff?.signature || (r as any).verifierSignature || adminDoc?.signature,
            studentSignature: (r as any).studentSignature
          };
        })
      });

      // 2. SAFETY LOCK: Check payload size to prevent 413 Vercel Server Crash
      const payloadSizeMB = (pdfBase64.length * 0.75) / (1024 * 1024);
      if (payloadSizeMB > 4.2) {
          showAlert("Warning", `PDF is too large (${payloadSizeMB.toFixed(1)}MB) for the email server. Please generate the preview and email it manually.`, "warning");
          return;
      }

      const response = await fetch('/api/send-completion-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: student.studentEmail,
          studentName: student.studentName,
          pdfBase64
        })
      });

      // 3. KILLED THE JSON BUG: Handle server errors properly before trying to read JSON
      if (!response.ok) {
        if (response.status === 413) {
            throw new Error("Payload Too Large: The PDF is too heavy to send via Vercel.");
        }
        const errText = await response.text();
        throw new Error(`Server Error ${response.status}: ${errText}`);
      }

      const result = await response.json();
      if (result.success) {
        showAlert("Sent", `Completion form successfully sent to ${student.studentEmail}!`, "success");
      }
    } catch (e: any) {
      console.error("Email send failed", e);
      showAlert("Error", e.message || "Failed to send completion email automatically.", "error");
    }
  };
const handleApproveCompletion = async (student: StudentProgress) => {
    const adminDoc = members.find(m => m.id === user?.uid);
    if (!adminDoc || !adminDoc.signature) {
       showAlert("Action Required", "You must set up your digital signature in Settings before you can approve completions.", "warning");
       setTab('settings');
       return;
    }

    const confirmApproval = window.confirm(`Approve final completion for ${student.studentName}? \n\nThis will apply your signature and role as the official note-taker for their completion form.`);
    if (!confirmApproval) return;

    try {
      const approvalData = {
        studentNo: student.studentNo,
        approverName: adminDoc.displayName,
        approverRole: (adminDoc.role === 'admin' || adminDoc.role === 'developer') ? 'Head, Office of Student Affairs' : (adminDoc.role === 'staff' ? 'OSA Staff' : 'Student Assistant, OSA'),
        approverSignature: adminDoc.signature,
        approvedAt: serverTimestamp()
      };

      await addDoc(collection(db, 'completions'), approvalData);
      showAlert("Approved", `${student.studentName}'s completion has been approved.`, "success");
      // Result handled by onSnapshot
    } catch (e) {
      console.error(e);
      showAlert("Error", "Failed to approve completion.", "error");
    }
  };

  const handleUndoApproval = async (approvalId: string, studentName: string) => {
    const confirmUndo = window.confirm(`Are you sure you want to REVOKE the completion approval for ${studentName}? \n\nThis will return their status to 'Pending Verification'.`);
    if (!confirmUndo) return;

    try {
      await deleteDoc(doc(db, 'completions', approvalId));
      showAlert("Revoked", `Approval for ${studentName} has been successfully undone.`, "success");
      // Result handled by onSnapshot
    } catch (e) {
      console.error(e);
      showAlert("Error", "Failed to undo approval.", "error");
    }
  };

  // --- NEW FEATURE: PREVIEW / PRINT PDF ---
  const handlePreviewPDF = async (student: StudentProgress) => {
    try {
      const latestRecord = [...student.records].sort((a, b) => b.date.localeCompare(a.date))[0];
      const adminDoc = members.find(m => m.email === user?.email);

      // Generate the PDF exactly like the email function does
      const pdfBase64 = await generateObligationPDF({
        studentName: student.studentName,
        studentNo: student.studentNo,
        program: student.program,
        section: student.section,
        bracket: student.bracket || 'N/A',
        totalVerifiedHours: student.verifiedHours,
        semester: (latestRecord as any)?.semester || '1st Semester',
        academicYear: (latestRecord as any)?.academicYear || `A.Y. ${new Date().getFullYear()} - ${new Date().getFullYear() + 1}`,
        studentSignature: (latestRecord as any)?.studentSignature,
        approverName: student.approval?.approverName || adminDoc?.displayName || 'Authorized Representative',
        approverRole: student.approval?.approverRole || (adminDoc?.role === 'admin' ? 'OSA Admin' : 'OSA Staff'),
        approverSignature: adminDoc?.signature || student.approval?.approverSignature,
        records: student.records.filter(r => r.status === 'verified').map(r => {
          
          // FIX: Look up the actual staff member to pull their live signature!
          const liveStaff = members.find(m => m.id === (r as any).verifiedById);
          
          return {
            date: r.date,
            taskTitle: r.taskTitle,
            staffName: (r as any).staffName || 'OSA Staff',
            timeIn: formatTime(r.timeIn),
            timeOut: formatTime(r.timeOut),
            creditHours: r.creditHours,
            verifierSignature: liveStaff?.signature || (r as any).verifierSignature || adminDoc?.signature,
            studentSignature: (r as any).studentSignature
          };
        })
      });

      // Safely convert base64 to a Blob and open it in a new browser tab for viewing/printing
      const pdfBlob = await (await fetch(pdfBase64)).blob();
      const blobUrl = URL.createObjectURL(pdfBlob);
      window.open(blobUrl, '_blank');
      
    } catch (e) {
      console.error("PDF Preview failed", e);
      showAlert("Error", "Failed to generate PDF preview.", "error");
    }
  };

  const handleVerify = async (recordId: string, currentStatus: string) => {
    try {
      const adminDoc = members.find(m => m.id === user?.uid);
      const newStatus = currentStatus === 'pending' ? 'verified' : 'pending';
      const ref = doc(db, 'service_records', recordId);
      
      await updateDoc(ref, { 
        status: newStatus,
        verifiedBy: user?.displayName || user?.email,
        verifiedById: user?.uid,
        verifierRole: adminDoc?.role || 'staff',
        verifierSignature: adminDoc?.signature || null,
        updatedAt: serverTimestamp()
      });
      
      // Result handled by onSnapshot
      showAlert("Success", `Attendance record has been ${newStatus}.`, "success");
    } catch (e: any) {
      console.error("FULL ERROR OBJECT:", e);
      showAlert("Error", `Verification failed: ${e.message || "Unknown error"}`, "error");
    }
  };

  const checkIsWithinSchedule = (record: ServiceRecord) => {
    if (record.status === 'active') return true;

    let startObj = record.scheduledStartTime ? new Date(record.scheduledStartTime) : null;
    let endObj = record.scheduledEndTime ? new Date(record.scheduledEndTime) : null;
    
    if (!startObj || !endObj) {
      const task = tasks.find(t => t.title === record.taskTitle && t.date === record.date);
      if (task && task.startTime && task.endTime) {
         startObj = new Date(task.startTime);
         endObj = new Date(task.endTime);
      }
    }

    if (!startObj || !endObj) return true;

    const now = new Date();
    if (endObj.getTime() <= startObj.getTime()) {
      endObj.setDate(endObj.getDate() + 1);
    }
    
    // FIX: Removed the 15-minute early buffer. Must be exact time.
    return now.getTime() >= startObj.getTime() && now.getTime() <= endObj.getTime();
  };

  const studentProgressRaw = Object.values(
    // Sort by date to ensure we can identify the "latest" name
    [...records].sort((a, b) => {
      const dateA = a.date + ' ' + (a.timeIn || '00:00');
      const dateB = b.date + ' ' + (b.timeIn || '00:00');
      return dateA.localeCompare(dateB);
    }).reduce((acc: { [key: string]: StudentProgress }, r) => {
      if (!acc[r.studentNo]) {
        acc[r.studentNo] = {
          studentNo: r.studentNo,
          studentName: r.studentName, // Initially set the "first" name found
          studentEmail: (r as any).studentEmail || 'N/A',
          program: r.program,
          section: r.section,
          bracket: r.bracket || 'N/A',
          totalHours: 0,
          verifiedHours: 0,
          records: [],
          allNames: [r.studentName],
          approval: approvals.find(ap => ap.studentNo === r.studentNo)
        };
      } else {
        // Update to the latest name found (since we sorted)
        acc[r.studentNo].studentName = r.studentName;
        if (!acc[r.studentNo].allNames?.includes(r.studentName)) {
           acc[r.studentNo].allNames?.push(r.studentName);
        }
        if (!acc[r.studentNo].approval) {
           acc[r.studentNo].approval = approvals.find(ap => ap.studentNo === r.studentNo);
        }
      }
      
      acc[r.studentNo].totalHours += r.creditHours;
      if (r.status === 'verified') {
        acc[r.studentNo].verifiedHours += r.creditHours;
      }
      acc[r.studentNo].records.push(r);
      acc[r.studentNo].hasNameMismatch = (acc[r.studentNo].allNames?.length || 0) > 1;
      
      return acc;
    }, {})
  ).sort((a, b) => (b as StudentProgress).verifiedHours - (a as StudentProgress).verifiedHours) as StudentProgress[];

  const isTaskDone = (t: Task) => {
    const taskRecords = records.filter(r => r.taskTitle === t.title && r.date === t.date);
    return taskRecords.length > 0 && taskRecords.every(r => r.status === 'verified');
  };

  const activeTasks = tasks.filter(t => {
    const isPast = t.date < getTodayYYYYMMDD();
    const done = isTaskDone(t);
    const searchMatch = t.title.toLowerCase().includes(taskSearch.toLowerCase());
    return !isPast && !done && searchMatch;
  });

  const historyTasks = tasks.filter(t => {
    const isPast = t.date < getTodayYYYYMMDD();
    const done = isTaskDone(t);
    const searchMatch = t.title.toLowerCase().includes(historySearch.toLowerCase());
    return (isPast || done) && searchMatch;
  });

  const studentProgress = studentProgressRaw.filter(s => 
    s.studentName.toLowerCase().includes(progressSearch.toLowerCase()) ||
    s.studentNo.toLowerCase().includes(progressSearch.toLowerCase()) ||
    s.studentEmail.toLowerCase().includes(progressSearch.toLowerCase()) ||
    s.program.toLowerCase().includes(progressSearch.toLowerCase())
  );

  const filteredRecords = records.filter(r => 
    r.studentName.toLowerCase().includes(recordsSearch.toLowerCase()) ||
    r.studentNo.toLowerCase().includes(recordsSearch.toLowerCase()) ||
    r.taskTitle.toLowerCase().includes(recordsSearch.toLowerCase())
  );

  const filteredMembers = members.filter(m => 
    m.displayName.toLowerCase().includes(membersSearch.toLowerCase()) ||
    m.email.toLowerCase().includes(membersSearch.toLowerCase()) ||
    m.role.toLowerCase().includes(membersSearch.toLowerCase())
  );

  // 1. Wait for auth state to be determined
  if (loadingAuth) {
    return (
      <div className="flex justify-center p-20 bg-[#1c1c1c] min-h-screen items-center">
        <Loader2 className="animate-spin text-[#3ecf8e]" />
      </div>
    );
  }

  // 2. If no user is logged in, redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 3. If authorized or still showing AlertModal (which handles its own redirect), show content
  if (!authorized) {
    return (
      <div className="flex justify-center p-20 bg-[#1c1c1c] min-h-screen items-center">
        <Loader2 className="animate-spin text-[#3ecf8e]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1c1c1c] text-[#ededed] flex flex-col md:flex-row font-sans relative">
      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-[#2e2e2e] bg-[#171717] sticky top-0 z-20">
        <div className="text-[#ededed] font-bold text-lg flex items-center gap-2 tracking-tight">
          <div className="w-6 h-6 bg-[#3ecf8e] rounded flex items-center justify-center">
            <LayoutDashboard className="w-4 h-4 text-black" />
          </div>
          Admin Portal
        </div>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-[#ededed]">
          {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Sidebar Overlay for Mobile */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed md:sticky top-0 h-[100dvh] z-40 w-64 border-r border-[#2e2e2e] bg-[#171717] flex flex-col transform transition-transform duration-300 ease-in-out md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b border-[#2e2e2e] hidden md:block">
          <div className="text-[#ededed] font-bold text-lg flex items-center gap-2 tracking-tight">
            <div className="w-6 h-6 bg-[#3ecf8e] rounded flex items-center justify-center">
              <LayoutDashboard className="w-4 h-4 text-black" />
            </div>
            OSA Dashboard
          </div>
          <div className="text-xs text-[#a1a1a1] mt-2">{user.email}</div>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <button 
            onClick={() => { setTab('tasks'); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${tab === 'tasks' ? 'bg-[#2e2e2e] text-[#3ecf8e]' : 'text-[#a1a1a1] hover:bg-[#2e2e2e] hover:text-[#ededed]'}`}
          >
            <Clock className="w-4 h-4" />
            <span className="text-sm font-medium">Manage Tasks</span>
          </button>
          <button 
            onClick={() => { setTab('records'); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${tab === 'records' ? 'bg-[#2e2e2e] text-[#3ecf8e]' : 'text-[#a1a1a1] hover:bg-[#2e2e2e] hover:text-[#ededed]'}`}
          >
            <Users className="w-4 h-4" />
            <span className="text-sm font-medium">Verify Logs</span>
            {records.filter(r => r.status === 'pending').length > 0 && (
              <span className="ml-auto bg-[#3ecf8e] text-black text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                {records.filter(r => r.status === 'pending').length}
              </span>
            )}
          </button>
          <button 
            onClick={() => { setTab('progress'); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${tab === 'progress' ? 'bg-[#2e2e2e] text-[#3ecf8e]' : 'text-[#a1a1a1] hover:bg-[#2e2e2e] hover:text-[#ededed]'}`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-sm font-medium">Student Progress</span>
          </button>
          <button 
            onClick={() => { setTab('history'); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${tab === 'history' ? 'bg-[#2e2e2e] text-[#3ecf8e]' : 'text-[#a1a1a1] hover:bg-[#2e2e2e] hover:text-[#ededed]'}`}
          >
            <History className="w-4 h-4" />
            <span className="text-sm font-medium">Task Execution History</span>
          </button>
          <button 
            onClick={() => { setTab('members'); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${tab === 'members' ? 'bg-[#2e2e2e] text-[#3ecf8e]' : 'text-[#a1a1a1] hover:bg-[#2e2e2e] hover:text-[#ededed]'}`}
          >
            <Users className="w-4 h-4" />
            <span className="text-sm font-medium">Members</span>
          </button>
          <button 
            onClick={() => { setTab('settings'); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${tab === 'settings' ? 'bg-[#2e2e2e] text-[#3ecf8e]' : 'text-[#a1a1a1] hover:bg-[#2e2e2e] hover:text-[#ededed]'}`}
          >
            <Settings className="w-4 h-4" />
            <span className="text-sm font-medium">Settings</span>
          </button>
          <div className="pt-4 mt-4 border-t border-[#2e2e2e]">
          </div>
        </nav>
        <div className="p-4 border-t border-[#2e2e2e]">
          <button onClick={logout} className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-[#a1a1a1] hover:bg-[#2e2e2e] hover:text-[#ededed] transition-colors">
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#1c1c1c]">
        <header className="sticky top-0 z-30 bg-[#171717] border-b border-[#2e2e2e] p-4 md:px-8 md:py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
           <div className="flex items-center gap-3">
              <h1 className="text-lg md:text-xl font-bold tracking-tight text-[#ededed]">
                {tab === 'tasks' && 'Schedule Management'}
                {tab === 'records' && 'Service Records'}
                {tab === 'progress' && 'Performance Tracker'}
                {tab === 'history' && 'Task Execution History'}
                {tab === 'members' && 'Staff Directory'}
                {tab === 'settings' && 'System Preferences'}
              </h1>
           </div>
           
           <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#a1a1a1] bg-[#1c1c1c] px-3 py-1.5 rounded-full border border-[#2e2e2e]">
                <div className="w-1.5 h-1.5 rounded-full bg-[#3ecf8e] shadow-[0_0_8px_rgba(62,207,142,0.4)]" />
                Live
              </div>
           </div>
        </header>

        <div className="flex-1 p-3 md:p-5 lg:p-6 overflow-y-auto">
        {tab === 'tasks' && (
          <div className="space-y-8 max-w-4xl">
            <div>
              <h2 className="text-xl font-bold tracking-tight">{editingTask ? 'Edit Task' : 'Create New Task'}</h2>
              <p className="text-[#a1a1a1] text-sm mt-1">Publish available schedule slots for students.</p>
            </div>
            
            <form onSubmit={handleSubmit(onTaskSubmit)} className="bg-[#171717] border border-[#2e2e2e] p-3 md:p-4 rounded-lg grid grid-cols-1 md:grid-cols-4 gap-3 md:gap-4 text-xs">
              <div className="space-y-1 md:col-span-4">
                <label className="text-[10px] font-semibold uppercase text-[#a1a1a1]">Activity / Task Title</label>
                <input {...register('title', { required: true })} className="w-full bg-[#1c1c1c] border border-[#2e2e2e] text-[#ededed] px-3 py-1.5 rounded-md focus:ring-1 focus:ring-[#3ecf8e] outline-none placeholder:text-[#a1a1a1]/50" placeholder="e.g. Stage Decorations" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase text-[#a1a1a1]">Date</label>
                <input 
                  type="date" 
                  min={getTodayYYYYMMDD()} 
                  {...register('date', { required: true })} 
                  className="w-full bg-[#1c1c1c] border border-[#2e2e2e] text-[#ededed] px-3 py-1.5 rounded-md focus:ring-1 focus:ring-[#3ecf8e] outline-none [color-scheme:dark]" 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase text-[#a1a1a1]">Start In</label>
                <input type="time" {...register('startTime', { required: true })} className="w-full bg-[#1c1c1c] border border-[#2e2e2e] text-[#ededed] px-3 py-1.5 rounded-md focus:ring-1 focus:ring-[#3ecf8e] outline-none [color-scheme:dark]" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase text-[#a1a1a1]">Ppl Size</label>
                <input 
                  type="number" 
                  min="1"
                  {...register('capacity', { required: true, min: 1 })} 
                  className="w-full bg-[#1c1c1c] border border-[#2e2e2e] text-[#ededed] px-3 py-1.5 rounded-md focus:ring-1 focus:ring-[#3ecf8e] outline-none placeholder:text-[#a1a1a1]/50" 
                  placeholder="e.g. 5" 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase text-[#a1a1a1]">Finish By</label>
                <input type="time" {...register('endTime', { required: true })} className="w-full bg-[#1c1c1c] border border-[#2e2e2e] text-[#ededed] px-3 py-1.5 rounded-md focus:ring-1 focus:ring-[#3ecf8e] outline-none [color-scheme:dark]" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase text-[#a1a1a1]">In-Charge</label>
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
                  className="w-full bg-[#1c1c1c] border border-[#2e2e2e] text-[#ededed] px-3 py-1.5 rounded-md focus:ring-1 focus:ring-[#3ecf8e] outline-none"
                >
                  <option value="me">Me</option>
                  <option value="other">Specify...</option>
                </select>
                {staffOption === 'other' && (
                  <input 
                    {...register('staffName', { required: staffOption === 'other' })} 
                    className="w-full bg-[#1c1c1c] border border-[#2e2e2e] text-[#ededed] px-3 py-1.5 rounded-md mt-1 focus:ring-1 focus:ring-[#3ecf8e] outline-none" 
                    placeholder="Staff name" 
                  />
                )}
                {staffOption === 'me' && (
                  <input type="hidden" {...register('staffName')} />
                )}
              </div>
              <div className="md:col-span-4 flex justify-end gap-2">
                {editingTask && (
                  <button type="button" onClick={() => { setEditingTask(null); reset(); }} className="px-3 py-1.5 text-[10px] font-bold border border-[#2e2e2e] rounded-md uppercase">Cancel</button>
                )}
                <button disabled={submittingTask} className={`${editingTask ? 'bg-amber-500 border-amber-500' : 'bg-[#3ecf8e] border-[#3ecf8e]'} text-black text-[10px] font-bold uppercase tracking-tight px-4 py-1.5 rounded-md flex items-center gap-1.5 transition-colors disabled:opacity-50 border`}>
                 {submittingTask ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : editingTask ? <Edit2 className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" /> }
                 {editingTask ? 'Update' : 'Publish'}
                </button>
              </div>
            </form>

            <div className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h3 className="text-lg font-bold tracking-tight">Active Published Tasks</h3>
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#a1a1a1]" />
                  <input 
                    type="text" 
                    placeholder="Search tasks..." 
                    value={taskSearch}
                    onChange={(e) => setTaskSearch(e.target.value)}
                    className="w-full bg-[#171717] border border-[#2e2e2e] rounded-md pl-9 pr-3 py-1.5 text-xs focus:border-[#3ecf8e] outline-none transition-colors"
                  />
                </div>
              </div>
              <div className="border border-[#2e2e2e] rounded-lg overflow-hidden bg-[#171717] w-full">
                {/* Desktop View */}
                <div className="hidden lg:block overflow-x-auto w-full">
                  <table className="min-w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-[#262626] border-b border-[#2e2e2e] text-[#a1a1a1] text-xs font-medium uppercase tracking-wider">
                      <tr>
                        <th className="px-3 py-2 text-[9px] font-bold uppercase tracking-wider">Task Title</th>
                        <th className="px-3 py-2 text-[9px] font-bold uppercase tracking-wider">Schedule</th>
                        <th className="px-3 py-2 text-[9px] font-bold uppercase tracking-wider">Capacity</th>
                        <th className="px-3 py-2 text-[9px] font-bold uppercase tracking-wider">Duration</th>
                        <th className="px-3 py-2 text-right text-[9px] font-bold uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2e2e2e]">
                      {activeTasks.length === 0 ? (
                        <tr><td colSpan={4} className="px-4 py-4 text-center text-[#a1a1a1]">No active tasks found.</td></tr>
                      ) : activeTasks.map(t => (
                        <tr key={t.id} className="hover:bg-[#1c1c1c]">
                          <td className="px-3 py-1.5">
                             <div className="font-bold text-[#ededed] text-[11px]">{t.title}</div>
                             <div className="text-[8px] text-[#a1a1a1] uppercase font-bold tracking-tight">{t.staffName}</div>
                          </td>
                          <td className="px-3 py-1.5 text-[#a1a1a1] font-mono text-[9px]">
                            <div className="text-[#ededed] mb-0.5">{formatDate(t.date)}</div>
                            <div>{formatTime(t.startTime)} - {formatTime(t.endTime)}</div>
                          </td>
                          <td className="px-3 py-1.5">
                            <div className="flex items-center gap-1">
                              <Users className="w-2.5 h-2.5 text-[#a1a1a1]" />
                              <span className="text-[9px] font-bold text-[#ededed]">{records.filter(r => r.taskTitle === t.title && r.date === t.date).length} / {t.capacity || 1}</span>
                            </div>
                          </td>
                          <td className="px-3 py-1.5 text-[#3ecf8e] font-bold text-[10px]">{t.duration?.toFixed(1)} {Number(t.duration) === 1 ? 'hr' : 'hrs'}</td>
                          <td className="px-3 py-1.5 text-right">
                            <div className="flex justify-end gap-1.5">
                               {records.some(r => r.taskTitle === t.title && r.date === t.date) ? (
                                 <div className="flex items-center gap-1.5">
                                   {records.filter(r => r.taskTitle === t.title && r.date === t.date).every(r => r.status === 'verified') ? (
                                      <span className="text-[8px] text-[#3ecf8e] uppercase font-black px-1.5 py-0.5 bg-[#3ecf8e]/10 border border-[#3ecf8e]/30 rounded">Done</span>
                                   ) : (
                                      <span className="text-[8px] text-[#a1a1a1] uppercase font-bold italic border border-[#2e2e2e] px-1.5 py-0.5 rounded">Active</span>
                                   )}
                                   <button 
                                      onClick={() => { setTab('records'); setRecordsSearch(t.title); window.scrollTo({top:0, behavior: 'smooth'}); }} 
                                      className="text-[9px] text-blue-400 font-bold hover:underline bg-blue-400/5 px-2 py-1 rounded border border-blue-400/20"
                                   >
                                      Logs
                                   </button>
                                 </div>
                               ) : (
                                 <>
                                   <button onClick={() => handleEditTask(t)} className="p-1 hover:bg-amber-500/10 text-amber-500 rounded"><Edit2 className="w-3 h-3" /></button>
                                   <button onClick={() => handleDeleteTask(t.id)} className="p-1 hover:bg-red-500/10 text-red-500 rounded"><Trash2 className="w-3 h-3" /></button>
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
                  {activeTasks.length === 0 ? (
                    <div className="p-8 text-center text-[#a1a1a1] text-sm">No active tasks found matching your search.</div>
                  ) : activeTasks.map(t => (
                    <div key={t.id} className="p-4 space-y-3 hover:bg-[#1c1c1c] transition-colors">
                      <div className="flex justify-between items-start gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-[#ededed] break-words text-sm">{t.title}</div>
                          <div className="text-[10px] text-[#a1a1a1] uppercase font-bold mt-0.5">{t.staffName}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-[#3ecf8e] font-bold text-xs bg-[#3ecf8e]/10 px-2 py-0.5 rounded">{t.duration?.toFixed(1)}h</div>
                        </div>
                      </div>
                      
                      <div className="bg-[#1c1c1c] p-2 rounded border border-[#2e2e2e]">
                        <div className="text-[#ededed] text-[10px] font-mono mb-1">{formatDate(t.date)}</div>
                        <div className="text-[#a1a1a1] text-[10px] font-mono">{formatTime(t.startTime)} - {formatTime(t.endTime)}</div>
                      </div>
                      
                      <div className="flex justify-end pt-2 border-t border-[#2e2e2e]/50">
                        {records.some(r => r.taskTitle === t.title && r.date === t.date) ? (
                          <div className="flex items-center gap-2">
                             {records.filter(r => r.taskTitle === t.title && r.date === t.date).every(r => r.status === 'verified') ? (
                                <span className="text-[10px] text-[#3ecf8e] font-bold uppercase tracking-widest px-2 py-0.5 bg-[#3ecf8e]/5 border border-[#3ecf8e]/20 rounded">Done</span>
                             ) : (
                                <span className="text-[10px] text-[#a1a1a1] uppercase font-bold italic px-2 py-0.5 bg-[#262626] rounded border border-white/5">In Progress</span>
                             )}
                             <button 
                               onClick={() => { setTab('records'); setRecordsSearch(t.title); window.scrollTo({top:0, behavior: 'smooth'}); }}
                               className="text-[10px] text-blue-400 font-bold uppercase hover:underline border border-blue-400/20 px-2 py-0.5 rounded bg-blue-400/5 transition-all"
                             >
                               View Logs
                             </button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button onClick={() => handleEditTask(t)} className="px-3 py-1.5 hover:bg-amber-500/10 text-amber-500 rounded transition-colors text-xs flex items-center gap-1 font-medium"><Edit2 className="w-3.5 h-3.5" /> Edit</button>
                            <button onClick={() => handleDeleteTask(t.id)} className="px-3 py-1.5 hover:bg-red-500/10 text-red-500 rounded transition-colors text-xs flex items-center gap-1 font-medium"><Trash2 className="w-3.5 h-3.5" /> Delete</button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'records' && (
          <div className="space-y-4 max-w-6xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg md:text-xl font-bold tracking-tight">Service Logs</h2>
              <p className="text-[#a1a1a1] text-[10px] mt-0.5">Review and verify student obligations.</p>
            </div>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#a1a1a1]" />
              <input 
                type="text" 
                placeholder="Search students..." 
                value={recordsSearch}
                onChange={(e) => setRecordsSearch(e.target.value)}
                className="w-full bg-[#171717] border border-[#2e2e2e] rounded-md pl-9 pr-3 py-1.5 text-[10px] focus:border-[#3ecf8e] outline-none transition-colors border-white/5"
              />
            </div>
          </div>

            {editingRecord && (
              <div className="bg-[#171717] border border-amber-500/50 p-6 rounded-lg space-y-4">
                <div className="flex justify-between items-center">
                   <h3 className="text-amber-500 font-bold flex items-center gap-2">
                     <Edit2 className="w-4 h-4" /> Editing Log for {editingRecord.studentName}
                   </h3>
                   <button onClick={() => setEditingRecord(null)} className="text-xs text-[#a1a1a1] hover:text-[#ededed]">Cancel</button>
                </div>
                <form onSubmit={recordForm.handleSubmit(onRecordSubmit)} className="grid grid-cols-1 md:grid-cols-4 gap-4">
  <div className="space-y-1">
    <label className="text-[10px] uppercase font-bold text-[#a1a1a1]">Student Name</label>
    <input {...recordForm.register('studentName', { required: true })} className="w-full bg-[#1c1c1c] border border-[#2e2e2e] rounded p-2 text-sm focus:border-[#3ecf8e] outline-none" />
  </div>
  <div className="space-y-1">
    <label className="text-[10px] uppercase font-bold text-[#a1a1a1]">Student No.</label>
    <input {...recordForm.register('studentNo', { required: true })} className="w-full bg-[#1c1c1c] border border-[#2e2e2e] rounded p-2 text-sm focus:border-[#3ecf8e] outline-none" />
  </div>
  {/* NEW FIELD ADDED HERE */}
  <div className="space-y-1">
    <label className="text-[10px] uppercase font-bold text-[#a1a1a1]">Student Email</label>
    <input 
      {...recordForm.register('studentEmail', { required: true })} 
      className="w-full bg-[#1c1c1c] border border-[#2e2e2e] rounded p-2 text-sm focus:border-[#3ecf8e] outline-none" 
      placeholder="student@example.com"
    />
  </div>
  <div className="space-y-1">
    <label className="text-[10px] uppercase font-bold text-[#a1a1a1]">Program</label>
    <input {...recordForm.register('program', { required: true })} className="w-full bg-[#1c1c1c] border border-[#2e2e2e] rounded p-2 text-sm focus:border-[#3ecf8e] outline-none" />
  </div>
  <div className="space-y-1">
    <label className="text-[10px] uppercase font-bold text-[#a1a1a1]">Section</label>
    <input {...recordForm.register('section', { required: true })} className="w-full bg-[#1c1c1c] border border-[#2e2e2e] rounded p-2 text-sm focus:border-[#3ecf8e] outline-none" />
  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-[#a1a1a1]">Date</label>
                    <input type="date" {...recordForm.register('date', { required: true })} className="w-full bg-[#1c1c1c] border border-[#2e2e2e] rounded p-2 text-sm [color-scheme:dark]" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-[#a1a1a1]">Time In</label>
                    <input type="time" {...recordForm.register('timeIn', { required: true })} className="w-full bg-[#1c1c1c] border border-[#2e2e2e] rounded p-2 text-sm [color-scheme:dark]" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-[#a1a1a1]">Time Out</label>
                    <input type="time" {...recordForm.register('timeOut', { required: true })} className="w-full bg-[#1c1c1c] border border-[#2e2e2e] rounded p-2 text-sm [color-scheme:dark]" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-[#a1a1a1]">Staff In-Charge</label>
                    <input {...recordForm.register('staffName')} className="w-full bg-[#1c1c1c] border border-[#2e2e2e] rounded p-2 text-sm focus:border-[#3ecf8e] outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-[#a1a1a1]">Semester</label>
                    <select {...recordForm.register('semester' as any)} className="w-full bg-[#1c1c1c] border border-[#2e2e2e] rounded p-2 text-sm focus:border-[#3ecf8e] outline-none">
                      <option value="1st Semester">1st Semester</option>
                      <option value="2nd Semester">2nd Semester</option>
                    </select>
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-[10px] uppercase font-bold text-[#a1a1a1]">Academic Year</label>
                    <input {...recordForm.register('academicYear' as any)} className="w-full bg-[#1c1c1c] border border-[#2e2e2e] rounded p-2 text-sm focus:border-[#3ecf8e] outline-none" placeholder="e.g. 2025 - 2026" />
                  </div>
                  <div className="flex items-end md:col-span-4">
                    <button type="submit" className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold py-2 rounded text-sm transition-colors">
                      Save Changes
                    </button>
                  </div>
                  <div className="md:col-span-4 text-[10px] text-amber-500 italic mt-2">
                    * Credit hours are automatically calculated based on time and capped at 20.0h per log.
                  </div>
                </form>
              </div>
            )}

            <div className="border border-[#2e2e2e] rounded-lg overflow-hidden bg-[#171717] w-full">
              {/* Desktop View */}
              <div className="hidden xl:block overflow-x-auto w-full">
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
                    {filteredRecords.length === 0 ? (
                        <tr><td colSpan={5} className="px-6 py-10 text-center text-[#a1a1a1]">No records found matching your search.</td></tr>
                    ) : filteredRecords.map(r => (
                      <tr key={r.id} className="hover:bg-[#1c1c1c]">
                        <td className="px-6 py-4">
                          <div className="font-bold text-[#ededed]"><span className="text-[#a1a1a1] text-[10px] font-normal mr-1">Full Name:</span>{r.studentName}</div>
                          <div className="text-[10px] text-[#a1a1a1] space-y-0.5 mt-1 font-mono">
                             <div><span className="text-[#666] mr-1">Student No.:</span>{r.studentNo}</div>
                             <div><span className="text-[#666] mr-1">Program:</span>{r.program}{r.section ? ` / Section: ${r.section}` : ''}</div>
                             {r.studentEmail && <div><span className="text-[#666] mr-1">Email Address:</span>{r.studentEmail}</div>}
                             {r.bracket && <div><span className="text-[#666] mr-1">Bracket:</span>{r.bracket}</div>}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center font-bold text-[#3ecf8e] text-lg">
                          {(r.status === 'active' || r.status === 'paused' || (!r.creditHours && r.accumulated_seconds)) ? (
                            <LiveClock 
                              startTime={r.startTime} 
                              accumulatedSeconds={r.accumulated_seconds || 0} 
                              scheduledEndTime={r.scheduledEndTime || tasks.find(t => t.title === r.taskTitle && t.date === r.date)?.endTime}
                              onTimeUp={() => handleAutoComplete(r)} 
                            />
                          ) : (
                            formatDynamicTimeDisplay(Math.floor((r.creditHours || 0) * 3600))
                          )}
                        </td>
                        <td className="px-6 py-4">
                           <div className="text-xs font-bold text-[#ededed]">{r.taskTitle}</div>
                           {r.staffName && <div className="text-[10px] text-[#3ecf8e] mt-1 uppercase tracking-wide">Pub: {r.staffName}</div>}
                           <div className="text-[9px] text-[#a1a1a1] font-mono mt-1 uppercase bg-[#262626] inline-block px-2 py-0.5 rounded border border-[#2e2e2e]">
                              {formatDate(r.date)} | {formatTime(r.timeIn)} - {formatTime(r.timeOut)}
                           </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold tracking-widest uppercase ${r.status === 'verified' ? 'bg-[#3ecf8e]/20 text-[#3ecf8e]' : (r.status === 'active' || r.status === 'auto_stopped') ? (isAutoStoppedIllusion(r) || r.status === 'auto_stopped' ? 'bg-red-500/20 text-red-500' : 'bg-blue-500/20 text-blue-500') : 'bg-amber-500/20 text-amber-500'}`}>
                            {isAutoStoppedIllusion(r) ? 'AUTO-STOPPED' : r.status.replace('_', ' ').toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end items-center gap-2">
                            {(r.status === 'pending' || r.status === 'active' || r.status === 'paused') && (
                              <button 
                                onClick={() => {
                                  const expired = isAutoStoppedIllusion(r);
                                  if (!checkIsWithinSchedule(r) || expired) {
                                    showAlert("Unauthorized", expired ? "Session has automatically ended." : "This task can only be started/stopped during its assigned window.", "warning");
                                    return;
                                  }
                                  if (!r.startTime) handleStartSession(r);
                                  else handlePauseSession(r);
                                }}
                                className={`text-[10px] font-bold uppercase tracking-wide px-3 py-1.5 rounded transition-colors flex items-center gap-1 ${
                                  r.creditHours >= 20 
                                    ? 'bg-gray-600 cursor-not-allowed text-white' 
                                    : (!checkIsWithinSchedule(r) || isAutoStoppedIllusion(r))
                                      ? 'bg-[#2e2e2e] text-[#666] cursor-not-allowed'
                                      : !r.startTime ? 'bg-blue-500 hover:bg-blue-600 text-white' : 'bg-amber-500 hover:bg-amber-600 text-white'
                                }`}
                                disabled={r.creditHours >= 20 || isAutoStoppedIllusion(r)}
                                title={
                                  r.creditHours >= 20 
                                    ? "Completed" 
                                    : isAutoStoppedIllusion(r)
                                      ? "Auto-Stopped"
                                      : !checkIsWithinSchedule(r) 
                                        ? "Outside assigned schedule" 
                                        : (!r.startTime ? "Start/Resume Session" : "Pause Session")
                                }
                              >
                                <Clock className="w-3 h-3" /> 
                                {r.creditHours >= 20 ? 'Completed' : (!r.startTime ? (r.accumulated_seconds ? 'Resume' : 'Start') : 'Pause')}
                              </button>
                            )}
                            
                            {(r.status === 'active' || r.status === 'paused') && (
                              <button 
                                onClick={() => handleClockOut(r)}
                                className={`text-[10px] font-bold uppercase tracking-wide px-3 py-1.5 rounded transition-colors flex items-center gap-1 bg-red-500 hover:bg-red-600 text-white disabled:opacity-50 disabled:cursor-not-allowed`}
                                title="Complete Session"
                                disabled={isAutoStoppedIllusion(r)}
                              >
                                <CheckSquare className="w-3 h-3" /> 
                                Complete
                              </button>
                            )}
                            
                            <button onClick={() => handleEditRecord(r)} className="p-1 text-[#a1a1a1] hover:text-amber-500 transition-colors" title="Edit Log"><Edit2 className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleDeleteRecord(r.id)} className="p-1 text-[#a1a1a1] hover:text-red-500 transition-colors" title="Delete Log"><Trash2 className="w-3.5 h-3.5" /></button>
                            <div className="w-px h-4 bg-[#2e2e2e] mx-1"></div>
                            
                            <button 
                              onClick={() => handleVerify(r.id, r.status)}
                              disabled={r.status === 'active'}
                              className={`text-[10px] font-bold uppercase tracking-wide px-3 py-1.5 rounded transition-colors ${
                                r.status === 'active' 
                                  ? 'border border-[#2e2e2e] text-[#666] cursor-not-allowed'
                                  : r.status === 'pending' 
                                    ? 'bg-[#3ecf8e] text-black hover:bg-[#34b27b] shadow-[0_0_10px_rgba(62,207,142,0.2)]'
                                    : 'border border-[#2e2e2e] text-[#a1a1a1] hover:bg-[#262626] hover:text-[#ededed]'
                              }`}
                            >
                              {r.status === 'verified' ? 'Unapprove' : 'Approve'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Mobile Card View */}
              <div className="xl:hidden flex flex-col divide-y divide-[#2e2e2e]">
                {filteredRecords.length === 0 ? (
                  <div className="p-8 text-center text-[#a1a1a1] text-sm">No records found.</div>
                ) : filteredRecords.map(r => (
                  <div key={r.id} className="p-4 space-y-3 hover:bg-[#1c1c1c] transition-colors">
                    <div className="flex justify-between items-start gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                           <div className="font-bold text-[#ededed] truncate"><span className="text-[#a1a1a1] text-[10px] font-normal mr-1">Full Name:</span>{r.studentName}</div>
                           <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase shrink-0 ${r.status === 'verified' ? 'bg-[#3ecf8e]/20 text-[#3ecf8e]' : (r.status === 'active' || r.status === 'auto_stopped') ? (isAutoStoppedIllusion(r) || r.status === 'auto_stopped' ? 'bg-red-500/20 text-red-500' : 'bg-blue-500/20 text-blue-500') : 'bg-amber-500/20 text-amber-500'}`}>
                             {isAutoStoppedIllusion(r) ? 'AUTO-STOPPED' : r.status.replace('_', ' ')}
                           </span>
                        </div>
                        <div className="text-[10px] text-[#a1a1a1] mt-1 space-y-0.5 font-mono">
                           <div><span className="text-[#666] mr-1">Student No.:</span>{r.studentNo}</div>
                           <div><span className="text-[#666] mr-1">Program:</span>{r.program}{r.section ? ` / Section: ${r.section}` : ''}</div>
                           {r.studentEmail && <div><span className="text-[#666] mr-1">Email Address:</span>{r.studentEmail}</div>}
                           {r.bracket && <div><span className="text-[#666] mr-1">Bracket:</span>{r.bracket}</div>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[9px] uppercase tracking-wider text-[#a1a1a1] font-bold mb-0.5">Credit Hour</div>
                        <div className="font-bold text-[#3ecf8e] text-xl">
                          {(r.status === 'active' || r.status === 'paused' || (!r.creditHours && r.accumulated_seconds)) ? (
                            <LiveClock 
                              startTime={r.startTime} 
                              accumulatedSeconds={r.accumulated_seconds || 0} 
                              scheduledEndTime={r.scheduledEndTime || tasks.find(t => t.title === r.taskTitle && t.date === r.date)?.endTime}
                              onTimeUp={() => handleAutoComplete(r)} 
                            />
                          ) : (
                            formatDynamicTimeDisplay(Math.floor((r.creditHours || 0) * 3600))
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-[#262626] rounded-md p-3">
                       <div className="flex justify-between items-start gap-2 mb-2">
                         <div className="text-xs font-bold text-[#ededed] break-words leading-tight">{r.taskTitle}</div>
                         {r.staffName && <div className="text-[9px] text-[#a1a1a1] uppercase tracking-wide shrink-0 border border-[#2e2e2e] bg-[#171717] px-2 py-0.5 rounded">{r.staffName}</div>}
                       </div>
                       <div className="flex justify-between items-center text-[9px] text-[#a1a1a1] font-mono mt-2 pt-2 border-t border-[#333]">
                         <span className="uppercase">{formatDate(r.date)}</span>
                         <span>{formatTime(r.timeIn)} - {formatTime(r.timeOut)}</span>
                       </div>
                    </div>

                    <div className="flex justify-between items-center gap-4 pt-2 border-t border-[#2e2e2e]">
                      <div className="flex gap-1">
                        {(r.status === 'pending' || r.status === 'active' || r.status === 'paused') && (
                          <button 
                            onClick={() => {
                              const expired = isAutoStoppedIllusion(r);
                              if (!checkIsWithinSchedule(r) || expired) {
                                showAlert("Unauthorized", expired ? "Session has automatically ended." : "This task can only be started/stopped during its assigned window.", "warning");
                                return;
                              }
                              if (!r.startTime) handleStartSession(r);
                              else handlePauseSession(r);
                            }}
                            className={`text-[10px] font-bold uppercase tracking-wide px-3 py-1.5 rounded transition-colors flex items-center gap-1 ${
                              r.creditHours >= 20 
                                ? 'bg-gray-600 cursor-not-allowed text-white' 
                                : (!checkIsWithinSchedule(r) || isAutoStoppedIllusion(r))
                                  ? 'bg-[#2e2e2e] text-[#666] cursor-not-allowed'
                                  : !r.startTime ? 'bg-blue-500 hover:bg-blue-600 text-white' : 'bg-amber-500 hover:bg-amber-600 text-white'
                            }`}
                            disabled={r.creditHours >= 20 || isAutoStoppedIllusion(r)}
                            title={
                              r.creditHours >= 20 
                                ? "Completed" 
                                : isAutoStoppedIllusion(r)
                                  ? "Auto-Stopped"
                                  : !checkIsWithinSchedule(r) 
                                    ? "Outside assigned schedule" 
                                    : (!r.startTime ? "Start/Resume Session" : "Pause Session")
                            }
                          >
                            <Clock className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-bold uppercase">{r.creditHours >= 20 ? 'Completed' : (!r.startTime ? (r.accumulated_seconds ? 'Resume' : 'Start') : 'Pause')}</span>
                          </button>
                        )}
                        {(r.status === 'active' || r.status === 'paused') && (
                          <button 
                            onClick={() => handleClockOut(r)}
                            className={`text-[10px] font-bold uppercase tracking-wide px-3 py-1.5 rounded transition-colors flex items-center gap-1 bg-red-500 hover:bg-red-600 text-white disabled:opacity-50 disabled:cursor-not-allowed`}
                            title="Complete Session"
                            disabled={isAutoStoppedIllusion(r)}
                          >
                            <CheckSquare className="w-3.5 h-3.5" /> 
                            <span className="text-[10px] font-bold uppercase">Complete</span>
                          </button>
                        )}
                        <button onClick={() => handleEditRecord(r)} className="p-1.5 text-[#a1a1a1] hover:text-amber-500 transition-colors" title="Edit Log"><Edit2 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDeleteRecord(r.id)} className="p-1.5 text-[#a1a1a1] hover:text-red-500 transition-colors" title="Delete Log"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                      <button 
                        onClick={() => handleVerify(r.id, r.status)} 
                        disabled={r.status === 'active'}
                        className={`text-[10px] px-4 py-1.5 rounded font-bold uppercase transition-all ${
                          r.status === 'active' 
                            ? 'border border-[#2e2e2e] text-[#666] cursor-not-allowed'
                            : r.status === 'pending' 
                              ? 'bg-[#3ecf8e] text-black hover:bg-[#3ecf8e]/80 shadow-[0_0_10px_rgba(62,207,142,0.2)]' 
                              : 'border border-[#2e2e2e] text-[#a1a1a1] hover:text-[#ededed]'
                        }`}
                      >
                         {r.status === 'verified' ? 'Unapprove' : 'Approve'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {tab === 'progress' && (
          <div className="space-y-4 max-w-6xl">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-[#171717] p-3 rounded-xl border border-[#2e2e2e]">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 bg-[#3ecf8e]/10 rounded-xl flex items-center justify-center text-[#3ecf8e] shrink-0 border border-[#3ecf8e]/20">
                    <CheckCircle2 className="w-5 h-5" />
                 </div>
                 <div>
                    <h2 className="text-sm font-bold tracking-tight">Student Progress</h2>
                    <p className="text-[#a1a1a1] text-[10px] font-medium">Goal: 20 verified hours.</p>
                 </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#a1a1a1]" />
                  <input 
                    type="text" 
                    placeholder="Search students..." 
                    value={progressSearch}
                    onChange={(e) => setProgressSearch(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-[#2e2e2e] rounded-md pl-9 pr-3 py-1.5 text-[10px] focus:border-[#3ecf8e] outline-none transition-colors placeholder:text-[#a1a1a1]/30"
                  />
                </div>
                <div className="flex items-center gap-2">
                   <button 
                    onClick={async () => {
                      const eligible = studentProgress.filter(s => s.verifiedHours >= 20 && !s.approval);
                      if (eligible.length === 0) {
                        showAlert("Nothing to Approve", "No students currently meet the 20-hour requirement for approval.", "info");
                        return;
                      }
                      if (!window.confirm(`Batch approve completion for ${eligible.length} eligible students?`)) return;
                      
                      const adminDoc = members.find(m => m.id === user?.uid);
                      if (!adminDoc || !adminDoc.signature) {
                        showAlert("Action Required", "You must set up your digital signature before bulk approving.", "warning");
                        setTab('settings');
                        return;
                      }

                      try {
                        for (const student of eligible) {
                          await addDoc(collection(db, 'completions'), {
                            studentNo: student.studentNo,
                            approverName: adminDoc.displayName,
                            approverRole: (adminDoc.role === 'admin' || adminDoc.role === 'developer') ? 'Head, Office of Student Affairs' : 'OSA Staff',
                            approverSignature: adminDoc.signature,
                            approvedAt: serverTimestamp()
                          });
                        }
                        showAlert("Success", `${eligible.length} students approved successfully.`, "success");
                        // Result handled by onSnapshot
                      } catch (e) {
                        showAlert("Error", "Bulk approval failed.", "error");
                      }
                    }}
                    className="bg-[#3ecf8e] text-black text-[9px] font-bold uppercase tracking-tight px-3 py-2 rounded-lg hover:bg-[#34b27b] transition-all flex items-center gap-1.5 shadow-lg"
                  >
                    <CheckSquare className="w-3 h-3" /> Approve
                  </button>
                  <button 
                    onClick={async () => {
                      const ready = studentProgress.filter(s => s.approval);
                      if (ready.length === 0) {
                        showAlert("No Approved Students", "No students have been approved for completion yet.", "info");
                        return;
                      }
                      if (!window.confirm(`Send completion emails to ${ready.length} approved students?`)) return;
                      
                      showAlert("Sending...", "Batch sending emails in progress. This may take a moment.", "info");
                      
                      let sentCount = 0;
                      for (const student of ready) {
                        try {
                          await sendCompletionEmail(student);
                          sentCount++;
                        } catch (e) {
                          console.error(`Failed to send to ${student.studentEmail}`, e);
                        }
                      }
                      showAlert("Success", `Finished sending ${sentCount} emails.`, "success");
                    }}
                    className="bg-blue-500 text-white text-[9px] font-bold uppercase tracking-tight px-3 py-2 rounded-lg hover:bg-blue-600 transition-all flex items-center gap-1.5 shadow-lg"
                  >
                    <Mail className="w-3 h-3" /> Emails
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
               <div className="bg-[#171717] border border-[#2e2e2e] p-2 rounded-lg flex flex-col items-center">
                  <div className="text-[8px] text-[#a1a1a1] uppercase font-bold tracking-tight mb-0.5">Total</div>
                  <div className="text-sm font-bold">{studentProgressRaw.length}</div>
               </div>
               <div className="bg-[#171717] border border-[#2e2e2e] p-2 rounded-lg flex flex-col items-center">
                  <div className="text-[8px] text-[#a1a1a1] uppercase font-bold tracking-tight mb-0.5">Done</div>
                  <div className="text-sm font-bold text-[#3ecf8e]">{studentProgressRaw.filter(s => s.verifiedHours >= 20).length}</div>
               </div>
               <div className="bg-[#171717] border border-[#2e2e2e] p-2 rounded-lg flex flex-col items-center">
                  <div className="text-[8px] text-[#a1a1a1] uppercase font-bold tracking-tight mb-0.5">Progress</div>
                  <div className="text-sm font-bold text-amber-500">{studentProgressRaw.filter(s => s.verifiedHours < 20).length}</div>
               </div>
            </div>

            <div className="border border-[#2e2e2e] rounded-lg overflow-hidden bg-[#171717] overflow-x-auto">
              <table className="min-w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-[#262626] border-b border-[#2e2e2e] text-[#a1a1a1] text-[9px] font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-3 py-2">Student</th>
                    <th className="px-3 py-2 text-center hidden md:table-cell">Program/Sec</th>
                    <th className="px-3 py-2 text-center">Hours</th>
                    <th className="px-3 py-2 text-center w-24 md:w-40">Progress</th>
                    <th className="px-3 py-2 text-right hidden sm:table-cell">Status</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2e2e2e]">
                  {studentProgress.length === 0 ? (
                    <tr><td colSpan={6} className="px-6 py-6 text-center text-[#a1a1a1]">No student data available.</td></tr>
                  ) : studentProgress.map(s => (
                    <tr key={s.studentNo} className="hover:bg-[#1c1c1c]">
                      <td className="px-3 py-1.5">
                         <div className="flex items-center gap-1.5">
                           <div className="font-bold text-[#ededed] text-[11px] leading-tight flex items-center gap-1">
                             {s.studentName}
                             {s.hasNameMismatch && <AlertCircle className="w-2.5 h-2.5 text-amber-500" />}
                           </div>
                         </div>
                         <div className="text-[8px] text-[#3ecf8e] font-mono leading-tight mt-0.5">{s.studentNo}</div>
                      </td>
                      <td className="px-3 py-1.5 text-center text-[9px] text-[#a1a1a1] hidden md:table-cell">
                        {s.program}/{s.section}
                      </td>
                      <td className="px-3 py-1.5 text-center">
                         <div className="font-bold text-[#ededed] text-[10px]">
                          {s.verifiedHours.toFixed(1)}h
                        </div>
                        <div className="text-[8px] text-[#666] italic leading-tight">of {s.totalHours.toFixed(1)}h</div>
                      </td>
                      <td className="px-3 py-1.5">
                        <div className="flex items-center gap-2">
                          <div className="h-1 bg-[#262626] flex-1 rounded-full overflow-hidden border border-white/5">
                            <div 
                                className={`h-full rounded-full transition-all duration-1000 ${s.verifiedHours >= 20 ? 'bg-[#3ecf8e]' : 'bg-[#3ecf8e]/40'}`} 
                                style={{ width: `${Math.min(100, (s.verifiedHours / 20) * 100)}%` }}
                             />
                          </div>
                          <span className="text-[8px] text-[#a1a1a1] w-4 text-right font-mono">{Math.round(Math.min(100, (s.verifiedHours / 20) * 100))}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-1.5 text-right hidden sm:table-cell">
                        {s.verifiedHours >= 20 ? (
                           <span className="text-[#3ecf8e] text-[8px] font-bold uppercase tracking-tight px-1.5 py-0.5 bg-[#3ecf8e]/5 rounded inline-flex items-center gap-1 border border-[#3ecf8e]/20">
                             Done
                           </span>
                        ) : (
                           <span className="text-[#a1a1a1] text-[8px] font-bold uppercase tracking-tight px-1.5 py-0.5 bg-[#262626] rounded border border-white/5">
                             Active
                           </span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        {s.approval ? (
                           <div className="flex flex-col items-end gap-1">
                             <div className="flex items-center gap-1 text-[#3ecf8e] text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 bg-[#3ecf8e]/10 rounded">
                               <CheckCircle2 className="w-2.5 h-2.5" /> Approved
                             </div>
                             
                             <div className="flex items-center gap-0.5 bg-[#262626] p-0.5 rounded-lg border border-[#2e2e2e]">
                               <button
                                 onClick={() => handlePreviewPDF(s)}
                                 className="text-blue-400 hover:text-blue-300 transition-colors p-1 rounded hover:bg-blue-400/10 flex items-center justify-center"
                                 title="Preview & Print PDF"
                               >
                                 <Printer className="h-3.5 w-3.5" />
                               </button>
                               <div className="w-px h-3 bg-[#3e3e3e]"></div>
                               <button
                                 onClick={() => sendCompletionEmail(s)}
                                 className="text-emerald-400 hover:text-emerald-300 transition-colors p-1 rounded hover:bg-emerald-400/10 flex items-center justify-center"
                                 title="Resend Email to Student"
                               >
                                 <Mail className="h-3.5 w-3.5" />
                               </button>
                               <div className="w-px h-3 bg-[#3e3e3e]"></div>
                               <button
                                 onClick={() => handleUndoApproval(s.approval!.id, s.studentName)}
                                 className="text-red-400 hover:text-red-300 transition-colors p-1 rounded hover:bg-red-400/10 flex items-center justify-center"
                                 title="Undo Approval"
                               >
                                 <RotateCcw className="h-3.5 w-3.5" />
                               </button>
                             </div>
                           </div>
                        ) : s.verifiedHours >= 20 ? (
                           <button
                             onClick={() => handleApproveCompletion(s)}
                             className="bg-amber-500 hover:bg-amber-600 text-black px-2 py-1 rounded-md text-[9px] font-bold uppercase transition-colors flex items-center gap-1.5 ml-auto shadow-lg shadow-amber-500/10"
                           >
                             <CheckCircle2 className="h-3 w-3" />
                             Approve
                           </button>
                        ) : (
                          <span className="text-[#a1a1a1] text-[8px] font-medium italic">Requirement not met</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'history' && (
          <div className="space-y-4 max-w-6xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg md:text-xl font-bold tracking-tight">Execution History</h2>
                <p className="text-[#a1a1a1] text-[10px] mt-0.5">Review completed tasks and corresponding student logs.</p>
              </div>
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#a1a1a1]" />
                <input 
                  type="text" 
                  placeholder="Search history..." 
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="w-full bg-[#171717] border border-[#2e2e2e] rounded-md pl-9 pr-3 py-1.5 text-[10px] focus:border-[#3ecf8e] outline-none transition-colors border-white/5"
                />
              </div>
            </div>
            
            <div className="border border-[#2e2e2e] rounded-lg overflow-hidden bg-[#171717] w-full">
               <div className="hidden lg:block overflow-x-auto w-full">
                 <table className="min-w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-[#262626] border-b border-[#2e2e2e] text-[#a1a1a1] text-[9px] font-bold uppercase tracking-wider">
                      <tr>
                         <th className="px-4 py-2">Task Details</th>
                         <th className="px-4 py-2">In-Charge</th>
                         <th className="px-4 py-2 text-center">Dur</th>
                         <th className="px-4 py-2">Students</th>
                         <th className="px-4 py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2e2e2e]">
                      {historyTasks.length === 0 ? (
                        <tr><td colSpan={5} className="px-6 py-6 text-center text-[#a1a1a1]">No records.</td></tr>
                      ) : historyTasks.map(t => {
                        const executors = records.filter(r => r.taskTitle === t.title && r.date === t.date);
                        return (
                          <tr key={t.id} className="hover:bg-[#1c1c1c]">
                             <td className="px-4 py-2">
                                <div className="font-bold text-[#ededed] text-[11px]">{t.title}</div>
                                <div className="text-[8px] text-[#a1a1a1] uppercase font-mono">{formatDate(t.date)}</div>
                             </td>
                             <td className="px-4 py-2">
                                <div className="text-[10px] text-[#ededed]">{t.staffName}</div>
                                <div className="text-[8px] text-[#a1a1a1]">{formatTime(t.startTime)} - {formatTime(t.endTime)}</div>
                             </td>
                             <td className="px-4 py-2 text-center font-bold text-[#3ecf8e] text-[10px]">
                                {t.duration?.toFixed(1)}h
                             </td>
                             <td className="px-4 py-2">
                                <div className="flex -space-x-1.5">
                                   {executors.slice(0, 4).map((ex, i) => (
                                      <div key={i} className="w-7 h-7 rounded-full border border-[#171717] bg-[#2e2e2e] flex items-center justify-center text-[10px] font-bold" title={ex.studentName}>
                                         {ex.studentName.charAt(0)}
                                      </div>
                                   ))}
                                   {executors.length > 4 && (
                                      <div className="w-7 h-7 rounded-full border border-[#171717] bg-[#3ecf8e]/20 text-[#3ecf8e] flex items-center justify-center text-[10px] font-bold">
                                         +{executors.length - 4}
                                      </div>
                                   )}
                                   {executors.length === 0 && <span className="text-[10px] italic text-[#444]">No student logs</span>}
                                </div>
                             </td>
                             <td className="px-6 py-4 text-right">
                                <div className="flex justify-end gap-2">
                                   {executors.length > 0 ? (
                                     <span className="text-[9px] text-[#555] uppercase font-bold italic">Locked</span>
                                   ) : (
                                     <>
                                       <button onClick={() => handleEditTask(t)} className="p-1.5 hover:bg-amber-500/10 text-amber-500 rounded transition-colors" title="Edit Task"><Edit2 className="w-4 h-4" /></button>
                                       <button onClick={() => handleDeleteTask(t.id)} className="p-1.5 hover:bg-red-500/10 text-red-500 rounded transition-colors" title="Delete Task"><Trash2 className="w-4 h-4" /></button>
                                     </>
                                   )}
                                </div>
                             </td>
                          </tr>
                        );
                      })}
                    </tbody>
                 </table>
               </div>
               
               {/* Mobile Card View */}
               <div className="lg:hidden flex flex-col divide-y divide-[#2e2e2e]">
                 {historyTasks.length === 0 ? (
                   <div className="p-8 text-center text-[#a1a1a1] text-sm">No task history found.</div>
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
                           <span className="text-sm font-bold text-[#3ecf8e]">{t.duration?.toFixed(1)}h</span>
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
          <div className="space-y-4 max-w-6xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg md:text-xl font-bold tracking-tight">Staff Directory</h2>
                <p className="text-[#a1a1a1] text-[10px] mt-0.5">Manage OSA Admins, Staff Members and Registration.</p>
              </div>
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#a1a1a1]" />
                <input 
                  type="text" 
                  placeholder="Search staff..." 
                  value={membersSearch}
                  onChange={(e) => setMembersSearch(e.target.value)}
                  className="w-full bg-[#171717] border border-[#2e2e2e] rounded-md pl-9 pr-3 py-1.5 text-[10px] focus:border-[#3ecf8e] outline-none transition-colors border-white/5"
                />
              </div>
            </div>

            <div className="bg-[#1c1c1c] rounded-xl border border-[#2e2e2e] overflow-hidden p-6 mb-6">
              <h3 className="text-[#ededed] font-medium mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5 text-[#3ecf8e]" />
                System Settings
              </h3>
              <div className="bg-[#171717] rounded-lg p-4 border border-[#2e2e2e] flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <h4 className="text-[#ededed] font-medium tracking-tight text-sm truncate">System Registration</h4>
                  <p className="text-xs text-[#a1a1a1]">Control whether new users can sign up for an account via the login screen.</p>
                </div>
                <button
                  onClick={handleToggleSignups}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none ${allowSignups ? 'bg-[#3ecf8e]' : 'bg-[#2e2e2e]'}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${allowSignups ? 'translate-x-6' : 'translate-x-1'}`}
                  />
                </button>
              </div>
            </div>

            <div className="border border-[#2e2e2e] rounded-lg overflow-hidden bg-[#171717] w-full">
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
                      {filteredMembers.length === 0 ? (
                        <tr><td colSpan={4} className="px-6 py-10 text-center text-[#a1a1a1]">No members found matching your search.</td></tr>
                      ) : filteredMembers.map(m => (
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
     (members.find(usr => usr.id === user?.uid)?.role === 'admin' && m.role !== 'developer')) ? (
     <select
       value={m.role}
       onChange={(e) => handleUpdateRole(m.id, e.target.value as AdminMember['role'], m.displayName, m.role)}
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
   {m.lastLogin 
      ? (typeof m.lastLogin === 'object' && m.lastLogin.toDate 
          ? formatDate(m.lastLogin.toDate().toISOString()) 
          : typeof m.lastLogin === 'string' || typeof m.lastLogin === 'number'
              ? formatDate(new Date(m.lastLogin).toISOString()).replace('Invalid Date', 'Just now') 
              : 'Just now') 
      : 'Never'}
</td>
                        </tr>
                      ))}
                    </tbody>
                 </table>
               </div>
               
               {/* Mobile Card View */}
               <div className="md:hidden flex flex-col divide-y divide-[#2e2e2e]">
                 {filteredMembers.length === 0 ? (
                   <div className="p-8 text-center text-[#a1a1a1] text-sm">No members found mapping your search.</div>
                 ) : filteredMembers.map(m => (
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
                           onChange={(e) => handleUpdateRole(m.id, e.target.value as AdminMember['role'], m.displayName, m.role)}
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
              <p className="text-[#a1a1a1] text-sm mt-1">Manage your profile information and digital signature.</p>
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
                    <input 
                      value={profileForm.role?.replace('_', ' ').toUpperCase() || 'N/A'}
                      disabled
                      className="w-full bg-[#1c1c1c]/50 border border-[#2e2e2e] rounded p-2 text-sm text-[#666] cursor-not-allowed uppercase font-bold tracking-widest"
                    />
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
                         ref={adminSigCanvas}
                         penColor='black'
                         backgroundColor="white" 
                         canvasProps={{className: 'signature-canvas w-full h-40'}} 
                       />
                     </div>
                     <div className="flex w-full gap-2 mt-2">
                       <button 
                         onClick={() => adminSigCanvas.current?.clear()}
                         className="flex-1 bg-[#262626] hover:bg-[#2e2e2e] py-1.5 rounded text-[10px] font-bold uppercase transition-colors"
                       >
                         Clear
                       </button>
                       <button 
                         onClick={saveAdminSignature}
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
        </div>
      </main>

      <AlertModal
        isOpen={modal.isOpen}
        onClose={() => {
          hideAlert();
          // If this was a permission error, send them back
          if (modal.title === 'Access Restricted') {
            window.location.href = '/staff';
          }
        }}
        title={modal.title}
        message={modal.message}
        type={modal.type}
      />
    </div>
  );
}