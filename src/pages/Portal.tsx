import { useState, useEffect, useRef } from 'react';
import { collection, query, addDoc, serverTimestamp, orderBy, db, onSnapshot } from '../lib/supabase';
import { Loader2, Plus, Clock, KeySquare, Calendar, CheckCircle2, ChevronDown, PenTool, Eraser } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { motion, AnimatePresence } from 'motion/react';
import { formatDate, formatTime, getTodayYYYYMMDD, getHHMM, formatDynamicTime } from '../lib/utils';
import SignatureCanvas from 'react-signature-canvas';
import { AlertModal } from '../components/ui/AlertModal';
import { useAlert } from '../hooks/useAlert';

// --- Image Placeholders ---
const cdmLogo = '/logo/images/cdmlogo.png';
const osaLogo = '/logo/images/osalogo.png';

// --- Types ---
type Task = {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  capacity?: number;
  staffName: string;
};

type FormData = {
  studentName: string;
  studentEmail: string;
  program: string;
  section: string;
  studentNo: string;
  bracket: string;
  taskId: string;
  semester: '1st Semester' | '2nd Semester';
};

export default function Portal() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskClaimCounts, setTaskClaimCounts] = useState<Record<string, number>>({});
  const [studentClaims, setStudentClaims] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isBracketOpen, setIsBracketOpen] = useState(false);
  
  const sigPad = useRef<SignatureCanvas>(null);
  const { modal, showAlert, hideAlert } = useAlert();

  const currentYear = new Date().getFullYear();
  const academicYear = `${currentYear} - ${currentYear + 1}`;

  const { register, handleSubmit, control, watch, reset, setValue } = useForm<FormData>({
    defaultValues: {
      semester: '1st Semester'
    }
  });

  const watchTaskId = watch("taskId");
  const watchStudentNo = watch("studentNo");

  // --- Real-Time Data Sync ---
  useEffect(() => {
    // 1. Real-time listener for Tasks
    const unsubTasks = onSnapshot(
      query(collection(db, 'tasks'), orderBy('date', 'desc')), 
      (snapshot: any) => {
        const tasksData = snapshot.docs.map((doc: any) => ({ 
          id: doc.id, 
          ...doc.data() 
        } as Task));
        setTasks(tasksData);
        setLoading(false);
      }
    );

    // 2. Real-time listener for Service Records to track task claims
    const unsubRecords = onSnapshot(collection(db, 'service_records'), (snapshot: any) => {
      const counts: Record<string, number> = {};
      const claims: Record<string, string[]> = {};
      snapshot.docs.forEach((doc: any) => {
        const data = doc.data();
        if (data.taskId) {
          counts[data.taskId] = (counts[data.taskId] || 0) + 1;
          if (data.studentNo) {
            const num = String(data.studentNo).trim();
            if (!claims[num]) claims[num] = [];
            claims[num].push(data.taskId);
          }
        }
      });
      setTaskClaimCounts(counts);
      setStudentClaims(claims);
    });

    return () => {
      unsubTasks();
      unsubRecords();
    };
  }, []);

  // --- Advanced Real-Time Filtering Logic ---
  const activeTasks = tasks.filter(t => {
    const now = new Date();
    const today = getTodayYYYYMMDD();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const claimCount = taskClaimCounts[t.id] || 0;
    const isFull = claimCount >= (t.capacity || 1);
    
    const taskEndHHMM = getHHMM(t.endTime);
    const isFutureDate = t.date > today;
    const isTodayAndNotExpired = t.date === today && taskEndHHMM > currentTime;

    // Check if the current student has already claimed this task
    let alreadyClaimed = false;
    if (watchStudentNo) {
      const studentNoStr = String(watchStudentNo).trim();
      if (studentClaims[studentNoStr] && studentClaims[studentNoStr].includes(t.id)) {
        alreadyClaimed = true;
      }
    }

    return !isFull && !alreadyClaimed && (isFutureDate || isTodayAndNotExpired);
  });

  const selectedTask = tasks.find(t => t.id === watchTaskId);

  // --- Submission Logic ---
  const onSubmit = async (data: FormData) => {
    if (!selectedTask) return;
    setSubmitting(true);

    try {
      if (sigPad.current?.isEmpty()) {
        showAlert("Wait!", "Please provide your signature on the signature pad.", "warning");
        setSubmitting(false);
        return;
      }

      if (data.studentNo) {
        const studentNoStr = String(data.studentNo).trim();
        if (studentClaims[studentNoStr] && studentClaims[studentNoStr].includes(selectedTask.id)) {
          showAlert("Duplicate Request", "You have already claimed this task. Please wait for verification.", "error");
          setValue("taskId", "");
          setSubmitting(false);
          return;
        }
      }

      if ((taskClaimCounts[selectedTask.id] || 0) >= (selectedTask.capacity || 1)) {
        showAlert("Task Unavailable", "This task has reached its maximum capacity. Please select another one.", "error");
        setValue("taskId", "");
        setSubmitting(false);
        return;
      }

      let signatureData = '';
      try {
        const svgData = sigPad.current?.getSignaturePad().toDataURL('image/svg+xml');
        if (svgData) {
          signatureData = svgData;
        }
      } catch (e) {
        console.error("Signature capture failed", e);
      }

      await addDoc(collection(db, 'service_records'), {
        studentName: data.studentName,
        studentEmail: data.studentEmail,
        studentNo: data.studentNo,
        program: data.program,
        section: data.section,
        bracket: data.bracket,
        semester: data.semester,
        academicYear: academicYear,
        taskId: selectedTask.id,
        taskTitle: selectedTask.title,
        staffName: selectedTask.staffName,
        date: selectedTask.date,
        timeIn: selectedTask.startTime,
        timeOut: selectedTask.endTime,
        scheduledStartTime: selectedTask.startTime,
        scheduledEndTime: selectedTask.endTime,
        creditHours: selectedTask.duration,
        studentSignature: signatureData,
        status: "pending",
        createdAt: serverTimestamp()
      });

      showAlert("Success", "Service obligation successfully recorded!", "success");
      sigPad.current?.clear();
      reset();
    } catch (err: any) {
      console.error("Submission error:", err);
      showAlert("Submission Failed", `Error: ${err.message || "Please check your connection."}`, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#1c1c1c] text-[#ededed] font-sans sm:p-6 lg:p-8 flex justify-center pb-20">
      <div className="student-portal-board max-w-3xl w-full bg-[#171717] border border-[#2e2e2e] sm:rounded-lg overflow-hidden mt-4 shadow-xl">

        {/* --- HEADER SECTION --- */}
        <div className="border-b border-[#2e2e2e] bg-[#1c1c1c] p-4 sm:p-6">
          <div className="flex items-center justify-between gap-2 sm:gap-4 max-w-2xl mx-auto">
            
            {/* Left Logo (CDM) */}
            <img 
              src={cdmLogo} 
              alt="CDM Logo" 
              className="w-12 h-12 sm:w-20 sm:h-20 -mt-8 sm:-mt-12 object-contain shrink-0 drop-shadow-md" 
            />
            
            {/* Center Text */}
            <div className="text-center flex-1">
              <h1 className="text-base sm:text-2xl font-bold tracking-tight text-[#ededed] uppercase leading-tight">Colegio de Muntinlupa</h1>
              <p className="text-[9px] sm:text-xs font-medium tracking-wide text-[#a1a1a1] mt-1 uppercase">The Home of Future Engineers and Architects</p>
              
              <div className="my-3 sm:my-4 h-px w-16 bg-[#3ecf8e] mx-auto rounded-full"></div>
              
              <h2 className="text-xs sm:text-md text-[#3ecf8e] font-semibold uppercase">Office of Student Affairs</h2>
              <h3 className="text-[11px] sm:text-lg font-bold text-[#ededed] mt-1 sm:mt-2 whitespace-nowrap tracking-tight uppercase">SERVICE OBLIGATION COMPLETION FORM</h3>
            </div>

            {/* Right Logo (OSA) - Scaled up to remove transparent padding effect */}
            <img 
              src={osaLogo} 
              alt="OSA Logo" 
              className="w-12 h-12 sm:w-20 sm:h-20 -mt-16 sm:-mt-26 object-contain shrink-0 drop-shadow-md scale-170 origin-top" 
            />

          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 sm:p-10 space-y-8">

          {/* --- STUDENT INFO --- */}
          <div>
            <h4 className="text-sm font-semibold text-[#ededed] uppercase tracking-wider mb-4 border-b border-[#2e2e2e] pb-2 flex items-center gap-2">
              <KeySquare className="w-4 h-4 text-[#3ecf8e]" />
              Student Information
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[#a1a1a1]">Full Name</label>
                <input {...register("studentName", { required: true })} className="w-full text-sm bg-[#1c1c1c] border border-[#2e2e2e] text-[#ededed] px-3 py-2.5 rounded-md focus:border-[#3ecf8e] outline-none" placeholder="Last Name, First Name M.I." />
              </div>
              
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[#a1a1a1]">Student No.</label>
                <input 
                  {...register("studentNo", { required: true })} 
                  onInput={(e) => {
                    e.currentTarget.value = e.currentTarget.value.replace(/[^0-9]/g, '');
                  }}
                  inputMode="numeric"
                  className="w-full text-sm bg-[#1c1c1c] border border-[#2e2e2e] text-[#ededed] px-3 py-2.5 rounded-md focus:border-[#3ecf8e] outline-none" 
                  placeholder="e.g. 20210001" 
                />
              </div>
              
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[#a1a1a1]">Email Address</label>
                <input type="email" {...register("studentEmail", { required: true })} className="w-full text-sm bg-[#1c1c1c] border border-[#2e2e2e] text-[#ededed] px-3 py-2.5 rounded-md focus:border-[#3ecf8e] outline-none" placeholder="name@example.com" />
              </div>
              
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[#a1a1a1]">Program</label>
                <input {...register("program", { required: true })} className="w-full text-sm bg-[#1c1c1c] border border-[#2e2e2e] text-[#ededed] px-3 py-2.5 rounded-md focus:border-[#3ecf8e] outline-none" placeholder="e.g. BSIT" />
              </div>
              
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[#a1a1a1]">Section</label>
                <input {...register("section", { required: true })} className="w-full text-sm bg-[#1c1c1c] border border-[#2e2e2e] text-[#ededed] px-3 py-2.5 rounded-md focus:border-[#3ecf8e] outline-none" placeholder="e.g. 1E4" />
              </div>
              
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[#a1a1a1]">Scholarship Bracket</label>
                <Controller
                  name="bracket"
                  control={control}
                  rules={{ required: true }}
                  render={({ field }) => (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsBracketOpen(!isBracketOpen)}
                        className="w-full text-left text-sm bg-[#1c1c1c] border border-[#2e2e2e] text-[#ededed] px-3 py-2.5 rounded-md focus:border-[#3ecf8e] outline-none flex items-center justify-between transition-colors hover:border-[#3e3e3e]"
                      >
                        <span className={!field.value ? 'text-[#a1a1a1]/50' : 'text-[#ededed]'}>
                          {field.value || "-- Select Bracket --"}
                        </span>
                        <ChevronDown className={`w-4 h-4 text-[#a1a1a1] transition-transform duration-200 ${isBracketOpen ? 'rotate-180' : ''}`} />
                      </button>

                      <AnimatePresence>
                        {isBracketOpen && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setIsBracketOpen(false)} />
                            <motion.div
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              className="absolute z-20 left-0 right-0 mt-2 bg-[#171717] border border-[#2e2e2e] rounded-lg shadow-2xl overflow-hidden"
                            >
                              {["BRACKET A", "BRACKET B", "BRACKET C"].map((bracket) => (
                                <button
                                  key={bracket}
                                  type="button"
                                  onClick={() => { field.onChange(bracket); setIsBracketOpen(false); }}
                                  className="w-full text-left px-4 py-3 hover:bg-[#3ecf8e]/10 border-b border-[#2e2e2e] last:border-0 text-sm font-medium text-[#ededed] hover:text-[#3ecf8e] transition-colors"
                                >
                                  {bracket}
                                </button>
                              ))}
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                />
              </div>

            </div>
          </div>

          {/* --- TASK SELECTION --- */}
          <div className="pt-2 task-selection-area">
            <h4 className="text-sm font-semibold text-[#ededed] uppercase tracking-wider mb-4 border-b border-[#2e2e2e] pb-2 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#3ecf8e]" />
              Service Selection
            </h4>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#a1a1a1]">Select Daily Task Activity</label>

              <Controller
                name="taskId"
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      disabled={loading}
                      className="w-full text-left text-sm bg-[#0a0a0a] border border-[#2e2e2e] text-[#ededed] pl-4 pr-10 py-3.5 rounded-md focus:border-[#3ecf8e] outline-none flex items-center justify-between hover:border-[#3e3e3e]"
                    >
                      <span className={!field.value ? 'text-[#a1a1a1]/40' : ''}>
                        {field.value 
                          ? tasks.find(t => t.id === field.value)?.title + " (Selected)"
                          : loading ? "Syncing tasks..." : "-- Choose an available task --"
                        }
                      </span>
                      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    <AnimatePresence>
                      {isDropdownOpen && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setIsDropdownOpen(false)} />
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="absolute z-20 left-0 right-0 mt-2 bg-[#171717] border border-[#2e2e2e] rounded-lg shadow-2xl overflow-hidden max-h-64 overflow-y-auto"
                          >
                            {activeTasks.length === 0 ? (
                              <div className="p-10 text-center text-xs text-[#a1a1a1] italic">
                                No tasks available for today.
                              </div>
                            ) : (
                              activeTasks.map((t) => {
                                const count = taskClaimCounts[t.id] || 0;
                                const capacity = t.capacity || 1;
                                const remaining = capacity - count;
                                const isFull = remaining <= 0;

                                return (
                                  <button
                                    key={t.id}
                                    type="button"
                                    disabled={isFull}
                                    onClick={() => { field.onChange(t.id); setIsDropdownOpen(false); }}
                                    className={`w-full text-left p-4 border-b border-[#2e2e2e] last:border-0 group ${isFull ? 'opacity-40 cursor-not-allowed bg-black/20' : 'hover:bg-[#3ecf8e]/10'}`}
                                  >
                                    <div className="flex justify-between items-start mb-1">
                                      <div className="flex flex-col">
                                        <span className={`font-bold transition-colors ${isFull ? 'text-[#a1a1a1]' : 'text-[#ededed] group-hover:text-[#3ecf8e]'}`}>{t.title}</span>
                                        {isFull ? (
                                          <span className="text-[9px] text-red-500 font-black uppercase tracking-tighter">Full Capacity</span>
                                        ) : (
                                          <span className="text-[9px] text-[#3ecf8e] font-bold uppercase tracking-tighter">{remaining}   slot {remaining > 1 ? 's' : ''}  left</span>
                                        )}
                                      </div>
                                      <span className="text-[10px] bg-[#1c1c1c] px-2 py-0.5 rounded text-[#a1a1a1]">{formatDate(t.date)}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-[#a1a1a1] text-[10px] uppercase font-bold">
                                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatTime(t.startTime)} - {formatTime(t.endTime)}</span>
                                      <span className={isFull ? 'text-[#a1a1a1]' : 'text-[#3ecf8e]'}>{formatDynamicTime(Number(t.duration) * 3600)}</span>
                                    </div>
                                  </button>
                                );
                              })
                            )}
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              />
            </div>

            {selectedTask && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mt-4 p-5 rounded-lg bg-[#1c1c1c] border border-[#2e2e2e] space-y-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div><div className="text-[9px] uppercase font-bold text-[#a1a1a1] mb-1">Time In</div><div className="text-sm font-mono">{formatTime(selectedTask.startTime)}</div></div>
                  <div><div className="text-[9px] uppercase font-bold text-[#a1a1a1] mb-1">Time Out</div><div className="text-sm font-mono">{formatTime(selectedTask.endTime)}</div></div>
                  <div><div className="text-[9px] uppercase font-bold text-[#a1a1a1] mb-1">Duration</div><div className="text-sm font-bold text-[#3ecf8e]">{formatDynamicTime(Number(selectedTask.duration) * 3600)}</div></div>
                </div>
                <div className="pt-2 border-t border-[#2e2e2e] flex justify-between items-center text-sm">
                   <div className="text-[9px] uppercase font-bold text-[#a1a1a1]">Authorized Staff</div>
                   <div className="font-medium">{selectedTask.staffName}</div>
                </div>
              </motion.div>
            )}
          </div>

          {/* --- SIGNATURE CANVAS --- */}
          <div className="pt-2">
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-[#ededed] flex items-center gap-2">
                <PenTool className="w-3.5 h-3.5 text-[#3ecf8e]" />
                Student Digital Signature
              </label>
              <button type="button" onClick={() => sigPad.current?.clear()} className="text-[10px] uppercase font-bold text-red-500 hover:text-red-400 flex items-center gap-1 transition-colors">
                <Eraser className="w-3 h-3" /> Clear Pad
              </button>
            </div>
            <div className="bg-white rounded-lg overflow-hidden h-32 md:h-40 border-2 border-[#2e2e2e] focus-within:border-[#3ecf8e] transition-all">
              <SignatureCanvas 
                ref={sigPad}
                penColor="black" 
                backgroundColor="white"
                canvasProps={{ className: 'w-full h-full cursor-crosshair' }} 
              />
            </div>
          </div>

          {/* --- FOOTER --- */}
          <div className="pt-6 border-t border-[#2e2e2e] flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <a href="/login" className="text-[10px] uppercase font-bold text-[#3ecf8e] hover:text-[#ededed] tracking-widest transition-colors border border-[#3ecf8e]/20 px-3 py-1.5 rounded-md bg-[#3ecf8e]/5">Staff Access</a>
              <button 
                disabled={submitting || !selectedTask}
                className="bg-[#3ecf8e] hover:bg-[#34b27b] disabled:opacity-30 disabled:cursor-not-allowed text-black text-sm font-bold px-8 py-3 rounded-md transition-all flex items-center gap-2 shadow-lg shadow-[#3ecf8e]/10"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Submit Log Record
              </button>
            </div>
            <p className="text-[9px] text-[#666] text-center italic">Report bugs to: tomaque.christian.a.220@cdm.edu.ph</p>
          </div>
        </form>
      </div>

      <AlertModal isOpen={modal.isOpen} onClose={hideAlert} title={modal.title} message={modal.message} type={modal.type} />
    </main>
  );
}
