import { useState, useEffect, useRef } from 'react';
import { collection, query, getDocs, addDoc, serverTimestamp, orderBy, db } from '../lib/supabase';
import { Loader2, Plus, Clock, KeySquare, Calendar, CheckCircle2, ChevronDown, PenTool, Eraser } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { motion, AnimatePresence } from 'motion/react';
import { formatDate, formatTime, getTodayYYYYMMDD } from '../lib/utils';
import SignatureCanvas from 'react-signature-canvas';
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
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [showCompletionMessage, setShowCompletionMessage] = useState(false);
  
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const sigPad = useRef<SignatureCanvas>(null);
  const { modal, showAlert, hideAlert } = useAlert();
  
  const currentYear = new Date().getFullYear();
  const academicYear = `${currentYear} - ${currentYear + 1}`;

  const { register, handleSubmit, control, watch, reset, setValue, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      semester: '1st Semester'
    }
  });
  
  const watchTaskId = watch("taskId");

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const q = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        const tasksData: Task[] = [];
        querySnapshot.forEach((doc) => {
          tasksData.push({ id: doc.id, ...doc.data() } as Task);
        });
        setTasks(tasksData);
      } catch (err) {
        console.error("Failed to fetch tasks", err);
      } finally {
        setLoading(false);
      }
    };
    fetchTasks();
  }, []);

  const selectedTask = tasks.find(t => t.id === watchTaskId);

  const checkCompletion = async (studentNo: string) => {
    try {
      const q = query(collection(db, 'service_records'));
      const snap = await getDocs(q);
      const records = snap.docs.map(d => d.data());
      const verifiedHours = records
        .filter(r => r.studentNo === studentNo && r.status === 'verified')
        .reduce((sum, r) => sum + r.creditHours, 0);
      
      if (verifiedHours >= 20) {
        setShowCompletionMessage(true);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const activeTasks = tasks.filter(t => t.date >= getTodayYYYYMMDD());

  const onSubmit = async (data: FormData) => {
    if (!selectedTask) return;
    setSubmitting(true);
    setSuccessMsg("");
    setShowCompletionMessage(false);
    try {
      if (sigPad.current?.isEmpty()) {
        showAlert("Wait!", "Please provide your signature on the signature pad.", "warning");
        setSubmitting(false);
        return;
      }

      let signatureData = '';
      try {
        signatureData = sigPad.current?.getTrimmedCanvas().toDataURL('image/png') || '';
      } catch (e) {
        console.warn("Trimming failed, saving raw canvas", e);
        signatureData = sigPad.current?.getCanvas().toDataURL('image/png') || '';
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
        creditHours: selectedTask.duration,
        studentSignature: signatureData,
        status: "pending",
        createdAt: serverTimestamp()
      });
      setSuccessMsg("Service obligation successfully recorded! Wait for OSA verification.");
      showAlert("Success", "Service obligation successfully recorded! Wait for OSA verification.", "success");
      sigPad.current?.clear();
      reset();
      checkCompletion(data.studentNo);
    } catch (err: any) {
      console.error("FULL ERROR OBJECT:", err);
      // Try to get message from error data if it's a Supabase error
      const msg = err.message || (err.error?.message) || "Please check your connection and try again.";
      console.error("Extracted message:", msg);
      showAlert("Submission Failed", `Error: ${msg}`, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1c1c1c] text-[#ededed] font-sans sm:p-6 lg:p-8 flex justify-center pb-20">
      <div className="max-w-3xl w-full bg-[#171717] border border-[#2e2e2e] sm:rounded-lg overflow-hidden mt-4 shadow-xl">
        {/* Header matching Document */}
        <div className="border-b border-[#2e2e2e] bg-[#1c1c1c] p-6 sm:p-10 text-center">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#ededed] uppercase">Colegio de Muntinlupa</h1>
          <p className="text-sm font-medium tracking-wide text-[#a1a1a1] mt-1 uppercase">The Home of Future Engineers and Architects</p>
          <div className="my-4 h-px w-16 bg-[#3ecf8e] mx-auto rounded-full"></div>
          <h2 className="text-md sm:text-lg text-[#3ecf8e] font-semibold uppercase">Office of Student Affairs</h2>
          <h3 className="text-lg sm:text-xl font-bold text-[#ededed] mt-2">SERVICE OBLIGATION COMPLETION FORM</h3>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 sm:p-10 space-y-8">
          {successMsg && (
            <div className="p-4 bg-[#3ecf8e]/10 border border-[#3ecf8e]/20 text-[#3ecf8e] rounded-lg text-sm flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#3ecf8e]"></div>
              {successMsg}
            </div>
          )}

          {showCompletionMessage && (
            <div className="p-4 bg-[#3ecf8e]/20 border border-[#3ecf8e] text-[#3ecf8e] rounded-lg text-sm">
              <div className="font-bold flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-4 h-4" /> 20 HOURS COMPLETED!
              </div>
              <p className="text-xs">Congratulations! Your service obligation is complete. A digital copy of your completion form has been queued for your email.</p>
            </div>
          )}

          {/* Student Info Section */}
          <div>
            <h4 className="text-sm font-semibold text-[#ededed] uppercase tracking-wider mb-4 border-b border-[#2e2e2e] pb-2 flex items-center gap-2">
              <KeySquare className="w-4 h-4 text-[#3ecf8e]" />
              Student Information
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-[#a1a1a1]">Full Name</label>
                <input {...register("studentName", { required: true })} className="w-full text-sm placeholder:text-[#a1a1a1]/40 bg-[#1c1c1c] border border-[#2e2e2e] text-[#ededed] px-3 py-2.5 rounded-md focus:ring-1 focus:ring-[#3ecf8e] focus:border-[#3ecf8e] outline-none transition-all" placeholder="Last Name, First Name M.I." />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-[#a1a1a1]">Student No.</label>
                <input {...register("studentNo", { required: true })} className="w-full text-sm placeholder:text-[#a1a1a1]/40 bg-[#1c1c1c] border border-[#2e2e2e] text-[#ededed] px-3 py-2.5 rounded-md focus:ring-1 focus:ring-[#3ecf8e] focus:border-[#3ecf8e] outline-none transition-all" placeholder="e.g. 20210001" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-[#a1a1a1]">Email Address</label>
                <input type="email" {...register("studentEmail", { required: true })} className="w-full text-sm placeholder:text-[#a1a1a1]/40 bg-[#1c1c1c] border border-[#2e2e2e] text-[#ededed] px-3 py-2.5 rounded-md focus:ring-1 focus:ring-[#3ecf8e] focus:border-[#3ecf8e] outline-none transition-all" placeholder="name@example.com" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-[#a1a1a1]">Program</label>
                <input {...register("program", { required: true })} className="w-full text-sm placeholder:text-[#a1a1a1]/40 bg-[#1c1c1c] border border-[#2e2e2e] text-[#ededed] px-3 py-2.5 rounded-md focus:ring-1 focus:ring-[#3ecf8e] focus:border-[#3ecf8e] outline-none transition-all" placeholder="e.g. BSIT" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-[#a1a1a1]">Section</label>
                <input {...register("section", { required: true })} className="w-full text-sm placeholder:text-[#a1a1a1]/40 bg-[#1c1c1c] border border-[#2e2e2e] text-[#ededed] px-3 py-2.5 rounded-md focus:ring-1 focus:ring-[#3ecf8e] focus:border-[#3ecf8e] outline-none transition-all" placeholder="e.g. 1E4" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-[#a1a1a1]">Scholarship Bracket</label>
                <input {...register("bracket", { required: true })} className="w-full text-sm placeholder:text-[#a1a1a1]/40 bg-[#1c1c1c] border border-[#2e2e2e] text-[#ededed] px-3 py-2.5 rounded-md focus:ring-1 focus:ring-[#3ecf8e] focus:border-[#3ecf8e] outline-none transition-all" placeholder="e.g. BRACKET A" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-[#a1a1a1]">Semester</label>
                <select {...register("semester", { required: true })} className="w-full text-sm bg-[#1c1c1c] border border-[#2e2e2e] text-[#ededed] px-3 py-2.5 rounded-md focus:ring-1 focus:ring-[#3ecf8e] focus:border-[#3ecf8e] outline-none transition-all appearance-none cursor-pointer">
                  <option value="1st Semester">1st Semester</option>
                  <option value="2nd Semester">2nd Semester</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-[#a1a1a1]">Academic Year</label>
                <div className="w-full text-sm bg-[#0a0a0a] border border-[#2e2e2e] text-[#a1a1a1] px-3 py-2.5 rounded-md font-mono">
                  A.Y. {academicYear}
                </div>
              </div>
            </div>
          </div>

          {/* Task Info Section */}
          <div className="pt-2">
            <h4 className="text-sm font-semibold text-[#ededed] uppercase tracking-wider mb-4 border-b border-[#2e2e2e] pb-2 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#3ecf8e]" />
              Service Selection
            </h4>
            <div className="space-y-4">
              
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-[#a1a1a1]">Select Daily Task Activity</label>
                
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
                        className="w-full text-left text-sm bg-[#0a0a0a] border border-[#2e2e2e] text-[#ededed] pl-4 pr-10 py-3.5 rounded-md focus:ring-1 focus:ring-[#3ecf8e] focus:border-[#3ecf8e] outline-none transition-all disabled:opacity-50 flex items-center justify-between hover:border-[#3e3e3e]"
                      >
                        <span className={!field.value ? 'text-[#a1a1a1]/40' : ''}>
                          {field.value 
                            ? tasks.find(t => t.id === field.value)?.title + " (Selected)"
                            : loading ? "Loading available tasks..." : "-- Choose a published task --"
                          }
                        </span>
                        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>

                      <AnimatePresence>
                        {isDropdownOpen && (
                          <>
                            <div 
                              className="fixed inset-0 z-10" 
                              onClick={() => setIsDropdownOpen(false)} 
                            />
                            <motion.div
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              className="absolute z-20 left-0 right-0 mt-2 bg-[#171717] border border-[#2e2e2e] rounded-lg shadow-2xl overflow-hidden max-h-64 overflow-y-auto"
                            >
                              {activeTasks.length === 0 ? (
                                <div className="p-4 text-center text-xs text-[#a1a1a1]">No active tasks available</div>
                              ) : (
                                activeTasks.map((t) => (
                                  <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => {
                                      field.onChange(t.id);
                                      setIsDropdownOpen(false);
                                    }}
                                    className={`w-full text-left p-4 hover:bg-[#3ecf8e]/10 border-b border-[#2e2e2e] last:border-0 transition-colors group ${field.value === t.id ? 'bg-[#3ecf8e]/5' : ''}`}
                                  >
                                    <div className="flex justify-between items-start mb-1">
                                      <span className="font-bold text-[#ededed] group-hover:text-[#3ecf8e]">{t.title}</span>
                                      <span className="text-[10px] bg-[#1c1c1c] px-2 py-0.5 rounded text-[#a1a1a1] group-hover:text-[#ededed]">{formatDate(t.date)}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-[#a1a1a1] text-[10px] uppercase tracking-wider">
                                      <span className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {t.startTime && t.endTime ? `${formatTime(t.startTime)} - ${formatTime(t.endTime)}` : 'Time N/A'}
                                      </span>
                                      <span className="text-[#3ecf8e] font-bold">
                                        {t.duration ? `${t.duration.toFixed(1)} hrs` : '0.0 hrs'}
                                      </span>
                                    </div>
                                  </button>
                                ))
                              )}
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                />

                {tasks.length === 0 && !loading && (
                  <p className="text-xs text-amber-500 mt-1">No tasks available currently. Check back later.</p>
                )}
              </div>

              {selectedTask && (
                <div className="p-5 rounded-lg bg-[#1c1c1c] border border-[#2e2e2e] space-y-4">
                  <div className="flex justify-between items-center bg-[#171717] p-3 rounded border border-[#2e2e2e]">
                     <div className="text-[10px] text-[#a1a1a1] uppercase font-bold tracking-widest">Schedule Details</div>
                     <div className="text-[#3ecf8e] font-bold text-[10px] uppercase">{formatDate(selectedTask.date)}</div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-[10px] uppercase text-[#a1a1a1] mb-1">Time Start</div>
                      <div className="text-sm font-mono">{formatTime(selectedTask.startTime)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-[#a1a1a1] mb-1">Time End</div>
                      <div className="text-sm font-mono">{formatTime(selectedTask.endTime)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-[#a1a1a1] mb-1">Duration</div>
                      <div className="text-sm font-bold text-[#3ecf8e]">{selectedTask.duration?.toFixed(1)} hrs</div>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-[#2e2e2e]">
                     <div className="text-[10px] text-[#a1a1a1] uppercase mb-1">Authorized Staff</div>
                     <div className="text-sm font-medium">{selectedTask.staffName}</div>
                  </div>
                </div>
              )}

              <div className="bg-[#1c1c1c] p-4 rounded-xl border border-[#2e2e2e] text-xs text-[#a1a1a1] leading-relaxed">
                <p className="font-semibold text-[#ededed] mb-1 text-[10px] uppercase tracking-widest">Important Reminders:</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>Fill-out the form neatly, and completely.</li>
                  <li>Duration is automatically set by the OSA based on the selected activity.</li>
                  <li>Once you verify and complete the 20 hours required duty, you will be notified via email.</li>
                  <li>Do not lose your digital records. All verified logs are protected by the OSA.</li>
                </ul>
              </div>

              <div className="pt-4">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-[#ededed] flex items-center gap-2">
                    <PenTool className="w-3.5 h-3.5 text-[#3ecf8e]" />
                    Student Digital Signature
                  </label>
                  <button 
                    type="button" 
                    onClick={() => sigPad.current?.clear()}
                    className="text-[10px] uppercase font-bold text-red-500 hover:text-red-400 flex items-center gap-1 transition-colors"
                  >
                    <Eraser className="w-3 h-3" /> Clear Signature
                  </button>
                </div>
                <div className="bg-[#0a0a0a] border border-[#2e2e2e] rounded-lg overflow-hidden h-32 md:h-40">
                  <SignatureCanvas 
                    ref={sigPad}
                    penColor="#3ecf8e"
                    canvasProps={{ className: 'w-full h-full cursor-crosshair' }}
                  />
                </div>
                <p className="text-[9px] text-[#a1a1a1] mt-2 italic">* By signing, you certify that the above information is true and correct.</p>
              </div>

            </div>
          </div>

          <div className="pt-6 border-t border-[#2e2e2e] flex items-center justify-between">
            <a href="/admin" className="text-xs text-[#a1a1a1] hover:text-[#ededed] transition-colors">
              OSA Admin Login
            </a>
            <button 
              disabled={submitting || !selectedTask}
              className="bg-[#3ecf8e] hover:bg-[#34b27b] disabled:opacity-50 disabled:cursor-not-allowed text-black text-sm font-bold px-6 py-3 rounded-md transition-colors flex items-center gap-2 shadow-sm"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Submit Log Record
            </button>
          </div>
        </form>
      </div>

      <AlertModal 
        isOpen={modal.isOpen}
        onClose={hideAlert}
        title={modal.title}
        message={modal.message}
        type={modal.type}
      />
    </div>
  );
}
