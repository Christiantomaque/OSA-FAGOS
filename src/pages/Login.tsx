import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, doc, getDoc, setDoc, serverTimestamp, auth, db } from '../lib/supabase';
import { Loader2 } from 'lucide-react';

export default function Login() {
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(true);
  const [allowSignups, setAllowSignups] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Check global settings for signups
    const fetchSettings = async () => {
      try {
        const snap = await getDoc(doc(db, 'settings', 'global'));
        if (snap.exists() && snap.data().allowSignups !== undefined) {
          setAllowSignups(snap.data().allowSignups);
        }
      } catch (e) {
        console.error("Failed to fetch settings:", e);
      }
    };
    fetchSettings();

    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        try {
          const userDoc = await getDoc(doc(db, 'admins', u.uid));
          let role = 'staff';
          if (userDoc.exists() && userDoc.data().role) {
            role = userDoc.data().role;
          } else {
             // For first user or legacy fallback
             role = u.email === 'christiantomaque18@gmail.com' ? 'developer' : 'student_assistant';
             await setDoc(doc(db, 'admins', u.uid), {
               email: u.email,
               displayName: u.displayName || 'New User',
               role: role,
               lastLogin: serverTimestamp()
             }, { merge: true });
          }
          
          if (role === 'developer') navigate('/developer');
          else if (role === 'admin') navigate('/admin');
          else if (role === 'staff') navigate('/staff');
          else if (role === 'student_assistant') navigate('/student-assistant');
          else navigate('/staff');
        } catch (e) {
           console.error("Auth routing error", e);
           navigate('/staff'); // default fallback
        }
      } else {
        setLoading(false);
      }
    });
    return () => unsub();
  }, [navigate]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsSubmitting(true);
    try {
      if (!import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL.includes("xxxx")) {
         throw new Error("Supabase is not configured! Please open 'Settings' -> 'Environment Variables' and add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from your Supabase dashboard.");
      }

      if (isRegistering) {
        if (!allowSignups) throw new Error("Signups are currently disabled by the administrator.");
        const res = await createUserWithEmailAndPassword(auth, authEmail, authPassword);
        if (res && res.user && !res.session) {
            setAuthError("Sign up successful! Please check your email to verify your account before logging in.");
        }
      } else {
        await signInWithEmailAndPassword(auth, authEmail, authPassword);
      }
    } catch (error: any) {
      console.error("Auth Error:", error);
      let msg = error.message;
      if (msg.includes("Email not confirmed") || msg.toLowerCase().includes("verify your email")) {
         msg = "Please check your inbox to verify your email address, or disable 'Confirm email' in your Supabase Auth Providers settings.";
      } else if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
         msg = "Network connection failed. Make sure your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are correctly set in the environment variables, and that they match your Supabase project.";
      }
      setAuthError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="flex justify-center p-20 bg-[#1c1c1c] min-h-screen items-center"><Loader2 className="animate-spin text-[#3ecf8e]" /></div>;

  return (
    <div className="min-h-screen bg-[#1c1c1c] flex flex-col items-center justify-center p-6 text-[#ededed]">
      <div className="bg-[#171717] border border-[#2e2e2e] max-w-sm w-full p-8 rounded-2xl text-center shadow-xl">
        <h2 className="text-2xl font-bold text-[#ededed] mb-1 tracking-tight">System Access</h2>
        <p className="text-[#a1a1a1] text-sm mb-6">
          {isRegistering ? 'Create a new account.' : 'Login to access the dashboard.'}
        </p>
        
        <form onSubmit={handleAuth} className="space-y-4">
          {authError && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-xs rounded text-left">
              {authError}
            </div>
          )}
          <div className="space-y-1 text-left">
            <label className="text-xs font-semibold uppercase tracking-wide text-[#a1a1a1]">Email Address</label>
            <input 
              type="email" 
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              required
              className="w-full text-sm placeholder:text-[#a1a1a1]/40 bg-[#1c1c1c] border border-[#2e2e2e] text-[#ededed] px-3 py-2.5 rounded-md focus:ring-1 focus:ring-[#3ecf8e] focus:border-[#3ecf8e] outline-none transition-all" 
              placeholder="user@example.com" 
            />
          </div>
          <div className="space-y-1 text-left">
            <label className="text-xs font-semibold uppercase tracking-wide text-[#a1a1a1]">Password</label>
            <input 
              type="password" 
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              required
              className="w-full text-sm placeholder:text-[#a1a1a1]/40 bg-[#1c1c1c] border border-[#2e2e2e] text-[#ededed] px-3 py-2.5 rounded-md focus:ring-1 focus:ring-[#3ecf8e] focus:border-[#3ecf8e] outline-none transition-all" 
              placeholder="••••••••" 
            />
          </div>
          <button 
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-[#3ecf8e] hover:bg-[#34b27b] disabled:opacity-50 text-black font-bold py-2.5 rounded-md transition-colors mt-2 flex justify-center items-center gap-2"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {isRegistering ? 'Sign Up' : 'Sign In'}
          </button>
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
        {!allowSignups && !isRegistering && (
          <div className="mt-6 text-xs text-[#a1a1a1] italic">
            New account signups are currently disabled by the administrator.
          </div>
        )}
      </div>
    </div>
  );
}
