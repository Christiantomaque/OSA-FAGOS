import { createClient } from '@supabase/supabase-js';

// --- INITIALIZATION ---
// Ensure these variables are set in your .env.local or Vercel environment
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export const auth = supabase.auth;
export const db = 'SUPABASE_INSTANCE';

export type User = { 
  uid: string; 
  email: string; 
  displayName?: string; 
  photoURL?: string 
};

// ==========================================
// 1. AUTHENTICATION & MFA LOGIC
// ==========================================

export const signInWithGoogle = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            // Redirect to root so App.tsx AuthGuard can catch the session and show OTP gate
            redirectTo: window.location.origin + '/',
            // PKCE prevents the giant #access_token in the URL and fixes 413 errors
            // @ts-ignore - Ignore if @supabase/supabase-js version is < 2.21.0
            flowType: 'pkce' 
        }
    });
    if (error) throw error;
    return data;
};

export const signInWithMicrosoft = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'azure',
        options: {
            redirectTo: window.location.origin + '/',
            // @ts-ignore
            flowType: 'pkce'
        }
    });
    if (error) throw error;
    return data;
};

/**
 * MFA HELPER: Generates a code, saves it to the DB, 
 * and triggers the Supabase Edge Function to send the actual email.
 */
export const sendVerificationCode = async (email: string) => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // 1. Save code to the otp_verification table (valid for 5 mins)
    await supabase.from('otp_verification').upsert({ 
        email, 
        code, 
        expires_at: new Date(Date.now() + 5 * 60000).toISOString() 
    });

    // 2. Invoke the Edge Function to send the email via Resend/SMTP
    // Ensure you have created this function in your Supabase Dashboard
    const { error } = await supabase.functions.invoke('send-otp', {
        body: { email, code },
    });

    if (error) {
        console.error("Failed to dispatch OTP email:", error);
        throw new Error("Could not send verification code. Please try again.");
    }
};

export const logout = async () => {
    // Clear the 7-day trust token on logout for security
    const user = (await supabase.auth.getUser()).data.user;
    if (user) localStorage.removeItem(`fagos_trust_${user.id}`);
    return await supabase.auth.signOut();
};

export const onAuthStateChanged = (authObj: any, cb: (user: User | null) => void) => {
    const firebaseUser = (u: any): User | null => u ? { 
        uid: u.id, 
        email: u.email, 
        photoURL: u.user_metadata?.avatar_url, 
        displayName: u.user_metadata?.full_name 
    } : null;

    supabase.auth.getUser().then(({ data: { user } }) => cb(firebaseUser(user)));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        cb(firebaseUser(session?.user));
    });
    return () => subscription.unsubscribe();
};

// ==========================================
// 2. FIRESTORE-STYLE SHIMS (CRUD)
// ==========================================

export const collection = (db: any, path: string) => ({ type: 'collection', path });
export const doc = (db: any, path: string, id: string) => ({ type: 'doc', path, id });
export const query = (coll: any, ...ops: any[]) => ({ ...coll, ops });
export const orderBy = (field: string, direction: 'asc' | 'desc') => ({ type: 'orderBy', field, direction });

export const getDocs = async (q: any) => {
    let req = supabase.from(q.path).select('*');
    if (q.ops) {
        for (const op of q.ops) {
            if (op.type === 'orderBy') {
                req = req.order(op.field, { ascending: op.direction === 'asc' });
            }
        }
    }
    const { data, error } = await req;
    if (error) throw error;

    const docs = (data || []).map((d: any) => ({ 
        id: d.id, 
        exists: () => true, 
        data: () => d, 
        get: (field: string) => d[field] 
    }));
    return { docs, forEach: (cb: (doc: any) => void) => docs.forEach(cb) };
};

export const getDoc = async (docRef: any) => {
    const { data, error } = await supabase.from(docRef.path).select('*').eq('id', docRef.id).maybeSingle();
    if (error) throw error;
    return { 
        exists: () => !!data, 
        data: () => data || {}, 
        get: (field: string) => data?.[field] 
    };
};

export const addDoc = async (coll: any, data: any) => {
    const { data: res, error } = await supabase.from(coll.path).insert([data]).select().single();
    if (error) throw error;
    return { id: res?.id };
};

export const setDoc = async (docRef: any, data: any, options?: any) => {
    const payload = { id: docRef.id, ...data };
    const { error } = await supabase.from(docRef.path).upsert([payload]);
    if (error) throw error;
};

export const updateDoc = async (docRef: any, data: any) => {
    const { error } = await supabase.from(docRef.path).update(data).eq('id', docRef.id);
    if (error) throw error;
};

export const deleteDoc = async (docRef: any) => {
    const { error } = await supabase.from(docRef.path).delete().eq('id', docRef.id);
    if (error) throw error;
};

export const onSnapshot = (q: any, cb: (snapshot: any) => void) => {
    getDocs(q).then(cb);
    const channel = supabase
        .channel(`public:${q.path}-changes`)
        .on('postgres_changes', { event: '*', schema: 'public', table: q.path }, async () => {
            const updatedSnapshot = await getDocs(q);
            cb(updatedSnapshot);
        })
        .subscribe();
    return () => { supabase.removeChannel(channel); };
};

export const serverTimestamp = () => new Date().toISOString();

// Legacy / Email Shims
export const signInWithEmailAndPassword = async (authObj: any, email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
};

export const createUserWithEmailAndPassword = async (authObj: any, email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return data;
};

export const sendPasswordResetEmail = async (authObj: any, email: string) => {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/login'
    });
    if (error) throw error;
    return data;
};