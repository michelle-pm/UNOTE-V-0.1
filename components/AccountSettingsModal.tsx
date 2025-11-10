import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import GlassButton from './GlassButton';

interface AccountSettingsModalProps {
  onClose: () => void;
  activeProjectName: string;
}

const AccountSettingsModal: React.FC<AccountSettingsModalProps> = ({ onClose, activeProjectName }) => {
  const { user, updateUser, changePassword } = useAuth();
  const [name, setName] = useState(user?.displayName || '');
  const [isSaved, setIsSaved] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (user && name.trim() !== user.displayName) {
      updateUser({ displayName: name.trim() });
    }
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword !== confirmPassword) {
        setPasswordError('Новые пароли не совпадают.');
        return;
    }

    try {
        changePassword(currentPassword, newPassword);
        setPasswordSuccess('Пароль успешно изменен!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setPasswordSuccess(''), 3000);
    } catch (err: any) {
        setPasswordError(err.message || 'Произошла ошибка при смене пароля.');
    }
  };
  
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 50, scale: 0.9 }}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md"
      >
        <div className="bg-[#1a202c] text-text-light rounded-2xl shadow-2xl p-8 border border-glass-border max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Настройки аккаунта</h2>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10">
              <X size={24} />
            </button>
          </div>
          
          <form onSubmit={handleNameSubmit}>
              <div className="mb-4">
                  <label htmlFor="name" className="block text-sm font-medium mb-2">Имя</label>
                  <input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full p-3 bg-white/10 rounded-lg border-2 border-transparent focus:border-accent focus:outline-none transition-colors"
                  />
              </div>
              <div className="mb-6">
                  <label htmlFor="email" className="block text-sm font-medium mb-2">Email</label>
                  <input
                      id="email"
                      type="email"
                      value={user?.email || ''}
                      disabled
                      className="w-full p-3 bg-white/10 rounded-lg border-2 border-transparent focus:outline-none transition-colors opacity-60 cursor-not-allowed"
                  />
              </div>

              <div className="flex items-center justify-end gap-4">
                <AnimatePresence>
                {isSaved && (
                    <motion.p
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        className="text-green-400 text-sm font-semibold"
                    >
                        Сохранено!
                    </motion.p>
                )}
                </AnimatePresence>
                  <GlassButton type="submit">
                      Сохранить
                  </GlassButton>
              </div>
          </form>

          <div className="my-8 border-t border-glass-border"></div>

            <h3 className="text-xl font-bold mb-4">Смена пароля</h3>
            <form onSubmit={handlePasswordSubmit}>
                <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">Текущий пароль</label>
                    <div className="relative">
                        <input
                            type={showPasswords.current ? 'text' : 'password'}
                            value={currentPassword}
                            onChange={e => setCurrentPassword(e.target.value)}
                            className="w-full p-3 bg-white/10 rounded-lg border-2 border-transparent focus:border-accent focus:outline-none transition-colors pr-10"
                            required
                        />
                         <button type="button" onClick={() => setShowPasswords(prev => ({...prev, current: !prev.current}))} className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-white">
                            {showPasswords.current ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                    </div>
                </div>
                 <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">Новый пароль</label>
                    <div className="relative">
                        <input
                            type={showPasswords.new ? 'text' : 'password'}
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                            className="w-full p-3 bg-white/10 rounded-lg border-2 border-transparent focus:border-accent focus:outline-none transition-colors pr-10"
                            required
                        />
                         <button type="button" onClick={() => setShowPasswords(prev => ({...prev, new: !prev.new}))} className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-white">
                            {showPasswords.new ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                    </div>
                </div>
                 <div className="mb-6">
                    <label className="block text-sm font-medium mb-2">Подтвердите пароль</label>
                    <div className="relative">
                        <input
                            type={showPasswords.confirm ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            className="w-full p-3 bg-white/10 rounded-lg border-2 border-transparent focus:border-accent focus:outline-none transition-colors pr-10"
                            required
                        />
                        <button type="button" onClick={() => setShowPasswords(prev => ({...prev, confirm: !prev.confirm}))} className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-white">
                            {showPasswords.confirm ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-4 h-5">
                    <AnimatePresence>
                    {passwordError && <motion.p initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="text-red-500 text-sm flex-grow">{passwordError}</motion.p>}
                    {passwordSuccess && <motion.p initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="text-green-400 text-sm flex-grow">{passwordSuccess}</motion.p>}
                    </AnimatePresence>
                    <GlassButton type="submit">
                        Сменить пароль
                    </GlassButton>
                </div>
            </form>

        </div>
      </motion.div>
    </>
  );
};

export default AccountSettingsModal;