import React, { useState, useRef, useEffect, useMemo, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GripVertical, Trash2, Plus, ChevronDown, ChevronUp, User, UserX, Copy, Edit3, MessageSquare } from 'lucide-react';
import { FolderData, Widget, User as UserType, ProjectMemberRole, WidgetType } from '../types';
import useResizeObserver from '../hooks/useResizeObserver';
import { UnreadStatusContext } from './Dashboard';


export const WidgetSizeContext = createContext({ width: 0, height: 0 });

const UserAvatar: React.FC<{ user: UserType | undefined }> = ({ user }) => (
    <div className="w-5 h-5 rounded-full bg-accent text-accent-text flex items-center justify-center font-bold text-xs select-none" title={`Назначено: ${user?.name}`}>
        {user?.name?.[0]?.toUpperCase() || '?'}
    </div>
);

interface WidgetWrapperProps {
  children: React.ReactNode;
  widget: Widget;
  onRemove: () => void;
  onCopy: () => void;
  onUpdateWidgetData: (id: string, data: any, assignedUserUid?: string | null) => void;
  onToggleFolder?: () => void;
  onInitiateAddWidget?: (parentId: string) => void;
  isNested?: boolean;
  currentUser: UserType | null;
  currentUserRole: ProjectMemberRole | 'owner' | null;
  projectUsers: UserType[];
  isTeamProject: boolean;
  isWidgetEditable: boolean;
  onToggleCommentPane: (widgetId: string | null) => void;
}

const WidgetWrapper: React.FC<WidgetWrapperProps> = ({
  children, widget, onRemove, onCopy, onUpdateWidgetData,
  onToggleFolder, onInitiateAddWidget, isNested,
  currentUser, currentUserRole, projectUsers, isTeamProject, isWidgetEditable,
  onToggleCommentPane
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(widget.data.title || '');
  const [isAssignMenuOpen, setIsAssignMenuOpen] = useState(false);
  const [isControlsVisible, setIsControlsVisible] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const { width, height } = useResizeObserver(contentRef);
  
  const unreadStatusByWidget = useContext(UnreadStatusContext);
  const hasUnreadComments = unreadStatusByWidget[widget.id] || false;


  const isFolder = widget.type === 'folder';
  const isTitleWidget = widget.type === 'title';
  const folderData = isFolder ? (widget.data as FolderData) : undefined;
  
  const isCommentable = ![WidgetType.Title, WidgetType.Goal].includes(widget.type);

  useEffect(() => {
    setTempTitle(widget.data.title || '');
  }, [widget.data.title]);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsAssignMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const handleUpdate = (field: string, value: any) => {
      onUpdateWidgetData(widget.id, { ...widget.data, [field]: value });
  };
  
  const handleAssignUser = (uid: string | null) => {
      onUpdateWidgetData(widget.id, widget.data, uid);
      setIsAssignMenuOpen(false);
  }

  const handleTitleBlur = () => {
    if (tempTitle.trim() !== '') {
      handleUpdate('title', tempTitle);
    } else {
      setTempTitle(widget.data.title || ''); // Revert if empty
    }
    setIsEditingTitle(false);
  };
  
  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
          handleTitleBlur();
      } else if (e.key === 'Escape') {
          setTempTitle(widget.data.title || '');
          setIsEditingTitle(false);
      }
  };
  
  const handleDoubleClick = () => {
    if (isWidgetEditable && !isTitleWidget) {
      setIsEditingTitle(true);
    }
  };

  const assignedUser = useMemo(() => projectUsers.find(u => u.uid === widget.assignedUser), [projectUsers, widget.assignedUser]);
  
  return (
    <div 
        onMouseEnter={() => setIsControlsVisible(true)}
        onMouseLeave={() => setIsControlsVisible(false)}
        className="relative w-full h-full transition-shadow duration-300 shadow-lg shadow-black/10 rounded-3xl widget-grain-container text-text-light"
    >
        <div
            className="absolute inset-0 w-full h-full rounded-3xl -z-10"
            style={{
                backgroundColor: isNested ? 'rgba(30, 41, 59, 0.5)' : 'rgba(30, 41, 59, 0.4)',
                border: `1px solid ${isNested ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.15)'}`,
                backdropFilter: 'blur(32px)',
            }}
        />

        <div className="relative z-0 flex flex-col w-full h-full">
            <div className={`drag-handle flex items-center h-12 px-4 ${isWidgetEditable && !isFolder ? 'cursor-grab' : 'cursor-default'} flex-shrink-0`}>
              <div className={`flex-grow flex items-center gap-2 min-w-0 ${isFolder && folderData?.isCollapsed ? 'justify-center' : ''}`} onDoubleClick={handleDoubleClick}>
                {isFolder && onToggleFolder && (
                    <button onClick={onToggleFolder} className="p-1 -ml-1 rounded-full hover:bg-white/10 no-drag flex-shrink-0">
                      {folderData?.isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                    </button>
                )}
                {assignedUser && <UserAvatar user={assignedUser} />}
                
                {!isTitleWidget && (
                  <div className="overflow-hidden flex-grow min-w-0">
                    {isEditingTitle && isWidgetEditable ? (
                      <input
                        ref={titleInputRef}
                        type="text"
                        value={tempTitle}
                        onChange={(e) => setTempTitle(e.target.value)}
                        onBlur={handleTitleBlur}
                        onKeyDown={handleTitleKeyDown}
                        className="w-full text-base font-semibold bg-transparent focus:outline-none p-1 -m-1 rounded-md bg-white/10 no-drag"
                      />
                    ) : (
                      <div className="flex items-center gap-1 min-w-0">
                        <h3 className={`font-semibold truncate select-none transition-all duration-300 ${isFolder && folderData?.isCollapsed ? 'text-lg text-text-light' : 'text-base text-text-light/80'}`}>{widget.data.title}</h3>
                        {isWidgetEditable && (
                           <button onClick={() => setIsEditingTitle(true)} className={`no-drag p-1 rounded-full text-text-secondary/60 hover:text-text-light transition-opacity flex-shrink-0 ${isControlsVisible ? 'opacity-100' : 'opacity-0'}`}>
                             <Edit3 size={12} />
                           </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
                <div className={`flex items-center gap-0.5 ml-auto transition-opacity duration-200 ${isControlsVisible ? 'opacity-100' : 'opacity-0'}`}>
                    {isWidgetEditable && isFolder && onInitiateAddWidget && !folderData?.isCollapsed && (
                        <button onClick={() => onInitiateAddWidget(widget.id)} className="no-drag p-1 rounded-full text-text-secondary hover:text-text-light hover:bg-white/10 transition-colors">
                            <Plus size={14} />
                        </button>
                    )}
                    
                    {isCommentable && (
                      <button onClick={() => onToggleCommentPane(widget.id)} className="relative no-drag p-1 rounded-full text-text-secondary hover:text-text-light hover:bg-white/10 transition-colors">
                          <MessageSquare size={14} />
                          {hasUnreadComments && <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-accent rounded-full"></div>}
                      </button>
                    )}

                    {isWidgetEditable && (
                        <div className="flex items-center gap-0 no-drag">
                             {isTeamProject && ['owner', 'editor'].includes(currentUserRole || '') && (
                                <div className="relative" ref={menuRef}>
                                    <button onClick={() => setIsAssignMenuOpen(!isAssignMenuOpen)} className="p-1 rounded-full text-text-secondary hover:text-text-light hover:bg-white/10 transition-colors">
                                        <User size={14} />
                                    </button>
                                     <AnimatePresence>
                                        {isAssignMenuOpen && (
                                            <motion.div 
                                                initial={{ opacity: 0, y: -10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -10 }}
                                                className="absolute top-full right-0 mt-2 w-56 bg-[#1a202c] rounded-lg shadow-xl z-50 overflow-hidden border border-glass-border p-2"
                                            >
                                                <div className="pl-2 pr-2 py-1 space-y-1 max-h-48 overflow-y-auto">
                                                    {projectUsers.map(u => (
                                                        <button key={u.uid} onClick={() => handleAssignUser(u.uid)} className={`w-full text-left px-2 py-1.5 text-sm rounded-md hover:bg-white/5 ${widget.assignedUser === u.uid ? 'bg-white/10' : ''}`}>
                                                            {u.name}
                                                        </button>
                                                    ))}
                                                </div>
                                                {widget.assignedUser && (
                                                    <div className="p-2 border-t border-glass-border">
                                                        <button onClick={() => handleAssignUser(null)} className="w-full flex items-center gap-2 text-left px-2 py-1.5 text-sm text-amber-500 rounded-md hover:bg-amber-500/10">
                                                        <UserX size={14}/> Снять назначение
                                                        </button>
                                                    </div>
                                                )}
                                            </motion.div>
                                        )}
                                     </AnimatePresence>
                                </div>
                             )}
                            <button onClick={onCopy} className="p-1 rounded-full text-text-secondary hover:text-text-light hover:bg-white/10 transition-colors">
                                <Copy size={14} />
                            </button>
                            <button onClick={onRemove} className="p-1 rounded-full text-text-secondary hover:text-red-500 hover:bg-red-500/10 transition-colors">
                                <Trash2 size={14} />
                            </button>
                        </div>
                    )}
                    
                    {!isFolder && isWidgetEditable && (<GripVertical className="cursor-grab text-text-secondary/30 ml-1" size={18} />)}
                </div>
            </div>
            <div className={`px-4 ${isFolder && folderData?.isCollapsed ? 'pb-0' : 'pb-4'} flex-grow overflow-hidden`}>
              <div ref={contentRef} className="w-full h-full">
                <WidgetSizeContext.Provider value={{ width, height }}>
                  {children}
                </WidgetSizeContext.Provider>
              </div>
            </div>
        </div>
    </div>
  );
};

export default React.memo(WidgetWrapper);