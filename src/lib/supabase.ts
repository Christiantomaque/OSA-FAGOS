import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://xxxxxxxxxxxxxxxxxxxx.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'xxxxxxxxxxxxxxxxxxxx';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const auth = supabase.auth;
export const db = 'DB_PLACEHOLDER'; 

export type User = { uid: string; email: string; displayName?: string; photoURL?: string };

// AUTH SHIM
export const signInWithEmailAndPassword = async (authObj: any, email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
}
export const createUserWithEmailAndPassword = async (authObj: any, email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return data;
}
export const logout = async () => await supabase.auth.signOut();

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
}

export const serverTimestamp = () => new Date().toISOString();

// FIRESTORE SHIM
export const collection = (db: any, path: string) => ({ type: 'collection', path });
export const doc = (db: any, path: string, id: string) => ({ type: 'doc', path, id });
export const query = (coll: any, ...ops: any[]) => {
    return { ...coll, ops };
};
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
    
    // 42P01 is Postgres "Undefined Table"
    // PGRST116/undefined can happen if schema cache is stale or table is missing
    if (error) {
        if (error.code === '42P01' || error.message?.includes('schema cache')) {
            console.warn(`Supabase Table Missing: The table "${q.path}" was not found. Please create it in your Supabase SQL Editor.`);
            return { docs: [], forEach: (cb: any) => {} };
        }
        throw error;
    }

    const docs = (data || []).map((d: any) => ({ 
        id: d.id, 
        exists: () => true, 
        data: () => d, 
        get: (field: string) => d[field] 
    }));
    return { docs, forEach: (cb: (doc: any) => void) => docs.forEach(cb) };
}

export const getDoc = async (docRef: any) => {
    const { data, error } = await supabase.from(docRef.path).select('*').eq('id', docRef.id).maybeSingle();
    if (error && error.code !== '42P01') throw error;
    return { exists: () => !!data, data: () => data || {}, get: (field: string) => data?.[field] };
}

export const addDoc = async (coll: any, data: any) => {
    const { data: res, error } = await supabase.from(coll.path).insert([data]).select().single();
    if (error && error.code !== '42P01') throw error;
    if (error && error.code === '42P01') console.error('Supabase Setup Missing: You must run the SQL to create table: ' + coll.path);
    return { id: res?.id || Date.now().toString() };
}

export const updateDoc = async (docRef: any, data: any) => {
    const { error } = await supabase.from(docRef.path).update(data).eq('id', docRef.id);
    if (error && error.code !== '42P01') throw error;
    if (error && error.code === '42P01') console.error('Supabase Setup Missing: You must run the SQL to create table: ' + docRef.path);
}

export const setDoc = async (docRef: any, data: any, options?: any) => {
    const payload = { id: docRef.id, ...data };
    const { error } = await supabase.from(docRef.path).upsert([payload]);
    if (error && error.code !== '42P01') throw error;
    if (error && error.code === '42P01') console.error('Supabase Setup Missing: You must run the SQL to create table: ' + docRef.path);
}

export const deleteDoc = async (docRef: any) => {
    const { error } = await supabase.from(docRef.path).delete().eq('id', docRef.id);
    if (error && error.code !== '42P01') throw error;
}
