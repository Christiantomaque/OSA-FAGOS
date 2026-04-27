import { createClient } from '@supabase/supabase-js';

// --- INITIALIZATION ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("SUPABASE ERROR: API Keys are missing. Check your .env file and restart your terminal.");
}

// 👇 EXPORT THESE TWO for App.tsx
export { supabaseUrl, supabaseAnonKey };

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');
export const auth = supabase.auth;
export const db = 'SUPABASE_INSTANCE';

export type User = { 
  uid: string; 
  email: string; 
  displayName?: string; 
  photoURL?: string 
};

// ==========================================
// 1. AUTHENTICATION LOGIC (SSO & EMAIL)
// ==========================================

export const signInWithGoogle = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin + '/login',
            // @ts-ignore
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
            redirectTo: window.location.origin + '/login',
            // @ts-ignore
            flowType: 'pkce'
        }
    });
    if (error) throw error;
    return data;
};

export const logout = async () => {
    return await supabase.auth.signOut();
};

const firebaseUser = (u: any): User | null => u ? { 
    uid: u.id, 
    email: u.email, 
    photoURL: u.user_metadata?.avatar_url, 
    displayName: u.user_metadata?.full_name 
} : null;

let globalAuthState: { user: User | null; loaded: boolean } = { user: null, loaded: false };
const authListeners = new Set<(user: User | null) => void>();

let authInitStarted = false;
const initGlobalAuth = () => {
    if (authInitStarted) return;
    authInitStarted = true;

    // Start background token refresh checking
    supabase.auth.onAuthStateChange((_event, session) => {
        const u = firebaseUser(session?.user);
        globalAuthState = { user: u, loaded: true };
        authListeners.forEach(cb => cb(u));
    });

    // Fire the initial state request (only once!)
    supabase.auth.getUser().then(({ data: { user } }) => {
        const u = firebaseUser(user);
        globalAuthState = { user: u, loaded: true };
        authListeners.forEach(cb => cb(u));
    }).catch(err => {
        console.warn("Global getUser error", err);
    });
};

export const onAuthStateChanged = (authObj: any, cb: (user: User | null) => void) => {
    initGlobalAuth();
    if (globalAuthState.loaded) {
        cb(globalAuthState.user);
    }
    authListeners.add(cb);
    return () => {
        authListeners.delete(cb);
    };
};

// ==========================================
// 2. DATA SHIMS (CRUD) 
// ==========================================

export const collection = (db: any, path: string) => ({ type: 'collection', path });
export const doc = (db: any, path: string, id: string) => ({ type: 'doc', path, id });
export const query = (coll: any, ...ops: any[]) => ({ ...coll, ops });
export const orderBy = (field: string, direction: 'asc' | 'desc') => ({ type: 'orderBy', field, direction });

export const getDocs = async (q: any) => {
    let req = supabase.from(q.path).select('*');
    if (q.ops) {
        for (const op of q.ops) {
            if (op.type === 'orderBy') req = req.order(op.field, { ascending: op.direction === 'asc' });
        }
    }
    const { data, error } = await req;
    if (error) throw error;
    const docs = (data || []).map((d: any) => ({ id: d.id, exists: () => true, data: () => d, get: (field: string) => d[field] }));
    return { docs, forEach: (cb: (doc: any) => void) => docs.forEach(cb) };
};

export const getDoc = async (docRef: any) => {
    const { data, error } = await supabase.from(docRef.path).select('*').eq('id', docRef.id).maybeSingle();
    if (error) throw error;
    return { exists: () => !!data, data: () => data || {}, get: (field: string) => data?.[field] };
};

export const setDoc = async (docRef: any, data: any, options?: any) => {
    const { error } = await supabase.from(docRef.path).upsert([{ id: docRef.id, ...data }]);
    if (error) throw error;
};

export const addDoc = async (coll: any, data: any) => {
    const { data: res, error } = await supabase.from(coll.path).insert([data]).select().single();
    if (error) throw error;
    return { id: res?.id };
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
    const isDoc = q.type === 'doc';

    const fetchUpdate = async () => {
        try {
            if (isDoc) {
                const snap = await getDoc(q);
                cb(snap);
            } else {
                const snap = await getDocs(q);
                cb(snap);
            }
        } catch (e) {
            console.error("Snapshot error:", e);
        }
    };

    fetchUpdate();

    const channel = supabase
        .channel(`public:${q.path}-changes-${Math.random().toString(36).substring(7)}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: q.path }, () => {
            fetchUpdate();
        })
        .subscribe();
        
    return () => { supabase.removeChannel(channel); };
};

export const serverTimestamp = () => new Date().toISOString();

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