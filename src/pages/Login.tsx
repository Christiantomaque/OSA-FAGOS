import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  doc, 
  getDoc, 
  db, 
  signInWithGoogle, 
  signInWithMicrosoft, 
  sendPasswordResetEmail,
  auth 
} from '../lib/supabase';
import { Loader2, Mail, Lock, LogIn, Chrome, Monitor, Home, ShieldCheck } from 'lucide-react';

export default function Login() {
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(true);
  const [allowSignups, setAllowSignups] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const snap = await getDoc(doc(db, 'settings', 'global'));
        if (snap.exists() && snap.data().allowSignups !== undefined) {
          setAllowSignups(snap.data().allowSignups);
        }
      } catch (e) {
        console.error("Failed to fetch settings:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      setAuthError('');
      // Triggers PKCE Flow - Redirects to App.tsx AuthGuard MFA check
      await signInWithGoogle();
    } catch (error: any) {
      setAuthError(error.message);
    }
  };

  const handleMicrosoftSignIn = async () => {
    try {
      setAuthError('');
      await signInWithMicrosoft();
    } catch (error: any) {
      setAuthError(error.message);
    }
  };

  const handleForgotPassword = async () => {
    if (!authEmail) {
      setAuthError("Enter your email to receive a reset link.");
      return;
    }
    setIsSubmitting(true);
    setAuthError('');
    try {
      await sendPasswordResetEmail(auth, authEmail);
      setResetSent(true);
      setAuthError("Check your inbox for the password reset link.");
    } catch (error: any) {
      setAuthError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsSubmitting(true);
    try {
      if (isRegistering) {
        if (!allowSignups) throw new Error("Registrations are currently locked.");
        const res = await createUserWithEmailAndPassword(auth, authEmail, authPassword);
        if (res && res.user && !res.session) {
            setAuthError("Account created! Verify your email before logging in.");
        }
      } else {
        await signInWithEmailAndPassword(auth, authEmail, authPassword);
        // Navigation is handled by the AuthGuard logic in App.tsx
      }
    } catch (error: any) {
      setAuthError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return (
    <div className="flex justify-center bg-[#1c1c1c] min-h-screen items-center">
      <Loader2 className="animate-spin text-[#3ecf8e] w-8 h-8" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#1c1c1c] flex flex-col items-center justify-center p-6 text-[#ededed]">
      <div className="relative bg-[#171717] border border-[#2e2e2e] max-w-sm w-full p-8 rounded-2xl text-center shadow-2xl">
        
        {/* Portal Home Shortcut */}
        <button 
          onClick={() => navigate('/')}
          className="absolute top-5 right-5 p-2 bg-[#1c1c1c] border border-[#2e2e2e] text-[#a1a1a1] hover:text-[#3ecf8e] hover:border-[#3ecf8e]/30 rounded-lg transition-all active:scale-90"
          title="Return to Portal"
        >
          <Home className="w-4 h-4" />
        </button>

        {/* Brand/Security Icon */}
        <div className="w-12 h-12 bg-[#3ecf8e]/5 border border-[#3ecf8e]/10 rounded-xl flex items-center justify-center mx-auto mb-6">
          <ShieldCheck className="w-6 h-6 text-[#3ecf8e]" />
        </div>

        <h2 className="text-2xl font-bold text-[#ededed] mb-1 tracking-tight">System Access</h2>
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="h-1.5 w-1.5 rounded-full bg-[#3ecf8e] animate-pulse" />
          <span className="text-[10px] font-bold text-[#3ecf8e] uppercase tracking-widest">MFA Protected Session</span>
        </div>
        
        <form onSubmit={handleAuth} className="space-y-4">
          {authError && (
            <div className={`p-3 border text-[11px] font-medium rounded-lg text-left leading-relaxed ${resetSent ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}>
              {authError}
            </div>
          )}

          {/* Email Input */}
          <div className="space-y-1.5 text-left">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#666] ml-1">Email Address</label>
            <div className="relative group">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#444] group-focus-within:text-[#3ecf8e] transition-colors" />
              <input 
                type="email" 
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                required
                className="w-full text-sm bg-[#1c1c1c] border border-[#2e2e2e] text-[#ededed] pl-11 pr-4 py-2.5 rounded-xl focus:border-[#3ecf8e] focus:ring-1 focus:ring-[#3ecf8e]/20 outline-none transition-all" 
                placeholder="university@example.edu" 
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="space-y-1.5 text-left">
            <div className="flex justify-between items-end ml-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#666]">Security Password</label>
              {!isRegistering && (
                <button type="button" onClick={handleForgotPassword} className="text-[10px] font-bold text-[#3ecf8e] hover:text-[#34b27b] transition-colors">Forgot?</button>
              )}
            </div>
            <div className="relative group">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#444] group-focus-within:text-[#3ecf8e] transition-colors" />
              <input 
                type="password" 
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                required
                className="w-full text-sm bg-[#1c1c1c] border border-[#2e2e2e] text-[#ededed] pl-11 pr-4 py-2.5 rounded-xl focus:border-[#3ecf8e] focus:ring-1 focus:ring-[#3ecf8e]/20 outline-none transition-all" 
                placeholder="••••••••" 
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-[#3ecf8e] hover:bg-[#34b27b] disabled:opacity-40 text-black font-black uppercase tracking-widest text-xs py-3.5 rounded-xl transition-all mt-4 flex justify-center items-center gap-2 active:scale-95"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
            {isRegistering ? 'Create Official Account' : 'Sign In to Dashboard'}
          </button>

          {!isRegistering && (
            <>
              <div className="flex items-center gap-4 my-6 opacity-40">
                <div className="flex-1 h-px bg-[#2e2e2e]" />
                <span className="text-[10px] font-bold text-[#ededed] uppercase tracking-widest">secure SSO</span>
                <div className="flex-1 h-px bg-[#2e2e2e]" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button 
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="w-full bg-[#1c1c1c] border border-[#2e2e2e] hover:bg-[#222] text-[#ededed] font-bold py-2.5 rounded-xl transition-all flex justify-center items-center gap-2 text-xs active:scale-95"
                >
                  <Chrome className="w-3.5 h-3.5" />
                  Google
                </button>

                <button 
                  type="button"
                  onClick={handleMicrosoftSignIn}
                  className="w-full bg-[#1c1c1c] border border-[#2e2e2e] hover:bg-[#222] text-[#ededed] font-bold py-2.5 rounded-xl transition-all flex justify-center items-center gap-2 text-xs active:scale-95"
                >
                  <Monitor className="w-3.5 h-3.5" />
                  Microsoft
                </button>
              </div>
            </>
          )}
        </form>

        {allowSignups && (
          <div className="mt-8 pt-6 border-t border-[#2e2e2e] text-xs text-[#a1a1a1]">
            {isRegistering ? 'Already registered? ' : 'Need administrative access? '}
            <button 
              onClick={() => { setIsRegistering(!isRegistering); setAuthError(''); }}
              className="text-[#3ecf8e] hover:text-[#34b27b] font-bold uppercase tracking-wider ml-1"
            >
              {isRegistering ? 'Sign In' : 'Sign Up'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}