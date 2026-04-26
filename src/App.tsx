import { useEffect, useState, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { onAuthStateChanged, doc, getDoc, setDoc, serverTimestamp, db, supabase } from './lib/supabase';
import Portal from './pages/Portal';
import Admin from './pages/Admin';
import Staff from './pages/Staff';
import StudentAssistant from './pages/StudentAssistant';
import Developer from './pages/Developer';
import Login from './pages/Login';
import { HelpGuide } from './components/HelpGuide';
import { Loader2, ShieldCheck, ArrowRight, Copy, Check, Info, AlertTriangle } from 'lucide-react';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<any>(null);
  
  const [mfaStatus, setMfaStatus] = useState<'checking' | 'setup' | 'verify' | 'verified'>('checking');
  const [qrCode, setQrCode] = useState('');
  const [secretKey, setSecretKey] = useState(''); 
  const [factorId, setFactorId] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // PREVENT RACE CONDITIONS: This ref stops the "double-trigger" loop seen in your logs
  const isProcessing = useRef(false);
  
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onAuthStateChanged(null, async (u) => {
      if (isProcessing.current) return;
      isProcessing.current = true;

      try {
        if (u) {
          setUser(u);
          const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
          
          if (aalData?.currentLevel === 'aal2') {
            setMfaStatus('verified');
            handleRoleRouting(u);
          } else {
            const { data: factorsData, error: factorsErr } = await supabase.auth.mfa.listFactors();
            if (factorsErr) throw factorsErr;

            const verifiedFactor = factorsData?.totp?.find(f => (f.status as string) === 'verified');

            if (verifiedFactor) {
              setFactorId(verifiedFactor.id);
              setMfaStatus('verify');
            } else {
              // 1. NUKE AND PAVE: If no verified factor exists, delete ALL existing factors
              // This clears the "Friendly name already exists" error once and for all.
              if (factorsData?.totp && factorsData.totp.length > 0) {
                console.log("MFA Gate: Cleaning up existing security factors...");
                for (const factor of factorsData.totp) {
                  await supabase.auth.mfa.unenroll({ factorId: factor.id });
                }
              }

              // 2. Start fresh enrollment
              const { data: enrollData, error: enrollError } = await supabase.auth.mfa.enroll({ 
                factorType: 'totp',
                friendlyName: 'OSA FAGOS Authenticator' 
              });
              
              if (enrollError) throw enrollError;
              
              setFactorId(enrollData.id);
              setQrCode(enrollData.totp.qr_code);
              setSecretKey(enrollData.totp.secret);
              setMfaStatus('setup');
            }
          }
        } else {
          setUser(null);
          setMfaStatus('verified');
        }
      } catch (err: any) {
        console.error("Auth Guard Error:", err.message);
        // If an error happens while logged in, stay on the setup screen so the user can see the error.
        if (u) {
          setError(err.message || "Security handshake failed.");
          setMfaStatus('setup'); 
        } else {
          setMfaStatus('verified');
        }
      } finally {
        setInitializing(false);
        isProcessing.current = false;
      }
    });
    return () => unsub();
  }, [navigate]);

  const handleRoleRouting = async (u: any) => {
    if (window.location.pathname === '/login') {
      const userDoc = await getDoc(doc(db, 'admins', u.uid));
      let role = userDoc.exists() ? userDoc.data().role : 'staff';
      
      if (!userDoc.exists() && u.email === 'christiantomaque18@gmail.com') {
        role = 'developer';
        await setDoc(doc(db, 'admins', u.uid), {
          email: u.email,
          displayName: u.displayName || 'User',
          role: role,
          lastLogin: serverTimestamp()
        }, { merge: true });
      }

      const routes: Record<string, string> = { developer: '/developer', admin: '/admin', student_assistant: '/student-assistant' };
      navigate(routes[role] || '/staff');
    }
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(secretKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifying(true);
    setError('');

    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: otpInput
      });

      if (verifyError) throw verifyError;

      setMfaStatus('verified');
      handleRoleRouting(user);
    } catch (err: any) {
      setError("Invalid code. Check your app and try again.");
    } finally {
      setVerifying(false);
    }
  };

  if (initializing || mfaStatus === 'checking') return (
    <div className="flex justify-center bg-[#1c1c1c] min-h-screen items-center text-[#3ecf8e]">
      <Loader2 className="animate-spin w-8 h-8" />
    </div>
  );

  if (user && mfaStatus !== 'verified' && window.location.pathname !== '/' && window.location.pathname !== '/portal') {
    return (
      <div className="min-h-screen bg-[#1c1c1c] flex items-center justify-center p-6 text-[#ededed]">
        <div className="bg-[#171717] border border-[#2e2e2e] max-w-md w-full p-8 rounded-2xl text-center shadow-xl">
          <div className="w-12 h-12 bg-[#3ecf8e]/10 rounded-xl flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-6 h-6 text-[#3ecf8e]" />
          </div>
          <h2 className="text-xl font-bold mb-1">Two-Step Verification</h2>
          <p className="text-[#a1a1a1] text-xs mb-8 uppercase tracking-widest font-semibold">Complete Security Setup</p>
          
          {mfaStatus === 'setup' && (
            <div className="space-y-6 mb-8 animate-in fade-in zoom-in duration-300">
              <div className="bg-white p-3 rounded-2xl inline-block shadow-inner mx-auto">
                <div 
                  className="w-40 h-40 flex items-center justify-center"
                  dangerouslySetInnerHTML={{ __html: qrCode }} 
                />
              </div>

              <div className="text-left space-y-2">
                <div className="flex items-center gap-2 text-[10px] font-bold text-[#a1a1a1] ml-1 uppercase">
                  <Info className="w-3.5 h-3.5" />
                  <span>Manual Setup Key</span>
                </div>
                <div className="flex items-center justify-between gap-3 bg-[#1c1c1c] border border-[#2e2e2e] p-3 rounded-xl transition-all hover:border-[#3ecf8e]/30">
                  <code className="text-sm font-mono text-[#3ecf8e] truncate flex-1">{secretKey}</code>
                  <button onClick={handleCopyKey} className="p-2 hover:bg-[#3ecf8e]/10 rounded-lg transition-all text-[#3ecf8e]">
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          )}
          
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="text-left space-y-2">
              <label className="text-[10px] font-bold text-[#a1a1a1] ml-1 uppercase tracking-widest">Authenticator Code</label>
              <input 
                type="text" 
                maxLength={6}
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="w-full text-center tracking-[0.5em] font-mono text-2xl bg-[#1c1c1c] border border-[#2e2e2e] text-[#3ecf8e] py-3 rounded-xl outline-none focus:border-[#3ecf8e] transition-all"
              />
            </div>
            {error && (
              <div className="flex items-center gap-2 text-red-500 text-[10px] font-bold bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                <AlertTriangle className="w-3 h-3" />
                {error}
              </div>
            )}
            <button 
              type="submit" 
              disabled={verifying || otpInput.length < 6}
              className="w-full bg-[#3ecf8e] hover:bg-[#34b27b] text-black font-black uppercase tracking-widest text-xs py-4 rounded-xl flex justify-center items-center gap-2 transition-all disabled:opacity-40 shadow-lg shadow-[#3ecf8e]/5"
            >
              {verifying ? <Loader2 className="animate-spin w-5 h-5" /> : <ArrowRight className="w-5 h-5" />}
              {mfaStatus === 'setup' ? 'Verify and Activate' : 'Continue to Dashboard'}
            </button>
          </form>

          <button onClick={() => supabase.auth.signOut()} className="mt-8 text-xs text-[#a1a1a1] hover:text-[#ededed] transition-colors uppercase tracking-widest font-bold">
            Cancel and Logout
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthGuard>
        <HelpGuide />
        <Routes>
          <Route path="/" element={<Portal />} />
          <Route path="/login" element={<Login />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/staff" element={<Staff />} />
          <Route path="/student-assistant" element={<StudentAssistant />} />
          <Route path="/developer" element={<Developer />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthGuard>
    </BrowserRouter>
  );
}