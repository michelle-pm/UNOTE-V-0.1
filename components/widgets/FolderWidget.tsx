import React, { useMemo, useState, Suspense } from 'react';
import { Widget, WidgetType, FolderData, WidgetData, User, ProjectMemberRole } from '../../types';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus } from 'lucide-react';
import { Responsive, WidthProvider, Layout } from 'react-grid-layout';
import WidgetWrapper from '../WidgetWrapper';
import { NESTED_GRID_COLS } from '../../App';
import { WIDGET_DEFAULTS } from '../../constants';

const ResponsiveGridLayout = WidthProvider(Responsive);

interface FolderWidgetProps {
  widget: Widget;
  allWidgets: Widget[];
  renderWidget: (widget: Widget, allWidgets: Widget[], isWidgetEditable: boolean) => React.ReactNode;
  onUpdateWidgetData: (id: string, data: WidgetData, assignedUserUid?: string | null) => void;
  onRemoveWidget: (id: string) => void;
  onCopyWidget: (id: string) => void;
  onInitiateAddWidget: (parentId?: string) => void;
  onChildrenLayoutChange: (folderId: string, allLayouts: {[key: string]: Layout[]}) => void;
  onToggleFolder: (widgetId: string) => void;
  onDragStart: (layout: Layout[], oldItem: Layout) => void;
  onDragStop: () => void;
  onResizeStop: () => void;
  setDraggingWidgetId: (id: string | null) => void;
  isAnythingDragging: boolean;
  isMobile: boolean;
  projectUsers: User[];
  currentUser: User | null;
  currentUserRole: ProjectMemberRole | 'owner' | null;
  isProjectTeam: boolean;
  onToggleCommentPane: (widgetId: string | null) => void;
}

const FolderWidget: React.FC<FolderWidgetProps> = ({ 
    widget, allWidgets, renderWidget, onUpdateWidgetData, 
    onRemoveWidget, onCopyWidget, onInitiateAddWidget, onChildrenLayoutChange,
    onDragStart, onDragStop, onResizeStop, isAnythingDragging, isMobile,
    projectUsers, currentUser, currentUserRole, isProjectTeam, onToggleFolder,
    onToggleCommentPane
}) => {
  const data = widget.data as FolderData;
  const { isCollapsed, childrenLayouts } = data;
  const [currentBreakpoint, setCurrentBreakpoint] = useState<string>('lg');
  
  const childrenWidgets = useMemo(() => {
    return allWidgets.filter(w => w.parentId === widget.id);
  }, [allWidgets, widget.id]);

  const canAddWidgetsToFolder = currentUserRole === 'owner' || currentUserRole === 'editor';
  const isOverallEditable = currentUserRole === 'owner' || currentUserRole === 'editor' || currentUserRole === 'manager';


  const handleLayoutUpdate = (layout: Layout[], allLayouts: {[key: string]: Layout[]}) => {
      onChildrenLayoutChange(widget.id, allLayouts);
  };
  
  const handleResize = (layout: Layout[], oldItem: Layout, newItem: Layout) => {
      const newAllLayouts = {
          ...(childrenLayouts || {}),
          [currentBreakpoint]: layout,
      };
      onChildrenLayoutChange(widget.id, newAllLayouts);
  };

  const processedChildrenLayouts = useMemo(() => {
    const newLayouts = JSON.parse(JSON.stringify(childrenLayouts || {}));
    Object.keys(newLayouts).forEach(bp => {
      newLayouts[bp] = newLayouts[bp]?.map((item: Layout) => {
        const childWidget = childrenWidgets.find(w => w.id === item.i);
        if (childWidget) {
          const defaults = WIDGET_DEFAULTS[childWidget.type];
          return { 
            ...item, 
            minW: (defaults.minW || 1) * 2, 
            minH: (defaults.minH || 1) * 2
          };
        }
        return item;
      }) || [];
    });
    return newLayouts;
  }, [childrenLayouts, childrenWidgets]);

  return (
    <div className="h-full w-full flex flex-col">
      <AnimatePresence initial={false}>
      {!isCollapsed && (
        <motion.div
            key="content"
            initial="collapsed"
            animate="open"
            exit="collapsed"
            variants={{
                open: { opacity: 1, height: 'auto' },
                collapsed: { opacity: 0, height: 0 }
            }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden flex flex-col flex-grow -mx-4 pb-2"
        >
          {childrenWidgets.length === 0 ? (
            <div className="w-full h-full flex-grow p-2 flex">
                <button
                    onClick={() => canAddWidgetsToFolder && onInitiateAddWidget(widget.id)}
                    className={`w-full h-full rounded-xl border-2 border-dashed border-white/10 flex flex-row items-center justify-center p-2 text-center text-text-secondary transition-colors ${canAddWidgetsToFolder ? 'hover:bg-white/5 hover:border-accent/30 hover:text-accent' : 'cursor-default'}`}
                    disabled={!canAddWidgetsToFolder}
                >
                    <Plus size={18} className="mr-2" />
                    <p className="font-medium text-xs">
                        {canAddWidgetsToFolder ? 'Добавить виджет в папку' : 'Папка пуста'}
                    </p>
                </button>
            </div>
          ) : (
            <div className="flex-grow nested-grid px-2">
              <ResponsiveGridLayout
                  className={`layout ${isAnythingDragging ? 'is-dragging' : ''}`}
                  layouts={processedChildrenLayouts}
                  breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
                  cols={NESTED_GRID_COLS}
                  rowHeight={21}
                  compactType="vertical"
                  onLayoutChange={handleLayoutUpdate}
                  onResize={handleResize}
                  onBreakpointChange={setCurrentBreakpoint}
                  draggableHandle=".drag-handle"
                  draggableCancel=".no-drag, input, textarea, button, select"
                  isDroppable={true}
                  margin={[8, 8]}
                  isBounded={true}
                  onDragStart={onDragStart}
                  onDragStop={onDragStop}
                  onResizeStop={onResizeStop}
                  isDraggable={isOverallEditable && !isMobile}
                  isResizable={isOverallEditable && !isMobile}
              >
                  {childrenWidgets.map(child => {
                    const isWidgetEditable = (() => {
                        if (!currentUserRole) return false;
                        if (['owner', 'editor'].includes(currentUserRole)) return true;
                        if (currentUserRole === 'manager') {
                            return child.assignedUser === currentUser?.uid;
                        }
                        return false;
                    })();

                    return (
                      <div key={child.id} id={`widget-${child.id}`} style={{ overflow: 'visible' }}>
                          <WidgetWrapper
                              widget={child}
                              onRemove={() => onRemoveWidget(child.id)}
                              onCopy={() => onCopyWidget(child.id)}
                              onUpdateWidgetData={onUpdateWidgetData}
                              onToggleFolder={() => onToggleFolder(child.id)}
                              onInitiateAddWidget={onInitiateAddWidget}
                              isNested={true}
                              currentUser={currentUser}
                              currentUserRole={currentUserRole}
                              projectUsers={projectUsers}
                              isProjectTeam={isProjectTeam}
                              isWidgetEditable={isWidgetEditable}
                              onToggleCommentPane={onToggleCommentPane}
                          >
                            <Suspense fallback={<div className="w-full h-full flex items-center justify-center text-xs text-gray-400">Загрузка...</div>}>
                                {renderWidget(child, allWidgets, isWidgetEditable)}
                            </Suspense>
                          </WidgetWrapper>
                      </div>
                    )
                  })}
              </ResponsiveGridLayout>
            </div>
          )}
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
};

export default React.memo(FolderWidget);