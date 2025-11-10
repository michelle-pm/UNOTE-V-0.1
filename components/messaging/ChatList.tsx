import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Chat } from '../../types';
import { Users, Search, Plus, X } from 'lucide-react';
import { db } from '../../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import GlassButton from '../GlassButton';

interface ChatListProps {
  chats: Chat[];
  currentUser: User;
  onSelectChat: (chat: Chat) => void;
  allUsers: User[];
}

const ChatListItem: React.FC<{ chat: Chat; currentUser: User; onClick: () => void }> = ({ chat, currentUser, onClick }) => {
    const chatName = useMemo(() => {
        if (chat.type === 'group') {
            return chat.name;
        }
        const otherUserId = chat.participants.find(uid => uid !== currentUser.uid);
        if (!otherUserId) return 'Неизвестный чат';
        return chat.participantInfo[otherUserId]?.name || 'Неизвестный пользователь';
    }, [chat, currentUser]);

    const lastMessageText = chat.lastMessage?.text || 'Нет сообщений';
    
    return (
        <button onClick={onClick} className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors text-left">
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center font-bold flex-shrink-0">
                {chatName?.[0]?.toUpperCase()}
            </div>
            <div className="flex-grow overflow-hidden">
                <p className="font-semibold truncate">{chatName}</p>
                <p className="text-xs text-text-secondary truncate">{lastMessageText}</p>
            </div>
        </button>
    )
}

const CreateGroupChat: React.FC<{ currentUser: User; allUsers: User[]; onClose: () => void }> = ({ currentUser, allUsers, onClose }) => {
    const [groupName, setGroupName] = useState('');
    const [selectedUids, setSelectedUids] = useState<string[]>([currentUser.uid]);
    const [error, setError] = useState('');

    const potentialMembers = allUsers.filter(u => u.uid !== currentUser.uid);

    const toggleMember = (uid: string) => {
        setSelectedUids(prev => 
            prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
        );
    }

    const handleCreateGroup = async () => {
        if (!groupName.trim()) {
            setError('Введите название группы.');
            return;
        }
        if (selectedUids.length < 3) {
            setError('В группе должно быть не менее 3 участников.');
            return;
        }

        setError('');

        const participantInfo = allUsers
            .filter(u => selectedUids.includes(u.uid))
            .reduce((acc, user) => {
                acc[user.uid] = { name: user.displayName, email: user.email };
                return acc;
            }, {} as { [uid: string]: { name: string, email: string }});

        try {
            await addDoc(collection(db, "chats"), {
                name: groupName,
                type: 'group',
                participants: selectedUids,
                participantInfo,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                avatar: '👥',
            });
            onClose();
        } catch (err) {
            console.error(err);
            setError('Не удалось создать группу.');
        }
    }

    return (
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm flex flex-col p-4 rounded-2xl"
        >
            <div className="flex-shrink-0 mb-4">
                <h3 className="font-bold">Новая группа</h3>
                <input
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="Название группы"
                    className="w-full mt-2 p-2 bg-white/10 rounded-lg border-2 border-transparent focus:border-accent focus:outline-none"
                />
            </div>
            <div className="flex-grow overflow-y-auto space-y-2 pr-2 -mr-2">
                <p className="text-xs text-text-secondary mb-2">Выберите участников:</p>
                {potentialMembers.map(user => (
                    <button key={user.uid} onClick={() => toggleMember(user.uid)} className={`w-full flex items-center gap-2 p-2 rounded-md transition-colors ${selectedUids.includes(user.uid) ? 'bg-accent/30' : 'hover:bg-white/5'}`}>
                        <div className={`w-5 h-5 rounded-full border-2 ${selectedUids.includes(user.uid) ? 'bg-accent border-accent-dark' : 'border-gray-500'}`} />
                        <span className="text-sm">{user.displayName}</span>
                    </button>
                ))}
            </div>
             <div className="flex-shrink-0 mt-4">
                {error && <p className="text-red-400 text-xs text-center mb-2">{error}</p>}
                <div className="flex items-center gap-2">
                    <GlassButton onClick={onClose} className="w-full py-2">Отмена</GlassButton>
                    <GlassButton onClick={handleCreateGroup} className="w-full py-2">Создать</GlassButton>
                </div>
            </div>
        </motion.div>
    )
}

const ChatList: React.FC<ChatListProps> = ({ chats, currentUser, onSelectChat, allUsers }) => {
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  return (
    <div className="h-full flex flex-col relative">
        <div className="flex-shrink-0 mb-4 flex items-center gap-2">
            <div className="relative flex-grow">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                <input
                    type="text"
                    placeholder="Поиск..."
                    className="w-full p-2 pl-9 bg-white/5 rounded-lg border-2 border-transparent focus:border-accent/50 focus:outline-none transition-colors"
                />
            </div>
            <GlassButton onClick={() => setIsCreatingGroup(true)} className="p-2.5">
                <Users size={16}/>
                <Plus size={12} className="-ml-2 -mt-2" />
            </GlassButton>
        </div>
        <div className="flex-grow overflow-y-auto pr-2 -mr-2 space-y-1">
            {chats.map(chat => (
                <ChatListItem key={chat.id} chat={chat} currentUser={currentUser} onClick={() => onSelectChat(chat)} />
            ))}
        </div>
        <AnimatePresence>
            {isCreatingGroup && (
                <CreateGroupChat 
                    currentUser={currentUser}
                    allUsers={allUsers}
                    onClose={() => setIsCreatingGroup(false)}
                />
            )}
        </AnimatePresence>
    </div>
  );
};

export default ChatList;