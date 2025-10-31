import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Edit3, LogOut, Settings, Save, Share2, MoreHorizontal, Copy, Image as ImageIcon } from 'lucide-react';
import { Project, User } from '../types';
import Logo from './Logo';
import BackgroundSettings from './BackgroundSettings';

interface SidebarProps {
  onSave: () => void;
  projects: Project[];
  activeProjectId: string | null;
  onProjectCreate: () => void;
  onProjectDelete: (id: string) => void;
  onProjectRename: (id: string, newName: string) => void;
  onProjectCopy: (id: string) => void;
  onProjectSelect: (id: string) => void;
  user: User | null;
  onLogout: () => void;
  onOpenAccountSettings: () => void;
  onShare: () => void;
  isEditable: boolean;
  isOwner: boolean;
  bgImage: string | null;
  setBgImage: (value: string | null) => void;
  bgBlur: number;
  setBgBlur: (value: number) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  onSave, projects, activeProjectId, onProjectCreate,
  onProjectDelete, onProjectRename, onProjectCopy, onProjectSelect, user, onLogout, onOpenAccountSettings,
  onShare, isEditable, isOwner,
  bgImage, setBgImage, bgBlur, setBgBlur
}) => {
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [isBgSettingsOpen, setIsBgSettingsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const bgSettingsRef = useRef<HTMLDivElement>(null);


  const handleRenameStart = (project: Project) => {
    setEditingProjectId(project.id);
    setNewProjectName(project.name);
    setMenuOpenId(null);
  };

  const handleRenameSave = () => {
    if (editingProjectId && newProjectName.trim()) {
      onProjectRename(editingProjectId, newProjectName.trim());
    }
    setEditingProjectId(null);
  };
  
  const handleCopy = (id: string) => {
      onProjectCopy(id);
      setMenuOpenId(null);
  }
  
  const handleDelete = (id: string) => {
      onProjectDelete(id);
      setMenuOpenId(null);
  }
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpenId(null);
      }
       if (bgSettingsRef.current && !bgSettingsRef.current.contains(event.target as Node)) {
        const target = event.target as HTMLElement;
        if (!target.closest('#bg-settings-toggle')) {
          setIsBgSettingsOpen(false);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <motion.aside
      key="sidebar"
      initial={{ x: '-100%' }}
      animate={{ x: 0 }}
      exit={{ x: '-100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="fixed top-0 left-0 h-full w-72 bg-black/20 backdrop-blur-xl z-40 flex flex-col p-4 border-r border-glass-border text-text-light"
    >
      <div className="flex items-center gap-3 flex-shrink-0 mb-6 px-2">
        <Logo className="text-accent" />
        <h2 className="text-2xl font-bold">UNOTE</h2>
      </div>

      <div className="flex-grow overflow-y-auto pr-2 -mr-2">
        <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-2 px-2">Проекты</h3>
        <ul className="space-y-1">
          {projects.map(p => (
            <li key={p.id} className="relative px-2">
              {editingProjectId === p.id ? (
                 <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={e => setNewProjectName(e.target.value)}
                    onBlur={handleRenameSave}
                    onKeyDown={e => e.key === 'Enter' && handleRenameSave()}
                    className="flex-grow bg-white/10 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                    autoFocus
                  />
                 </div>
              ) : (
                <div className={`group flex items-center justify-between rounded-lg transition-all duration-200 ${ activeProjectId === p.id ? 'bg-white/10' : 'hover:bg-white/5'}`}>
                  <button
                    onClick={() => onProjectSelect(p.id)}
                    className={`flex items-center gap-3 w-full text-left p-2 rounded-md transition-colors`}
                  >
                    <span className="text-2xl bg-white/5 p-2 rounded-lg">{p.emoji}</span>
                    <span className={`font-semibold truncate ${activeProjectId === p.id ? 'text-accent' : ''}`}>{p.name}</span>
                  </button>
                  <button onClick={() => setMenuOpenId(menuOpenId === p.id ? null : p.id)} className="p-2 opacity-50 group-hover:opacity-100 focus:opacity-100 transition-opacity mr-1">
                    <MoreHorizontal size={18} />
                  </button>
                </div>
              )}
               <AnimatePresence>
                {menuOpenId === p.id && (
                    <motion.div
                        ref={menuRef}
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="absolute top-full right-2 mt-1 w-48 bg-[#1a202c] rounded-lg shadow-xl z-50 overflow-hidden p-2 border border-glass-border"
                    >
                        {isEditable && <button onClick={() => handleRenameStart(p)} className="w-full flex items-center gap-3 text-left px-3 py-2 text-sm hover:bg-white/5 rounded-md"><Edit3 size={16} />Переименовать</button>}
                        <button onClick={() => handleCopy(p.id)} className="w-full flex items-center gap-3 text-left px-3 py-2 text-sm hover:bg-white/5 rounded-md"><Copy size={16} />Копировать</button>
                        {isOwner && projects.length > 1 && (
                            <>
                            <div className="h-px bg-white/10 my-1"></div>
                            <button onClick={() => handleDelete(p.id)} className="w-full flex items-center gap-3 text-left px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 rounded-md"><Trash2 size={16} />Удалить</button>
                            </>
                        )}
                    </motion.div>
                )}
               </AnimatePresence>
            </li>
          ))}
        </ul>
        <button onClick={onProjectCreate} className="w-full flex items-center gap-2 p-2 mt-2 text-sm text-text-secondary hover:text-accent rounded-lg">
          <Plus size={16} />
          <span>Новый проект</span>
        </button>
      </div>

      <div className="flex-shrink-0 border-t border-glass-border pt-4 mt-4 space-y-1">
        {isOwner && (
            <button onClick={onShare} className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors">
              <Share2 size={18} />
              <span>Поделиться</span>
            </button>
        )}
        <button onClick={onSave} className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors">
          <Save size={18} />
          <span>Сохранить как PNG</span>
        </button>
        
        <div className="relative">
          <button id="bg-settings-toggle" onClick={() => setIsBgSettingsOpen(prev => !prev)} className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors">
            <ImageIcon size={18} />
            <span>Фон</span>
          </button>
          <AnimatePresence>
            {isBgSettingsOpen && (
                <div ref={bgSettingsRef}>
                    <BackgroundSettings 
                        bgImage={bgImage}
                        setBgImage={setBgImage}
                        bgBlur={bgBlur}
                        setBgBlur={setBgBlur}
                        onClose={() => setIsBgSettingsOpen(false)}
                    />
                </div>
            )}
          </AnimatePresence>
        </div>
        
        <div className="border-t border-glass-border pt-4 mt-2 flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
             <div className="w-8 h-8 rounded-full bg-accent text-accent-text flex items-center justify-center font-bold flex-shrink-0">
                 {user?.name?.[0]?.toUpperCase() || 'U'}
             </div>
             <div className="flex flex-col overflow-hidden">
                <span className="font-semibold truncate text-sm">{user?.name}</span>
                <span className="text-xs text-text-secondary truncate">{user?.email}</span>
             </div>
          </div>
          <div className="flex items-center">
            <button onClick={onOpenAccountSettings} className="p-2 rounded-full hover:bg-white/5"><Settings size={16} /></button>
            <button onClick={onLogout} className="p-2 rounded-full hover:bg-white/5"><LogOut size={16} /></button>
          </div>
        </div>
      </div>
    </motion.aside>
  );
};

export default Sidebar;