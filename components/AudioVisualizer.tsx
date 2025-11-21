import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  isPlaying: boolean;
  color?: string;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ isPlaying, color = '#3b82f6' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bars = 50;
    const barWidth = canvas.width / bars;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      for (let i = 0; i < bars; i++) {
        // Generate random height if playing, else flat line
        const height = isPlaying 
          ? Math.random() * canvas.height * 0.8 
          : 2;
        
        // Calculate x position
        const x = i * barWidth;
        // Center y position
        const y = (canvas.height - height) / 2;

        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, '#8b5cf6'); // purple-500

        ctx.fillStyle = gradient;
        // Rounded caps look
        ctx.beginPath();
        ctx.roundRect(x + 2, y, barWidth - 4, height, 4);
        ctx.fill();
      }

      if (isPlaying) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        // Draw one last stationary frame
         ctx.clearRect(0, 0, canvas.width, canvas.height);
         for (let i = 0; i < bars; i++) {
            const height = 4;
            const x = i * barWidth;
            const y = (canvas.height - height) / 2;
            ctx.fillStyle = '#334155';
            ctx.fillRect(x + 2, y, barWidth - 4, height);
         }
      }
    };

    animate();

    return () => cancelAnimationFrame(animationRef.current);
  }, [isPlaying, color]);

  return (
    <canvas 
      ref={canvasRef} 
      width={600} 
      height={60} 
      className="w-full h-16 rounded-lg opacity-80"
    />
  );
};

export default AudioVisualizer;