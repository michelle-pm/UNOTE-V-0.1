import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Chat, Message, MessageType } from '../../types';
import { db } from '../../firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { ArrowLeft, Paperclip, Mic, Send, Trash2, Loader2 } from 'lucide-react';
import MessageComponent from './Message';
import AudioRecorder from './AudioRecorder';

interface ChatViewProps {
  chat: Chat;
  currentUser: User;
  onBack: () => void;
}

const ChatView: React.FC<ChatViewProps> = ({ chat, currentUser, onBack }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = query(
      collection(db, "chats", chat.id, "messages"),
      orderBy("timestamp", "asc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      setMessages(msgs);
    });
    return () => unsubscribe();
  }, [chat.id]);
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (messageData: Partial<Message>) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
        const messagePayload = {
            chatId: chat.id,
            senderId: currentUser.uid,
            senderName: currentUser.name,
            timestamp: serverTimestamp(),
            ...messageData,
        };
        
        await addDoc(collection(db, "chats", chat.id, "messages"), messagePayload);

        // Update last message on chat document
        const chatRef = doc(db, "chats", chat.id);
        let lastMessageText = '';
        switch(messageData.type) {
            case MessageType.Image: lastMessageText = '📷 Изображение'; break;
            case MessageType.Video: lastMessageText = '📹 Видео'; break;
            case MessageType.Audio: lastMessageText = '🎤 Голосовое сообщение'; break;
            case MessageType.File: lastMessageText = `📄 ${messageData.content}`; break;
            default: lastMessageText = messageData.content || '';
        }

        await updateDoc(chatRef, {
            lastMessage: {
                text: lastMessageText,
                senderId: currentUser.uid,
                timestamp: serverTimestamp(),
            },
            updatedAt: serverTimestamp(),
        });

    } catch (error) {
        console.error("Error sending message:", error);
    } finally {
        setIsSubmitting(false);
    }
  }

  const handleSendText = () => {
    if (!newMessage.trim()) return;
    sendMessage({
        type: MessageType.Text,
        content: newMessage.trim(),
    });
    setNewMessage('');
  };
  
  const handleSendFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
        const fileUrl = e.target?.result as string;
        const fileType = file.type;
        let messageType = MessageType.File;
        if(fileType.startsWith('image/')) messageType = MessageType.Image;
        if(fileType.startsWith('video/')) messageType = MessageType.Video;

        sendMessage({
            type: messageType,
            content: file.name,
            fileUrl,
            fileType,
        });
    };
    reader.readAsDataURL(file);
  };
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          handleSendFile(file);
      }
  };

  const handleSendAudio = (audioData: { url: string; duration: number }) => {
      setIsRecording(false);
      sendMessage({
        type: MessageType.Audio,
        content: `Голосовое сообщение`,
        fileUrl: audioData.url,
        fileType: 'audio/webm',
        audioDuration: audioData.duration,
      });
  }

  return (
    <div className="h-full flex flex-col bg-white/5 rounded-2xl">
      <div className="flex-shrink-0 p-2 border-b border-glass-border flex items-center gap-2">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-white/10">
          <ArrowLeft size={18} />
        </button>
      </div>
      <div className="flex-grow p-4 overflow-y-auto space-y-4">
        {messages.map((msg, index) => (
          <MessageComponent 
            key={msg.id} 
            message={msg} 
            isOwnMessage={msg.senderId === currentUser.uid} 
            isGroupChat={chat.type === 'group'}
            showSenderName={index === 0 || messages[index-1].senderId !== msg.senderId}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="flex-shrink-0 p-2 border-t border-glass-border">
          <AnimatePresence>
          {isRecording && (
              <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}>
                  <AudioRecorder onStop={handleSendAudio} onCancel={() => setIsRecording(false)} />
              </motion.div>
          )}
          </AnimatePresence>
          <div className="flex items-end gap-2">
            <button onClick={() => fileInputRef.current?.click()} className="p-3 rounded-lg hover:bg-white/10 transition-colors">
                <Paperclip size={20} />
            </button>
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
            <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendText();
                    }
                }}
                placeholder="Сообщение..."
                rows={1}
                className="flex-grow w-full p-3 bg-white/5 rounded-lg border-2 border-transparent focus:border-accent focus:outline-none transition-colors resize-none max-h-24"
            />
            {newMessage.trim() ? (
                <button onClick={handleSendText} disabled={isSubmitting} className="p-3 bg-accent text-accent-text rounded-lg transition-colors w-12 h-12 flex items-center justify-center">
                    {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                </button>
            ) : (
                 <button onClick={() => setIsRecording(true)} className="p-3 rounded-lg hover:bg-white/10 transition-colors w-12 h-12 flex items-center justify-center">
                    <Mic size={20} />
                </button>
            )}
        </div>
      </div>
    </div>
  );
};

export default ChatView;