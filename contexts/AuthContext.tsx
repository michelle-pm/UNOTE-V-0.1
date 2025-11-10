import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { User, Project } from '../types';
import { getRandomEmoji } from '../utils/emojis';
import { auth, db } from '../firebase';
import { 
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    updateProfile,
    updatePassword,
    reauthenticateWithCredential,
    EmailAuthProvider
} from 'firebase/auth';
import { doc, setDoc, getDoc, addDoc, collection } from 'firebase/firestore';


interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password?: string, remember?: boolean) => Promise<void>;
  logout: () => void;
  register: (name: string, email: string, password?: string) => Promise<void>;
  updateUser: (updatedUser: Partial<User>) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
            const userDocRef = doc(db, "users", firebaseUser.uid);
            const userDoc = await getDoc(userDocRef);
            if (userDoc.exists()) {
                setUser({ uid: firebaseUser.uid, ...userDoc.data() } as User);
            } else {
                 // This might happen if Firestore doc creation failed after auth creation
                const newUser: User = { uid: firebaseUser.uid, displayName: firebaseUser.displayName || 'Пользователь', email: firebaseUser.email! };
                await setDoc(userDocRef, { displayName: newUser.displayName, email: newUser.email });
                setUser(newUser);
            }
        } else {
            setUser(null);
        }
        setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password?: string) => {
    if (!password) throw new Error("Пароль не указан.");
    await signInWithEmailAndPassword(auth, email, password);
  };

  const register = async (name: string, email: string, password?: string) => {
    if (!password) throw new Error("Пароль не указан.");
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;
    
    await updateProfile(firebaseUser, { displayName: name });
    
    const newUser: Omit<User, 'uid'> = { displayName: name, email };
    await setDoc(doc(db, "users", firebaseUser.uid), newUser);
    
    // Create a default project for the new user in Firestore
    const newProject: Omit<Project, 'id'> = {
        name: 'Мой проект',
        emoji: getRandomEmoji(),
        isTeamProject: false,
        owner_uid: firebaseUser.uid,
        member_uids: {},
        participant_uids: [firebaseUser.uid],
        widgets: [],
        layouts: {},
    };
    await addDoc(collection(db, 'projects'), newProject);
  };

  const updateUser = async (updatedUser: Partial<User>) => {
    if (auth.currentUser) {
        if (updatedUser.displayName) {
            await updateProfile(auth.currentUser, { displayName: updatedUser.displayName });
            const userDocRef = doc(db, "users", auth.currentUser.uid);
            await setDoc(userDocRef, { displayName: updatedUser.displayName }, { merge: true });
            
            // Update local state
            setUser(prev => prev ? { ...prev, displayName: updatedUser.displayName! } : null);
        }
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (!auth.currentUser || !auth.currentUser.email) {
        throw new Error("Пользователь не авторизован.");
    }
     if (newPassword.length < 6) {
        throw new Error("Новый пароль должен содержать не менее 6 символов.");
    }

    try {
        const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
        await reauthenticateWithCredential(auth.currentUser, credential);
        await updatePassword(auth.currentUser, newPassword);

    } catch (error: any) {
        console.error("Password change error:", error.code);
        if (error.code === 'auth/wrong-password') {
            throw new Error('Неверный текущий пароль.');
        }
        throw new Error('Произошла ошибка при смене пароля.');
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  const value = {
    user,
    isAuthenticated: !!user,
    login,
    logout,
    register,
    updateUser,
    changePassword
  };

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};