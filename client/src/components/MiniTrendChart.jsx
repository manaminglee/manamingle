import React from 'react';

export const MiniTrendChart = ({ data = [12, 18, 15, 25, 20, 35, 45], color = "#06b6d4" }) => {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const width = 200;
  const height = 60;
  const step = width / (data.length - 1);

  const points = data.map((val, i) => {
    const x = i * step;
    const y = height - ((val - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="w-full h-[80px] bg-white/[0.02] border border-white/5 rounded-2xl p-4 relative overflow-hidden group">
      <div className="flex justify-between items-center mb-2 px-1">
          <span className="text-[8px] font-black uppercase text-white/20 tracking-widest italic group-hover:text-cyan-400 transition-colors">Growth Terminal</span>
          <span className="text-[8px] font-black text-emerald-400 uppercase italic animate-pulse">Live Tracking</span>
      </div>
      <svg width="100%" height="40" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="overflow-visible">
        <defs>
          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
          className="drop-shadow-[0_0_8px_var(--chart-color)]"
          style={{ '--chart-color': color }}
        />
        <polygon
          points={`${width},${height} 0,${height} ${points}`}
          fill="url(#chartGradient)"
        />
        {/* Animated indicator on the last point */}
        <circle 
          cx={width} 
          cy={height - ((data[data.length-1] - min) / range) * height} 
          r="3" 
          fill={color} 
          className="animate-pulse shadow-[0_0_10px_white]"
        />
      </svg>
    </div>
  );
};
