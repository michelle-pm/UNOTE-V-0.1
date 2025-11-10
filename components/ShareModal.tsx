import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, UserPlus, Crown, ChevronDown } from 'lucide-react';
import { Project, ProjectMemberRole, User } from '../types';
import { useAuth } from '../contexts/AuthContext';
import GlassButton from './GlassButton';
import { db } from '../firebase';
import { doc, updateDoc, arrayUnion, arrayRemove, collection, query, where, getDocs, deleteField } from 'firebase/firestore';


interface ShareModalProps {
  project: Project;
  projectUsers: User[];
  onClose: () => void;
  onUpdateProject: (updatedProject: Project) => void; // This prop might be removed if updates are direct
}

const ShareModal: React.FC<ShareModalProps> = ({ project, projectUsers, onClose }) => {
  const { user: currentUser } = useAuth();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<ProjectMemberRole>('visitor');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const owner = projectUsers.find(u => u.uid === project.owner_uid);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const emailToInvite = inviteEmail.trim().toLowerCase();
    if (!emailToInvite) return;
    if (emailToInvite === currentUser?.email) {
      setError("Вы не можете пригласить самого себя.");
      return;
    }

    const isAlreadyParticipant = projectUsers.some(u => u.email === emailToInvite);
    if (isAlreadyParticipant) {
        setError("Этот пользователь уже имеет доступ.");
        return;
    }
    
    // Find user by email in Firestore
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("email", "==", emailToInvite));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        setError("Пользователь с таким email не найден.");
        return;
    }
    const userToInviteDoc = querySnapshot.docs[0];
    const userToInviteUid = userToInviteDoc.id;

    const projectRef = doc(db, "projects", project.id);
    await updateDoc(projectRef, {
        [`member_uids.${userToInviteUid}`]: inviteRole,
        participant_uids: arrayUnion(userToInviteUid),
        isTeamProject: true,
    });
    
    setSuccess(`Пользователь ${emailToInvite} приглашен.`);
    setInviteEmail('');
  };

  const handleRoleChange = async (uid: string, role: ProjectMemberRole) => {
    const projectRef = doc(db, "projects", project.id);
    await updateDoc(projectRef, {
        [`member_uids.${uid}`]: role,
    });
  };

  const handleRemoveUser = async (uid: string) => {
    const projectRef = doc(db, "projects", project.id);
    await updateDoc(projectRef, {
        [`member_uids.${uid}`]: deleteField(),
        participant_uids: arrayRemove(uid),
    });
  };

  const members = projectUsers.filter(u => u.uid !== project.owner_uid);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 50, scale: 0.9 }}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg"
      >
        <div className="bg-black/20 backdrop-blur-2xl rounded-3xl shadow-2xl p-8 border border-glass-border text-text-light">
          <div className="flex justify-between items-center mb-6">
            <div>
                <h2 className="text-2xl font-bold">Поделиться "{project.name}"</h2>
                <p className="text-sm text-text-secondary">Управляйте доступом к вашему проекту</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10">
              <X size={24} />
            </button>
          </div>

          <form onSubmit={handleInvite} className="flex items-center gap-2 mb-6">
            <input
              type="email"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              placeholder="Email пользователя"
              className="flex-grow w-full p-3 bg-white/5 rounded-lg border-2 border-transparent focus:border-accent focus:outline-none transition-colors"
              required
            />
            <div className="relative">
                <select value={inviteRole} onChange={e => setInviteRole(e.target.value as ProjectMemberRole)} className="appearance-none w-full p-3 bg-white/5 rounded-lg border-2 border-transparent focus:border-accent focus:outline-none transition-colors pr-8">
                    <option value="visitor">Посетитель</option>
                    <option value="manager">Менеджер</option>
                    <option value="editor">Редактор</option>
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <GlassButton type="submit" className="p-3">
              <UserPlus size={18} />
            </GlassButton>
          </form>

          {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}
          {success && <p className="text-green-500 text-sm mb-4 text-center">{success}</p>}

          <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
            {/* Owner */}
            {owner && (
                <div className="flex items-center justify-between p-2 rounded-md">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
                            <Crown size={16} className="text-accent" />
                        </div>
                        <div>
                            <p className="font-semibold">{owner.displayName}</p>
                            <p className="text-xs text-text-secondary">{owner.email}</p>
                        </div>
                    </div>
                    <p className="text-sm font-semibold text-text-secondary">Владелец</p>
                </div>
            )}

            {/* Members */}
            {members.map((user) => (
              <div key={user.uid} className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center font-bold">
                        {user.displayName?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                    </div>
                    <div>
                        <p className="font-semibold">{user.displayName}</p>
                        <p className="text-xs text-text-secondary">{user.email}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <select value={project.member_uids[user.uid]} onChange={e => handleRoleChange(user.uid, e.target.value as ProjectMemberRole)} className="appearance-none text-sm p-2 bg-white/10 rounded-lg border-2 border-transparent focus:border-accent focus:outline-none transition-colors pr-8">
                            <option value="visitor">Посетитель</option>
                            <option value="manager">Менеджер</option>
                            <option value="editor">Редактор</option>
                        </select>
                        <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                    <button onClick={() => handleRemoveUser(user.uid)} className="p-2 text-red-500/80 hover:text-red-500 rounded-full hover:bg-red-500/10">
                        <X size={16} />
                    </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </>
  );
};

export default ShareModal;