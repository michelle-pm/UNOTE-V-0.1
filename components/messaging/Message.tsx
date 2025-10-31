import React from 'react';
import { motion } from 'framer-motion';
import { Message, MessageType } from '../../types';
import { File, Download } from 'lucide-react';

interface MessageProps {
  message: Message;
  isOwnMessage: boolean;
  isGroupChat: boolean;
  showSenderName: boolean;
}

const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

const renderContent = (message: Message) => {
    switch (message.type) {
        case MessageType.Image:
            return <img src={message.fileUrl} alt={message.content} className="max-w-xs max-h-64 rounded-lg object-contain cursor-pointer" onClick={() => window.open(message.fileUrl)} />;
        case MessageType.Video:
            return <video src={message.fileUrl} controls className="max-w-xs rounded-lg" />;
        case MessageType.Audio:
            return <audio src={message.fileUrl} controls className="w-full" />;
        case MessageType.File:
            const size = message.fileUrl ? atob(message.fileUrl.split(',')[1]).length : 0;
            return (
                <div className="flex items-center gap-3 p-2 bg-black/20 rounded-lg">
                    <File size={32} className="flex-shrink-0" />
                    <div className="overflow-hidden">
                        <p className="truncate font-medium text-sm">{message.content}</p>
                        <p className="text-xs text-text-secondary">{formatBytes(size)}</p>
                    </div>
                    <a href={message.fileUrl} download={message.content} className="p-2 rounded-full hover:bg-white/10 ml-auto">
                        <Download size={18} />
                    </a>
                </div>
            )
        case MessageType.Text:
        default:
            return <p className="whitespace-pre-wrap break-words">{message.content}</p>;
    }
}

const MessageComponent: React.FC<MessageProps> = ({ message, isOwnMessage, isGroupChat, showSenderName }) => {
  const alignClass = isOwnMessage ? 'items-end' : 'items-start';
  const bubbleClass = isOwnMessage
    ? 'bg-accent text-accent-text rounded-br-none'
    : 'bg-white/10 text-text-primary rounded-bl-none';
  
  const hasPadding = message.type === MessageType.Image || message.type === MessageType.Video;

  return (
    <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className={`flex flex-col w-full ${alignClass}`}
    >
      {isGroupChat && !isOwnMessage && showSenderName && (
        <p className="text-xs text-text-secondary mb-1 ml-2">{message.senderName}</p>
      )}
      <div
        className={`max-w-[80%] rounded-2xl ${bubbleClass} ${hasPadding ? '' : 'px-3 py-2'}`}
      >
        {renderContent(message)}
      </div>
    </motion.div>
  );
};

export default MessageComponent;