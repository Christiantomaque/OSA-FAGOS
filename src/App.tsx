import { useEffect, useState, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { onAuthStateChanged, doc, getDoc, setDoc, serverTimestamp, db, supabase, User } from './lib/supabase';
import Portal from './pages/Portal';
import Admin from './pages/Admin';
import Staff from './pages/Staff';
import StudentAssistant from './pages/StudentAssistant';
import Developer from './pages/Developer';
import Login from './pages/Login';
import { HelpGuide } from './components/HelpGuide';
import { Loader2, ShieldCheck, ArrowRight, Copy, Check, Info, AlertCircle } from 'lucide-react';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  
  const [mfaStatus, setMfaStatus] = useState<'checking' | 'setup' | 'verify' | 'verified'>('checking');
  const [qrCode, setQrCode] = useState('');
  const [secretKey, setSecretKey] = useState(''); 
  const [factorId, setFactorId] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const isSyncing = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onAuthStateChanged(null, async (u) => {
      if (isSyncing.current) return;
      isSyncing.current = true;

      try {
        if (u) {
          setUser(u);
          
          // 1. THE 30-DAY TRUST LOGIC
          const trustKey = `mfa_trust_${u.uid}`;
          const trustExpiry = localStorage.getItem(trustKey);
          const isTrusted = trustExpiry && Date.now() < parseInt(trustExpiry);

          const { data: aalData, error: aalErr } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
          if (aalErr) throw aalErr;

          if (aalData?.currentLevel === 'aal2' || isTrusted) {
            // ALREADY SECURE: Skip gate and handle routing
            setMfaStatus('verified');
            await handleRoleRouting(u);
          } else {
            // NEED SECURITY: Check factors
            const { data: factorsData, error: factorsErr } = await supabase.auth.mfa.listFactors();
            if (factorsErr) throw factorsErr;

            const verifiedFactor = factorsData?.totp?.find(f => (f.status as string) === 'verified');

            if (verifiedFactor) {
              setFactorId(verifiedFactor.id);
              setMfaStatus('verify');
            } else {
              // THE 422 CLEANUP: Nuke existing unverified factors
              if (factorsData?.totp && factorsData.totp.length > 0) {
                for (const factor of factorsData.totp) {
                  await supabase.auth.mfa.unenroll({ factorId: factor.id });
                }
              }

              // FRESH ENROLLMENT
              const { data: enrollData, error: enrollErr } = await supabase.auth.mfa.enroll({ 
                factorType: 'totp',
                friendlyName: 'OSA FAGOS Authenticator' 
              });
              if (enrollErr) throw enrollErr;
              
              setFactorId(enrollData.id);
              setQrCode(enrollData.totp.qr_code);
              setSecretKey(enrollData.totp.secret);
              setMfaStatus('setup');
            }
          }
        } else {
          // PUBLIC VIEWING
          setUser(null);
          setMfaStatus('verified');
        }
      } catch (err: any) {
        console.error("Auth Guard Loop Detected:", err.message);
        // Fix 403 Sub Claim
        if (err.message.includes("sub claim") || err.status === 403) {
          await supabase.auth.signOut();
          localStorage.clear();
          window.location.reload();
          return;
        }
        setMfaStatus('verified');
      } finally {
        setInitializing(false);
        isSyncing.current = false;
      }
    });
    return () => unsub();
  }, [navigate]);

  const handleRoleRouting = async (u: User) => {
    // FORCE ROUTING: This solves the "stuck on login page" issue
    const userDoc = await getDoc(doc(db, 'admins', u.uid));
    let role = userDoc.exists() ? userDoc.data().role : 'staff';
    
    if (!userDoc.exists() && u.email === 'christiantomaque18@gmail.com') {
      role = 'developer';
      await setDoc(doc(db, 'admins', u.uid), {
        email: u.email, displayName: u.displayName || 'User', role, lastLogin: serverTimestamp()
      });
    }

    const routes: Record<string, string> = { developer: '/developer', admin: '/admin', student_assistant: '/student-assistant' };
    const targetPath = routes[role] || '/staff';
    
    // Only navigate if we are currently at the login gate
    if (window.location.pathname === '/login') {
      navigate(targetPath, { replace: true });
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifying(true);
    setError('');

    try {
      const { data: chalData, error: chalErr } = await supabase.auth.mfa.challenge({ factorId });
      if (chalErr) throw chalErr;

      const { error: verErr } = await supabase.auth.mfa.verify({
        factorId, challengeId: chalData.id, code: otpInput
      });
      if (verErr) throw verErr;

      // SUCCESS: Set the 30-day trust token
      if (user) {
        const thirtyDays = Date.now() + (30 * 24 * 60 * 60 * 1000);
        localStorage.setItem(`mfa_trust_${user.uid}`, thirtyDays.toString());
      }

      setMfaStatus('verified');
      await handleRoleRouting(user!);
    } catch (err: any) {
      setError("Invalid code. Check your app.");
    } finally {
      setVerifying(false);
    }
  };

  if (initializing || mfaStatus === 'checking') return (
    <div className="flex justify-center bg-[#1c1c1c] min-h-screen items-center">
      <Loader2 className="animate-spin text-[#3ecf8e] w-6 h-6" />
    </div>
  );

  // --- ULTRA-COMPACT SECURITY UI ---
  if (user && mfaStatus !== 'verified' && window.location.pathname !== '/' && window.location.pathname !== '/portal') {
    return (
      <div className="min-h-screen bg-[#1c1c1c] flex items-center justify-center p-4">
        <div className="bg-[#171717] border border-[#2e2e2e] max-w-[340px] w-full p-6 rounded-2xl text-center shadow-2xl">
          <ShieldCheck className="w-8 h-8 text-[#3ecf8e] mx-auto mb-3" />
          <h2 className="text-lg font-bold mb-0.5 tracking-tight text-[#ededed]">System Security</h2>
          <p className="text-[#a1a1a1] text-[9px] mb-6 uppercase tracking-widest font-bold">Two-Step Verification</p>
          
          {mfaStatus === 'setup' && (
            <div className="space-y-4 mb-6">
              <div className="bg-white p-2 rounded-lg inline-block mx-auto">
                <img src={qrCode} alt="QR" className="w-32 h-32 object-contain" />
              </div>
              <div className="text-left space-y-1.5 px-1">
                <span className="text-[9px] font-bold text-[#555] ml-1 uppercase">Manual Key</span>
                <div className="flex items-center justify-between bg-[#1c1c1c] border border-[#2e2e2e] px-3 py-2 rounded-xl">
                  <code className="text-[10px] font-mono text-[#3ecf8e] truncate flex-1">{secretKey}</code>
                  <button onClick={() => { navigator.clipboard.writeText(secretKey); setCopied(true); setTimeout(()=>setCopied(false), 2000); }} className="ml-2 text-[#3ecf8e]">
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          )}
          
          <form onSubmit={handleVerifyOtp} className="space-y-3 px-1">
            <div className="text-left space-y-1.5">
              <label className="text-[9px] font-bold text-[#555] ml-1 uppercase tracking-widest">Authenticator Code</label>
              <input 
                type="text" maxLength={6} value={otpInput}
                onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="w-full text-center tracking-[0.4em] font-mono text-xl bg-[#1c1c1c] border border-[#2e2e2e] text-[#3ecf8e] py-2.5 rounded-xl outline-none focus:border-[#3ecf8e]"
              />
            </div>
            {error && (
              <div className="flex items-center gap-2 text-red-500 text-[10px] font-bold bg-red-500/10 p-2 rounded-lg border border-red-500/20">
                <AlertCircle className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{error}</span>
              </div>
            )}
            <button 
              type="submit" disabled={verifying || otpInput.length < 6}
              className="w-full bg-[#3ecf8e] hover:bg-[#34b27b] text-black font-black uppercase text-[10px] py-3.5 rounded-xl transition-all flex justify-center items-center gap-2 active:scale-95 disabled:opacity-30"
            >
              {verifying ? <Loader2 className="animate-spin w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
              Authorize Session
            </button>
          </form>

          <button onClick={() => supabase.auth.signOut()} className="mt-6 text-[9px] text-[#555] hover:text-[#ededed] transition-colors uppercase font-bold tracking-widest">
            Sign out of account
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