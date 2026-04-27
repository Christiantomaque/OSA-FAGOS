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

const notifyListeners = (u: User | null) => {
    // Only notify if we haven't loaded yet, or if the user changed
    const userChanged = u?.uid !== globalAuthState.user?.uid;
    const firstLoad = !globalAuthState.loaded;
    
    globalAuthState = { user: u, loaded: true };
    
    if (userChanged || firstLoad) {
        authListeners.forEach(cb => cb(u));
    }
};

const initGlobalAuth = () => {
    if (authInitStarted) return;
    authInitStarted = true;

    // Start background token refresh checking
    supabase.auth.onAuthStateChange((_event, session) => {
        const u = firebaseUser(session?.user);
        notifyListeners(u);
    });

    // Fire the initial state request (only once!)
    supabase.auth.getSession().then(({ data: { session } }) => {
        const u = firebaseUser(session?.user);
        notifyListeners(u);
        
        if (session) {
            supabase.auth.getUser().then(({ data: { user } }) => {
                if (!user) {
                    notifyListeners(null);
                }
            }).catch(err => {
                console.warn("Global getUser error", err);
                notifyListeners(null);
            });
        }
    }).catch(err => {
        console.warn("Global getSession error", err);
        notifyListeners(null);
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

const pgToCamelMap: Record<string, string> = {
    displayName: 'displayName',
    photoURL: 'photoURL',
    lastLogin: 'lastLogin',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    studentNo: 'studentNo',
    approverName: 'approverName',
    approverRole: 'approverRole',
    approverSignature: 'approverSignature',
    approvedAt: 'approvedAt',
    studentName: 'studentName',
    studentEmail: 'studentEmail',
    taskId: 'taskId',
    taskTitle: 'taskTitle',
    timeIn: 'timeIn',
    timeOut: 'timeOut',
    creditHours: 'creditHours',
    studentSignature: 'studentSignature',
    academicYear: 'academicYear',
    staffName: 'staffName',
    startTime: 'startTime',
    verifiedBy: 'verifiedBy',
    verifiedById: 'verifiedById',
    verifierRole: 'verifierRole',
    verifierSignature: 'verifierSignature',
    scheduledEndTime: 'scheduledEndTime',
    scheduledStartTime: 'scheduledStartTime',
    allowSignups: 'allowSignups',
    endTime: 'endTime'
};

const mapToPg = (data: any) => {
    if (!data || typeof data !== 'object') return data;
    const res: any = {};
    for (const k of Object.keys(data)) {
        res[k] = data[k]; // ✅ Send the exact camelCase key to Supabase
    }
    return res;
};

const mapToCamel = (data: any) => {
    if (!data || typeof data !== 'object') return data;
    const res: any = {};
    for (const k of Object.keys(data)) {
        res[pgToCamelMap[k] || k] = data[k];
    }
    return res;
};

export const collection = (db: any, path: string) => ({ type: 'collection', path });
export const doc = (db: any, path: string, id: string) => ({ type: 'doc', path, id });
export const query = (coll: any, ...ops: any[]) => ({ ...coll, ops });
export const orderBy = (field: string, direction: 'asc' | 'desc') => ({ type: 'orderBy', field: field, direction }); 

export const getDocs = async (q: any): Promise<{ docs: any[], forEach: (cb: (doc: any) => void) => void }> => {
    let req = supabase.from(q.path).select('*');
    if (q.ops) {
        for (const op of q.ops) {
            if (op.type === 'orderBy') req = req.order(op.field, { ascending: op.direction === 'asc' }); // ✅
        }
    }
    const { data, error } = await req;
    if (error) throw error;
    const docs = (data || []).map((d: any) => {
        const mapped = mapToCamel(d);
        return { id: d.id, exists: () => true, data: () => mapped, get: (field: string) => mapped[field] };
    });
    return { docs, forEach: (cb: (doc: any) => void) => docs.forEach(cb) };
};

export const getDoc = async (docRef: any): Promise<{ exists: () => boolean, data: () => any, get: (field: string) => any }> => {
    let retries = 3;
    while (retries > 0) {
        try {
            const { data, error } = await supabase.from(docRef.path).select('*').eq('id', docRef.id).maybeSingle();
            if (error) throw error;
            const mapped = mapToCamel(data || {});
            return { exists: () => !!data, data: () => mapped, get: (field: string) => mapped[field] };
        } catch (error: any) {
            if (error && error.message && error.message.includes('Lock') && retries > 1) {
                retries--;
                await new Promise(r => setTimeout(r, 500));
                continue;
            }
            throw error;
        }
    }
    throw new Error("Max retries exceeded");
};

export const setDoc = async (docRef: any, data: any, options?: any) => {
    let retries = 3;
    while (retries > 0) {
        try {
            const { error } = await supabase.from(docRef.path).upsert([{ id: docRef.id, ...mapToPg(data) }]);
            if (error) throw error;
            return;
        } catch (error: any) {
            if (error && error.message && error.message.includes('Lock') && retries > 1) {
                retries--;
                await new Promise(r => setTimeout(r, 500));
                continue;
            }
            throw error;
        }
    }
    throw new Error("Max retries exceeded");
};

export const addDoc = async (coll: any, data: any) => {
    const { data: res, error } = await supabase.from(coll.path).insert([mapToPg(data)]).select().single();
    if (error) throw error;
    return { id: res?.id };
};

export const updateDoc = async (docRef: any, data: any) => {
    const { error } = await supabase.from(docRef.path).update(mapToPg(data)).eq('id', docRef.id);
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