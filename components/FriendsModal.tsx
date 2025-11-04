import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { X, UserPlus, UserX, MessageSquare } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, runTransaction, arrayUnion, arrayRemove, getDoc, serverTimestamp } from 'firebase/firestore';
import { User, Chat } from '../types';
import GlassButton from './GlassButton';

interface FriendsModalProps {
  user: User;
  onClose: () => void;
  onSelectChat: (userId: string) => void;
}

const FriendsModal: React.FC<FriendsModalProps> = ({ user, onClose, onSelectChat }) => {
  const [friends, setFriends] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchFriends = useCallback(async () => {
    if (!user?.uid) return;
    try {
      setIsLoading(true);
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const currentUids = userDoc.data()?.friends_uids || [];
      if (currentUids.length === 0) {
         setFriends([]);
         setIsLoading(false);
         return;
      }
      
      const friendPromises = currentUids.map((uid: string) => getDoc(doc(db, "users", uid)));
      const friendDocs = await Promise.all(friendPromises);
      const friendsData = friendDocs
        .filter(doc => doc.exists())
        .map(doc => ({ uid: doc.id, ...doc.data() } as User));
      setFriends(friendsData);
    } catch (err) {
      console.error("Error fetching friends:", err);
      setError("Не удалось загрузить список друзей.");
    } finally {
      setIsLoading(false);
    }
  }, [user.uid]);

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);
  
  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    const emailToAdd = inviteEmail.trim().toLowerCase();

    if (!emailToAdd) return;
    if (emailToAdd === user.email) {
      setError("Вы не можете добавить себя в друзья.");
      return;
    }
    if (friends.some(f => f.email === emailToAdd)) {
      setError("Этот пользователь уже в друзьях.");
      return;
    }

    try {
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", emailToAdd));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setError("Пользователь с таким email не найден.");
        return;
      }
      
      const friendDoc = querySnapshot.docs[0];
      const friendUid = friendDoc.id;
      const friendUserForState = { uid: friendDoc.id, ...friendDoc.data() } as User;
      
      const currentUserRef = doc(db, "users", user.uid);
      const friendUserRef = doc(db, "users", friendUid);

      const chatId = [user.uid, friendUid].sort().join('_');
      const chatRef = doc(db, "chats", chatId);

      await runTransaction(db, async (transaction) => {
        const currentUserDoc = await transaction.get(currentUserRef);
        const friendUserDoc = await transaction.get(friendUserRef);
        const chatDoc = await transaction.get(chatRef);

        if (!currentUserDoc.exists() || !friendUserDoc.exists()) {
          throw new Error("Один из пользователей не найден в базе данных.");
        }
        
        const currentUserData = currentUserDoc.data();
        const friendUserData = friendUserDoc.data();

        if (!currentUserData?.name || !currentUserData?.email || !friendUserData?.name || !friendUserData?.email) {
            throw new Error("У одного из пользователей неполные данные профиля.");
        }
        
        transaction.update(currentUserRef, { friends_uids: arrayUnion(friendUid) });
        transaction.update(friendUserRef, { friends_uids: arrayUnion(user.uid) });

        if (!chatDoc.exists()) {
            const newChatData = {
                type: 'private' as const,
                participants: [user.uid, friendUid],
                participantInfo: {
                    [user.uid]: { name: currentUserData.name, email: currentUserData.email },
                    [friendUid]: { name: friendUserData.name, email: friendUserData.email }
                },
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            };
            transaction.set(chatRef, newChatData);
        }
      });

      setSuccess(`Пользователь ${emailToAdd} добавлен в друзья.`);
      setInviteEmail('');
      setFriends(prev => [...prev, friendUserForState]);

    } catch (err) {
      console.error("Error adding friend:", err);
      if (err instanceof Error && (err.message.includes("Один из пользователей") || err.message.includes("неполные данные"))) {
        setError(err.message);
      } else {
        setError("Ошибка. Проверьте права доступа Firestore.");
      }
    }
  };

  const handleRemoveFriend = async (friendId: string) => {
     try {
      const currentUserRef = doc(db, "users", user.uid);
      const friendUserRef = doc(db, "users", friendId);

      await runTransaction(db, async (transaction) => {
        transaction.update(currentUserRef, { friends_uids: arrayRemove(friendId) });
        transaction.update(friendUserRef, { friends_uids: arrayRemove(user.uid) });
      });

      setFriends(prev => prev.filter(f => f.uid !== friendId));
      setSuccess("Пользователь удален из друзей.");

    } catch (err) {
      console.error("Error removing friend:", err);
      setError("Произошла ошибка при удалении друга.");
    }
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-40"
      />
      <motion.div
        key="friends-modal"
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 50 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="fixed top-4 right-4 w-[360px] bottom-4 origin-top-right bg-black/20 backdrop-blur-2xl z-50 flex flex-col p-4 border border-glass-border rounded-3xl text-text-light"
      >
        <div className="flex justify-between items-center mb-4 flex-shrink-0 px-2">
          <h2 className="text-xl font-bold">Друзья</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleAddFriend} className="flex items-center gap-2 mb-2 flex-shrink-0">
          <input
            type="email"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            placeholder="Email пользователя"
            className="flex-grow w-full p-3 bg-white/5 rounded-lg border-2 border-transparent focus:border-accent focus:outline-none transition-colors"
            required
          />
          <GlassButton type="submit" className="p-3 flex-shrink-0">
            <UserPlus size={18} />
          </GlassButton>
        </form>

        <div className="h-5 mb-2 flex-shrink-0">
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            {success && <p className="text-green-500 text-sm text-center">{success}</p>}
        </div>

        <div className="flex-grow overflow-y-auto pr-2 -mr-2 space-y-2">
          {isLoading ? (
            <p className="text-center text-text-secondary pt-10">Загрузка...</p>
          ) : friends.length > 0 ? (
            friends.map(friend => (
              <div key={friend.uid} className="group flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center font-bold flex-shrink-0">
                      {friend.name?.[0]?.toUpperCase() || friend.email[0].toUpperCase()}
                  </div>
                  <div className="overflow-hidden">
                      <p className="font-semibold truncate">{friend.name}</p>
                      <p className="text-xs text-text-secondary truncate">{friend.email}</p>
                  </div>
                </div>
                <div className="flex items-center flex-shrink-0">
                    <button onClick={() => onSelectChat(friend.uid)} className="p-2 text-text-secondary hover:text-accent rounded-full hover:bg-white/10 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100">
                        <MessageSquare size={18} />
                    </button>
                    <button onClick={() => handleRemoveFriend(friend.uid)} className="p-2 text-red-500/80 hover:text-red-500 rounded-full hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100">
                        <UserX size={18} />
                    </button>
                </div>
              </div>
            ))
          ) : (
              <div className="flex flex-col items-center justify-center h-full text-center text-text-secondary">
                 <p className="font-semibold">У вас пока нет друзей.</p>
                 <p className="text-xs mt-1">Добавьте друзей, чтобы вместе работать над проектами.</p>
              </div>
          )}
        </div>
      </motion.div>
    </>
  );
};

export default FriendsModal;