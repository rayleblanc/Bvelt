import React from 'react';
import { motion } from 'motion/react';

interface ConfettiPieceProps {
  x: number;
  y: number;
  color: string;
  delay: number;
  duration: number;
  size: number;
  rotate: number;
}

const COLORS = [
  '#f59e0b', // amber-500
  '#eab308', // yellow-500
  '#3b82f6', // blue-500
  '#10b981', // emerald-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#f43f5e'  // rose-500
];

const generateConfetti = (count: number) => {
  const pieces: ConfettiPieceProps[] = [];
  for (let i = 0; i < count; i++) {
    pieces.push({
      x: Math.random() * 100, // percentage width
      y: -20 - Math.random() * 50, // above the screen
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      delay: Math.random() * 2,
      duration: 3 + Math.random() * 3,
      size: 6 + Math.random() * 8,
      rotate: Math.random() * 360
    });
  }
  return pieces;
};

export const Confetti: React.FC = () => {
  const [pieces] = React.useState(() => generateConfetti(80));
  const [visible, setVisible] = React.useState(true);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-[160]">
      {pieces.map((p, idx) => (
        <motion.div
          key={idx}
          initial={{ 
            x: `${p.x}%`, 
            y: `${p.y}px`, 
            rotate: p.rotate, 
            opacity: 1 
          }}
          animate={{ 
            y: '120vh', 
            rotate: p.rotate + 720, 
            opacity: [1, 1, 1, 0.8, 0] 
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            ease: [0.25, 0.46, 0.45, 0.94], // easeOutQuad
            repeat: 0
          }}
          style={{
            position: 'absolute',
            width: `${p.size}px`,
            height: `${p.size * (Math.random() > 0.5 ? 1.5 : 0.6)}px`, // some rectangular, some square
            backgroundColor: p.color,
            borderRadius: Math.random() > 0.7 ? '50%' : '2px', // some circles, some rectangles
          }}
        />
      ))}
    </div>
  );
};
