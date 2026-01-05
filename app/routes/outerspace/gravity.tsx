import React, { useState, useEffect, useRef } from 'react';
import { Rocket, Weight, Ruler, Thermometer, Info, ArrowRight, RotateCw, Play, Calculator, MousePointer2, Move } from 'lucide-react';
import type { Route } from "./+types/gravity";

// Meta 設定
export function meta({}: Route.MetaArgs) {
  return [
    { title: "Gravity Lab // 行星重力實驗室" },
    { name: "description", content: "計算與模擬太陽系行星重力" },
  ];
}

// 定義行星資料介面
interface PlanetBody {
  id: string;
  englishName: string;
  gravity: number;
  meanRadius: number;
  avgTemp: number;
  density: number;
  moons: { moon: string; rel: string }[] | null;
}

// 靜態備用數據
const FALLBACK_DATA: PlanetBody[] = [
  { id: 'mercury', englishName: 'Mercury', gravity: 3.7, meanRadius: 2439.7, avgTemp: 440, density: 5.427, moons: null },
  { id: 'venus', englishName: 'Venus', gravity: 8.87, meanRadius: 6051.8, avgTemp: 737, density: 5.243, moons: null },
  { id: 'earth', englishName: 'Earth', gravity: 9.8, meanRadius: 6371, avgTemp: 288, density: 5.514, moons: [{ moon: 'Moon', rel: '' }] },
  { id: 'moon', englishName: 'Moon', gravity: 1.62, meanRadius: 1737.1, avgTemp: 220, density: 3.344, moons: null },
  { id: 'mars', englishName: 'Mars', gravity: 3.71, meanRadius: 3389.5, avgTemp: 210, density: 3.933, moons: [{ moon: 'Phobos', rel: '' }, { moon: 'Deimos', rel: '' }] },
  { id: 'jupiter', englishName: 'Jupiter', gravity: 24.79, meanRadius: 69911, avgTemp: 165, density: 1.326, moons: Array(79).fill({ moon: 'x', rel: '' }) },
  { id: 'saturn', englishName: 'Saturn', gravity: 10.44, meanRadius: 58232, avgTemp: 134, density: 0.687, moons: Array(82).fill({ moon: 'x', rel: '' }) },
  { id: 'uranus', englishName: 'Uranus', gravity: 8.69, meanRadius: 25362, avgTemp: 76, density: 1.271, moons: Array(27).fill({ moon: 'x', rel: '' }) },
  { id: 'neptune', englishName: 'Neptune', gravity: 11.15, meanRadius: 24622, avgTemp: 72, density: 1.638, moons: Array(14).fill({ moon: 'x', rel: '' }) },
  { id: 'pluto', englishName: 'Pluto', gravity: 0.62, meanRadius: 1188.3, avgTemp: 44, density: 1.88, moons: Array(5).fill({ moon: 'x', rel: '' }) },
];

// --- 物理模擬畫布組件 ---
const GravityPlayground = ({ gravity, planetName }: { gravity: number, planetName: string }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 物理狀態
  const physicsRef = useRef({
    x: 100, y: 100, // 位置
    vx: 5, vy: 0,   // 速度
    radius: 30,
    isDragging: false,
    lastX: 0, lastY: 0, // 用於計算投擲速度
    trail: [] as {x: number, y: number, alpha: number}[] // 軌跡
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 調整畫布大小
    const resize = () => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    let animationId: number;
    const scale = 20; // 物理縮放比例 (1 meter = 20 pixels)

    const update = () => {
      const p = physicsRef.current;
      const width = canvas.width;
      const height = canvas.height;

      // 清空畫布
      ctx.fillStyle = '#0f172a'; // slate-950
      ctx.fillRect(0, 0, width, height);

      // 繪製背景網格 (每 100px)
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for(let i=0; i<width; i+=100) { ctx.moveTo(i,0); ctx.lineTo(i,height); }
      for(let i=0; i<height; i+=100) { ctx.moveTo(0,i); ctx.lineTo(width,i); }
      ctx.stroke();

      // --- 物理運算 ---
      if (!p.isDragging) {
        // 重力 (Gravity) - F = ma
        // 這裡簡化為速度每幀增加 (gravity * scale * dt)
        // 假設 60fps, dt 約 0.016s
        p.vy += (gravity * scale) * 0.016; 
        
        // 空氣阻力 (Air Resistance) - 簡單模擬
        p.vx *= 0.99;
        p.vy *= 0.99;

        // 更新位置
        p.x += p.vx;
        p.y += p.vy;

        // 地板碰撞 (Bounce)
        if (p.y + p.radius > height) {
          p.y = height - p.radius;
          p.vy *= -0.7; // 彈性係數 (損失能量)
          // 防止在地板微小抖動
          if (Math.abs(p.vy) < gravity) p.vy = 0;
          // 地板摩擦力
          p.vx *= 0.9;
        }
        // 天花板碰撞
        if (p.y - p.radius < 0) {
          p.y = p.radius;
          p.vy *= -0.7;
        }
        // 牆壁碰撞
        if (p.x + p.radius > width) {
          p.x = width - p.radius;
          p.vx *= -0.7;
        }
        if (p.x - p.radius < 0) {
          p.x = p.radius;
          p.vx *= -0.7;
        }
      }

      // --- 繪製軌跡 ---
      if (Math.abs(p.vx) > 0.1 || Math.abs(p.vy) > 0.1 || p.isDragging) {
         p.trail.push({ x: p.x, y: p.y, alpha: 1.0 });
      }
      if (p.trail.length > 50) p.trail.shift(); // 限制軌跡長度

      p.trail.forEach((point, index) => {
        point.alpha -= 0.02; // 慢慢消失
        if (point.alpha > 0) {
          ctx.beginPath();
          ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(99, 102, 241, ${point.alpha})`; // Indigo color
          ctx.fill();
        }
      });
      // 清理完全消失的點
      p.trail = p.trail.filter(t => t.alpha > 0);

      // --- 繪製物體 (箱子) ---
      ctx.save();
      ctx.translate(p.x, p.y);
      // 根據速度稍微旋轉 (視覺效果)
      if (!p.isDragging) ctx.rotate((p.vx * 0.1)); 
      
      // 箱子本體
      ctx.fillStyle = p.isDragging ? '#818cf8' : '#6366f1'; // indigo-400 / indigo-500
      ctx.shadowColor = 'rgba(99, 102, 241, 0.5)';
      ctx.shadowBlur = 20;
      // 畫圓角矩形
      ctx.beginPath();
      ctx.roundRect(-p.radius, -p.radius, p.radius*2, p.radius*2, 10);
      ctx.fill();
      
      // 箱子上的文字 (重力值)
      ctx.fillStyle = 'white';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${gravity}g`, 0, 0);
      
      ctx.restore();

      // --- 繪製互動提示 ---
      if (!p.isDragging && Math.abs(p.vx) < 0.5 && Math.abs(p.vy) < 0.5 && p.y > height - p.radius - 5) {
         ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
         ctx.font = '12px sans-serif';
         ctx.textAlign = 'center';
         ctx.fillText("Drag me!", p.x, p.y - p.radius - 15);
      }

      animationId = requestAnimationFrame(update);
    };

    animationId = requestAnimationFrame(update);
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, [gravity]); // 當重力改變時，這個 effect 不需要重啟，但 gravity 變數會在 render loop 中被讀取

  // --- 滑鼠互動處理 ---
  const handlePointerDown = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const p = physicsRef.current;
    const dist = Math.sqrt((mouseX - p.x) ** 2 + (mouseY - p.y) ** 2);

    if (dist < p.radius * 2) { // 增加一點判定範圍比較好抓
      p.isDragging = true;
      p.vx = 0;
      p.vy = 0;
      canvas.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const p = physicsRef.current;
    if (p.isDragging) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      
      // 記錄上一幀位置來計算投擲速度
      p.lastX = p.x;
      p.lastY = p.y;
      
      p.x = e.clientX - rect.left;
      p.y = e.clientY - rect.top;
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const p = physicsRef.current;
    if (p.isDragging) {
      p.isDragging = false;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;
      
      // 計算投擲速度 (簡單的微分)
      // 增加係數讓投擲更有力
      p.vx = (currentX - p.lastX) * 1.5; 
      p.vy = (currentY - p.lastY) * 1.5;
    }
  };

  return (
    <div ref={containerRef} className="w-full h-full min-h-[400px] relative rounded-3xl overflow-hidden border border-slate-700 bg-slate-900 shadow-2xl">
      <div className="absolute top-4 left-4 pointer-events-none select-none z-10">
         <div className="bg-slate-950/80 backdrop-blur px-4 py-2 rounded-lg border border-indigo-500/30 text-indigo-400 font-mono text-sm">
            <div className="flex items-center gap-2 font-bold">
               <RotateCw size={14} className="animate-spin-slow" />
               PHYSICS ENGINE
            </div>
            <div className="text-white text-lg mt-1">PLANET: {planetName}</div>
            <div className="text-slate-400">G-FORCE: {gravity} m/s²</div>
         </div>
      </div>
      <canvas 
        ref={canvasRef}
        className="w-full h-full cursor-grab active:cursor-grabbing touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
    </div>
  );
};

export default function GravityLab() {
  const [userWeight, setUserWeight] = useState<number | string>(60);
  const [planets, setPlanets] = useState<PlanetBody[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlanet, setSelectedPlanet] = useState<PlanetBody | null>(null);
  const [useFallback, setUseFallback] = useState(false);
  const [viewMode, setViewMode] = useState<'calculator' | 'simulation'>('calculator'); // 新增模式切換

  useEffect(() => {
    const fetchPlanets = async () => {
      setLoading(true);
      try {
        const response = await fetch('https://api.le-systeme-solaire.net/rest/bodies?data=id,englishName,gravity,meanRadius,avgTemp,density,moons');
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        const data = await response.json();
        processData(data.bodies);
        setUseFallback(false);
      } catch (error) {
        console.warn("Using offline database.", error);
        processData(FALLBACK_DATA);
        setUseFallback(true);
      } finally {
        setLoading(false);
      }
    };
    fetchPlanets();
  }, []);

  const processData = (rawData: any[]) => {
    const targetPlanets = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'moon'];
    const filtered = rawData.filter((b: any) => targetPlanets.includes(b.englishName.toLowerCase()));
    const orderMap: Record<string, number> = {
        'mercury': 1, 'venus': 2, 'earth': 3, 'moon': 3.5, 'mars': 4, 
        'jupiter': 5, 'saturn': 6, 'uranus': 7, 'neptune': 8, 'pluto': 9
    };
    const sorted = filtered.sort((a: any, b: any) => (orderMap[a.englishName.toLowerCase()] || 10) - (orderMap[b.englishName.toLowerCase()] || 10));
    setPlanets(sorted);
    const mars = sorted.find((p: any) => p.englishName.toLowerCase() === 'mars');
    if (mars && !selectedPlanet) setSelectedPlanet(mars);
  };

  const calculateWeight = (gravity: number) => {
    const weightNum = Number(userWeight);
    if (!weightNum) return 0;
    return (weightNum * (gravity / 9.8)).toFixed(1);
  };

  const getPlanetStyle = (name: string) => {
    const styles: Record<string, string> = {
      Mercury: "bg-stone-400", Venus: "bg-orange-300", Earth: "bg-blue-500", Moon: "bg-gray-300",
      Mars: "bg-red-500", Jupiter: "bg-orange-200", Saturn: "bg-yellow-200", Uranus: "bg-cyan-300",
      Neptune: "bg-blue-600", Pluto: "bg-slate-300",
    };
    return styles[name] || "bg-slate-500";
  };

  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 font-sans selection:bg-indigo-500 selection:text-white pb-20">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <header className="mb-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-center md:text-left">
             <div className="inline-flex items-center gap-2 text-indigo-400 font-bold tracking-widest text-xs mb-2 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
                <Rocket size={14} /> SOLAR SYSTEM LAB
             </div>
             <h1 className="text-3xl md:text-4xl font-bold text-white">Planetary Gravity</h1>
          </div>

          {/* 模式切換按鈕 (Tab Switcher) */}
          <div className="bg-slate-900 p-1 rounded-xl border border-slate-800 flex shadow-lg">
             <button 
                onClick={() => setViewMode('calculator')}
                className={`flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-bold transition-all ${viewMode === 'calculator' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
             >
                <Calculator size={18} /> Weight Analysis
             </button>
             <button 
                onClick={() => setViewMode('simulation')}
                className={`flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-bold transition-all ${viewMode === 'simulation' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
             >
                <Play size={18} /> Physics Sim
             </button>
          </div>
        </header>

        {loading ? (
          <div className="text-center text-indigo-400 animate-pulse py-20">Scanning Solar System...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* 左側：行星導航 (Sidebar) */}
            <div className="lg:col-span-3 space-y-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
               {planets.map(planet => (
                  <button
                    key={planet.id}
                    onClick={() => setSelectedPlanet(planet)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 group ${
                      selectedPlanet?.id === planet.id 
                      ? 'bg-slate-800 border-indigo-500 shadow-lg scale-[1.02]' 
                      : 'bg-slate-900/40 border-slate-800 hover:bg-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full ${getPlanetStyle(planet.englishName)} shadow-inner shrink-0`} />
                    <div className="text-left flex-1 min-w-0">
                      <div className={`font-bold truncate ${selectedPlanet?.id === planet.id ? 'text-white' : 'text-slate-300'}`}>
                        {planet.englishName}
                      </div>
                      <div className="text-xs text-slate-500 font-mono">
                        {planet.gravity} m/s²
                      </div>
                    </div>
                  </button>
                ))}
            </div>

            {/* 右側：主要顯示區 (根據模式切換) */}
            <div className="lg:col-span-9">
              {selectedPlanet && (
                <div className="h-full flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-300">
                  
                  {viewMode === 'calculator' ? (
                    /* --- 模式一：計算器視圖 --- */
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 relative overflow-hidden shadow-2xl">
                      {/* 背景光暈 */}
                      <div className={`absolute -top-32 -right-32 w-96 h-96 rounded-full blur-[120px] opacity-20 ${getPlanetStyle(selectedPlanet.englishName)}`} />
                      
                      <div className="relative z-10">
                        <div className="flex flex-col md:flex-row gap-8 items-start md:items-center justify-between mb-12">
                           <div>
                              <h2 className="text-5xl font-bold text-white mb-2">{selectedPlanet.englishName}</h2>
                              <div className="text-slate-400">Surface Gravity Analysis</div>
                           </div>
                           {/* 體重輸入 */}
                           <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800 flex flex-col items-center">
                              <label className="text-xs text-slate-500 font-bold mb-2 uppercase">Input Earth Weight</label>
                              <div className="flex items-center gap-2">
                                <input 
                                  type="number" 
                                  value={userWeight}
                                  onChange={(e) => setUserWeight(e.target.value)}
                                  className="w-24 bg-transparent text-3xl font-bold text-center text-white focus:outline-none border-b-2 border-slate-700 focus:border-indigo-500 transition-colors"
                                />
                                <span className="text-slate-500 font-bold mt-2">kg</span>
                              </div>
                           </div>
                        </div>

                        {/* 結果展示 */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-2xl p-6 flex flex-col justify-center items-center text-center">
                              <div className="text-slate-400 font-medium mb-1">Weight on {selectedPlanet.englishName}</div>
                              <div className="text-7xl font-bold text-white tracking-tighter drop-shadow-lg">
                                 {calculateWeight(selectedPlanet.gravity)}
                              </div>
                              <div className="text-indigo-400 font-bold mt-2">kilograms</div>
                           </div>
                           
                           <div className="grid grid-cols-2 gap-3">
                              <InfoCard icon={<Weight className="text-blue-400" />} label="Gravity" value={`${selectedPlanet.gravity} m/s²`} sub="Acceleration" />
                              <InfoCard icon={<Thermometer className="text-red-400" />} label="Temp" value={`${(selectedPlanet.avgTemp - 273.15).toFixed(0)}°C`} sub="Average" />
                              <InfoCard icon={<Ruler className="text-green-400" />} label="Radius" value={`${(selectedPlanet.meanRadius).toLocaleString()} km`} sub="Mean Radius" />
                              <InfoCard icon={<Info className="text-purple-400" />} label="Moons" value={selectedPlanet.moons ? selectedPlanet.moons.length : 0} sub="Satellites" />
                           </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* --- 模式二：物理模擬視圖 --- */
                    <div className="h-[500px] lg:h-[600px] flex flex-col gap-4">
                       <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                             <div className="p-2 bg-indigo-500 rounded-lg text-white">
                                <Move size={20} />
                             </div>
                             <div>
                                <h3 className="font-bold text-white">Interactive Chamber</h3>
                                <p className="text-xs text-slate-400">Drag & Throw the box to test gravity</p>
                             </div>
                          </div>
                          <div className="text-right hidden sm:block">
                             <div className="text-2xl font-bold text-indigo-400">{selectedPlanet.gravity} <span className="text-sm text-slate-500">m/s²</span></div>
                             <div className="text-xs text-slate-500">Current Gravity</div>
                          </div>
                       </div>
                       
                       {/* 物理畫布 */}
                       <GravityPlayground gravity={selectedPlanet.gravity} planetName={selectedPlanet.englishName} />
                       
                       <div className="flex gap-4 text-xs text-slate-500 justify-center">
                          <span className="flex items-center gap-1"><MousePointer2 size={12} /> Click & Drag to grab object</span>
                          <span className="flex items-center gap-1"><Move size={12} /> Release while moving to throw</span>
                       </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// 小元件：資訊卡
const InfoCard = ({ icon, label, value, sub }: any) => (
  <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 flex flex-col justify-center">
    <div className="flex items-center gap-2 mb-2">
      {icon}
      <span className="text-xs text-slate-500 font-bold uppercase">{label}</span>
    </div>
    <div className="text-xl font-bold text-slate-200">{value}</div>
    <div className="text-xs text-slate-600">{sub}</div>
  </div>
);