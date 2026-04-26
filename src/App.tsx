import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { onAuthStateChanged, doc, getDoc, setDoc, serverTimestamp, db, supabase } from './lib/supabase';
import Portal from './pages/Portal';
import Admin from './pages/Admin';
import Staff from './pages/Staff';
import StudentAssistant from './pages/StudentAssistant';
import Developer from './pages/Developer';
import Login from './pages/Login';
import { HelpGuide } from './components/HelpGuide';
import { Loader2, ShieldCheck, ArrowRight, Copy, Check, Info, RefreshCw } from 'lucide-react';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<any>(null);
  
  // MFA States
  const [mfaStatus, setMfaStatus] = useState<'checking' | 'setup' | 'verify' | 'verified'>('checking');
  const [qrCode, setQrCode] = useState('');
  const [secretKey, setSecretKey] = useState(''); 
  const [factorId, setFactorId] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  
  const navigate = useNavigate();

  useEffect(() => {
    // 1. SAFETY VALVE: If Supabase hangs for more than 4 seconds, force-stop the spinner.
    const safetyTimer = setTimeout(() => {
      if (initializing) {
        console.warn("MFA Gate: Handshake timed out. Failing open to allow Portal access.");
        setInitializing(false);
        if (mfaStatus === 'checking') setMfaStatus('verified');
      }
    }, 4000);

    const unsub = onAuthStateChanged(null, async (u) => {
      try {
        if (u) {
          setUser(u);
          
          // 2. Check if the user is already fully verified
          const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
          
          if (aalData?.currentLevel === 'aal2') {
            setMfaStatus('verified');
            handleRoleRouting(u);
          } else {
            // 3. List factors to check for "Ghost" (unverified) attempts
            const { data: factorsData, error: factorsErr } = await supabase.auth.mfa.listFactors();
            if (factorsErr) throw factorsErr;

            const verifiedFactor = factorsData?.totp?.find(f => (f.status as string) === 'verified');
            const unverifiedFactor = factorsData?.totp?.find(f => (f.status as string) === 'unverified');

            if (verifiedFactor) {
              setFactorId(verifiedFactor.id);
              setMfaStatus('verify');
            } else {
              // 4. AUTO-RECOVERY: Delete any stuck/unverified factor before starting a new one
              if (unverifiedFactor) {
                console.log("MFA Gate: Cleaning up stuck enrollment...");
                await supabase.auth.mfa.unenroll({ factorId: unverifiedFactor.id });
              }

              // 5. Start Fresh Enrollment with a Friendly Name
              const { data: enrollData, error: enrollError } = await supabase.auth.mfa.enroll({ 
                factorType: 'totp',
                friendlyName: 'OSA FAGOS Device' // Added this to prevent the "" error
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
        console.error("MFA Critical Error:", err.message);
        setMfaStatus('verified'); // Don't block the public portal on error
      } finally {
        clearTimeout(safetyTimer);
        setInitializing(false);
      }
    });

    return () => {
      clearTimeout(safetyTimer);
      unsub();
    };
  }, [navigate]);

  const handleRoleRouting = async (u: any) => {
    if (window.location.pathname === '/login') {
      const userDoc = await getDoc(doc(db, 'admins', u.uid));
      let role = userDoc.exists() ? userDoc.data().role : 'staff';
      
      if (!userDoc.exists()) {
        role = u.email === 'christiantomaque18@gmail.com' ? 'developer' : 'staff';
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
      setError("Invalid code. Please check your app.");
    } finally {
      setVerifying(false);
    }
  };

  // --- LOADING UI ---
  if (initializing || mfaStatus === 'checking') return (
    <div className="flex flex-col gap-4 justify-center bg-[#1c1c1c] min-h-screen items-center text-[#3ecf8e]">
      <Loader2 className="animate-spin w-10 h-10" />
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#a1a1a1] animate-pulse">
        System Security Initializing...
      </p>
    </div>
  );

  // --- MFA GATE UI ---
  if (user && mfaStatus !== 'verified' && window.location.pathname !== '/' && window.location.pathname !== '/portal') {
    return (
      <div className="min-h-screen bg-[#1c1c1c] flex items-center justify-center p-6 text-[#ededed]">
        <div className="bg-[#171717] border border-[#2e2e2e] max-w-md w-full p-8 rounded-2xl text-center shadow-xl">
          <div className="w-12 h-12 bg-[#3ecf8e]/10 rounded-xl flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-6 h-6 text-[#3ecf8e]" />
          </div>
          <h2 className="text-xl font-bold mb-1 tracking-tight">Authenticator Setup</h2>
          <p className="text-[#a1a1a1] text-xs mb-8 uppercase tracking-widest">Device Enrollment Required</p>
          
          {mfaStatus === 'setup' && (
            <div className="space-y-6 mb-8">
              {/* QR Container - High Contrast for Brave/Chrome scanners */}
              <div className="bg-white p-3 rounded-2xl inline-block shadow-inner mx-auto">
                <div 
                  className="w-40 h-40 flex items-center justify-center"
                  dangerouslySetInnerHTML={{ __html: qrCode }} 
                />
              </div>

              {/* Manual Entry Section */}
              <div className="text-left space-y-2 px-2">
                <div className="flex items-center gap-2 text-[10px] font-bold text-[#a1a1a1] ml-1 uppercase tracking-widest">
                  <Info className="w-3.5 h-3.5" />
                  <span>Manual Key</span>
                </div>
                <div className="flex items-center justify-between gap-3 bg-[#1c1c1c] border border-[#2e2e2e] p-3 rounded-xl">
                  <code className="text-sm font-mono text-[#3ecf8e] truncate flex-1">{secretKey}</code>
                  <button onClick={handleCopyKey} className="p-2 hover:bg-[#3ecf8e]/10 rounded-lg transition-all text-[#3ecf8e]">
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          )}
          
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="text-left space-y-2 px-2">
              <label className="text-[10px] font-bold text-[#a1a1a1] ml-1 uppercase tracking-widest">6-Digit Code</label>
              <input 
                type="text" maxLength={6} value={otpInput}
                onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="w-full text-center tracking-[0.5em] font-mono text-2xl bg-[#1c1c1c] border border-[#2e2e2e] text-[#3ecf8e] py-3.5 rounded-xl outline-none focus:border-[#3ecf8e] transition-all"
              />
            </div>
            {error && <p className="text-red-500 text-[10px] font-bold bg-red-500/10 py-2.5 rounded-lg border border-red-500/20">{error}</p>}
            <button 
              type="submit" disabled={verifying || otpInput.length < 6}
              className="w-full bg-[#3ecf8e] hover:bg-[#34b27b] text-black font-black uppercase tracking-widest text-xs py-4 rounded-xl flex justify-center items-center gap-2 transition-all disabled:opacity-30 active:scale-95"
            >
              {verifying ? <Loader2 className="animate-spin w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
              {mfaStatus === 'setup' ? 'Verify and Activate' : 'Authorize Dashboard'}
            </button>
          </form>

          <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="mt-8 flex items-center justify-center gap-2 mx-auto text-[10px] font-bold text-[#666] hover:text-[#ededed] uppercase tracking-widest transition-colors">
            <RefreshCw className="w-3 h-3" /> Fix Stuck Session
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