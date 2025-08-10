import React, { useRef, useEffect } from 'react';

interface GestureDrawCanvasProps {
    points: { x: number; y: number }[];
    isDrawing: boolean;
    resultText: string | null;
}

const GestureDrawCanvas: React.FC<GestureDrawCanvasProps> = ({ points, isDrawing, resultText }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const resultFadeTimeout = useRef<number | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Resize canvas to fit window
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (points.length > 1) {
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';

            // Draw the trail
            for (let i = 1; i < points.length; i++) {
                const start = points[i - 1];
                const end = points[i];
                const progress = i / points.length;
                
                ctx.beginPath();
                ctx.moveTo(start.x, start.y);
                ctx.lineTo(end.x, end.y);
                
                // Style
                ctx.strokeStyle = `rgba(255, 165, 0, ${0.1 + progress * 0.7})`;
                ctx.lineWidth = 5 + progress * 15;
                ctx.shadowColor = 'rgba(255, 100, 0, 0.8)';
                ctx.shadowBlur = 15;

                ctx.stroke();
            }
        }
    }, [points]);

    useEffect(() => {
        if(resultFadeTimeout.current) {
            clearTimeout(resultFadeTimeout.current);
            resultFadeTimeout.current = null;
        }
    }, [resultText]);
    
    const isSuccess = resultText && !resultText.toLowerCase().includes('failed');
    const resultClasses = [
      "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
      "text-3xl font-bold tracking-widest pointer-events-none transition-all duration-1000",
      resultText ? "opacity-100 scale-100" : "opacity-0 scale-125",
      isSuccess ? "text-cyan-300 text-shadow-glow-cyan" : "text-red-400 text-shadow-glow-red"
    ].join(' ');

    return (
        <>
        <canvas ref={canvasRef} className={`absolute inset-0 z-50 pointer-events-none transition-opacity duration-500 ${isDrawing ? 'opacity-100' : 'opacity-0'}`} />
        <div className={resultClasses}>
            {resultText}
        </div>
         <style>{`
            .text-shadow-glow-cyan {
                text-shadow: 0 0 5px #0ff, 0 0 10px #0ff, 0 0 20px #0ff;
            }
             .text-shadow-glow-red {
                text-shadow: 0 0 5px #f00, 0 0 10px #f00, 0 0 20px #f00;
            }
         `}</style>
        </>
    );
};

export default GestureDrawCanvas;
