import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Activity, Zap, Wind, Navigation, AlertTriangle, Clock, ArrowLeft } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useNavigate } from 'react-router';
import type { Route } from "./+types/dashboard"; // 支援 React Router v7 的型別 (可選)

// --- META 設定 (設定網頁標題) ---
export function meta({}: Route.MetaArgs) {
  return [
    { title: "ORION-7 // 軌道監控系統" },
    { name: "description", content: "即時 3D 太空站監控儀表板" },
  ];
}

// --- 子組件：Three.js 地球視圖 ---
const EarthView = ({ speed }: { speed: number }) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. 初始化
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x020617, 0.035);

    const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // 2. 幾何體
    const geometry = new THREE.IcosahedronGeometry(2.5, 10);
    const material = new THREE.MeshPhongMaterial({ 
      color: 0x0f172a, 
      emissive: 0x1e3a8a,
      emissiveIntensity: 0.2,
      shininess: 50,
      flatShading: true
    });
    
    const wireframeMaterial = new THREE.MeshBasicMaterial({
       color: 0x06b6d4,
       wireframe: true,
       transparent: true,
       opacity: 0.15
    });

    const earth = new THREE.Mesh(geometry, material);
    const wireframe = new THREE.Mesh(geometry, wireframeMaterial);
    wireframe.scale.setScalar(1.001);
    earth.add(wireframe);
    scene.add(earth);

    // 光暈
    const glowGeo = new THREE.IcosahedronGeometry(2.8, 8);
    const glowMat = new THREE.MeshBasicMaterial({
        color: 0x3b82f6,
        transparent: true,
        opacity: 0.05,
        side: THREE.BackSide
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    scene.add(glow);

    // 3. 燈光
    const ambientLight = new THREE.AmbientLight(0x404040, 2);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
    directionalLight.position.set(5, 3, 5);
    scene.add(directionalLight);
    const pointLight = new THREE.PointLight(0x06b6d4, 1, 100);
    pointLight.position.set(-5, 2, 5);
    scene.add(pointLight);

    camera.position.z = 6;

    // 4. 動畫
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      
      const rotationSpeed = 0.001 + (speed - 27000) * 0.000005;
      earth.rotation.y += rotationSpeed;
      glow.rotation.y += rotationSpeed * 0.8;
      
      const time = Date.now() * 0.001;
      earth.position.y = Math.sin(time) * 0.1;

      renderer.render(scene, camera);
    };
    animate();

    // 5. Resize 處理
    const handleResize = () => {
      if (!container) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', handleResize);

    // 6. 清理
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []); 

  return <div ref={mountRef} className="w-full h-full min-h-[400px]" />;
};

// --- 子組件：統計卡片 ---
const StatCard = ({ title, value, icon, trend, color }: any) => {
  const colorClasses: any = {
    blue: "from-blue-500/10 to-blue-600/5 border-blue-500/30 text-blue-400",
    yellow: "from-yellow-500/10 to-yellow-600/5 border-yellow-500/30 text-yellow-400",
    purple: "from-purple-500/10 to-purple-600/5 border-purple-500/30 text-purple-400",
  };

  return (
    <div className={`p-4 rounded-lg border bg-gradient-to-br backdrop-blur-sm ${colorClasses[color] || colorClasses.blue}`}>
      <div className="flex justify-between items-start mb-2">
        <h4 className="text-xs font-bold tracking-wider text-slate-400">{title}</h4>
        {icon}
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold text-slate-100">{value}</span>
        <span className={`text-xs mb-1 ${trend === 'decreasing' ? 'text-red-400' : 'text-green-400'}`}>
           {trend === 'stable' ? '● STABLE' : '▼ DRAINING'}
        </span>
      </div>
      <div className="w-full h-1 bg-slate-700 mt-3 rounded-full overflow-hidden">
        <div className={`h-full w-2/3 animate-pulse bg-current opacity-50`}></div>
      </div>
    </div>
  );
};

const FloatingBackButton = () => {
  const navigate = useNavigate();
  const [position, setPosition] = useState({ x: 24, y: 24 });
  const dragRef = useRef<{ offsetX: number; offsetY: number; pointerId: number | null }>({
    offsetX: 0,
    offsetY: 0,
    pointerId: null,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setPosition({
      x: window.innerWidth - 156,
      y: window.innerHeight - 96,
    });
  }, []);

  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    dragRef.current = {
      offsetX: event.clientX - position.x,
      offsetY: event.clientY - position.y,
      pointerId: event.pointerId,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (dragRef.current.pointerId !== event.pointerId) return;
    const maxX = typeof window === 'undefined' ? position.x : window.innerWidth - 112;
    const maxY = typeof window === 'undefined' ? position.y : window.innerHeight - 72;
    setPosition({
      x: clamp(event.clientX - dragRef.current.offsetX, 12, maxX),
      y: clamp(event.clientY - dragRef.current.offsetY, 12, maxY),
    });
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (dragRef.current.pointerId !== event.pointerId) return;
    dragRef.current.pointerId = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/jock_space');
    }
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className="fixed z-[10000] flex items-center gap-2 rounded-full bg-cyan-400 px-4 py-3 text-slate-900 font-semibold shadow-[0_10px_35px_rgba(6,182,212,0.35)] border border-white/60 active:scale-95 transition"
      style={{ left: position.x, top: position.y }}
    >
      <ArrowLeft size={18} />
      返回上一頁
    </button>
  );
};

// --- 主組件 ---
export default function SpaceStationDashboard() {
  const [metrics, setMetrics] = useState({
    oxygen: 98,
    fuel: 85,
    speed: 27500,
    temperature: 22,
    integrity: 100
  });

  const [dataHistory, setDataHistory] = useState<any[]>([]);
  const [systemTime, setSystemTime] = useState("00:00:00");
  const [alert, setAlert] = useState<any>(null);

  // 解決 Hydration Mismatch: 確保只在客戶端渲染時間
  useEffect(() => {
    setSystemTime(new Date().toLocaleTimeString());
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setSystemTime(new Date().toLocaleTimeString());
      setMetrics(prev => {
        const newOxygen = Math.max(90, Math.min(100, prev.oxygen + (Math.random() - 0.4) * 0.5));
        const newFuel = Math.max(0, prev.fuel - 0.05);
        const newSpeed = Math.max(27000, Math.min(28000, prev.speed + (Math.random() - 0.5) * 50));
        const newTemp = Math.max(18, Math.min(26, prev.temperature + (Math.random() - 0.5) * 0.2));
        
        if (Math.random() > 0.98) {
          setAlert({ type: 'warning', message: '檢測到微隕石撞擊風險' });
          setTimeout(() => setAlert(null), 3000);
        }

        const newEntry = {
          time: new Date().toLocaleTimeString(),
          oxygen: newOxygen.toFixed(1),
          speed: newSpeed.toFixed(0),
          fuel: newFuel.toFixed(1),
          temp: newTemp.toFixed(1)
        };

        setDataHistory(current => {
          const newHistory = [...current, newEntry];
          if (newHistory.length > 20) newHistory.shift();
          return newHistory;
        });

        return { oxygen: newOxygen, fuel: newFuel, speed: newSpeed, temperature: newTemp, integrity: prev.integrity };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    // 使用 fixed inset-0 z-[9999] 確保覆蓋全螢幕且蓋過原有的 Layout
    <div className="fixed inset-0 z-[9999] flex flex-col w-full h-full bg-slate-950 text-slate-100 overflow-hidden font-mono selection:bg-cyan-500 selection:text-black">
      <FloatingBackButton />
      {/* 頂部導航欄 */}
      <header className="flex justify-between items-center p-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-cyan-500 animate-pulse shadow-[0_0_10px_#06b6d4]"></div>
          <h1 className="text-xl font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
            ORION-7 // 軌道監控系統
          </h1>
        </div>
        <div className="flex items-center gap-6 text-sm text-slate-400">
          <div className="flex items-center gap-2">
            <Clock size={16} />
            <span>UTC {systemTime}</span>
          </div>
          <div className="px-3 py-1 rounded border border-green-500/30 bg-green-500/10 text-green-400 text-xs">
            SYSTEM ONLINE
          </div>
        </div>
      </header>

      {/* 主要內容網格 */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-0 lg:gap-px bg-slate-800 overflow-hidden">
        
        {/* 左側：3D 視覺化區域 */}
        <div className="lg:col-span-1 bg-slate-950 relative border-r border-slate-800">
          <div className="absolute top-4 left-4 z-10 bg-slate-900/80 p-2 rounded border border-slate-700 backdrop-blur text-xs">
            <div className="text-slate-400 mb-1">VISUAL FEED</div>
            <div className="text-cyan-400">LIVE // CAM-01</div>
          </div>
          
          <EarthView speed={metrics.speed} />
          
          <div className="absolute bottom-6 left-6 right-6 grid grid-cols-2 gap-4">
             <div className="bg-slate-900/80 backdrop-blur p-3 rounded border border-slate-700 border-l-4 border-l-cyan-500">
                <div className="text-xs text-slate-400">LATITUDE</div>
                <div className="text-lg font-bold">28.57 N</div>
             </div>
             <div className="bg-slate-900/80 backdrop-blur p-3 rounded border border-slate-700 border-l-4 border-l-cyan-500">
                <div className="text-xs text-slate-400">LONGITUDE</div>
                <div className="text-lg font-bold">80.64 W</div>
             </div>
          </div>
        </div>

        {/* 右側：儀表板數據區域 */}
        <div className="lg:col-span-2 bg-slate-950 p-6 flex flex-col gap-6 overflow-y-auto">
          {alert && (
            <div className="w-full bg-red-500/20 border border-red-500 text-red-100 p-3 rounded flex items-center gap-3 animate-bounce shrink-0">
              <AlertTriangle />
              <span className="font-bold">WARNING: {alert.message}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
            <StatCard 
              title="OXYGEN LEVEL" 
              value={`${metrics.oxygen.toFixed(1)}%`} 
              icon={<Wind className="text-blue-400" />}
              trend="stable"
              color="blue"
            />
            <StatCard 
              title="FUEL RESERVES" 
              value={`${metrics.fuel.toFixed(1)}%`} 
              icon={<Zap className="text-yellow-400" />}
              trend="decreasing"
              color="yellow"
            />
            <StatCard 
              title="ORBITAL VELOCITY" 
              value={`${(metrics.speed/1000).toFixed(2)} km/s`} 
              icon={<Navigation className="text-purple-400" />}
              trend="stable"
              color="purple"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 flex-1 min-h-[300px]">
            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-800 shadow-xl backdrop-blur-sm flex flex-col">
              <div className="flex justify-between items-center mb-4 shrink-0">
                <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                  <Activity size={16} className="text-cyan-500" />
                  即時遙測數據 (REAL-TIME TELEMETRY)
                </h3>
                <div className="flex gap-2">
                   <span className="w-2 h-2 rounded-full bg-cyan-500 mt-1"></span>
                   <span className="text-xs text-slate-500">VELOCITY</span>
                   <span className="w-2 h-2 rounded-full bg-pink-500 mt-1 ml-2"></span>
                   <span className="text-xs text-slate-500">TEMP</span>
                </div>
              </div>
              
              <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dataHistory}>
                    <defs>
                      <linearGradient id="colorSpeed" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                         <stop offset="5%" stopColor="#ec4899" stopOpacity={0.3}/>
                         <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="time" stroke="#475569" tick={{fontSize: 10}} tickMargin={10} />
                    <YAxis yAxisId="left" stroke="#475569" domain={['dataMin - 100', 'dataMax + 100']} tick={{fontSize: 10}} />
                    <YAxis yAxisId="right" orientation="right" stroke="#475569" domain={[15, 30]} tick={{fontSize: 10}} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9' }}
                      itemStyle={{ fontSize: '12px' }}
                    />
                    <Area 
                      yAxisId="left" type="monotone" dataKey="speed" stroke="#06b6d4" strokeWidth={2}
                      fillOpacity={1} fill="url(#colorSpeed)" isAnimationActive={false}
                    />
                    <Area 
                       yAxisId="right" type="monotone" dataKey="temp" stroke="#ec4899" strokeWidth={2}
                       fillOpacity={1} fill="url(#colorTemp)" isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-800 shadow-xl h-48 flex flex-col shrink-0">
               <h3 className="text-sm font-bold text-slate-300 mb-2">SYSTEM LOGS</h3>
               <div className="flex-1 overflow-y-auto text-xs font-mono space-y-1 pr-2 custom-scrollbar">
                  <div className="text-slate-500">[{systemTime}] Syncing visual modules... OK</div>
                  <div className="text-slate-500">[{systemTime}] Checking hull integrity... 100%</div>
                  <div className="text-slate-400">[{systemTime}] Telemetry stream active.</div>
                  <div className="text-cyan-500">[{systemTime}] Connected to ORION-7 Mainframe.</div>
                  {alert && <div className="text-red-400 font-bold">[{systemTime}] !ALERT! {alert.message}</div>}
               </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
