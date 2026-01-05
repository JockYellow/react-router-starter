import React, { useState, useEffect, useRef } from 'react';
import { Search, RefreshCw, Volume2, Activity, Zap, Shield, Swords, Ghost, Database } from 'lucide-react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip } from 'recharts';
import type { Route } from "./+types/creatures";

// 設定 Meta 標籤
export function meta({}: Route.MetaArgs) {
  return [
    { title: "XENO-DB // 異星生物資料庫" },
    { name: "description", content: "跨星系生物體分析系統" },
  ];
}

// --- 類型定義 ---
interface PokemonStats {
  hp: number;
  attack: number;
  defense: number;
  specialAttack: number;
  specialDefense: number;
  speed: number;
}

interface CreatureData {
  id: number;
  name: string;
  types: string[];
  height: number;
  weight: number;
  sprite: string;
  shinySprite: string;
  cry: string;
  stats: PokemonStats;
  chartData: any[];
}

export default function CreatureDatabase() {
  const [searchTerm, setSearchTerm] = useState('lucario');
  const [creature, setCreature] = useState<CreatureData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isShiny, setIsShiny] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // --- 核心功能：從 PokeAPI 獲取資料 ---
  const fetchCreature = async (query: string | number) => {
    setLoading(true);
    setError('');
    setIsFlipped(false); // 重置卡片翻轉
    
    try {
      const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${query.toString().toLowerCase()}`);
      if (!response.ok) throw new Error('Target not found in database.');
      
      const data = await response.json();
      
      // 整理數據格式以符合我們的 UI 需求
      const stats = {
        hp: data.stats[0].base_stat,
        attack: data.stats[1].base_stat,
        defense: data.stats[2].base_stat,
        specialAttack: data.stats[3].base_stat,
        specialDefense: data.stats[4].base_stat,
        speed: data.stats[5].base_stat,
      };

      const chartData = [
        { subject: 'HP', A: stats.hp, fullMark: 150 },
        { subject: 'ATK', A: stats.attack, fullMark: 150 },
        { subject: 'DEF', A: stats.defense, fullMark: 150 },
        { subject: 'SPD', A: stats.speed, fullMark: 150 },
        { subject: 'S-DEF', A: stats.specialDefense, fullMark: 150 },
        { subject: 'S-ATK', A: stats.specialAttack, fullMark: 150 },
      ];

      setCreature({
        id: data.id,
        name: data.name,
        types: data.types.map((t: any) => t.type.name),
        height: data.height / 10, // 轉為公尺
        weight: data.weight / 10, // 轉為公斤
        sprite: data.sprites.other['official-artwork'].front_default || data.sprites.front_default,
        shinySprite: data.sprites.other['official-artwork'].front_shiny || data.sprites.front_shiny,
        cry: data.cries.latest,
        stats,
        chartData
      });

    } catch (err) {
      setError('SCAN FAILED: Target signal lost or invalid.');
      setCreature(null);
    } finally {
      setLoading(false);
    }
  };

  // 初始載入
  useEffect(() => {
    fetchCreature(Math.floor(Math.random() * 150) + 1); // 隨機載入一隻
  }, []);

  // 播放叫聲
  const playCry = () => {
    if (creature?.cry) {
      const audio = new Audio(creature.cry);
      audio.volume = 0.3;
      audio.play();
    }
  };

  // 隨機搜尋
  const handleRandom = () => {
    const randomId = Math.floor(Math.random() * 1000) + 1;
    fetchCreature(randomId);
  };

  // 處理搜尋提交
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if(searchTerm.trim()) fetchCreature(searchTerm);
  };

  return (
    // --- 容器層：使用 min-h-screen 確保佔滿但不覆蓋 Layout ---
    <div className="w-full min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 font-mono relative overflow-hidden">
      
      {/* 背景裝飾網格 */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

      <div className="max-w-6xl mx-auto relative z-10">
        
        {/* 標題區 */}
        <header className="mb-8 border-b border-slate-800 pb-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <Database className="text-emerald-400" />
            <h1 className="text-2xl md:text-3xl font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-500">
              XENO-BIOLOGY DB
            </h1>
          </div>
          
          {/* 搜尋與控制列 */}
          <div className="flex gap-2 w-full md:w-auto">
            <form onSubmit={handleSearch} className="flex-1 flex gap-2">
              <div className="relative flex-1 md:w-64">
                <input 
                  type="text" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Enter ID or Name..."
                  className="w-full bg-slate-900/80 border border-slate-700 rounded px-4 py-2 pl-10 focus:outline-none focus:border-emerald-500 text-emerald-100 placeholder:text-slate-600"
                />
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
              </div>
              <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded transition-colors">
                SCAN
              </button>
            </form>
            <button onClick={handleRandom} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 px-3 py-2 rounded transition-colors group" title="Random Scan">
              <RefreshCw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />
            </button>
          </div>
        </header>

        {/* 內容顯示區 */}
        {loading ? (
          <div className="h-96 flex flex-col items-center justify-center text-emerald-500 animate-pulse">
            <Activity className="w-16 h-16 mb-4" />
            <div className="text-xl tracking-widest">ANALYZING DNA SEQUENCE...</div>
          </div>
        ) : error ? (
          <div className="h-96 flex flex-col items-center justify-center text-red-500 bg-red-950/20 border border-red-900/50 rounded-xl">
            <Shield className="w-16 h-16 mb-4" />
            <div className="text-xl tracking-widest">{error}</div>
          </div>
        ) : creature && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12">
            
            {/* 左側：生物視覺化 (3D 卡片效果) */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              <div className="relative group perspective-1000 w-full aspect-square">
                <div className="relative w-full h-full transition-all duration-500 transform-style-3d bg-slate-900/50 rounded-2xl border border-slate-700 overflow-hidden flex items-center justify-center backdrop-blur-sm hover:border-emerald-500/50 hover:shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                  
                  {/* 背景全息圖效果 */}
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(16,185,129,0.1),transparent_70%)]" />
                  
                  {/* 生物影像 */}
                  <img 
                    src={isShiny ? creature.shinySprite : creature.sprite} 
                    alt={creature.name}
                    className="relative z-10 w-3/4 h-3/4 object-contain drop-shadow-[0_0_15px_rgba(0,0,0,0.8)] transition-transform duration-300 hover:scale-110 cursor-pointer"
                    onClick={playCry}
                  />

                  {/* 覆蓋 UI */}
                  <div className="absolute top-4 right-4 flex flex-col gap-2 z-20">
                    <button 
                      onClick={() => setIsShiny(!isShiny)}
                      className={`p-2 rounded-full border backdrop-blur-md transition-colors ${isShiny ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400' : 'bg-slate-800/50 border-slate-600 text-slate-400 hover:text-white'}`}
                    >
                      <Zap className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={playCry}
                      className="p-2 rounded-full bg-slate-800/50 border border-slate-600 text-slate-400 hover:text-emerald-400 hover:border-emerald-500 backdrop-blur-md transition-colors"
                    >
                      <Volume2 className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="absolute bottom-4 left-4 bg-slate-950/80 px-3 py-1 rounded border border-slate-700 text-xs text-emerald-500 font-bold">
                    ID: #{creature.id.toString().padStart(4, '0')}
                  </div>
                </div>
              </div>

              {/* 屬性標籤 */}
              <div className="flex gap-3 justify-center">
                {creature.types.map(t => (
                  <span key={t} className="px-6 py-2 rounded bg-slate-800 border border-slate-600 text-slate-200 uppercase tracking-wider font-bold text-sm shadow-lg">
                    {t}
                  </span>
                ))}
              </div>
            </div>

            {/* 右側：數據分析儀表板 */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* 頂部資訊 */}
              <div className="space-y-2 border-l-4 border-emerald-500 pl-6">
                <h2 className="text-5xl font-bold text-white uppercase tracking-tighter">{creature.name}</h2>
                <div className="flex gap-8 text-slate-400 text-sm">
                  <span>HEIGHT: <strong className="text-emerald-400">{creature.height}m</strong></span>
                  <span>WEIGHT: <strong className="text-emerald-400">{creature.weight}kg</strong></span>
                </div>
              </div>

              {/* 雷達圖分析 */}
              <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-4 relative h-80">
                 <h3 className="absolute top-4 left-4 text-xs font-bold text-slate-500 flex items-center gap-2">
                   <Activity className="w-4 h-4" />
                   STATS MATRIX
                 </h3>
                 <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={creature.chartData}>
                      <PolarGrid stroke="#334155" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 150]} tick={false} axisLine={false} />
                      <Radar
                        name={creature.name}
                        dataKey="A"
                        stroke="#10b981"
                        strokeWidth={3}
                        fill="#10b981"
                        fillOpacity={0.3}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#020617', borderColor: '#1e293b', color: '#f1f5f9' }}
                        itemStyle={{ color: '#10b981' }}
                      />
                    </RadarChart>
                 </ResponsiveContainer>
              </div>

              {/* 戰鬥能力評估 */}
              <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800 hover:border-red-500/50 transition-colors group">
                    <div className="flex items-center gap-2 text-red-400 mb-2">
                      <Swords className="w-5 h-5 group-hover:animate-pulse" />
                      <span className="text-sm font-bold">OFFENSIVE</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-200">
                      {creature.stats.attack + creature.stats.specialAttack}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">Combined Combat Power</div>
                  </div>

                  <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800 hover:border-blue-500/50 transition-colors group">
                    <div className="flex items-center gap-2 text-blue-400 mb-2">
                      <Shield className="w-5 h-5 group-hover:animate-pulse" />
                      <span className="text-sm font-bold">DEFENSIVE</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-200">
                      {creature.stats.defense + creature.stats.specialDefense + creature.stats.hp}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">Total Resilience Index</div>
                  </div>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}