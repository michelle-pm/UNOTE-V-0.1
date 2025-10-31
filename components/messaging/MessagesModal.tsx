import React, { useState } from 'react';
// FIX: Import AnimatePresence from framer-motion.
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { User, Chat } from '../../types';
import ChatList from './ChatList';
import ChatView from './ChatView';

interface MessagesModalProps {
  user: User;
  chats: Chat[];
  activeChat: Chat | null;
  setActiveChat: (chat: Chat | null) => void;
  onClose: () => void;
  allUsers: User[]; // All users in the current project, for creating group chats
}

const MessagesModal: React.FC<MessagesModalProps> = ({ user, chats, activeChat, setActiveChat, onClose, allUsers }) => {
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-40"
      />
      <motion.div
        key="messages-modal"
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 50 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="fixed top-4 right-4 w-[380px] bottom-4 origin-top-right bg-black/20 backdrop-blur-2xl z-50 flex flex-col p-4 border border-glass-border rounded-3xl text-text-light"
      >
        <div className="flex justify-between items-center mb-4 flex-shrink-0 px-2">
            <AnimatePresence mode="wait">
                <motion.h2 
                    key={activeChat ? `chat-${activeChat.id}` : 'list'}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.2 }}
                    className="text-xl font-bold"
                >
                    {activeChat ? (activeChat.type === 'group' ? activeChat.name : activeChat.participantInfo[Object.keys(activeChat.participantInfo).find(uid => uid !== user.uid)!]?.name) : 'Сообщения'}
                </motion.h2>
            </AnimatePresence>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10">
            <X size={20} />
          </button>
        </div>

        <div className="flex-grow overflow-hidden relative">
            <AnimatePresence>
                {!activeChat ? (
                    <motion.div
                        key="chat-list"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="h-full"
                    >
                        <ChatList 
                            chats={chats} 
                            currentUser={user}
                            onSelectChat={setActiveChat}
                            allUsers={allUsers}
                        />
                    </motion.div>
                ) : (
                    <motion.div
                        key={`chat-view-${activeChat.id}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="h-full"
                    >
                        <ChatView 
                            chat={activeChat} 
                            currentUser={user} 
                            onBack={() => setActiveChat(null)}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
      </motion.div>
    </>
  );
};

export default MessagesModal;
