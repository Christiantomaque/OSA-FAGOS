import { createClient } from '@supabase/supabase-js';

// --- INITIALIZATION ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("SUPABASE ERROR: API Keys are missing. Check your .env file and restart your terminal.");
}

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

// RESTORED: Missing logout export
export const logout = async () => {
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        cb(firebaseUser(session?.user));
    });
    return () => subscription.unsubscribe();
};

// ==========================================
// 2. DATA SHIMS (CRUD) - FULLY RESTORED
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

// RESTORED: options?: any added back to fix "Expected 2 arguments, but got 3" error
export const setDoc = async (docRef: any, data: any, options?: any) => {
    const { error } = await supabase.from(docRef.path).upsert([{ id: docRef.id, ...data }]);
    if (error) throw error;
};

// RESTORED: Missing addDoc export
export const addDoc = async (coll: any, data: any) => {
    const { data: res, error } = await supabase.from(coll.path).insert([data]).select().single();
    if (error) throw error;
    return { id: res?.id };
};

// RESTORED: Missing updateDoc export
export const updateDoc = async (docRef: any, data: any) => {
    const { error } = await supabase.from(docRef.path).update(data).eq('id', docRef.id);
    if (error) throw error;
};

// RESTORED: Missing deleteDoc export
export const deleteDoc = async (docRef: any) => {
    const { error } = await supabase.from(docRef.path).delete().eq('id', docRef.id);
    if (error) throw error;
};

// RESTORED: Missing onSnapshot export
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