import React, { useMemo, useState, useEffect, useContext } from 'react';
import { PlanData } from '../../types';
import Confetti from '../Confetti';
import { motion, AnimatePresence } from 'framer-motion';
import { WidgetSizeContext } from '../WidgetWrapper';

interface PlanWidgetProps {
  data: PlanData;
  updateData: (data: PlanData) => void;
  isEditable: boolean;
}

const PlanWidget: React.FC<PlanWidgetProps> = ({ data, updateData, isEditable }) => {
  const { current, target, unit, customUnit, color, color2 } = data;
  const [showConfetti, setShowConfetti] = useState(false);
  const { width } = useContext(WidgetSizeContext);

  const percentage = useMemo(() => {
    if (unit === '%') {
        return Math.min(Math.max(current, 0), 100);
    }
    if (target <= 0) return 0;
    return Math.min(Math.max((current / target) * 100, 0), 100);
  }, [current, target, unit]);

  useEffect(() => {
    if (percentage >= 100) {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [percentage]);
  
  const handleUpdate = (field: keyof PlanData, value: string | number) => {
    let new_data: PlanData = {...data, [field]: value}
    if (field === 'current' || field === 'target') {
        new_data = {...new_data, [field]: parseFloat(value as string) || 0}
    }
    updateData(new_data);
  };
  
  const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => event.target.select();
  
  const formattedUnit = unit === 'custom' ? customUnit : unit;

  const percentageFontSize = useMemo(() => {
    if (!width) return '3.75rem'; // fallback for text-6xl
    // Responsive font size based on widget width, with min and max values
    return `${Math.max(24, Math.min(width / 4, 96))}px`;
  }, [width]);

  return (
    <div className="h-full flex flex-col justify-between relative text-sm">
      <AnimatePresence>{showConfetti && <Confetti />}</AnimatePresence>
      
      <div className="flex-grow flex flex-col justify-center items-center text-center -mt-2">
        <div 
            className="font-bold bg-clip-text text-transparent"
            style={{ 
              backgroundImage: `linear-gradient(to right, ${color}, ${color2})`,
              fontSize: percentageFontSize,
              lineHeight: 1.1
            }}
        >
            {percentage.toFixed(0)}%
        </div>
      </div>

      <div className="w-full">
        <div className="w-full bg-transparent rounded-full h-2.5 my-2">
            <div className="w-full bg-white/10 rounded-full h-2.5 relative">
                <motion.div
                    className="h-2.5 rounded-full absolute top-0 left-0"
                    style={{ backgroundImage: `linear-gradient(to right, ${color}, ${color2})` }}
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ type: 'spring', stiffness: 100, damping: 20 }}
                />
            </div>
        </div>

        <div className="flex justify-around items-start w-full font-medium mt-2 text-center">
            <div className="flex flex-col items-center">
                 <input 
                    type="number" 
                    value={current}
                    onChange={(e) => handleUpdate('current', e.target.value)}
                    onFocus={handleFocus}
                    disabled={!isEditable}
                    className="bg-transparent w-full text-center focus:outline-none p-1 text-base font-semibold rounded-md hover:bg-white/5 focus:bg-white/10 transition-colors disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                    aria-label="Текущее значение"
                />
                <span className="text-xs text-text-secondary">Текущее {unit !== '%' && `(${formattedUnit})`}</span>
            </div>
            <AnimatePresence>
            {unit !== '%' && (
                <motion.div 
                    initial={{opacity:0, scale: 0.9}} 
                    animate={{opacity:1, scale: 1}} 
                    exit={{opacity:0, scale: 0.9}}
                    transition={{duration: 0.2}}
                    className="w-full"
                >
                    <div className="flex flex-col items-center">
                        <input 
                            type="number"
                            value={target}
                            onChange={(e) => handleUpdate('target', e.target.value)}
                            onFocus={handleFocus}
                            disabled={!isEditable}
                            className="bg-transparent w-full text-center focus:outline-none p-1 text-base font-semibold rounded-md hover:bg-white/5 focus:bg-white/10 transition-colors disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                             aria-label="Целевое значение"
                        />
                         <span className="text-xs text-text-secondary">Цель ({formattedUnit})</span>
                    </div>
                </motion.div>
            )}
            </AnimatePresence>
        </div>
      </div>

      <div className="absolute -bottom-2 -right-2">
        <div className="flex items-center gap-1">
            <AnimatePresence>
            {unit === 'custom' && (
                <motion.div initial={{width: 0, opacity: 0}} animate={{width: 'auto', opacity: 1}} exit={{width: 0, opacity: 0}}>
                    <input 
                        type="text"
                        value={customUnit}
                        onChange={(e) => handleUpdate('customUnit', e.target.value)}
                        onFocus={handleFocus}
                        disabled={!isEditable}
                        className="bg-transparent w-16 text-right font-semibold text-text-secondary/80 focus:outline-none p-1 rounded-md hover:bg-white/5 text-xs disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                    />
                </motion.div>
            )}
            </AnimatePresence>
            <select
                value={unit}
                onChange={(e) => handleUpdate('unit', e.target.value)}
                disabled={!isEditable}
                className="bg-transparent font-semibold text-text-secondary/80 focus:outline-none no-drag p-1 rounded-md hover:bg-white/5 text-xs disabled:opacity-70 disabled:cursor-not-allowed"
            >
                <option value="%">%</option>
                <option value="₽">₽</option>
                <option value="custom">Другое</option>
            </select>
        </div>
    </div>

    </div>
  );
};

export default React.memo(PlanWidget);