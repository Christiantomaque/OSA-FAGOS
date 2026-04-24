import { useState, useEffect } from 'react';
import { HelpCircle, Play, BookOpen, X } from 'lucide-react';
import { Joyride } from 'react-joyride';
import type { Step, EventData } from 'react-joyride';

export function HelpGuide() {
  const [isOpen, setIsOpen] = useState(false);
  const [runTour, setRunTour] = useState(false);
  const [showManual, setShowManual] = useState(false);

  // Dynamic steps based on what's available in the DOM
  const [steps, setSteps] = useState<Step[]>([]);

  useEffect(() => {
    // Basic tour steps that apply generally
    const tSteps: Step[] = [
      {
        target: 'body',
        content: 'Welcome to the OSA Task Management System! Let us quickly show you around.',
        placement: 'center',
        skipBeacon: true,
      }
    ];

    if (document.querySelector('.system-sidebar') || document.querySelector('aside')) {
        tSteps.push({
            target: document.querySelector('.system-sidebar') ? '.system-sidebar' : 'aside',
            content: 'This sidebar lets you navigate through Tasks, Approval Logs, History, and Members.',
            placement: 'right',
        });
    }

    if (document.querySelector('main')) {
        tSteps.push({
            target: 'main',
            content: 'This is the main workspace area where your data and forms appear.',
            placement: 'left',
        });
    }

    // Portal specific
    if (document.querySelector('.student-portal-board')) {
        tSteps.push({
            target: '.student-portal-board',
            content: 'This board shows all the available tasks. Select one you want to sign up for!',
            placement: 'top',
        });
    }

    setSteps(tSteps);
  }, [runTour]);

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 p-3 sm:p-4 bg-[#3ecf8e] text-black rounded-full shadow-lg hover:bg-[#34b27b] transition-colors group flex items-center gap-2"
        title="Need Help?"
      >
        <HelpCircle className="w-5 h-5 sm:w-6 sm:h-6" />
        <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 ease-in-out whitespace-nowrap font-bold text-xs sm:text-sm">
          Guide & Tour
        </span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 px-4 font-sans">
          <div className="bg-[#171717] border border-[#2e2e2e] p-6 rounded-xl shadow-2xl max-w-sm w-full relative space-y-6">
            <button onClick={() => setIsOpen(false)} className="absolute top-4 right-4 text-[#a1a1a1] hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-[#3ecf8e]/20 text-[#3ecf8e] rounded-full flex items-center justify-center mx-auto mb-4">
                <HelpCircle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">How can we help?</h3>
              <p className="text-xs text-[#a1a1a1]">Get familiar with the system through an interactive tour or our written guide.</p>
            </div>
            
            <div className="space-y-3">
              <button 
                onClick={() => {
                  setIsOpen(false);
                  setTimeout(() => setRunTour(true), 300);
                }}
                className="w-full flex items-center gap-3 p-3 bg-[#1c1c1c] hover:bg-[#2e2e2e] border border-[#2e2e2e] hover:border-[#3ecf8e]/50 rounded-lg transition-colors text-white text-left group"
              >
                <div className="w-8 h-8 rounded bg-[#3ecf8e]/20 text-[#3ecf8e] flex items-center justify-center group-hover:bg-[#3ecf8e] group-hover:text-black transition-colors shrink-0">
                  <Play className="w-4 h-4 fill-current" />
                </div>
                <div>
                  <div className="font-bold text-sm">Start Interactive Tour</div>
                  <div className="text-[10px] text-[#a1a1a1] mt-0.5">A quick walkthrough of the interface.</div>
                </div>
              </button>

              <button 
                onClick={() => {
                  setIsOpen(false);
                  setShowManual(true);
                }}
                className="w-full flex items-center gap-3 p-3 bg-[#1c1c1c] hover:bg-[#2e2e2e] border border-[#2e2e2e] hover:border-[#3ecf8e]/50 rounded-lg transition-colors text-white text-left group"
              >
                <div className="w-8 h-8 rounded bg-[#3ecf8e]/20 text-[#3ecf8e] flex items-center justify-center group-hover:bg-[#3ecf8e] group-hover:text-black transition-colors shrink-0">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-sm">Read User Guide</div>
                  <div className="text-[10px] text-[#a1a1a1] mt-0.5">Comprehensive documentation of features.</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {showManual && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 font-sans">
          <div className="bg-[#171717] border border-[#2e2e2e] rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col relative text-[#ededed]">
            <button onClick={() => setShowManual(false)} className="absolute top-4 right-4 text-[#a1a1a1] hover:text-white z-10 bg-[#262626] rounded p-1">
              <X className="w-5 h-5" />
            </button>
            <div className="p-6 border-b border-[#2e2e2e] shrink-0 pr-12">
               <h2 className="text-xl font-bold flex items-center gap-2 text-[#3ecf8e]">
                 <BookOpen className="w-5 h-5" /> OSA System Reference Guide
               </h2>
               <p className="text-xs text-[#a1a1a1] mt-1">Version 1.0 • Task & Hours Management</p>
            </div>
            <div className="p-6 overflow-y-auto space-y-8 text-sm custom-scrollbar">
                <section>
                    <h3 className="text-[#3ecf8e] font-bold uppercase tracking-wider text-xs mb-3 border-b border-[#2e2e2e] pb-1">1. Overview</h3>
                    <p className="text-[#a1a1a1] leading-relaxed">The system centralizes service task allocation, student assistant logs, and hours tracking. It maintains schedules, credits, and verification seamlessly to replace manual paperwork.</p>
                </section>
                <section>
                    <h3 className="text-[#3ecf8e] font-bold uppercase tracking-wider text-xs mb-3 border-b border-[#2e2e2e] pb-1">2. Assigning Tasks (Staff/Admin)</h3>
                    <ul className="list-disc pl-5 space-y-2 text-[#a1a1a1]">
                        <li>Navigate to the <strong className="text-white">Tasks</strong> tab and utilize the Assign Task form.</li>
                        <li>Input Date, Time Window, and Capacity (number of students needed).</li>
                        <li><span className="text-amber-500">Important:</span> The time window defined strictly enforces the period students can physically clock in or out. Logs cannot be started outside of their scheduled block.</li>
                    </ul>
                </section>
                <section>
                    <h3 className="text-[#3ecf8e] font-bold uppercase tracking-wider text-xs mb-3 border-b border-[#2e2e2e] pb-1">3. Managing Logs & Time Tracking</h3>
                    <ul className="list-disc pl-5 space-y-2 text-[#a1a1a1]">
                        <li>Students must physically check-in via the <strong>Public Portal</strong> first to pre-record their service slot for the day.</li>
                        <li>Once they report to you in person, locate them on your <strong className="text-white">Approve Logs</strong> tab. Click the blue <strong className="text-white bg-blue-500/20 px-1 py-0.5 rounded text-[10px]">Start Now</strong> button to activate their timer.</li>
                        <li>When their service is complete, click the red <strong className="text-white bg-red-500/20 px-1 py-0.5 rounded text-[10px]">Stop Time</strong> button.</li>
                        <li>Hours are automatically calculated based on the precise start and end times recorded by the system, capped universally at 20 hours.</li>
                        <li>If a shift exceeds the scheduled end time without administrative action, <strong className="text-white">Late Penalty</strong> deductions automatically cap their credit to the scheduled bound.</li>
                    </ul>
                </section>
                <section>
                    <h3 className="text-[#3ecf8e] font-bold uppercase tracking-wider text-xs mb-3 border-b border-[#2e2e2e] pb-1">4. Verification & Digital Signatures</h3>
                    <ul className="list-disc pl-5 space-y-2 text-[#a1a1a1]">
                        <li>When a shift physically concludes (Status: Pending), you must officially <strong className="text-white">Approve</strong> it to reflect in the final tally.</li>
                        <li>Approval permanently attaches your digital signature to their record for official auditing.</li>
                        <li>You can draw or upload your signature via the <strong className="text-white">Settings</strong> tab.</li>
                    </ul>
                </section>
                <section>
                    <h3 className="text-[#3ecf8e] font-bold uppercase tracking-wider text-xs mb-3 border-b border-[#2e2e2e] pb-1">5. Student Portal Registration</h3>
                    <ul className="list-disc pl-5 space-y-2 text-[#a1a1a1]">
                        <li>The Student Portal is the landing page. Students browse available tasks published by staff for today or future dates.</li>
                        <li>Upon selecting a task, they must provide their Student ID, Name, Program, and trace an e-signature to complete sign-up.</li>
                    </ul>
                </section>
            </div>
          </div>
        </div>
      )}

      {runTour && steps.length > 0 && (
        <Joyride
          steps={steps}
          run={runTour}
          continuous={true}
          onEvent={(data: EventData) => {
            if (['finished', 'skipped'].includes(data.status as string)) {
              setRunTour(false);
            }
          }}
          options={{
            backgroundColor: '#171717',
            primaryColor: '#3ecf8e',
            textColor: '#ededed',
            arrowColor: '#171717',
            zIndex: 1000,
          }}
          styles={{
            tooltip: {
                border: '1px solid #2e2e2e',
                borderRadius: '12px'
            },
            buttonBack: {
                color: '#a1a1a1'
            },
            buttonPrimary: {
                backgroundColor: '#3ecf8e',
                color: 'black',
                fontWeight: 'bold',
                borderRadius: '6px'
            }
          }}
        />
      )}
    </>
  );
}
