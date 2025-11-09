import { Layout } from 'react-grid-layout';
import { Timestamp } from 'firebase/firestore';

// Basic types
export type ProjectMemberRole = 'visitor' | 'manager' | 'editor';

export interface User {
  uid: string;
  name: string;
  email: string;
}

// Widget Types Enum
export enum WidgetType {
  Plan = 'plan',
  Pie = 'pie',
  Line = 'line',
  Text = 'text',
  Title = 'title',
  Checklist = 'checklist',
  Image = 'image',
  Article = 'article',
  Folder = 'folder',
  Table = 'table',
  Goal = 'goal',
  File = 'file'
}

// Widget Data Interfaces
export interface BaseWidgetData {
  title: string;
}

export interface PlanData extends BaseWidgetData {
  current: number;
  target: number;
  unit: '%' | '₽' | 'custom';
  customUnit: string;
  color: string;
  color2: string;
  userSetColors?: boolean;
}

export interface PieChartItem {
  id: string;
  part: number;
  total: number;
  partLabel: string;
  totalLabel: string;
}

export interface PieData extends BaseWidgetData {
  charts: PieChartItem[];
  color1: string;
  color2: string;
  userSetColors?: boolean;
}

export type DependencyDataKey = 'current' | 'target' | 'part' | 'total';

export interface LineDataPoint {
  id: string;
  x: string;
  y: number;
  dependency?: {
    widgetId: string;
    dataKey: DependencyDataKey;
  };
}

export interface LineSeries {
  name: string;
  data: LineDataPoint[];
}

export interface LineData extends BaseWidgetData {
  series: LineSeries[];
  color: string;
  color2: string;
  userSetColors?: boolean;
}

export interface TextData extends BaseWidgetData {
  content: string;
}

export interface TitleData {
  title: string;
  fontSize?: 'sm' | 'md' | 'lg' | 'xl';
  textAlign?: 'left' | 'center' | 'right';
}

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface ChecklistData extends BaseWidgetData {
  items: ChecklistItem[];
}

export interface ImageData extends BaseWidgetData {
  src: string | null;
}

export interface ArticleData extends BaseWidgetData {
  content: string;
}

export interface FolderData extends BaseWidgetData {
  isCollapsed: boolean;
  childrenLayouts?: { [key: string]: Layout[] };
  expandedH?: number;
}

export interface TableCell {
  columnId: string;
  value: string;
}

export interface TableRow {
  id: string;
  cells: TableCell[];
}

export interface TableColumn {
  id: string;
  header: string;
}

export interface TableData extends BaseWidgetData {
  columns: TableColumn[];
  rows: TableRow[];
}

export interface GoalData extends BaseWidgetData {
    goal: string;
    dueDate: string | null;
    completed: boolean;
}

export interface FileObject {
    id: string;
    name: string;
    url: string;
    fileType: string;
}

export interface FileData extends BaseWidgetData {
    files: FileObject[];
}

// Union type for all widget data
export type WidgetData =
  | PlanData
  | PieData
  | LineData
  | TextData
  | TitleData
  | ChecklistData
  | ImageData
  | ArticleData
  | FolderData
  | TableData
  | GoalData
  | FileData;

// Main Widget Interface
export interface Widget {
  id: string;
  type: WidgetType;
  data: WidgetData;
  parentId?: string;
  minW: number;
  minH: number;
  assignedUser?: string | null; // This will store user UID
}

// Project Interface
export interface Project {
  id: string;
  name: string;
  emoji: string;
  owner_uid: string;
  member_uids: { [uid: string]: ProjectMemberRole };
  participant_uids: string[];
  isTeamProject: boolean;
  widgets: Widget[];
  layouts: { [key: string]: Layout[] };
}

// Comment Interface
export interface Comment {
  id: string;
  widgetId: string;
  authorUid: string;
  authorName: string; // denormalized for easy display
  content: string;
  createdAt: Timestamp;
  mentions: string[]; // array of UIDs
}

// Friend Request Interface
export interface FriendRequest {
  id: string;
  from: string;
  fromName: string;
  fromEmail: string;
  to: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Timestamp;
}


// Messaging Interfaces
export enum MessageType {
  Text = 'text',
  Image = 'image',
  Video = 'video',
  Audio = 'audio',
  File = 'file',
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string; // denormalized
  type: MessageType;
  content: string; // for text, or file name for others
  fileUrl?: string; // base64 data URL
  fileType?: string; // mime type
  audioDuration?: number; // in seconds
  timestamp: Timestamp;
}

export interface Chat {
  id: string;
  type: 'private' | 'group';
  participants: string[];
  participantInfo: { [uid: string]: { name: string, email: string }}; // Denormalized user info
  name?: string; // for group chats
  avatar?: string; // emoji for group chats
  lastMessage?: {
    text: string;
    timestamp: Timestamp;
    senderId: string;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}