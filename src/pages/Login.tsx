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
import { Loader2, Mail, Lock, LogIn, Chrome, Monitor, Home } from 'lucide-react';

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
    // We only need to check global settings now. 
    // Navigation is handled globally by App.tsx/AuthGuard.
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
      // This now triggers the PKCE flow we configured in supabase.ts
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
      setAuthError("Please enter your email address first to reset your password.");
      return;
    }
    setIsSubmitting(true);
    setAuthError('');
    try {
      await sendPasswordResetEmail(auth, authEmail);
      setResetSent(true);
      setAuthError("Password reset link sent! Please check your email.");
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
        if (!allowSignups) throw new Error("Signups are currently disabled.");
        const res = await createUserWithEmailAndPassword(auth, authEmail, authPassword);
        if (res && res.user && !res.session) {
            setAuthError("Sign up successful! Check your email to verify your account.");
        }
      } else {
        await signInWithEmailAndPassword(auth, authEmail, authPassword);
        // No navigate() here! AuthGuard in App.tsx will handle the redirect.
      }
    } catch (error: any) {
      setAuthError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return (
    <div className="flex justify-center p-20 bg-[#1c1c1c] min-h-screen items-center">
      <Loader2 className="animate-spin text-[#3ecf8e]" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#1c1c1c] flex flex-col items-center justify-center p-6 text-[#ededed]">
      <div className="relative bg-[#171717] border border-[#2e2e2e] max-w-sm w-full p-8 rounded-2xl text-center shadow-xl">
        
        <button 
          onClick={() => navigate('/')}
          className="absolute top-5 right-5 p-2 bg-[#1c1c1c] border border-[#2e2e2e] text-[#a1a1a1] hover:text-[#ededed] hover:border-[#444] rounded-lg transition-all"
          title="Back to Portal"
        >
          <Home className="w-4 h-4" />
        </button>

        <h2 className="text-2xl font-bold text-[#ededed] mb-1 tracking-tight">System Access</h2>
        <p className="text-[#a1a1a1] text-sm mb-6">
          {isRegistering ? 'Create a new account.' : 'Login to access the dashboard.'}
        </p>
        
        <form onSubmit={handleAuth} className="space-y-4">
          {authError && (
            <div className={`p-3 border text-xs rounded text-left ${resetSent ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}>
              {authError}
            </div>
          )}
          <div className="space-y-1 text-left">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#a1a1a1] ml-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#444]" />
              <input 
                type="email" 
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                required
                className="w-full text-sm placeholder:text-[#444] bg-[#1c1c1c] border border-[#2e2e2e] text-[#ededed] pl-10 pr-3 py-2.5 rounded-lg focus:border-[#3ecf8e] outline-none" 
                placeholder="university@example.edu" 
              />
            </div>
          </div>
          <div className="space-y-1 text-left">
            <div className="flex justify-between items-end ml-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#a1a1a1]">Password</label>
              {!isRegistering && (
                <button type="button" onClick={handleForgotPassword} className="text-[10px] font-bold text-[#3ecf8e] hover:underline">Forgot?</button>
              )}
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#444]" />
              <input 
                type="password" 
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                required
                className="w-full text-sm placeholder:text-[#444] bg-[#1c1c1c] border border-[#2e2e2e] text-[#ededed] pl-10 pr-3 py-2.5 rounded-lg focus:border-[#3ecf8e] outline-none" 
                placeholder="••••••••" 
              />
            </div>
          </div>
          <button 
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-[#3ecf8e] hover:bg-[#34b27b] disabled:opacity-50 text-black font-black uppercase tracking-widest text-xs py-3 rounded-lg transition-all mt-4 flex justify-center items-center gap-2"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
            {isRegistering ? 'Create Account' : 'Sign In'}
          </button>

          {!isRegistering && (
            <>
              <div className="flex items-center gap-4 my-6">
                <div className="flex-1 h-px bg-[#2e2e2e]" />
                <span className="text-[10px] font-bold text-[#444] uppercase tracking-widest">or</span>
                <div className="flex-1 h-px bg-[#2e2e2e]" />
              </div>

              <button 
                type="button"
                onClick={handleGoogleSignIn}
                className="w-full bg-[#262626] border border-[#2e2e2e] hover:bg-[#2e2e2e] text-[#ededed] font-bold py-2.5 rounded-lg transition-all flex justify-center items-center gap-2 text-sm"
              >
                <Chrome className="w-4 h-4" />
                Google Account
              </button>

              <button 
                type="button"
                onClick={handleMicrosoftSignIn}
                className="w-full bg-[#262626] border border-[#2e2e2e] hover:bg-[#2e2e2e] text-[#ededed] font-bold py-2.5 rounded-lg transition-all flex justify-center items-center gap-2 text-sm mt-3"
              >
                <Monitor className="w-4 h-4" />
                Microsoft Account
              </button>
            </>
          )}
        </form>

        {allowSignups && (
          <div className="mt-6 text-sm text-[#a1a1a1]">
            {isRegistering ? 'Already have an account? ' : 'Need an account? '}
            <button 
              onClick={() => { setIsRegistering(!isRegistering); setAuthError(''); }}
              className="text-[#3ecf8e] hover:text-[#34b27b] font-medium"
            >
              {isRegistering ? 'Sign In' : 'Sign Up'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}