import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Layout } from 'react-grid-layout';
import { v4 as uuidv4 } from 'uuid';
import html2canvas from 'html2canvas';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { collection, query, where, onSnapshot, doc, addDoc, updateDoc, deleteDoc, getDoc, writeBatch, getDocs, orderBy, serverTimestamp, runTransaction, arrayUnion } from 'firebase/firestore';
import { db } from './firebase';


import { Widget, WidgetType, Project, WidgetData, FolderData, User, LineData, PlanData, PieData, Comment, Chat } from './types';
import useLocalStorage from './hooks/useLocalStorage';
import { WIDGET_DEFAULTS } from './constants';
import { getRandomGradient } from './utils/colors';
import { getRandomEmoji } from './utils/emojis';
import { useAuth } from './contexts/AuthContext';

import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import WidgetMenu from './components/WidgetMenu';
import AuthPage from './components/AuthPage';
import AccountSettingsModal from './components/AccountSettingsModal';
import ShareModal from './components/ShareModal';
import FriendsModal from './components/FriendsModal';
import MessagesModal from './components/messaging/MessagesModal';
import GlassButton from './components/GlassButton';


const MAX_HISTORY_LENGTH = 20;

// Grid layout constants
const GRID_COLS = { lg: 12, md: 10, sm: 6, xs: 2, xxs: 1 };
export const NESTED_GRID_COLS = { lg: 24, md: 20, sm: 12, xs: 4, xxs: 2 };

// Helper to clean layout objects from react-grid-layout
const cleanLayoutItem = (l: Layout): Layout => {
    const cleaned: Layout = { i: l.i, x: l.x, y: l.y, w: l.w, h: l.h };
    if (l.minW) cleaned.minW = l.minW;
    if (l.minH) cleaned.minH = l.minH;
    if (l.maxW) cleaned.maxW = l.maxW;
    if (l.maxH) cleaned.maxH = l.maxH;
    if (l.isDraggable !== undefined) cleaned.isDraggable = l.isDraggable;
    if (l.isResizable !== undefined) cleaned.isResizable = l.isResizable;
    if (l.static) cleaned.static = l.static;
    return cleaned;
};

const cleanAllLayouts = (allLayouts: { [key: string]: Layout[] }): { [key: string]: Layout[] } => {
    const cleaned: { [key: string]: Layout[] } = {};
    for (const bp in allLayouts) {
        if (Object.prototype.hasOwnProperty.call(allLayouts, bp)) {
            cleaned[bp] = allLayouts[bp].map(cleanLayoutItem);
        }
    }
    return cleaned;
};

// Helper to strip any extraneous properties from widget and project objects before cloning/saving.
const cleanProjectForSerialization = (project: Project): Project => {
    const cleanWidget = (w: Widget): Widget => {
        // Create a shallow copy of the data to prevent side effects on the original state object.
        const dataCopy = { ...w.data };

        const cleaned: Widget = {
            id: w.id,
            type: w.type,
            data: dataCopy,
            minW: w.minW,
            minH: w.minH,
        };
        if (w.parentId) cleaned.parentId = w.parentId;
        if (w.assignedUser !== undefined) cleaned.assignedUser = w.assignedUser;

        if (cleaned.type === WidgetType.Folder) {
            const folderData = cleaned.data as FolderData;
            if (folderData.childrenLayouts) {
                // Modify the copied data object, not the original state.
                folderData.childrenLayouts = cleanAllLayouts(folderData.childrenLayouts);
            }
        }
        return cleaned;
    };

    const cleanedProject: Project = {
        id: project.id,
        name: project.name,
        emoji: project.emoji,
        owner_uid: project.owner_uid,
        member_uids: project.member_uids,
        participant_uids: project.participant_uids,
        isTeamProject: project.isTeamProject,
        widgets: project.widgets.map(cleanWidget),
        layouts: cleanAllLayouts(project.layouts),
    };
    
    return cleanedProject;
};


const App: React.FC = () => {
  const { isAuthenticated, user, logout } = useAuth();
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [initialProjectsLoadDone, setInitialProjectsLoadDone] = useState(false);
  const [activeProjectId, setActiveProjectId] = useLocalStorage<string | null>('activeProjectId', null, user?.uid);
  
  // Effect 1: Fetch projects based on user ID
  useEffect(() => {
    if (!user?.uid) {
        setProjects([]);
        setProjectsLoading(false);
        setInitialProjectsLoadDone(true); // User is logged out, so "loading" is done.
        return;
    }

    setProjectsLoading(true);
    setInitialProjectsLoadDone(false); // Reset on user change
    const q = query(collection(db, "projects"), where("participant_uids", "array-contains", user.uid));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const projectsData: Project[] = [];
        querySnapshot.forEach((doc) => {
            projectsData.push({ id: doc.id, ...doc.data() } as Project);
        });
        setProjects(projectsData);
        setProjectsLoading(false);
        setInitialProjectsLoadDone(true); // Mark initial load as complete
    }, (error) => {
        console.error("Error fetching projects:", error);
        setProjectsLoading(false);
        setInitialProjectsLoadDone(true); // Also mark as complete on error
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // Effect 2: Manage active project ID based on the projects list
  useEffect(() => {
    const activeProjectExists = projects.some(p => p.id === activeProjectId);

    if (projects.length > 0 && !activeProjectExists) {
        setActiveProjectId(projects[0].id);
    } else if (projects.length === 0 && activeProjectId !== null) {
        setActiveProjectId(null);
    }
  }, [projects, activeProjectId, setActiveProjectId]);


  const activeProject = useMemo(() => projects.find(p => p.id === activeProjectId), [projects, activeProjectId]);
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isWidgetMenuOpen, setIsWidgetMenuOpen] = useState(false);
  const [isAccountSettingsOpen, setIsAccountSettingsOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isFriendsModalOpen, setIsFriendsModalOpen] = useState(false);
  const [isMessagesModalOpen, setIsMessagesModalOpen] = useState(false);
  const [addWidgetParentId, setAddWidgetParentId] = useState<string | null>(null);
  const [draggingWidgetId, setDraggingWidgetId] = useState<string | null>(null);

  const [history, setHistory] = useState<{ projectId: string; projectState: Project }[]>([]);
  const [scrollToWidgetId, setScrollToWidgetId] = useState<string | null>(null);
  
  const [bgImage, setBgImage] = useLocalStorage<string | null>('bgImage', null, user?.uid);
  const [bgBlur, setBgBlur] = useLocalStorage<number>('bgBlur', 0, user?.uid);

  // Comments State
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [activeCommentWidgetId, setActiveCommentWidgetId] = useState<string | null>(null);
  const [lastSeenTimestamps, setLastSeenTimestamps] = useLocalStorage<Record<string, number>>(
    'lastSeenWidgetCommentTimestamps', {}, user?.uid
  );

  // Messaging State
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);

  useEffect(() => {
      const bgElement = document.getElementById('app-bg-image');
      if (bgElement) {
          if (bgImage) {
              bgElement.style.backgroundImage = `url(${bgImage})`;
              bgElement.style.filter = `blur(${bgBlur}px)`;
          } else {
              bgElement.style.backgroundImage = 'none';
              bgElement.style.filter = 'none';
          }
      }
  }, [bgImage, bgBlur]);

  const safeDeepClone = useCallback((project: Project): Project | null => {
    if (!project) return null;
    try {
        const cleaned = cleanProjectForSerialization(project);
        return JSON.parse(JSON.stringify(cleaned));
    // FIX: Corrected a syntax error in the catch block.
    } catch (error) {
        console.error("Failed to deep clone project state:", error);
        return null;
    }
  }, []);

  const pushStateToHistory = useCallback(() => {
    if (!activeProject) return;
    const clonedState = safeDeepClone(activeProject);
    if (!clonedState) return;
    
    setHistory(prev => {
        const newHistory = [...prev, { projectId: activeProject.id, projectState: clonedState }];
        if (newHistory.length > MAX_HISTORY_LENGTH) {
            return newHistory.slice(1);
        }
        return newHistory;
    });
  }, [activeProject, safeDeepClone]);

  const handleUndo = useCallback(async () => {
    if (history.length === 0 || !activeProjectId) return;
    
    const lastRelevantState = [...history].reverse().find(h => h.projectId === activeProjectId);
    if (!lastRelevantState) return;
    
    const projectRef = doc(db, 'projects', activeProjectId);
    await updateDoc(projectRef, { ...lastRelevantState.projectState });

    setHistory(prev => prev.filter(h => h !== lastRelevantState));
  }, [history, activeProjectId]);

  const currentUserRole = useMemo(() => {
    if (!activeProject || !user) return null;
    if (activeProject.owner_uid === user.uid) return 'owner';
    return activeProject.member_uids[user.uid] || null;
  }, [activeProject, user]);

  const [projectUsers, setProjectUsers] = useState<User[]>([]);

  useEffect(() => {
    if (!activeProject?.participant_uids) {
        setProjectUsers([]);
        return;
    }
    const fetchUsers = async () => {
        const uids = activeProject.participant_uids;
        if (uids.length === 0) {
            setProjectUsers([]);
            return;
        }
        // Firestore 'in' query is limited to 30 elements
        const chunks = [];
        for (let i = 0; i < uids.length; i += 30) {
            chunks.push(uids.slice(i, i + 30));
        }

        const userPromises = chunks.map(chunk => 
            Promise.all(chunk.map(uid => getDoc(doc(db, "users", uid))))
        );

        const userChunks = await Promise.all(userPromises);
        const userDocs = userChunks.flat();
        
        const usersData = userDocs
            .filter(doc => doc.exists())
            .map(doc => ({ uid: doc.id, ...doc.data() } as User));
        setProjectUsers(usersData);
    };
    fetchUsers();
  }, [activeProject]);

  const isEditableOverall = currentUserRole === 'owner' || currentUserRole === 'editor' || currentUserRole === 'manager';
  const canAddWidgets = currentUserRole === 'owner' || currentUserRole === 'editor';

  useEffect(() => {
      if (scrollToWidgetId) {
          const widgetElement = document.getElementById(`widget-${scrollToWidgetId}`);
          if (widgetElement) {
              const rect = widgetElement.getBoundingClientRect();
              if (rect.bottom > window.innerHeight || rect.top < 0) {
                  widgetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
          }
          setScrollToWidgetId(null);
      }
  }, [scrollToWidgetId, activeProject?.widgets]);
  
    // Fetch user's chats
    useEffect(() => {
        if (!user?.uid) {
            setChats([]);
            return;
        }
        const q = query(
            collection(db, "chats"), 
            where("participants", "array-contains", user.uid),
            orderBy("updatedAt", "desc")
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const chatsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Chat));
            setChats(chatsData);
        }, (error) => {
            console.error("Error fetching chats:", error);
        });
        return () => unsubscribe();
    }, [user?.uid]);
    
    const handleSelectChat = useCallback((chatOrUserId: string) => {
        let chat = chats.find(c => c.id === chatOrUserId);
        if (!chat) { // If userId is passed, find the corresponding private chat
            const privateChatId = [user?.uid, chatOrUserId].sort().join('_');
            chat = chats.find(c => c.id === privateChatId);
        }

        if (chat) {
            setActiveChat(chat);
            setIsFriendsModalOpen(false);
            setIsMessagesModalOpen(true);
        }
    }, [chats, user?.uid]);


  // Comments logic
    useEffect(() => {
        if (!activeProjectId) {
            setComments([]);
            setCommentsError(null);
            return;
        }
        const commentsQuery = query(
            collection(db, "projects", activeProjectId, "comments"),
            orderBy("createdAt", "asc")
        );
        const unsubscribe = onSnapshot(commentsQuery, (snapshot) => {
            const fetchedComments: Comment[] = [];
            snapshot.forEach((doc) => {
                fetchedComments.push({ id: doc.id, ...doc.data() } as Comment);
            });
            setComments(fetchedComments);
            setCommentsError(null); // Clear error on success
        }, (error) => {
            console.error("Ошибка при загрузке комментариев (проверьте правила Firestore):", error);
            if (error.code === 'permission-denied') {
                setCommentsError("Доступ запрещен. Проверьте правила безопасности Firestore.");
            } else {
                setCommentsError("Не удалось загрузить комментарии.");
            }
            setComments([]);
        });
        return () => unsubscribe();
    }, [activeProjectId]);

    const unreadStatusByWidget = useMemo(() => {
        const status: Record<string, boolean> = {};
        if (!user) return status;

        const commentsByWidget = comments.reduce((acc, comment) => {
            (acc[comment.widgetId] = acc[comment.widgetId] || []).push(comment);
            return acc;
        }, {} as Record<string, Comment[]>);

        for (const widgetId in commentsByWidget) {
            const lastSeen = lastSeenTimestamps[widgetId] || 0;
            const hasUnread = commentsByWidget[widgetId].some(c => c.createdAt && c.createdAt.seconds > lastSeen);
            if (hasUnread) {
                status[widgetId] = true;
            }
        }
        return status;
    }, [comments, lastSeenTimestamps, user]);

    const handleToggleCommentPane = useCallback((widgetId: string | null) => {
        if (widgetId) {
            // Mark as read by setting the last seen time to now
            setLastSeenTimestamps(prev => ({
                ...prev,
                [widgetId]: Math.floor(Date.now() / 1000)
            }));
        }
        setActiveCommentWidgetId(widgetId);
    }, [setLastSeenTimestamps]);

    const handleAddComment = useCallback(async (widgetId: string, content: string, mentions: string[]) => {
        if (!activeProjectId || !user) throw new Error("Пользователь не авторизован.");
        
        const newComment = {
            widgetId,
            content,
            mentions,
            authorUid: user.uid,
            authorName: user.name,
            createdAt: serverTimestamp(),
        };
        
        try {
            await addDoc(collection(db, "projects", activeProjectId, "comments"), newComment);
        } catch (error: any) {
            console.error("Ошибка при добавлении комментария (проверьте правила Firestore):", error);
            if (error.code === 'permission-denied') {
                throw new Error("Доступ запрещен. Проверьте правила Firestore.");
            }
            throw new Error("Ошибка при отправке комментария.");
        }
    }, [activeProjectId, user]);


  const updateProjectInFirestore = useCallback(async (updates: Partial<Project>) => {
    if (!activeProjectId) return;

    // Sanitize updates to remove any 'undefined' values before sending to Firestore.
    const sanitizedUpdates: Partial<Project> = { ...updates };

    if (sanitizedUpdates.widgets) {
        sanitizedUpdates.widgets = sanitizedUpdates.widgets.map(w => {
            const newW = { ...w };
            // Explicitly delete optional properties if they are undefined
            if (newW.parentId === undefined) delete (newW as Partial<Widget>).parentId;
            if (newW.assignedUser === undefined) delete (newW as Partial<Widget>).assignedUser;
            return newW;
        });
    }

    const projectRef = doc(db, 'projects', activeProjectId);
    await updateDoc(projectRef, sanitizedUpdates);
  }, [activeProjectId]);
  
  const handleInitiateAddWidget = useCallback((parentId: string | null = null) => {
      if (!canAddWidgets) return;
      setAddWidgetParentId(parentId);
      setIsWidgetMenuOpen(true);
  }, [canAddWidgets]);

  const handleCloseWidgetMenu = useCallback(() => {
    setIsWidgetMenuOpen(false);
    setAddWidgetParentId(null);
  }, []);

    const isColliding = (item: Layout, items: Layout[]): boolean => {
        for (const existingItem of items) {
            if (
                item.x < existingItem.x + existingItem.w &&
                item.x + item.w > existingItem.x &&
                item.y < existingItem.y + existingItem.h &&
                item.y + item.h > existingItem.y
            ) {
                return true;
            }
        }
        return false;
    };

  const handleAddWidget = useCallback(async (type: WidgetType) => {
    if (!canAddWidgets || !activeProject) return;
    pushStateToHistory();
    const defaults = WIDGET_DEFAULTS[type];
    
    let widgetData = { ...defaults.data };
    const isGradientWidget = type === WidgetType.Plan || type === WidgetType.Pie || type === WidgetType.Line;
    
    if(isGradientWidget) {
        widgetData = { ...widgetData, ...getRandomGradient(), userSetColors: false };
    }

    const newWidget: Widget = {
      id: uuidv4(),
      type,
      data: widgetData,
      minW: defaults.minW,
      minH: defaults.minH,
    };
    
    if (addWidgetParentId) {
        newWidget.parentId = addWidgetParentId;
    }

    const projectCopy = safeDeepClone(activeProject);
    if (!projectCopy) return;
      
    if (addWidgetParentId) {
        const parentFolderIndex = projectCopy.widgets.findIndex(w => w.id === addWidgetParentId);
        if (parentFolderIndex > -1) {
            const parentFolder = projectCopy.widgets[parentFolderIndex] as Widget & { data: FolderData };
            const childrenLayouts = parentFolder.data.childrenLayouts || {};
            
            const breakpoints = Object.keys(NESTED_GRID_COLS) as Array<keyof typeof NESTED_GRID_COLS>;
            breakpoints.forEach(breakpoint => {
                if (!childrenLayouts[breakpoint]) childrenLayouts[breakpoint] = [];
                const layout = childrenLayouts[breakpoint] as Layout[];
                const nestedDefaults = {
                    w: (type === WidgetType.Folder ? defaults.w : defaults.minW) * 2,
                    h: (type === WidgetType.Folder ? defaults.h : defaults.minH) * 2,
                    minW: defaults.minW * 2,
                    minH: defaults.minH * 2,
                };
                const newLayoutItemDefaults = { i: newWidget.id, ...nestedDefaults };
                let newX = 0, newY = 0, positionFound = false;
                const gridWidth = NESTED_GRID_COLS[breakpoint];
                for (let y = 0; !positionFound; y++) {
                    for (let x = 0; x <= gridWidth - newLayoutItemDefaults.w; x++) {
                        const newItem = { ...newLayoutItemDefaults, x, y };
                        if (!isColliding(newItem, layout)) {
                            newX = x; newY = y; positionFound = true; break;
                        }
                    }
                    if (y > 200) { let maxY = 0; layout.forEach(l => { maxY = Math.max(maxY, l.y + l.h); }); newX = 0; newY = maxY; break; }
                }
                layout.push({ ...newLayoutItemDefaults, x: newX, y: newY });
            });
            
            projectCopy.widgets[parentFolderIndex] = { ...parentFolder, data: { ...parentFolder.data, childrenLayouts } };
            await updateProjectInFirestore({ widgets: [...projectCopy.widgets, newWidget] });
        }
    } else {
         const newLayouts = projectCopy.layouts;
         const breakpoints = Object.keys(GRID_COLS) as Array<keyof typeof GRID_COLS>;
         breakpoints.forEach(breakpoint => {
            if (!newLayouts[breakpoint]) newLayouts[breakpoint] = [];
            const layout = newLayouts[breakpoint] as Layout[];
            const gridWidth = GRID_COLS[breakpoint];
            const newLayoutItemDefaults = { i: newWidget.id, w: Math.min(type === WidgetType.Folder ? defaults.w : defaults.minW, gridWidth), h: type === WidgetType.Folder ? defaults.h : defaults.minH, minW: Math.min(defaults.minW, gridWidth), minH: defaults.minH };
            let newX = 0, newY = 0, positionFound = false;
            for (let y = 0; !positionFound; y++) {
                for (let x = 0; x <= gridWidth - newLayoutItemDefaults.w; x++) {
                    const newItem = { ...newLayoutItemDefaults, x, y };
                    if (!isColliding(newItem, layout)) {
                        newX = x; newY = y; positionFound = true; break;
                    }
                }
                if (y > 200) { let maxY = 0; layout.forEach(l => { maxY = Math.max(maxY, l.y + l.h); }); newX = 0; newY = maxY; break; }
            }
            layout.push({ ...newLayoutItemDefaults, x: newX, y: newY });
         });
         await updateProjectInFirestore({ widgets: [...projectCopy.widgets, newWidget], layouts: newLayouts });
    }
    setScrollToWidgetId(newWidget.id);
    handleCloseWidgetMenu();
  }, [activeProject, addWidgetParentId, handleCloseWidgetMenu, pushStateToHistory, canAddWidgets, updateProjectInFirestore, safeDeepClone]);
  
  const handleRemoveWidget = useCallback(async (id: string) => {
    if (!activeProject) return;
    pushStateToHistory();
    const projectCopy = safeDeepClone(activeProject);
    if (!projectCopy) return;

    const widgetToRemove = projectCopy.widgets.find(w => w.id === id);
    let currentWidgets = [...projectCopy.widgets];

    if (widgetToRemove?.parentId) {
      const parentFolderIndex = currentWidgets.findIndex(w => w.id === widgetToRemove.parentId);
      if (parentFolderIndex > -1) {
        const parentFolder = currentWidgets[parentFolderIndex] as Widget & { data: FolderData };
        if (parentFolder.data.childrenLayouts) {
          const newChildrenLayouts = { ...parentFolder.data.childrenLayouts };
          Object.keys(newChildrenLayouts).forEach(bp => {
            if (newChildrenLayouts[bp]) {
              newChildrenLayouts[bp] = newChildrenLayouts[bp].filter(l => l.i !== id);
            }
          });
          currentWidgets[parentFolderIndex] = { ...parentFolder, data: { ...parentFolder.data, childrenLayouts: newChildrenLayouts } };
        }
      }
    }

    const widgetsToRemove = new Set([id]);
    if (widgetToRemove?.type === WidgetType.Folder) {
        projectCopy.widgets.forEach(w => {
            if (w.parentId === id) widgetsToRemove.add(w.id);
        });
    }

    const finalWidgets = currentWidgets.filter(w => !widgetsToRemove.has(w.id));
    await updateProjectInFirestore({ widgets: finalWidgets });
  }, [activeProject, updateProjectInFirestore, pushStateToHistory, safeDeepClone]);
  
  const handleCopyWidget = async (id: string) => {
    if (!activeProject) return;
    pushStateToHistory();
    const project = safeDeepClone(activeProject);
    if (!project) return;
    
    const widgetToCopy = project.widgets.find(w => w.id === id);
    if (!widgetToCopy) return;

    const widgetsToCopy = new Map<string, Widget>();
    widgetsToCopy.set(id, widgetToCopy);

    if (widgetToCopy.type === WidgetType.Folder) {
        const queue = project.widgets.filter(w => w.parentId === id);
        while (queue.length > 0) {
            const current = queue.shift();
            if (current) {
                widgetsToCopy.set(current.id, current);
                if (current.type === WidgetType.Folder) {
                    queue.push(...project.widgets.filter(w => w.parentId === current.id));
                }
            }
        }
    }

    const idMap = new Map<string, string>();
    const newWidgets: Widget[] = [];
    
    widgetsToCopy.forEach(originalWidget => {
        const newId = uuidv4();
        idMap.set(originalWidget.id, newId);
        const newWidget = JSON.parse(JSON.stringify(originalWidget)); // Safe to stringify a cleaned widget
        newWidget.id = newId;
        newWidgets.push(newWidget);
    });

    newWidgets.forEach(widget => {
        if (widget.parentId) widget.parentId = idMap.get(widget.parentId) || widget.parentId;
        if (widget.type === WidgetType.Folder) {
            const folderData = widget.data as FolderData;
            if (folderData.childrenLayouts) {
                Object.keys(folderData.childrenLayouts).forEach(bp => folderData.childrenLayouts![bp].forEach(l => { l.i = idMap.get(l.i) || l.i; }));
            }
        }
        if (widget.type === WidgetType.Line) {
            const lineData = widget.data as LineData;
            lineData.series.forEach(s => s.data.forEach(point => { if (point.dependency) point.dependency.widgetId = idMap.get(point.dependency.widgetId) || point.dependency.widgetId; }));
        }
    });
    
    const newTopLevelWidget = newWidgets.find(w => w.id === idMap.get(id)!);
    if (!newTopLevelWidget) return;

    if (newTopLevelWidget.parentId) {
         const parentFolderIndex = project.widgets.findIndex(w => w.id === newTopLevelWidget.parentId);
         if (parentFolderIndex === -1) return;
         const parentFolder = project.widgets[parentFolderIndex] as Widget & { data: FolderData };
         const originalLayout = parentFolder.data.childrenLayouts?.[Object.keys(NESTED_GRID_COLS)[0]]?.find(l => l.i === id);
         if (!originalLayout) return;
         const newChildrenLayouts = parentFolder.data.childrenLayouts || {};
         Object.keys(NESTED_GRID_COLS).forEach(bp => {
             const layout = newChildrenLayouts[bp] || [];
             const gridWidth = NESTED_GRID_COLS[bp as keyof typeof NESTED_GRID_COLS];
             const newLayoutItemDefaults = { ...originalLayout, i: newTopLevelWidget.id, w: Math.min(originalLayout.w, gridWidth) };
             let newX = 0, newY = 0, positionFound = false;
             for (let y = 0; !positionFound; y++) {
                 for (let x = 0; x <= gridWidth - newLayoutItemDefaults.w; x++) {
                     const newItem = { ...newLayoutItemDefaults, x, y };
                     if (!isColliding(newItem, layout)) { newX = x; newY = y; positionFound = true; break; }
                 }
                 if (y > 200) { let maxY = 0; layout.forEach(l => { maxY = Math.max(maxY, l.y + l.h); }); newX = 0; newY = maxY; break; }
             }
             layout.push({ ...newLayoutItemDefaults, x: newX, y: newY });
             newChildrenLayouts[bp] = layout;
         });
         project.widgets[parentFolderIndex] = { ...parentFolder, data: { ...parentFolder.data, childrenLayouts: newChildrenLayouts }};
    } else {
        const originalLayout = project.layouts[Object.keys(GRID_COLS)[0]]?.find(l => l.i === id);
        if (!originalLayout) return;
        const newLayouts = project.layouts;
        Object.keys(GRID_COLS).forEach(bp => {
            const layout = newLayouts[bp] || [];
            const gridWidth = GRID_COLS[bp as keyof typeof GRID_COLS];
            const newLayoutItemDefaults = { ...originalLayout, i: newTopLevelWidget.id, w: Math.min(originalLayout.w, gridWidth) };
            let newX = 0, newY = 0, positionFound = false;
            for (let y = 0; !positionFound; y++) {
                for (let x = 0; x <= gridWidth - newLayoutItemDefaults.w; x++) {
                    const newItem = { ...newLayoutItemDefaults, x, y };
                    if (!isColliding(newItem, layout)) { newX = x; newY = y; positionFound = true; break; }
                }
                if (y > 200) { let maxY = 0; layout.forEach(l => { maxY = Math.max(maxY, l.y + l.h); }); newX = 0; newY = maxY; break; }
            }
            layout.push({ ...newLayoutItemDefaults, x: newX, y: newY });
            newLayouts[bp] = layout;
        });
        project.layouts = newLayouts;
    }
    setScrollToWidgetId(newTopLevelWidget.id);
    await updateProjectInFirestore({ widgets: [...project.widgets, ...newWidgets], layouts: project.layouts });
  };

  const handleUpdateWidgetData = useCallback(async (id:string, data: WidgetData, assignedUserUid?: string | null) => {
    if (!activeProject) return;
      const newWidgets = activeProject.widgets.map(w => {
          if (w.id === id) {
              const updatedWidget: Widget = { ...w, data };
              if (assignedUserUid !== undefined) {
                  updatedWidget.assignedUser = assignedUserUid;
              }
              return updatedWidget;
          }
          return w;
      });
      await updateProjectInFirestore({ widgets: newWidgets });
  }, [activeProject, updateProjectInFirestore]);

  const handleLayoutChange = useCallback(async (layout: Layout[], allLayouts: { [key: string]: Layout[] }) => {
    if (!isEditableOverall || !activeProject) return;
      const cleanedAllLayouts = cleanAllLayouts(allLayouts);
      const newWidgets = activeProject.widgets.map(widget => {
        if (widget.type === WidgetType.Folder) {
          const layoutItem = layout.find(l => l.i === widget.id);
          const folderData = widget.data as FolderData;
          if (layoutItem && !folderData.isCollapsed) {
            return { ...widget, data: { ...folderData, expandedH: layoutItem.h } };
          }
        }
        return widget;
      });
      await updateProjectInFirestore({ widgets: newWidgets, layouts: cleanedAllLayouts });
  }, [updateProjectInFirestore, isEditableOverall, activeProject]);

    const handleWidgetHeightChange = useCallback(async (widgetId: string, newH: number) => {
        if (!isEditableOverall || !activeProject) return;
        const cleanedLayouts = cleanAllLayouts(activeProject.layouts);
        const newLayouts = JSON.parse(JSON.stringify(cleanedLayouts));
        let changed = false;
        Object.keys(newLayouts).forEach(bp => {
            const layout = newLayouts[bp] as Layout[];
            const item = layout.find(l => l.i === widgetId);
            if (item && item.h !== newH) {
                item.h = newH;
                changed = true;
            }
        });
        if (changed) await updateProjectInFirestore({ layouts: newLayouts });
    }, [activeProject, updateProjectInFirestore, isEditableOverall]);

  const handleChildrenLayoutChange = useCallback(async (folderId: string, allChildrenLayouts: { [key: string]: Layout[] }) => {
    if (!isEditableOverall || !activeProject) return;
      const cleanedChildrenLayouts = cleanAllLayouts(allChildrenLayouts);
      const projectCopy = safeDeepClone(activeProject);
      if (!projectCopy) return;

      const folderIndex = projectCopy.widgets.findIndex(w => w.id === folderId);
      if (folderIndex === -1) return;
      
      const folder = projectCopy.widgets[folderIndex] as Widget & { data: FolderData };
      const updatedFolderData = { ...folder.data, childrenLayouts: cleanedChildrenLayouts };
      
      Object.keys(GRID_COLS).forEach(breakpoint => {
        const childrenLayout = cleanedChildrenLayouts[breakpoint];
        const folderLayoutItem = projectCopy.layouts[breakpoint]?.find((l: Layout) => l.i === folderId);
        
        if (folderLayoutItem && !folder.data.isCollapsed) {
          let newHeight = WIDGET_DEFAULTS[WidgetType.Folder].h;
          if (childrenLayout && childrenLayout.length > 0) {
            const PARENT_ROW_HEIGHT = 50, PARENT_MARGIN_Y = 16, NESTED_ROW_HEIGHT = 21, NESTED_MARGIN_Y = 8, FOLDER_HEADER_PX = 60, FOLDER_VERTICAL_PADDING_PX = 32;
            const maxRows = Math.max(0, ...childrenLayout.map(l => l.y + l.h));
            const contentPixelHeight = maxRows * NESTED_ROW_HEIGHT + (maxRows > 0 ? (maxRows - 1) * NESTED_MARGIN_Y : 0) + FOLDER_VERTICAL_PADDING_PX;
            const totalPixelHeight = contentPixelHeight + FOLDER_HEADER_PX;
            newHeight = Math.ceil((totalPixelHeight + PARENT_MARGIN_Y) / (PARENT_ROW_HEIGHT + PARENT_MARGIN_Y));
          }
          folderLayoutItem.h = Math.max(WIDGET_DEFAULTS[WidgetType.Folder].h, newHeight);
          updatedFolderData.expandedH = folderLayoutItem.h;
        }
      });
      projectCopy.widgets[folderIndex] = { ...folder, data: updatedFolderData };
      await updateProjectInFirestore({ widgets: projectCopy.widgets, layouts: projectCopy.layouts });
  }, [activeProject, updateProjectInFirestore, isEditableOverall, safeDeepClone]);
  
  const handleToggleFolder = useCallback(async (widgetId: string) => {
      if (!isEditableOverall || !activeProject) return;
      pushStateToHistory();
      const projectCopy = safeDeepClone(activeProject);
      if (!projectCopy) return;

      const folderWidgetIndex = projectCopy.widgets.findIndex(w => w.id === widgetId && w.type === WidgetType.Folder);
      if (folderWidgetIndex === -1) return;
      
      const folder = projectCopy.widgets[folderWidgetIndex];
      const folderData = { ...(folder.data as FolderData) }; // Make a mutable copy
      
      const newIsCollapsed = !folderData.isCollapsed;
      folderData.isCollapsed = newIsCollapsed;
      
      const collapsedH = folder.minH || WIDGET_DEFAULTS[WidgetType.Folder].minH;
      
      Object.keys(projectCopy.layouts).forEach(bp => {
          const layout = projectCopy.layouts[bp] as Layout[];
          const folderItem = layout.find((l: Layout) => l.i === widgetId);
          if (!folderItem) return;
          
          if (newIsCollapsed) {
              // Save the current height as expandedH *before* collapsing
              folderData.expandedH = folderItem.h;
              folderItem.h = collapsedH;
          } else {
              // Restore to expanded height, with a fallback to default.
              folderItem.h = folderData.expandedH || WIDGET_DEFAULTS[WidgetType.Folder].h;
          }
      });
      
      projectCopy.widgets[folderWidgetIndex] = { ...folder, data: folderData };
      await updateProjectInFirestore({ widgets: projectCopy.widgets, layouts: projectCopy.layouts });
  }, [activeProject, pushStateToHistory, isEditableOverall, updateProjectInFirestore, safeDeepClone]);
    
  const handleDragStart = useCallback((layout: Layout[], oldItem: Layout) => {
      if (!isEditableOverall) return;
      setDraggingWidgetId(oldItem.i);
  }, [isEditableOverall]);
  const handleDragStop = useCallback(() => {
      if (!isEditableOverall) return;
      pushStateToHistory();
      setDraggingWidgetId(null);
  }, [pushStateToHistory, isEditableOverall]);
   const handleResizeStop = useCallback(() => {
      if (!isEditableOverall) return;
      pushStateToHistory();
  }, [pushStateToHistory, isEditableOverall]);

  const handleAddProject = useCallback(async () => {
      if (!user) return;

      // If the local state shows no projects, perform a definitive server check
      // to prevent creating a duplicate due to race conditions on startup.
      if (projects.length === 0) {
        const checkQuery = query(collection(db, "projects"), where("participant_uids", "array-contains", user.uid));
        const existingProjectsSnapshot = await getDocs(checkQuery);
        if (!existingProjectsSnapshot.empty) {
          // The onSnapshot listener will soon update the local state, so we just abort.
          return;
        }
      }

      pushStateToHistory();
      const newProjectData = {
          name: `Новый проект ${projects.length + 1}`,
          emoji: getRandomEmoji(),
          isTeamProject: false,
          owner_uid: user.uid,
          member_uids: {},
          participant_uids: [user.uid],
          widgets: [],
          layouts: {},
      };
      const newProjectRef = await addDoc(collection(db, "projects"), newProjectData);
      setActiveProjectId(newProjectRef.id);
  }, [user, pushStateToHistory, projects.length, setActiveProjectId]);
  
  const handleCopyProject = async (id: string) => {
    pushStateToHistory();
    const projectToCopy = projects.find(p => p.id === id);
    if (!projectToCopy || !user) return;

    const newProject: Omit<Project, 'id'> = safeDeepClone(projectToCopy) as Omit<Project, 'id'>;
    if (!newProject) return;

    newProject.name = `Копия ${projectToCopy.name}`;
    newProject.owner_uid = user.uid;
    newProject.member_uids = {};
    newProject.participant_uids = [user.uid];
    newProject.isTeamProject = false;

    const idMap = new Map<string, string>();
    newProject.widgets.forEach(widget => {
        const oldId = widget.id;
        const newId = uuidv4();
        idMap.set(oldId, newId);
        widget.id = newId;
    });
    
    newProject.widgets.forEach(widget => {
        if (widget.parentId) widget.parentId = idMap.get(widget.parentId) || widget.parentId;
        if (widget.type === WidgetType.Folder) {
            const folderData = widget.data as FolderData;
            if (folderData.childrenLayouts) {
                Object.keys(folderData.childrenLayouts).forEach(bp => folderData.childrenLayouts![bp].forEach(l => { l.i = idMap.get(l.i) || l.i; }));
            }
        }
        if (widget.type === WidgetType.Line) {
            const lineData = widget.data as LineData;
            lineData.series.forEach(s => s.data.forEach(p => { if (p.dependency) p.dependency.widgetId = idMap.get(p.dependency.widgetId) || p.dependency.widgetId; }));
        }
    });

    Object.keys(newProject.layouts).forEach(bp => newProject.layouts[bp].forEach(l => { l.i = idMap.get(l.i) || l.i; }));

    const newProjectRef = await addDoc(collection(db, "projects"), newProject);
    setActiveProjectId(newProjectRef.id);
  };


  const handleRemoveProject = async (id: string) => {
      if (currentUserRole !== 'owner') return;
      pushStateToHistory();
      
      const projectRef = doc(db, 'projects', id);
      const projectDoc = await getDoc(projectRef);
      if (!projectDoc.exists()) return;

      const projectData = projectDoc.data() as Project;
      const widgetsToDelete = projectData.widgets.filter(w => w.type === WidgetType.File || w.type === WidgetType.Image);
      
      // NOTE: Firebase Storage deletion logic would go here if it was used for files/images.
      // Since it's Base64, we just delete the project doc.
      
      await deleteDoc(projectRef);
  };

  const handleRenameProject = async (id: string, newName: string) => {
      if (currentUserRole !== 'owner' && currentUserRole !== 'editor') return;
      pushStateToHistory();
      await updateDoc(doc(db, 'projects', id), { name: newName });
  };

  const handleUpdateProject = async (updatedProject: Project) => {
      if (currentUserRole !== 'owner') return;
      pushStateToHistory();
      const { id, ...projectData } = updatedProject;
      await updateDoc(doc(db, 'projects', id), { ...projectData });
  };
  
  const handleSaveAsPng = useCallback(() => {
    const dashboardElement = document.querySelector('.react-grid-layout') as HTMLElement;
    if (dashboardElement) {
        html2canvas(dashboardElement, {
            backgroundColor: '#0d252e',
            useCORS: true,
            scale: 2,
        }).then(canvas => {
            const link = document.createElement('a');
            link.download = `${activeProject?.name || 'dashboard'}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        });
    }
  }, [activeProject]);

  const handleUpdateGradients = useCallback(async (color1: string, color2: string) => {
    if (!activeProject) return;
    pushStateToHistory();

    const gradientWidgetTypes = [WidgetType.Plan, WidgetType.Pie, WidgetType.Line];

    const newWidgets = activeProject.widgets.map(widget => {
        if (gradientWidgetTypes.includes(widget.type)) {
            let updatedData = { ...widget.data };
            if (widget.type === WidgetType.Pie) {
                (updatedData as PieData).color1 = color1;
                (updatedData as PieData).color2 = color2;
            } else {
                (updatedData as PlanData | LineData).color = color1;
                (updatedData as PlanData | LineData).color2 = color2;
            }
            (updatedData as PlanData | PieData | LineData).userSetColors = true;
            return { ...widget, data: updatedData };
        }
        return widget;
    });

    await updateProjectInFirestore({ widgets: newWidgets });
  }, [activeProject, pushStateToHistory, updateProjectInFirestore]);

  // Automatically create a project if the user has none
  useEffect(() => {
    if (isAuthenticated && user && initialProjectsLoadDone && !projectsLoading && projects.length === 0) {
        handleAddProject();
    }
  }, [isAuthenticated, user, projects, projectsLoading, initialProjectsLoadDone, handleAddProject]);

  const projectColors = useMemo(() => {
    if (!activeProject) return { color1: '#D9C8FF', color2: '#B092FF' };
    const gradientWidget = activeProject.widgets.find(w => 
      w.type === WidgetType.Plan || w.type === WidgetType.Line || w.type === WidgetType.Pie
    );
    if (gradientWidget) {
      const data = gradientWidget.data as PlanData | LineData | PieData;
      return {
        color1: 'color1' in data ? data.color1 : data.color,
        color2: data.color2,
      };
    }
    return { color1: '#D9C8FF', color2: '#B092FF' };
  }, [activeProject]);


  let content;
  if (!isAuthenticated) {
    content = <AuthPage />;
  } else if (projectsLoading && !initialProjectsLoadDone) {
     content = (
      <div className="flex items-center justify-center min-h-screen">
        <p>Загрузка проектов...</p>
      </div>
    );
  } else if (!activeProject) {
    content = (
      <div className="flex items-center justify-center min-h-screen">
         <div className="text-center">
            <p className="text-xl mb-4">У вас пока нет проектов.</p>
            <GlassButton onClick={handleAddProject}><Plus size={20} />Создать первый проект</GlassButton>
         </div>
      </div>
    );
  } else {
    content = (
      <div className="flex flex-col h-screen">
        <AnimatePresence>
          {isSidebarOpen && (
            <>
              <motion.div
                key="sidebar-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsSidebarOpen(false)}
                className="fixed inset-0 bg-black/30 z-30 backdrop-blur-sm"
              />
              <Sidebar 
                  onSave={handleSaveAsPng}
                  projects={projects}
                  activeProjectId={activeProjectId}
                  onProjectCreate={handleAddProject}
                  onProjectDelete={handleRemoveProject}
                  onProjectRename={handleRenameProject}
                  onProjectCopy={handleCopyProject}
                  onProjectSelect={setActiveProjectId}
                  user={user}
                  onLogout={logout}
                  onOpenAccountSettings={() => setIsAccountSettingsOpen(true)}
                  onShare={() => setIsShareModalOpen(true)}
                  isEditable={currentUserRole === 'owner' || currentUserRole === 'editor'}
                  isOwner={currentUserRole === 'owner'}
                  bgImage={bgImage}
                  setBgImage={setBgImage}
                  bgBlur={bgBlur}
                  setBgBlur={setBgBlur}
              />
            </>
          )}
        </AnimatePresence>
        <div className={`flex flex-col flex-grow h-screen transition-all duration-500 ${isSidebarOpen ? 'pointer-events-none' : ''}`}>
            <Header
              title={activeProject.name}
              onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
              onAddWidget={() => handleInitiateAddWidget()}
              showAddWidgetButton={canAddWidgets}
              onUndo={handleUndo}
              canUndo={history.some(h => h.projectId === activeProjectId) && isEditableOverall}
              onUpdateGradients={handleUpdateGradients}
              projectColors={projectColors}
              onToggleFriendsModal={() => setIsFriendsModalOpen(prev => !prev)}
              onToggleMessagesModal={() => setIsMessagesModalOpen(prev => !prev)}
              projectUsers={projectUsers}
              ownerUid={activeProject.owner_uid}
              isTeamProject={activeProject.isTeamProject}
            />
            <main className="flex-grow overflow-y-auto" onClick={(e) => {
               const target = e.target as HTMLElement;
               if (target.classList.contains('layout')) {
                  handleCloseWidgetMenu();
               }
            }}>
              <div className="p-4">
                <Dashboard
                  project={activeProject}
                  onLayoutChange={handleLayoutChange}
                  onWidgetHeightChange={handleWidgetHeightChange}
                  onChildrenLayoutChange={handleChildrenLayoutChange}
                  onRemoveWidget={handleRemoveWidget}
                  onUpdateWidgetData={handleUpdateWidgetData}
                  onToggleFolder={handleToggleFolder}
                  onInitiateAddWidget={handleInitiateAddWidget}
                  draggingWidgetId={draggingWidgetId}
                  onDragStart={handleDragStart}
                  onDragStop={handleDragStop}
                  onResizeStop={handleResizeStop}
                  setDraggingWidgetId={setDraggingWidgetId}
                  gridCols={GRID_COLS}
                  currentUser={user}
                  currentUserRole={currentUserRole}
                  projectUsers={projectUsers}
                  onCopyWidget={handleCopyWidget}
                  comments={comments}
                  unreadStatusByWidget={unreadStatusByWidget}
                  activeCommentWidgetId={activeCommentWidgetId}
                  onToggleCommentPane={handleToggleCommentPane}
                  onAddComment={handleAddComment}
                  commentsError={commentsError}
                />
              </div>
            </main>
        </div>
        
         <AnimatePresence>
          {isAccountSettingsOpen && (
            <AccountSettingsModal 
              onClose={() => setIsAccountSettingsOpen(false)} 
              activeProjectName={activeProject?.name || 'Дашборд'}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isShareModalOpen && activeProject && (
              <ShareModal
                  project={activeProject}
                  projectUsers={projectUsers}
                  onClose={() => setIsShareModalOpen(false)}
                  onUpdateProject={handleUpdateProject}
              />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isFriendsModalOpen && user && (
            <FriendsModal
              user={user}
              onClose={() => setIsFriendsModalOpen(false)}
              onSelectChat={handleSelectChat}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
            {isMessagesModalOpen && user && (
                <MessagesModal
                    user={user}
                    allUsers={projectUsers}
                    chats={chats}
                    activeChat={activeChat}
                    setActiveChat={setActiveChat}
                    onClose={() => {
                        setIsMessagesModalOpen(false);
                        setActiveChat(null);
                    }}
                />
            )}
        </AnimatePresence>

         <AnimatePresence>
          {isWidgetMenuOpen && (
            <WidgetMenu onSelect={handleAddWidget} onClose={handleCloseWidgetMenu} />
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden font-sans text-text-light">
      <div className="app-background">
        <div id="app-bg-image" />
      </div>
      <main className="relative z-10">
        {content}
      </main>
    </div>
  );
};

export default App;
