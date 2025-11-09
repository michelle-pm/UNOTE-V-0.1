import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, UserPlus, UserX, MessageSquare, Check, MailQuestion, Search, Loader2 } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, runTransaction, serverTimestamp, deleteDoc, addDoc, updateDoc } from 'firebase/firestore';
import { User, FriendRequest } from '../types';
import GlassButton from './GlassButton';

interface FriendsModalProps {
  user: User;
  friends: User[];
  requests: FriendRequest[];
  onClose: () => void;
  onSelectChat: (userId: string) => void;
}

const FriendsModal: React.FC<FriendsModalProps> = ({ user, friends, requests, onClose, onSelectChat }) => {
  const [searchEmail, setSearchEmail] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<User | 'not_found' | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');


  const handleSearchUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailToSearch = searchEmail.trim().toLowerCase();
    if (!emailToSearch) return;

    setIsSearching(true);
    setSearchResult(null);
    setError('');

    try {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("email", "==", emailToSearch));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            setSearchResult('not_found');
        } else {
            const userDoc = querySnapshot.docs[0];
            const foundUser = { uid: userDoc.id, ...userDoc.data() } as User;
            setSearchResult(foundUser);
        }
    } catch (err) {
        console.error("Error searching user:", err);
        setError("Произошла ошибка при поиске.");
        setSearchResult(null);
    } finally {
        setIsSearching(false);
    }
  };
  
  const handleSendRequest = async (friend: User) => {
    setError('');
    setSuccess('');

    if (!user.name || !user.email) {
      return setError("Информация о вашем профиле неполная.");
    }
    if (friend.uid === user.uid) {
        return setError("Вы не можете добавить себя в друзья.");
    }
    
    try {
      const requestsRef = collection(db, "friend_requests");
      await addDoc(requestsRef, {
        from: user.uid,
        fromName: user.name,
        fromEmail: user.email,
        to: friend.uid,
        status: 'pending',
        createdAt: serverTimestamp(),
      });

      setSuccess(`Запрос отправлен пользователю ${friend.email}.`);
      setSearchResult(null);
      setSearchEmail('');
    } catch (err: any) {
      console.error("Error sending request:", err);
      if (err.code === 'permission-denied') {
          setError("Ошибка прав доступа. Не удалось отправить запрос.");
      } else {
          setError("Произошла ошибка при отправке запроса.");
      }
    }
  };


  const handleAcceptRequest = async (request: FriendRequest) => {
    try {
      const friendshipId = [request.from, request.to].sort().join('_');
      const friendshipRef = doc(db, "friendships", friendshipId);
      const chatRef = doc(db, "chats", friendshipId);
      const requestRef = doc(db, "friend_requests", request.id);

      await runTransaction(db, async (transaction) => {
        const fromUserDoc = await transaction.get(doc(db, "users", request.from));
        const toUserDoc = await transaction.get(doc(db, "users", request.to));
        if (!fromUserDoc.exists() || !toUserDoc.exists()) throw new Error("Один из пользователей не найден.");
        const fromUserData = fromUserDoc.data();
        const toUserData = toUserDoc.data();
        
        // Create friendship document
        transaction.set(friendshipRef, { users: [request.from, request.to], createdAt: serverTimestamp() });
        
        // Create chat document only if it doesn't exist
        const chatSnap = await transaction.get(chatRef);
        if (!chatSnap.exists()) {
            transaction.set(chatRef, {
                type: 'private',
                participants: [request.from, request.to],
                participantInfo: {
                    [request.from]: { name: fromUserData.name, email: fromUserData.email },
                    [request.to]: { name: toUserData.name, email: toUserData.email }
                },
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
        }

        // Update request status with acceptedAt timestamp
        transaction.update(requestRef, { status: "accepted", acceptedAt: serverTimestamp() });
      });
      
      setSuccess("Запрос в друзья принят!");

    } catch(err) {
      console.error("Error accepting request: ", err);
      setError("Не удалось принять запрос.");
    }
  };

  const handleDeclineRequest = async (requestId: string) => {
    try {
      const requestRef = doc(db, "friend_requests", requestId);
      await updateDoc(requestRef, { status: 'rejected' });
    } catch(err) { console.error("Error declining request: ", err); setError("Не удалось отклонить запрос."); }
  };

  const handleRemoveFriend = async (friendId: string) => {
    try {
      const friendshipId = [user.uid, friendId].sort().join('_');
      await deleteDoc(doc(db, "friendships", friendshipId));
      setSuccess("Пользователь удален из друзей.");
    } catch (err) { console.error("Error removing friend:", err); setError("Произошла ошибка при удалении друга."); }
  }

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-40" />
      <motion.div
        key="friends-modal" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 50 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="fixed top-4 right-4 w-[360px] bottom-4 origin-top-right bg-black/20 backdrop-blur-2xl z-50 flex flex-col p-4 border border-glass-border rounded-3xl text-text-light"
      >
        <div className="flex justify-between items-center mb-4 flex-shrink-0 px-2">
          <h2 className="text-xl font-bold">Друзья</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10"><X size={20} /></button>
        </div>

        <form onSubmit={handleSearchUser} className="flex items-center gap-2 mb-2 flex-shrink-0">
          <input type="email" value={searchEmail} onChange={e => setSearchEmail(e.target.value)} placeholder="Поиск по email"
            className="flex-grow w-full p-3 bg-white/5 rounded-lg border-2 border-transparent focus:border-accent focus:outline-none transition-colors" required />
          <GlassButton type="submit" className="p-3 flex-shrink-0 w-[52px]">
            {isSearching ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
          </GlassButton>
        </form>

        <div className="h-20 mb-2 flex-shrink-0">
            {error && <p className="text-red-500 text-sm text-center pt-1">{error}</p>}
            {success && <p className="text-green-500 text-sm text-center pt-1">{success}</p>}
            <AnimatePresence>
            {searchResult && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="p-2 rounded-lg bg-white/5 mt-2">
                {searchResult === 'not_found' ? (
                    <p className="text-center text-sm text-text-secondary">Пользователь не найден.</p>
                ) : (
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 overflow-hidden">
                            <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center font-bold flex-shrink-0">{searchResult.name?.[0]?.toUpperCase()}</div>
                            <div className="overflow-hidden">
                                <p className="font-semibold truncate">{searchResult.name}</p>
                                <p className="text-xs text-text-secondary truncate">{searchResult.email}</p>
                            </div>
                        </div>
                        <GlassButton onClick={() => handleSendRequest(searchResult)} className="px-3 py-1.5 text-sm"><UserPlus size={16}/></GlassButton>
                    </div>
                )}
                </motion.div>
            )}
            </AnimatePresence>
        </div>

        <div className="flex-grow overflow-y-auto pr-2 -mr-2 space-y-2">
            <>
              {requests.length > 0 && (
                <div className="mb-4">
                  <h3 className="font-semibold text-sm text-text-secondary px-2 mb-2">Запросы в друзья ({requests.length})</h3>
                  <div className="space-y-2">
                    {requests.map(req => (
                      <div key={req.id} className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                         <div className="flex items-center gap-3 overflow-hidden">
                            <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center font-bold flex-shrink-0" title={req.fromEmail}>{req.fromName?.[0]?.toUpperCase()}</div>
                            <p className="font-semibold truncate text-sm">{req.fromName}</p>
                        </div>
                        <div className="flex items-center flex-shrink-0">
                            <button onClick={() => handleAcceptRequest(req)} className="p-2 text-green-400 hover:text-green-300 rounded-full hover:bg-green-500/10"><Check size={18} /></button>
                            <button onClick={() => handleDeclineRequest(req.id)} className="p-2 text-red-500/80 hover:text-red-500 rounded-full hover:bg-red-500/10"><X size={18} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <hr className="border-glass-border my-4"/>
                </div>
              )}
              {friends.length > 0 ? (
                friends.map(friend => (
                  <div key={friend.uid} className="group flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center font-bold flex-shrink-0">{friend.name?.[0]?.toUpperCase() || friend.email[0].toUpperCase()}</div>
                      <div className="overflow-hidden">
                          <p className="font-semibold truncate">{friend.name}</p>
                          <p className="text-xs text-text-secondary truncate">{friend.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center flex-shrink-0">
                        <button onClick={() => onSelectChat(friend.uid)} className="p-2 text-text-secondary hover:text-accent rounded-full hover:bg-white/10 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"><MessageSquare size={18} /></button>
                        <button onClick={() => handleRemoveFriend(friend.uid)} className="p-2 text-red-500/80 hover:text-red-500 rounded-full hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"><UserX size={18} /></button>
                    </div>
                  </div>
                ))
              ) : requests.length === 0 && !searchResult ? (
                  <div className="flex flex-col items-center justify-center h-full text-center text-text-secondary">
                     <MailQuestion size={48} className="mb-4 text-text-secondary/50"/>
                     <p className="font-semibold">У вас пока нет друзей.</p>
                     <p className="text-xs mt-1">Ищите друзей по email, чтобы начать общаться.</p>
                  </div>
              ) : null}
            </>
        </div>
      </motion.div>
    </>
  );
};

export default FriendsModal;