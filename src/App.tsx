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
import { Loader2, ShieldCheck, ArrowRight, Copy, Check, Info } from 'lucide-react';

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
            const { data: factorsData } = await supabase.auth.mfa.listFactors();
            const verifiedFactor = factorsData?.totp?.find(f => (f.status as string) === 'verified');

            if (verifiedFactor) {
              setFactorId(verifiedFactor.id);
              setMfaStatus('verify');
            } else {
              if (factorsData?.totp && factorsData.totp.length > 0) {
                for (const factor of factorsData.totp) {
                  await supabase.auth.mfa.unenroll({ factorId: factor.id });
                }
              }

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
        if (u) {
          setError(err.message || "Handshake failed.");
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
      
      if (!userDoc.exists()) {
        role = u.email === 'christiantomaque18@gmail.com' ? 'developer' : 'staff';
        await setDoc(doc(db, 'admins', u.uid), {
          email: u.email, displayName: u.displayName || 'User', role, lastLogin: serverTimestamp()
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
      const { data: chalData, error: chalErr } = await supabase.auth.mfa.challenge({ factorId });
      if (chalErr) throw chalErr;

      const { error: verErr } = await supabase.auth.mfa.verify({
        factorId, challengeId: chalData.id, code: otpInput
      });

      if (verErr) throw verErr;

      setMfaStatus('verified');
      handleRoleRouting(user);
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

  if (user && mfaStatus !== 'verified' && window.location.pathname !== '/' && window.location.pathname !== '/portal') {
    return (
      <div className="min-h-screen bg-[#1c1c1c] flex items-center justify-center p-4">
        <div className="bg-[#171717] border border-[#2e2e2e] max-w-sm w-full p-6 rounded-xl text-center shadow-xl">
          <ShieldCheck className="w-8 h-8 text-[#3ecf8e] mx-auto mb-3" />
          <h2 className="text-lg font-bold mb-1">MFA Verification</h2>
          <p className="text-[#a1a1a1] text-[10px] mb-6 uppercase tracking-widest font-semibold">Secure Official Session</p>
          
          {mfaStatus === 'setup' && (
            <div className="space-y-4 mb-6">
              <div className="bg-white p-2 rounded-lg inline-block mx-auto">
                <img src={qrCode} alt="QR" className="w-32 h-32" />
              </div>

              <div className="text-left space-y-1">
                <span className="text-[9px] font-bold text-[#a1a1a1] ml-1 uppercase">Manual Key</span>
                <div className="flex items-center justify-between bg-[#1c1c1c] border border-[#2e2e2e] px-3 py-2 rounded-lg">
                  <code className="text-[11px] font-mono text-[#3ecf8e] truncate flex-1">{secretKey}</code>
                  <button onClick={handleCopyKey} className="ml-2 text-[#3ecf8e]">
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            </div>
          )}
          
          <form onSubmit={handleVerifyOtp} className="space-y-3">
            <div className="text-left space-y-1">
              <label className="text-[9px] font-bold text-[#a1a1a1] ml-1 uppercase">6-Digit Code</label>
              <input 
                type="text" maxLength={6} value={otpInput}
                onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="w-full text-center tracking-[0.5em] font-mono text-xl bg-[#1c1c1c] border border-[#2e2e2e] text-[#3ecf8e] py-2.5 rounded-lg outline-none focus:border-[#3ecf8e] transition-all"
              />
            </div>
            {error && <p className="text-red-500 text-[9px] font-bold bg-red-500/10 py-2 rounded-md">{error}</p>}
            <button 
              type="submit" disabled={verifying || otpInput.length < 6}
              className="w-full bg-[#3ecf8e] hover:bg-[#34b27b] text-black font-black uppercase text-[10px] py-3 rounded-lg flex justify-center items-center gap-2 transition-all disabled:opacity-40"
            >
              {verifying ? <Loader2 className="animate-spin w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
              Verify Session
            </button>
          </form>

          <button onClick={() => supabase.auth.signOut()} className="mt-6 text-[9px] text-[#666] hover:text-[#ededed] transition-colors uppercase font-bold tracking-tighter">
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