/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from 'firebase/auth';
import { auth } from './lib/firebase';
import { Whiteboard } from './components/Whiteboard';
import { MessageSquarePlus, LogOut, LogIn } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Sign in error', error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Sign out error', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fdfdfd] bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:24px_24px] flex flex-col">
      <header className="bg-white/80 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-10 border-b border-slate-100">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center shadow-inner">
            <MessageSquarePlus className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h1 className="font-bold text-slate-800 text-lg">回饋給Hady或敲碗新知識</h1>
            <p className="text-sm text-slate-500 font-medium">歡迎留下你的回饋與建議！</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {user ? (
            <>
              <div className="hidden sm:flex items-center gap-3 text-sm text-slate-700 bg-slate-50 pr-4 pl-1 py-1 rounded-full border border-slate-100">
                <img src={user.photoURL || ''} alt="" className="w-8 h-8 rounded-full bg-white shadow-sm" />
                <span className="font-bold">{user.displayName}</span>
              </div>
              <button
                onClick={handleSignOut}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                title="登出"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </>
          ) : (
            <button
              onClick={handleSignIn}
              className="px-5 py-2.5 flex items-center gap-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all text-sm font-bold shadow-[0_4px_0_0_#4f46e5] hover:-translate-y-0.5 hover:shadow-[0_6px_0_0_#4f46e5] active:translate-y-[2px] active:shadow-none"
            >
              <LogIn className="w-4 h-4" />
              使用 Google 登入
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 relative overflow-x-hidden">
        <Whiteboard user={user} />
      </main>
    </div>
  );
}
