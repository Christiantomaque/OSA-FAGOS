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
import { Loader2, ShieldCheck, Mail, ArrowRight } from 'lucide-react';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [isMfaVerified, setIsMfaVerified] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onAuthStateChanged(null, async (u) => {
      if (u) {
        setUser(u);
        // 1. Check for 7-day Trust Token
        const trustToken = localStorage.getItem(`fagos_trust_${u.uid}`);
        if (trustToken) {
          const { expiry } = JSON.parse(trustToken);
          if (new Date().getTime() < expiry) {
            setIsMfaVerified(true);
          }
        }
        
        // 2. Fetch/Create Role Profile
        try {
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

          // 3. Handle Auto-Redirects if already verified
          if (isMfaVerified && window.location.pathname === '/login') {
            const routes: Record<string, string> = { developer: '/developer', admin: '/admin', student_assistant: '/student-assistant' };
            navigate(routes[role] || '/staff');
          }
        } catch (err) {
          console.error("Auth Error:", err);
        }
      }
      setInitializing(false);
    });
    return () => unsub();
  }, [navigate, isMfaVerified]);

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifying(true);
    setError('');

    try {
      // Check the code against your 'otp_verification' table
      const { data, error: dbError } = await supabase
        .from('otp_verification')
        .select('*')
        .eq('email', user.email)
        .eq('code', otpInput)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (data) {
        // Success: Set 7-day Trust Token
        const expiry = new Date().getTime() + (7 * 24 * 60 * 60 * 1000);
        localStorage.setItem(`fagos_trust_${user.uid}`, JSON.stringify({ verified: true, expiry }));
        setIsMfaVerified(true);
      } else {
        setError("Invalid or expired code. Please check your email.");
      }
    } catch (err) {
      setError("Verification failed. Try again.");
    } finally {
      setVerifying(false);
    }
  };

  if (initializing) return (
    <div className="flex justify-center bg-[#1c1c1c] min-h-screen items-center text-[#3ecf8e]">
      <Loader2 className="animate-spin w-8 h-8" />
    </div>
  );

  // --- THE GATE: If logged in but NOT verified, show the OTP UI instead of the app ---
  if (user && !isMfaVerified && window.location.pathname !== '/' && window.location.pathname !== '/portal') {
    return (
      <div className="min-h-screen bg-[#1c1c1c] flex items-center justify-center p-6 text-[#ededed]">
        <div className="bg-[#171717] border border-[#2e2e2e] max-w-sm w-full p-8 rounded-2xl text-center shadow-xl">
          <div className="w-16 h-16 bg-[#3ecf8e]/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldCheck className="w-8 h-8 text-[#3ecf8e]" />
          </div>
          <h2 className="text-xl font-bold mb-2">Two-Step Verification</h2>
          <p className="text-[#a1a1a1] text-sm mb-6">We sent a 6-digit code to <br/><span className="text-[#ededed] font-medium">{user.email}</span></p>
          
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <input 
              type="text" 
              maxLength={6}
              value={otpInput}
              onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="w-full text-center tracking-[1em] font-mono text-xl bg-[#1c1c1c] border border-[#2e2e2e] text-[#3ecf8e] py-3 rounded-lg outline-none focus:border-[#3ecf8e]"
            />
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <button 
              type="submit" 
              disabled={verifying || otpInput.length < 6}
              className="w-full bg-[#3ecf8e] hover:bg-[#34b27b] text-black font-bold py-3 rounded-lg flex justify-center items-center gap-2 transition-all disabled:opacity-50"
            >
              {verifying ? <Loader2 className="animate-spin w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
              Verify Device
            </button>
          </form>
          <button onClick={() => supabase.auth.signOut()} className="mt-6 text-xs text-[#a1a1a1] hover:text-[#ededed] underline">Sign out of account</button>
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