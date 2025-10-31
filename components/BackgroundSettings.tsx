import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { Upload, Trash2 } from 'lucide-react';

interface BackgroundSettingsProps {
    bgImage: string | null;
    setBgImage: (value: string | null) => void;
    bgBlur: number;
    setBgBlur: (value: number) => void;
    onClose: () => void;
}

const BackgroundSettings: React.FC<BackgroundSettingsProps> = ({
    bgImage, setBgImage, bgBlur, setBgBlur, onClose
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                setBgImage(e.target?.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const triggerFileInput = () => {
        fileInputRef.current?.click();
    };

    const removeImage = () => {
        setBgImage(null);
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className="absolute bottom-full left-0 mb-2 w-72 bg-[#1a202c] rounded-lg shadow-xl z-50 p-4 border border-glass-border"
        >
            <h4 className="font-semibold mb-3">Настройки фона</h4>
            
            <div className="flex items-center gap-2 mb-4">
                <button
                    onClick={triggerFileInput}
                    className="flex-grow flex items-center justify-center gap-2 px-3 py-2 text-sm bg-white/5 hover:bg-white/10 rounded-md transition-colors"
                >
                    <Upload size={16} />
                    <span>{bgImage ? 'Изменить' : 'Загрузить'}</span>
                </button>
                {bgImage && (
                     <button
                        onClick={removeImage}
                        className="flex-shrink-0 p-2 text-sm bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-md transition-colors"
                    >
                        <Trash2 size={16} />
                    </button>
                )}
            </div>
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
            />

            <div className="space-y-2">
                <label htmlFor="blur-slider" className="text-sm font-medium">Размытие</label>
                <div className='flex items-center gap-2'>
                    <input
                        id="blur-slider"
                        type="range"
                        min="0"
                        max="40"
                        step="1"
                        value={bgBlur}
                        onChange={(e) => setBgBlur(Number(e.target.value))}
                        className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
                        disabled={!bgImage}
                    />
                    <span className='text-xs font-mono w-6 text-right'>{bgBlur}</span>
                </div>
            </div>

        </motion.div>
    );
};

export default BackgroundSettings;
