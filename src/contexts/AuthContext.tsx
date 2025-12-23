import { createContext, useContext, useEffect, useState } from 'react';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  signInAnonymously
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { User } from '../types';

// Simple password hashing
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  sendEmailLink: (email: string) => Promise<void>;
  confirmEmailLink: (email: string) => Promise<void>;
  signUpWithUsername: (username: string, password: string) => Promise<void>;
  signInWithUsername: (username: string, password: string) => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;
  acceptTerms: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Helper function to load user data from Firestore
  const loadUserData = async (firebaseUser: any): Promise<User | null> => {
    try {
      const savedUsername = localStorage.getItem('lottery_username');

      if (firebaseUser.isAnonymous && savedUsername) {
        // Username/password auth
        const authUserDoc = await getDoc(doc(db, 'authUsers', savedUsername));

        if (authUserDoc.exists()) {
          const authUserData = authUserDoc.data();
          const userId = authUserData.userId;

          if (userId) {
            const userDoc = await getDoc(doc(db, 'users', userId));
            const userData = userDoc.data();

            if (userData) {
              return {
                uid: userId,
                email: userData.email || `${savedUsername}@lottery.local`,
                username: savedUsername,
                displayName: userData.displayName || '',
                isAdmin: userData.isAdmin || false,
                termsAccepted: userData.termsAccepted || false,
                termsAcceptedAt: userData.termsAcceptedAt,
                isOver18: userData.isOver18 || false
              };
            }
          }
        }
        return null;
      } else {
        // Google or Email auth - ALWAYS fetch from DB
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        const userData = userDoc.data();

        // Check if user is default admin
        const defaultAdminEmail = import.meta.env.VITE_ADMIN_EMAIL;
        const isDefaultAdmin = defaultAdminEmail && firebaseUser.email === defaultAdminEmail;

        // Return user with DB data (not from firebase user)
        return {
          uid: firebaseUser.uid,
          email: firebaseUser.email!,
          username: userData?.username,
          displayName: userData?.displayName || '',
          isAdmin: isDefaultAdmin || userData?.isAdmin || false,
          termsAccepted: userData?.termsAccepted || false,
          termsAcceptedAt: userData?.termsAcceptedAt,
          isOver18: userData?.isOver18 || false
        };
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      return null;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userData = await loadUserData(firebaseUser);
        setUser(userData);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);

    // Create or update user document
    await setDoc(doc(db, 'users', result.user.uid), {
      email: result.user.email,
      displayName: result.user.displayName || '',
      isAdmin: false,
      createdAt: new Date(),
      termsAccepted: false,
      isOver18: false
    }, { merge: true });

    // Reload user data
    const userData = await loadUserData(result.user);
    setUser(userData);
  };

  const sendEmailLink = async (email: string) => {
    const actionCodeSettings = {
      url: window.location.origin + '/complete-signin',
      handleCodeInApp: true,
    };

    await sendSignInLinkToEmail(auth, email, actionCodeSettings);
    window.localStorage.setItem('emailForSignIn', email);
  };

  const confirmEmailLink = async (email: string) => {
    if (isSignInWithEmailLink(auth, window.location.href)) {
      const result = await signInWithEmailLink(auth, email, window.location.href);
      window.localStorage.removeItem('emailForSignIn');

      const userDoc = await getDoc(doc(db, 'users', result.user.uid));
      if (!userDoc.exists()) {
        await setDoc(doc(db, 'users', result.user.uid), {
          email: result.user.email,
          displayName: '',
          isAdmin: false,
          createdAt: new Date(),
          termsAccepted: false,
          isOver18: false
        });
      }

      // Reload user data
      const userData = await loadUserData(result.user);
      setUser(userData);
    }
  };

  const signUpWithUsername = async (username: string, password: string) => {
    const trimmedUsername = username.trim().toLowerCase();
    if (trimmedUsername.length < 3) {
      throw new Error('Kullanıcı adı en az 3 karakter olmalıdır');
    }
    if (!/^[a-z0-9_]+$/.test(trimmedUsername)) {
      throw new Error('Kullanıcı adı sadece harf, rakam ve alt çizgi içerebilir');
    }

    // Sign in anonymously
    await signInAnonymously(auth);

    // Check if username exists
    const authUserDoc = await getDoc(doc(db, 'authUsers', trimmedUsername));

    if (authUserDoc.exists()) {
      throw new Error('Bu kullanıcı adı zaten kullanılıyor');
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Generate unique user ID
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create auth entry
    await setDoc(doc(db, 'authUsers', trimmedUsername), {
      username: trimmedUsername,
      passwordHash: passwordHash,
      userId: userId,
      createdAt: new Date()
    });

    // Create user document with default values
    await setDoc(doc(db, 'users', userId), {
      email: `${trimmedUsername}@lottery.local`,
      username: trimmedUsername,
      displayName: '',
      isAdmin: false,
      createdAt: new Date(),
      termsAccepted: false,
      isOver18: false
    });

    // Save username
    localStorage.setItem('lottery_username', trimmedUsername);

    // Reload user data
    const currentUser = auth.currentUser;
    if (currentUser) {
      const userData = await loadUserData(currentUser);
      setUser(userData);
    }
  };

  const signInWithUsername = async (username: string, password: string) => {
    const trimmedUsername = username.trim().toLowerCase();

    // Sign in anonymously
    await signInAnonymously(auth);

    // Get auth doc
    const authUserDoc = await getDoc(doc(db, 'authUsers', trimmedUsername));

    if (!authUserDoc.exists()) {
      throw new Error('Kullanıcı bulunamadı');
    }

    // Verify password
    const authUserData = authUserDoc.data();
    const storedPasswordHash = authUserData.passwordHash;
    const inputPasswordHash = await hashPassword(password);

    if (inputPasswordHash !== storedPasswordHash) {
      throw new Error('Şifre yanlış');
    }

    // Save username
    localStorage.setItem('lottery_username', trimmedUsername);

    // Reload user data
    const currentUser = auth.currentUser;
    if (currentUser) {
      const userData = await loadUserData(currentUser);
      setUser(userData);
    }
  };

  const updateDisplayName = async (name: string) => {
    if (!user) return;

    // Update DB
    await setDoc(doc(db, 'users', user.uid), {
      displayName: name
    }, { merge: true });

    // Update local state
    setUser({ ...user, displayName: name });
  };

  const acceptTerms = async () => {
    if (!user) return;

    // Update DB
    await setDoc(doc(db, 'users', user.uid), {
      termsAccepted: true,
      termsAcceptedAt: new Date(),
      isOver18: true
    }, { merge: true });

    // Update local state
    setUser({
      ...user,
      termsAccepted: true,
      termsAcceptedAt: new Date(),
      isOver18: true
    });
  };

  const signOut = async () => {
    localStorage.removeItem('lottery_username');
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      signInWithGoogle,
      sendEmailLink,
      confirmEmailLink,
      signUpWithUsername,
      signInWithUsername,
      updateDisplayName,
      acceptTerms,
      signOut
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
