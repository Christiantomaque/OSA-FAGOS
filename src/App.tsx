import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
// Notice: sendVerificationCode is removed because we don't need emails anymore!
import { onAuthStateChanged, doc, getDoc, setDoc, serverTimestamp, db, supabase } from './lib/supabase';
import Portal from './pages/Portal';
import Admin from './pages/Admin';
import Staff from './pages/Staff';
import StudentAssistant from './pages/StudentAssistant';
import Developer from './pages/Developer';
import Login from './pages/Login';
import { HelpGuide } from './components/HelpGuide';
import { Loader2, ShieldCheck, ArrowRight } from 'lucide-react';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<any>(null);
  
  // New MFA States for Authenticator App
  const [mfaStatus, setMfaStatus] = useState<'checking' | 'setup' | 'verify' | 'verified'>('checking');
  const [qrCode, setQrCode] = useState('');
  const [factorId, setFactorId] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onAuthStateChanged(null, async (u) => {
      if (u) {
        setUser(u);
        
        try {
          // 1. Check Authenticator Assurance Level (AAL)
          const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
          
          if (aalData?.currentLevel === 'aal2') {
            // User has completed Two-Step Verification this session
            setMfaStatus('verified');
            handleRoleRouting(u);
          } else {
            // User is aal1 (Logged in, but MFA not verified yet)
            const { data: factorsData } = await supabase.auth.mfa.listFactors();
            const totpFactor = factorsData?.totp?.[0];

            if (totpFactor && totpFactor.status === 'verified') {
              // They already set up an app before, just ask for the 6-digit code
              setFactorId(totpFactor.id);
              setMfaStatus('verify');
            } else {
              // First time login! Generate a QR code for them to scan
              const { data: enrollData, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
              if (enrollError) throw enrollError;
              
              setFactorId(enrollData.id);
              setQrCode(enrollData.totp.qr_code); // Supabase gives us the raw SVG
              setMfaStatus('setup');
            }
          }
        } catch (err) {
          console.error("Auth/MFA Error:", err);
        }
      } else {
        setMfaStatus('checking');
      }
      setInitializing(false);
    });
    return () => unsub();
  }, [navigate]);

  const handleRoleRouting = async (u: any) => {
    if (window.location.pathname === '/login') {
      const userDoc = await getDoc(doc(db, 'admins', u.uid));
      let role = userDoc.exists() ? userDoc.data().role : 'staff';
      
      // Developer override for initial setup
      if (!userDoc.exists() && u.email === 'christiantomaque18@gmail.com') {
        role = 'developer';
        await setDoc(doc(db, 'admins', u.uid), {
          email: u.email,
          displayName: u.displayName || 'User',
          role: role,
          lastLogin: serverTimestamp()
        }, { merge: true });
      } else if (!userDoc.exists()) {
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

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifying(true);
    setError('');

    try {
      // Create a challenge, then verify the code against it
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: otpInput
      });

      if (verifyError) throw verifyError;

      // Success! They are now AAL2 verified.
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

  // --- THE GATE: If user needs to Setup OR Verify ---
  if (user && mfaStatus !== 'verified' && window.location.pathname !== '/' && window.location.pathname !== '/portal') {
    return (
      <div className="min-h-screen bg-[#1c1c1c] flex items-center justify-center p-6 text-[#ededed]">
        <div className="bg-[#171717] border border-[#2e2e2e] max-w-sm w-full p-8 rounded-2xl text-center shadow-xl">
          <div className="w-16 h-16 bg-[#3ecf8e]/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldCheck className="w-8 h-8 text-[#3ecf8e]" />
          </div>
          <h2 className="text-xl font-bold mb-2">Authenticator App</h2>
          
          {mfaStatus === 'setup' ? (
            <>
              <p className="text-[#a1a1a1] text-sm mb-4">Scan this QR code with Google Authenticator or Authy to secure your account.</p>
              <div 
                className="bg-white p-2 rounded-xl inline-block mb-6"
                dangerouslySetInnerHTML={{ __html: qrCode }} 
              />
            </>
          ) : (
            <p className="text-[#a1a1a1] text-sm mb-6">Enter the 6-digit code from your authenticator app.</p>
          )}
          
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
              {mfaStatus === 'setup' ? 'Activate Security' : 'Verify Device'}
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