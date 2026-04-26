import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { onAuthStateChanged, doc, getDoc, setDoc, serverTimestamp, db } from './lib/supabase';
import Portal from './pages/Portal';
import Admin from './pages/Admin';
import Staff from './pages/Staff';
import StudentAssistant from './pages/StudentAssistant';
import Developer from './pages/Developer';
import Login from './pages/Login';
import { HelpGuide } from './components/HelpGuide';
import { Loader2 } from 'lucide-react';

// We create a wrapper to use the 'useNavigate' hook correctly
function AuthGuard({ children }: { children: React.ReactNode }) {
  const [initializing, setInitializing] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onAuthStateChanged(null, async (user) => {
      if (user) {
        try {
          // 1. Check if they already have a profile in the 'admins' table
          const userDoc = await getDoc(doc(db, 'admins', user.uid));
          
          let role = 'staff'; // Default role

          if (userDoc.exists() && userDoc.data().role) {
            role = userDoc.data().role;
          } else {
            // 2. Logic for new Google/Microsoft sign-ups
            role = user.email === 'christiantomaque18@gmail.com' ? 'developer' : 'staff';
            
            await setDoc(doc(db, 'admins', user.uid), {
              email: user.email,
              displayName: user.displayName || 'User',
              role: role,
              lastLogin: serverTimestamp()
            }, { merge: true });
          }

          // 3. Global Redirect based on role
          // This clears the messy URL codes automatically after login
          if (window.location.pathname === '/login') {
           if (role === 'developer') navigate('/developer');
           else if (role === 'admin') navigate('/admin');
           else if (role === 'student_assistant') navigate('/student-assistant');
           else navigate('/staff');
        }
      } catch (error) {
        console.error("Global Auth Error:", error);
      }
    }
    setInitializing(false);
  });
  return () => unsub();
}, [navigate]);

  if (initializing) {
    return (
      <div className="flex justify-center p-20 bg-[#1c1c1c] min-h-screen items-center text-[#3ecf8e]">
        <Loader2 className="animate-spin w-8 h-8" />
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