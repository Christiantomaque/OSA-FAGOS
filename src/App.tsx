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
import { Loader2, ShieldCheck, ArrowRight, Copy, Check, Info } from 'lucide-react';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<any>(null);
  
  const [mfaStatus, setMfaStatus] = useState<'checking' | 'setup' | 'verify' | 'verified'>('checking');
  const [qrCode, setQrCode] = useState('');
  const [secretKey, setSecretKey] = useState(''); // Stores the manual entry key
  const [factorId, setFactorId] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onAuthStateChanged(null, async (u) => {
      if (u) {
        setUser(u);
        try {
          const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
          
          if (aalData?.currentLevel === 'aal2') {
            setMfaStatus('verified');
            handleRoleRouting(u);
          } else {
            const { data: factorsData } = await supabase.auth.mfa.listFactors();
            const totpFactor = factorsData?.totp?.[0];

            if (totpFactor && totpFactor.status === 'verified') {
              setFactorId(totpFactor.id);
              setMfaStatus('verify');
            } else {
              const { data: enrollData, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
              if (enrollError) throw enrollError;
              
              setFactorId(enrollData.id);
              setQrCode(enrollData.totp.qr_code);
              setSecretKey(enrollData.totp.secret); // Capture the manual secret key
              setMfaStatus('setup');
            }
          }
        } catch (err) {
          console.error("Auth/MFA Error:", err);
        }
      } else {
        setUser(null);
        setMfaStatus('verified');
      }
      setInitializing(false);
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

  const copyToClipboard = () => {
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
      setError(err.message || "Invalid code. Please try again.");
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
          <h2 className="text-xl font-bold mb-1">Secure Your Account</h2>
          <p className="text-[#a1a1a1] text-sm mb-6">Verification required for **OSA FAGOS** access.</p>
          
          {mfaStatus === 'setup' && (
            <div className="space-y-6 mb-6">
              {/* QR Code Section */}
              <div className="bg-white p-3 rounded-2xl inline-block shadow-inner">
                <div 
                  className="w-40 h-40"
                  dangerouslySetInnerHTML={{ __html: qrCode }} 
                />
              </div>

              {/* Manual Entry Section */}
              <div className="text-left bg-[#1c1c1c] border border-[#2e2e2e] p-4 rounded-xl">
                <div className="flex items-center gap-2 mb-2 text-[#3ecf8e]">
                  <Info className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Manual Setup Key</span>
                </div>
                <div className="flex items-center justify-between gap-3 bg-[#171717] p-2 rounded-lg border border-[#2e2e2e]">
                  <code className="text-sm font-mono text-[#ededed] truncate">{secretKey}</code>
                  <button 
                    onClick={copyToClipboard}
                    className="p-2 hover:bg-[#3ecf8e]/10 rounded-md transition-colors text-[#3ecf8e]"
                    title="Copy Key"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          )}
          
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="text-left">
              <label className="text-xs font-semibold text-[#a1a1a1] ml-1 mb-1 block">Enter 6-digit Authenticator Code</label>
              <input 
                type="text" 
                maxLength={6}
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                placeholder="······"
                className="w-full text-center tracking-[0.5em] font-mono text-2xl bg-[#1c1c1c] border border-[#2e2e2e] text-[#3ecf8e] py-3 rounded-xl outline-none focus:border-[#3ecf8e] focus:ring-1 focus:ring-[#3ecf8e]/50 transition-all"
              />
            </div>
            {error && <p className="text-red-500 text-xs font-medium bg-red-500/10 py-2 rounded-lg">{error}</p>}
            <button 
              type="submit" 
              disabled={verifying || otpInput.length < 6}
              className="w-full bg-[#3ecf8e] hover:bg-[#34b27b] text-black font-bold py-3.5 rounded-xl flex justify-center items-center gap-2 transition-all disabled:opacity-40 shadow-lg shadow-[#3ecf8e]/10 active:scale-[0.98]"
            >
              {verifying ? <Loader2 className="animate-spin w-5 h-5" /> : <Check className="w-5 h-5" />}
              {mfaStatus === 'setup' ? 'Verify and Activate' : 'Continue to Dashboard'}
            </button>
          </form>

          <button 
            onClick={() => supabase.auth.signOut()} 
            className="mt-8 text-xs text-[#a1a1a1] hover:text-[#3ecf8e] transition-colors"
          >
            Cancel and Sign Out
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