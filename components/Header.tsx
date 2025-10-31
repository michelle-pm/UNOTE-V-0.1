import React, { useState, useRef, useEffect } from 'react';
import { Menu, Plus, Undo2, Users, Palette, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import GlassButton from './GlassButton';
import { User } from '../types';
import GradientColorPicker from './GradientColorPicker';

interface HeaderProps {
  title: string;
  onToggleSidebar: () => void;
  onAddWidget: () => void;
  showAddWidgetButton: boolean;
  onUndo: () => void;
  canUndo: boolean;
  onUpdateGradients: (color1: string, color2: string) => void;
  projectColors: { color1: string; color2: string };
  onToggleFriendsModal: () => void;
  onToggleMessagesModal: () => void;
  projectUsers: User[];
  ownerUid: string;
  isTeamProject: boolean;
}

const UserAvatar: React.FC<{ user: User | undefined, isOwner: boolean }> = ({ user, isOwner }) => (
    <div 
        className={`w-7 h-7 rounded-full bg-accent text-accent-text flex items-center justify-center font-bold text-xs select-none border-2 ${isOwner ? 'border-accent-dark' : 'border-transparent'}`}
        title={`${user?.name} ${isOwner ? '(Владелец)' : ''}`}
    >
        {user?.name?.[0]?.toUpperCase() || '?'}
    </div>
);

const Header: React.FC<HeaderProps> = ({ 
    title, onToggleSidebar, onAddWidget, showAddWidgetButton, onUndo, canUndo, 
    onUpdateGradients, projectColors, onToggleFriendsModal, onToggleMessagesModal,
    projectUsers, ownerUid, isTeamProject
}) => {
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const colorPickerRef = useRef<HTMLDivElement>(null);

  const usersToShow = isTeamProject ? projectUsers : projectUsers.filter(u => u.uid === ownerUid);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (
        colorPickerRef.current && 
        !colorPickerRef.current.contains(target) &&
        !target.closest('#palette-button')
      ) {
        setIsColorPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSync = (c1: string, c2: string) => {
    onUpdateGradients(c1, c2);
    setIsColorPickerOpen(false);
  }

  return (
    <header className="sticky top-0 flex-shrink-0 flex items-center justify-between h-16 px-4 z-20 bg-transparent backdrop-blur-xl border-b border-glass-border text-text-light">
      <div className="flex items-center gap-2 text-text-dark">
        <motion.button 
          whileTap={{ scale: 0.9 }}
          onClick={onToggleSidebar} 
          className="p-2 rounded-full hover:bg-black/10 transition-colors"
          aria-label="Toggle Sidebar"
        >
          <Menu size={20} />
        </motion.button>
        <h1 className="text-lg font-bold truncate">{title}</h1>
         <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onUndo}
          disabled={!canUndo}
          className="p-2 rounded-full hover:bg-black/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Undo"
        >
          <Undo2 size={18} />
        </motion.button>
        <div ref={colorPickerRef} className="relative">
            <motion.button
                id="palette-button"
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsColorPickerOpen(prev => !prev)}
                className="p-2 rounded-full hover:bg-black/10 transition-colors"
                aria-label="Sync Gradients"
            >
                <Palette size={18} />
            </motion.button>
            <AnimatePresence>
            {isColorPickerOpen && (
                <GradientColorPicker 
                    initialColor1={projectColors.color1}
                    initialColor2={projectColors.color2}
                    onSync={handleSync}
                />
            )}
            </AnimatePresence>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onToggleMessagesModal}
          className="p-2 rounded-full hover:bg-white/10 transition-colors"
          aria-label="Сообщения"
        >
          <MessageSquare size={18} />
        </motion.button>
         <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onToggleFriendsModal}
          className="p-2 rounded-full hover:bg-white/10 transition-colors"
          aria-label="Friends"
        >
          <Users size={18} />
        </motion.button>
        
        <div className="flex items-center -space-x-2 ml-2">
            {usersToShow.map(user => (
                <UserAvatar key={user.uid} user={user} isOwner={user.uid === ownerUid} />
            ))}
        </div>
        
        {showAddWidgetButton && (
          <GlassButton onClick={onAddWidget} aria-label="Add Widget" className="ml-2">
            <Plus size={18} />
            <span className="hidden sm:inline">Виджет</span>
          </GlassButton>
        )}
      </div>
    </header>
  );
};

export default Header;