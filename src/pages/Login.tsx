import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
  
  const navigate = useNavigate();
  const location = useLocation();

  // Listen for bounce-back errors from AuthGuard (SSO Rejections)
  useEffect(() => {
    if (location.state?.authError) {
      setAuthError(location.state.authError);
      // Clear the state so the error doesn't persist if they refresh the page
      navigate('/login', { replace: true, state: {} });
    }
  }, [location.state, navigate]);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const snap = await getDoc(doc(db, 'settings', 'global'));
        if (snap.exists() && snap.data().allowSignups !== undefined) {
          setAllowSignups(snap.data().allowSignups);
        }
      } catch (e) { console.error("Settings failed:", e); } finally { setLoading(false); }
    };
    fetchSettings();
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsSubmitting(true);
    try {
      if (isRegistering) {
        // ENFORCE EXACT WORDING ON MANUAL SIGNUP
        if (!allowSignups) throw new Error("Registration is not allowed at the moment. Please contact the admin.");
        await createUserWithEmailAndPassword(auth, authEmail, authPassword);
      } else {
        await signInWithEmailAndPassword(auth, authEmail, authPassword);
      }
    } catch (err: any) { setAuthError(err.message); } finally { setIsSubmitting(false); }
  };

  if (loading) return (
    <div className="flex justify-center bg-[#1c1c1c] min-h-screen items-center">
      <Loader2 className="animate-spin text-[#3ecf8e] w-6 h-6" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#1c1c1c] flex flex-col items-center justify-center p-6 text-[#ededed]">
      <div className="relative bg-[#171717] border border-[#2e2e2e] max-w-[340px] w-full p-7 rounded-2xl text-center shadow-2xl">
        
        <button onClick={() => navigate('/')} className="absolute top-5 right-5 p-1.5 bg-[#1c1c1c] border border-[#2e2e2e] text-[#a1a1a1] hover:text-[#3ecf8e] rounded-lg transition-all active:scale-90">
          <Home className="w-3.5 h-3.5" />
        </button>

        <div className="w-10 h-10 bg-[#3ecf8e]/10 rounded-xl flex items-center justify-center mx-auto mb-4">
          <ShieldCheck className="w-5 h-5 text-[#3ecf8e]" />
        </div>

        <h2 className="text-xl font-bold text-[#ededed] mb-0.5 tracking-tight">System Access</h2>
        <div className="flex items-center justify-center gap-1.5 mb-6">
          <div className="h-1 w-1 rounded-full bg-[#3ecf8e] animate-pulse" />
          <span className="text-[9px] font-bold text-[#3ecf8e] uppercase tracking-widest">MFA Protected Session</span>
        </div>
        
        <form onSubmit={handleAuth} className="space-y-3.5">
          {authError && (
            <div className={`p-2.5 border text-[10px] font-bold rounded-lg text-left leading-relaxed bg-red-500/10 border-red-500/20 text-red-500`}>
              {authError}
            </div>
          )}

          <div className="space-y-1.5 text-left px-1">
            <label className="text-[9px] font-bold uppercase tracking-widest text-[#555] ml-1">Email Address</label>
            <div className="relative group">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#333] group-focus-within:text-[#3ecf8e] transition-colors" />
              <input 
                type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} required
                className="w-full text-xs bg-[#1c1c1c] border border-[#2e2e2e] text-[#ededed] pl-10 pr-4 py-2.5 rounded-xl focus:border-[#3ecf8e] outline-none transition-all" 
                placeholder="university@example.edu" 
              />
            </div>
          </div>

          <div className="space-y-1.5 text-left px-1">
            <div className="flex justify-between items-end ml-1">
              <label className="text-[9px] font-bold uppercase tracking-widest text-[#555]">Security Password</label>
              {!isRegistering && (
                <button type="button" onClick={() => sendPasswordResetEmail(auth, authEmail)} className="text-[9px] font-bold text-[#3ecf8e] hover:text-[#34b27b]">Forgot?</button>
              )}
            </div>
            <div className="relative group">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#333] group-focus-within:text-[#3ecf8e] transition-colors" />
              <input 
                type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} required
                className="w-full text-xs bg-[#1c1c1c] border border-[#2e2e2e] text-[#ededed] pl-10 pr-4 py-2.5 rounded-xl focus:border-[#3ecf8e] outline-none transition-all" 
                placeholder="••••••••" 
              />
            </div>
          </div>

          <button 
            type="submit" disabled={isSubmitting}
            className="w-full bg-[#3ecf8e] hover:bg-[#34b27b] disabled:opacity-40 text-black font-black uppercase tracking-[0.1em] text-[10px] py-3.5 rounded-xl transition-all mt-2 flex justify-center items-center gap-2 active:scale-95"
          >
            {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogIn className="w-3.5 h-3.5" />}
            {isRegistering ? 'Create Official Account' : 'Sign In'}
          </button>

          {!isRegistering && (
            <>
              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-[#262626]" />
                <span className="text-[9px] font-bold text-[#444] uppercase tracking-widest">Others</span>
                <div className="flex-1 h-px bg-[#262626]" />
              </div>

              {/* SSO Buttons remain active so existing users can still log in, but new users will bounce back. */}
              <div className="grid grid-cols-2 gap-2.5">
                <button type="button" onClick={() => signInWithGoogle()} className="bg-[#1c1c1c] border border-[#2e2e2e] hover:bg-[#222] text-[#ededed] font-bold py-2 rounded-xl transition-all flex justify-center items-center gap-2 text-[10px] active:scale-95">
                  <Chrome className="w-3 h-3 text-[#3ecf8e]" /> Google
                </button>
                <button type="button" onClick={() => signInWithMicrosoft()} className="bg-[#1c1c1c] border border-[#2e2e2e] hover:bg-[#222] text-[#ededed] font-bold py-2 rounded-xl transition-all flex justify-center items-center gap-2 text-[10px] active:scale-95">
                  <Monitor className="w-3 h-3 text-[#3ecf8e]" /> Microsoft
                </button>
              </div>
            </>
          )}
        </form>

        {allowSignups && (
          <div className="mt-8 pt-6 border-t border-[#262626] text-[10px] text-[#666]">
            {isRegistering ? 'Already registered? ' : 'Need administrative access? '}
            <button 
              onClick={() => { setIsRegistering(!isRegistering); setAuthError(''); }}
              className="text-[#3ecf8e] font-bold uppercase tracking-widest ml-1"
            >
              {isRegistering ? 'Sign In' : 'Sign Up'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}