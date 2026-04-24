import { useState, useEffect } from 'react';
import { HelpCircle, Play, BookOpen, X } from 'lucide-react';
import { Joyride } from 'react-joyride';
import type { Step, EventData } from 'react-joyride';
import { useLocation } from 'react-router-dom';

export function HelpGuide() {
  const [isOpen, setIsOpen] = useState(false);
  const [runTour, setRunTour] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const location = useLocation();

  const isPortal = location.pathname === '/';

  // Dynamic steps based on what's available in the DOM
  const [steps, setSteps] = useState<Step[]>([]);

  useEffect(() => {
    let tSteps: Step[] = [];

    if (isPortal) {
      tSteps = [
        {
          target: 'body',
          content: 'Welcome to the OSA Task Management Portal! This is where students sign up for daily tasks.',
          placement: 'center',
          skipBeacon: true,
        },
        {
          target: '.student-portal-board',
          content: 'This main board contains the form to sign up for a physical service task.',
          placement: 'top',
        }
      ];
    } else {
      tSteps = [
        {
          target: 'body',
          content: 'Welcome to the System Dashboard! Let us quickly show you around your workspace.',
          placement: 'center',
          skipBeacon: true,
        }
      ];

      if (document.querySelector('.system-sidebar') || document.querySelector('aside')) {
          tSteps.push({
              target: document.querySelector('.system-sidebar') ? '.system-sidebar' : 'aside',
              content: 'This sidebar lets you navigate through your available tools like Tasks, Approval Logs, and Members.',
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
    }

    setSteps(tSteps);
  }, [runTour, isPortal]);

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
              <p className="text-xs text-[#a1a1a1]">Get familiar with the {isPortal ? 'Portal' : 'Dashboard'} through an interactive tour or our written guide.</p>
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
               <p className="text-xs text-[#a1a1a1] mt-1">{isPortal ? 'Portal Instructions' : 'Dashboard Workflow & Management'}</p>
            </div>
            <div className="p-6 overflow-y-auto space-y-8 text-sm custom-scrollbar">
              {isPortal ? (
                <>
                  <section>
                      <h3 className="text-[#3ecf8e] font-bold uppercase tracking-wider text-xs mb-3 border-b border-[#2e2e2e] pb-1">1. Welcome to the Portal</h3>
                      <p className="text-[#a1a1a1] leading-relaxed">The Student Portal is the public landing page. Students browse available tasks published by staff for today or future dates.</p>
                  </section>
                  <section>
                      <h3 className="text-[#3ecf8e] font-bold uppercase tracking-wider text-xs mb-3 border-b border-[#2e2e2e] pb-1">2. Signing up for a Task</h3>
                      <ul className="list-disc pl-5 space-y-2 text-[#a1a1a1]">
                          <li>Select an available task from the dropdown menu. Ensure the date and time fit your schedule.</li>
                          <li>Fill in your Student ID, Full Name, and Program.</li>
                          <li>Provide your digital signature in the pad provided.</li>
                          <li>Click <strong className="text-white bg-green-500/20 px-1 py-0.5 rounded text-[10px]">Submit Log Record</strong>.</li>
                      </ul>
                  </section>
                  <section>
                      <h3 className="text-[#3ecf8e] font-bold uppercase tracking-wider text-xs mb-3 border-b border-[#2e2e2e] pb-1">3. Physical Check-in</h3>
                      <ul className="list-disc pl-5 space-y-2 text-[#a1a1a1]">
                          <li>Submitting the form here creates a "Pending" log.</li>
                          <li>You must physically report to the designated office/staff to have them "Clock In" your actual start time on their end to start receiving credit.</li>
                      </ul>
                  </section>
                </>
              ) : (
                <>
                  <section>
                      <h3 className="text-[#3ecf8e] font-bold uppercase tracking-wider text-xs mb-3 border-b border-[#2e2e2e] pb-1">1. Overview</h3>
                      <p className="text-[#a1a1a1] leading-relaxed">The system centralizes service task allocation, student assistant logs, and hours tracking. It maintains schedules, credits, and verification seamlessly to replace manual paperwork.</p>
                  </section>
                  <section>
                      <h3 className="text-[#3ecf8e] font-bold uppercase tracking-wider text-xs mb-3 border-b border-[#2e2e2e] pb-1">2. Assigning Tasks (Staff/Admin)</h3>
                      <ul className="list-disc pl-5 space-y-2 text-[#a1a1a1]">
                          <li>Navigate to the <strong className="text-white">Tasks</strong> tab and utilize the Assign Task form.</li>
                          <li>Input Date, Time Window, and Capacity.</li>
                          <li><span className="text-amber-500">Important:</span> Scheduled limits strictly cap the creditable hours, even if students check out later.</li>
                      </ul>
                  </section>
                  <section>
                      <h3 className="text-[#3ecf8e] font-bold uppercase tracking-wider text-xs mb-3 border-b border-[#2e2e2e] pb-1">3. Managing Logs & Time Tracking</h3>
                      <ul className="list-disc pl-5 space-y-2 text-[#a1a1a1]">
                          <li>On the <strong className="text-white">Approve Logs</strong> tab, identify pending portal submissions. Click the blue <strong className="text-white bg-blue-500/20 px-1 py-0.5 rounded text-[10px]">Start Now</strong> button to activate a session.</li>
                          <li>When the student leaves, click the red <strong className="text-white bg-red-500/20 px-1 py-0.5 rounded text-[10px]">Stop Time</strong> button.</li>
                          <li>System calculates precise hours, enforcing the maximum 20-hour limit and applying any late penalties if they exceed the task's schedule.</li>
                      </ul>
                  </section>
                  <section>
                      <h3 className="text-[#3ecf8e] font-bold uppercase tracking-wider text-xs mb-3 border-b border-[#2e2e2e] pb-1">4. Verification & Digital Signatures</h3>
                      <ul className="list-disc pl-5 space-y-2 text-[#a1a1a1]">
                          <li>You must officially <strong className="text-white">Approve</strong> completed shifts to reflect in final tallies.</li>
                          <li>Setup your signature in <strong className="text-white">Settings</strong> so it automatically appends to approved records.</li>
                      </ul>
                  </section>
                </>
              )}
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
