import React, { useState } from 'react';
import { Gift, Lock, Unlock, Zap, Sparkles, Smartphone, Monitor, Gavel, User, Play, StopCircle, RefreshCw, Trophy, Edit3, ArrowRight, Eye, EyeOff } from 'lucide-react';

// --- 資料結構 ---
type GiftType = 'GOOD' | 'BAD';

interface Player {
  id: string;
  name: string;
  hasGift: boolean;
  wishedGiftId: string | null;
}

interface GiftItem {
  id: string;
  type: GiftType;
  provider: string; 
  holder: string | null;   
  slogan: string;
  tags: string[];
  isRevealed: boolean; // 是否揭曉提供者
  isLocked: boolean;   // 是否被鎖定
}

// --- 模擬初始資料 ---
const INITIAL_GIFTS: GiftItem[] = [
  {
    id: 'g1', type: 'GOOD', provider: 'Alex', holder: null, slogan: '讓你夜晚不再寂寞',
    tags: ['#很重', '#會發熱'], isRevealed: false, isLocked: false
  },
  {
    id: 'g2', type: 'BAD', provider: 'Alex', holder: null, slogan: '來自地獄的呼喚',
    tags: ['#很吵', '#塑膠味'], isRevealed: false, isLocked: false
  },
];

// --- 組件：登入與禮物建立 ---
const LoginScreen = ({ onJoin }: { onJoin: (name: string, gifts: { good: any, bad: any }) => void }) => {
  const [name, setName] = useState('');
  const [goodSlogan, setGoodSlogan] = useState('');
  const [goodTag, setGoodTag] = useState('');
  const [badSlogan, setBadSlogan] = useState('');
  const [badTag, setBadTag] = useState('');

  const handleSubmit = () => {
    if (!name || !goodSlogan || !badSlogan) return;
    onJoin(name, {
      good: { slogan: goodSlogan, tags: goodTag.split(' ') },
      bad: { slogan: badSlogan, tags: badTag.split(' ') }
    });
  };

  return (
    <div className="min-h-screen bg-black p-6 flex flex-col justify-center animate-in fade-in zoom-in duration-500">
      <div className="text-center mb-8">
        <div className="inline-block p-4 bg-gradient-to-br from-yellow-400 to-orange-600 rounded-full mb-4 shadow-[0_0_30px_rgba(234,179,8,0.4)]">
          <Gift size={48} className="text-white" />
        </div>
        <h1 className="text-4xl font-black text-white tracking-tight">GIFT WAR</h1>
        <p className="text-gray-400 text-sm mt-2">輸入你的大名與禮物線索</p>
      </div>

      <div className="space-y-6 bg-gray-900/50 p-6 rounded-2xl border border-gray-800 backdrop-blur-sm max-h-[70vh] overflow-y-auto">
        {/* 1. 玩家資訊 */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Player Name</label>
          <input 
            type="text" 
            placeholder="你的暱稱"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full bg-gray-950 border border-gray-700 rounded-xl p-4 text-white text-lg focus:border-yellow-500 outline-none transition-colors placeholder:text-gray-700"
          />
        </div>

        {/* 2. 好禮物資訊 */}
        <div className="space-y-3 pt-2 bg-yellow-900/10 p-4 rounded-xl border border-yellow-500/20">
          <div className="flex items-center gap-2 text-yellow-500 font-bold text-sm uppercase tracking-wider">
            <Gift size={14} /> 禮物 A (好禮物)
          </div>
          <div className="grid gap-3">
            <input 
              type="text" 
              placeholder="一句話形容 (Slogan)"
              value={goodSlogan}
              onChange={e => setGoodSlogan(e.target.value)}
              className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-yellow-500 outline-none placeholder:text-gray-700"
            />
            <input 
              type="text" 
              placeholder="#標籤 (例如：#實用 #很重)"
              value={goodTag}
              onChange={e => setGoodTag(e.target.value)}
              className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-yellow-500 outline-none placeholder:text-gray-700"
            />
          </div>
        </div>

        {/* 3. 鬧禮物資訊 */}
        <div className="space-y-3 pt-2 bg-purple-900/10 p-4 rounded-xl border border-purple-500/20">
          <div className="flex items-center gap-2 text-purple-400 font-bold text-sm uppercase tracking-wider">
            <Zap size={14} /> 禮物 B (鬧禮物)
          </div>
          <div className="grid gap-3">
            <input 
              type="text" 
              placeholder="一句話形容 (Slogan)"
              value={badSlogan}
              onChange={e => setBadSlogan(e.target.value)}
              className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-purple-500 outline-none placeholder:text-gray-700"
            />
            <input 
              type="text" 
              placeholder="#標籤 (例如：#吵鬧 #塑膠)"
              value={badTag}
              onChange={e => setBadTag(e.target.value)}
              className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-purple-500 outline-none placeholder:text-gray-700"
            />
          </div>
        </div>

        <button 
          onClick={handleSubmit}
          disabled={!name || !goodSlogan || !badSlogan}
          className="w-full bg-white hover:bg-gray-100 text-black font-black py-4 rounded-xl text-lg shadow-lg active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4"
        >
          加入戰局 <ArrowRight size={20} />
        </button>
      </div>
    </div>
  );
};

// --- 組件：玩家視角 (Player View) ---
const PlayerView = ({ 
  gifts, 
  user, 
  activeVotingGiftId,
  onWish, 
}: { 
  gifts: GiftItem[], 
  user: Player, 
  activeVotingGiftId: string | null,
  onWish: (giftId: string) => void,
}) => {
  const [poolType, setPoolType] = useState<GiftType>('GOOD');
  const filteredGifts = gifts.filter(g => g.type === poolType);

  return (
    <div className="min-h-screen bg-gray-950 pb-20">
      <div className="sticky top-0 z-20 bg-gray-950/90 backdrop-blur-md border-b border-gray-800">
        <div className="p-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-gray-700 to-gray-900 rounded-full flex items-center justify-center text-white font-bold border border-gray-600">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="text-white font-bold">{user.name}</div>
              <div className="text-[10px] text-gray-400">
                {user.hasGift ? '✅ 已獲得禮物' : '⏳ 等待分配中'}
              </div>
            </div>
          </div>
          <div className="px-2 py-1 rounded bg-gray-800 border border-gray-700 text-[10px] text-gray-400 flex items-center gap-1">
            <Smartphone size={10} /> 玩家端
          </div>
        </div>

        <div className="px-4 pb-4">
          <div className="flex bg-gray-900 p-1 rounded-xl border border-gray-800">
            <button 
              onClick={() => setPoolType('GOOD')}
              className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${poolType === 'GOOD' ? 'bg-yellow-500 text-black shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <Gift size={16} /> 好禮物
            </button>
            <button 
              onClick={() => setPoolType('BAD')}
              className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${poolType === 'BAD' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <Zap size={16} /> 鬧禮物
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {filteredGifts.map(gift => {
          const isMine = gift.holder === user.name;
          const isChosen = !!gift.holder;
          const isVotingNow = activeVotingGiftId === gift.id;

          return (
            <div key={gift.id} className={`
              relative bg-gray-900 border rounded-xl overflow-hidden transition-all duration-300
              ${isMine ? 'border-green-500 ring-1 ring-green-500/50' : ''}
              ${activeVotingGiftId === gift.id ? 'border-purple-500 ring-2 ring-purple-500 animate-pulse' : ''}
              ${!isMine && isChosen ? 'border-gray-800 opacity-60' : 'border-gray-800'}
            `}>
              {gift.isLocked && (
                <div className="absolute top-2 right-2 z-10 bg-red-500/90 text-white text-[10px] px-2 py-1 rounded-full font-bold flex items-center gap-1 backdrop-blur-sm shadow-lg">
                  <Lock size={10} /> 主台鎖定
                </div>
              )}

              <div className="p-4">
                <div className="mb-3">
                  <h3 className={`font-bold text-lg mb-1 ${isChosen ? 'text-gray-300' : 'text-white'}`}>
                    {gift.slogan}
                  </h3>
                  <div className="flex gap-1.5 flex-wrap">
                    {gift.tags.map((t, i) => (
                      <span key={i} className="text-[10px] bg-gray-950 text-gray-500 px-1.5 py-0.5 rounded border border-gray-800">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-800 flex justify-between items-center min-h-[40px]">
                  <div className="text-sm">
                    {isChosen ? (
                      <div className="space-y-0.5">
                         {/* 修正：如果尚未揭曉且不是自己的，隱藏 Provider */}
                         {(gift.isRevealed || isMine) ? (
                          <div className="text-gray-500 text-xs">From: {gift.provider}</div>
                        ) : (
                          <div className="text-gray-600 text-xs flex items-center gap-1">From: <span className="blur-[3px] opacity-70">Secret</span></div>
                        )}
                        <div className="text-white font-bold flex items-center gap-1">
                           Holder: <span className={isMine ? 'text-green-400' : 'text-white'}>{gift.holder}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-gray-600 text-xs italic flex items-center gap-1">
                        {gift.type === 'BAD' ? '尚未投出' : '等待有緣人...'}
                      </div>
                    )}
                  </div>

                  <div>
                    {gift.type === 'BAD' && !isChosen && (
                      isVotingNow ? (
                        <button className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg animate-bounce">
                          👉 進入投票
                        </button>
                      ) : (
                        <span className="text-gray-600 text-xs font-bold px-2">等待主台發起...</span>
                      )
                    )}

                    {gift.type === 'GOOD' && !isChosen && (
                      <button 
                        onClick={() => onWish(gift.id)}
                        disabled={user.hasGift || (user.wishedGiftId !== null && user.wishedGiftId !== gift.id)}
                        className={`
                          flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all
                          ${user.wishedGiftId === gift.id
                            ? 'bg-green-600/20 text-green-400 border border-green-500/50' 
                            : user.hasGift || user.wishedGiftId 
                              ? 'bg-gray-800 text-gray-600 cursor-not-allowed' 
                              : 'bg-yellow-500 hover:bg-yellow-400 text-black shadow-lg'}
                        `}
                      >
                        {user.wishedGiftId === gift.id ? <><Sparkles size={14}/> 已許願</> : '🙏 許願'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// --- 組件：PK 選擇得主 Modal ---
const PKAssignModal = ({ 
  gift, 
  onClose, 
  onConfirm 
}: { 
  gift: GiftItem, 
  onClose: () => void, 
  onConfirm: (name: string) => void 
}) => {
  const [inputName, setInputName] = useState('');
  // 模擬：這裡可以放一個「許願此禮物的人」的列表
  const [candidates] = useState(['Kevin', 'John', 'Mary']); 

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-yellow-500/30 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95">
        <div className="text-center mb-6">
          <div className="inline-block p-3 bg-yellow-500/20 rounded-full mb-3">
            <Trophy size={32} className="text-yellow-500" />
          </div>
          <h2 className="text-2xl font-black text-white">PK 決戰得主</h2>
          <p className="text-gray-400 text-sm mt-1">禮物: {gift.slogan}</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">直接輸入勝者名字:</label>
            <input 
              type="text" 
              value={inputName}
              onChange={e => setInputName(e.target.value)}
              className="w-full bg-black border border-gray-700 rounded-lg p-3 text-white focus:border-yellow-500 outline-none"
              placeholder="Ex: Kevin"
            />
          </div>

          <div className="border-t border-gray-800 pt-4">
            <label className="text-xs text-gray-500 mb-2 block">或從許願者中選擇:</label>
            <div className="flex flex-wrap gap-2">
              {candidates.map(c => (
                <button 
                  key={c}
                  onClick={() => setInputName(c)}
                  className={`px-3 py-1.5 rounded-full text-sm font-bold border transition-colors ${inputName === c ? 'bg-yellow-500 text-black border-yellow-500' : 'bg-gray-800 text-gray-300 border-gray-700 hover:border-gray-500'}`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-8">
          <button onClick={onClose} className="py-3 rounded-xl font-bold bg-gray-800 text-gray-400 hover:bg-gray-700">
            取消
          </button>
          <button 
            onClick={() => inputName && onConfirm(inputName)}
            disabled={!inputName}
            className="py-3 rounded-xl font-bold bg-yellow-500 text-black hover:bg-yellow-400 disabled:opacity-50"
          >
            確認得主
          </button>
        </div>
      </div>
    </div>
  );
};

// --- 組件：主控台 (Host Dashboard) ---
const HostDashboard = ({ 
  gifts, 
  activeVotingGiftId,
  onAssign, 
  onToggleLock, 
  onStartVote, 
  onStopVote,
  onRevealProvider
}: { 
  gifts: GiftItem[], 
  activeVotingGiftId: string | null,
  onAssign: (id: string, winnerName: string) => void,
  onToggleLock: (id: string) => void,
  onStartVote: (id: string) => void,
  onStopVote: (id: string) => void,
  onRevealProvider: (id: string) => void
}) => {
  const [tab, setTab] = useState<'R1' | 'S1' | 'S2'>('R1');
  const [pkModalGift, setPkModalGift] = useState<GiftItem | null>(null); // 控制 PK Modal

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 pb-20 font-sans">
      {pkModalGift && (
        <PKAssignModal 
          gift={pkModalGift} 
          onClose={() => setPkModalGift(null)} 
          onConfirm={(name) => {
            onAssign(pkModalGift.id, name);
            setPkModalGift(null);
          }} 
        />
      )}

      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-black text-white flex items-center gap-2">
              <Monitor /> 主控台 Dashboard
            </h1>
            <p className="text-slate-400 text-sm">上帝視角控制中心</p>
          </div>
          <div className="flex bg-slate-800 p-1 rounded-lg">
            <button onClick={() => setTab('R1')} className={`px-4 py-2 rounded text-sm font-bold ${tab === 'R1' ? 'bg-yellow-500 text-black' : 'text-slate-400'}`}>R1 好禮物</button>
            <button onClick={() => setTab('S1')} className={`px-4 py-2 rounded text-sm font-bold ${tab === 'S1' ? 'bg-purple-600 text-white' : 'text-slate-400'}`}>S1 鬧禮物</button>
            <button onClick={() => setTab('S2')} className={`px-4 py-2 rounded text-sm font-bold ${tab === 'S2' ? 'bg-red-600 text-white' : 'text-slate-400'}`}>S2 交換</button>
          </div>
        </div>

        {tab === 'R1' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {gifts.filter(g => g.type === 'GOOD').map(gift => (
              <div key={gift.id} className="bg-slate-800 border border-slate-700 p-4 rounded-xl flex flex-col justify-between relative group">
                {/* 變更持有者按鈕 (所有階段都可用) */}
                {gift.holder && (
                  <button 
                    onClick={() => setPkModalGift(gift)}
                    className="absolute top-2 right-2 p-2 bg-slate-700 rounded-full hover:bg-white hover:text-black transition-colors"
                    title="手動變更持有者"
                  >
                    <Edit3 size={14} />
                  </button>
                )}

                <div className="mb-4">
                  <div className="flex justify-between items-start pr-8">
                    <h3 className="font-bold text-lg text-yellow-400">{gift.slogan}</h3>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded ${gift.isRevealed ? 'bg-blue-900 text-blue-300' : 'bg-slate-900 text-slate-500'}`}>
                      From: {gift.provider} {gift.isRevealed ? '(已揭曉)' : '(隱藏中)'}
                    </span>
                  </div>
                  <div className="text-sm mt-3 text-slate-300">
                    目前持有: {gift.holder ? <span className="text-green-400 font-bold text-lg">{gift.holder}</span> : <span className="text-slate-500 italic">等待抽出...</span>}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  {!gift.holder ? (
                    <button 
                      onClick={() => setPkModalGift(gift)}
                      className="col-span-2 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 shadow-lg"
                    >
                      <Trophy size={18} /> 公布得主 / 進入 PK
                    </button>
                  ) : (
                    <>
                      <button 
                        onClick={() => onToggleLock(gift.id)}
                        className={`py-2 rounded font-bold flex items-center justify-center gap-2 border ${gift.isLocked ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-slate-700 border-slate-600 text-slate-300'}`}
                      >
                        {gift.isLocked ? <><Lock size={16}/> 解鎖</> : <><Unlock size={16}/> 鎖定</>}
                      </button>
                      <button 
                        onClick={() => onRevealProvider(gift.id)}
                        disabled={gift.isRevealed}
                        className="bg-blue-600/20 border border-blue-600 text-blue-400 py-2 rounded font-bold hover:bg-blue-600/40 disabled:opacity-30 flex items-center justify-center gap-2"
                      >
                        {gift.isRevealed ? <><Eye size={16}/> 已揭曉</> : <><EyeOff size={16}/> 揭曉來源</>}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'S1' && (
          <div className="space-y-4">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {gifts.filter(g => g.type === 'BAD').map(gift => (
                <div key={gift.id} className={`bg-slate-800 border p-4 rounded-xl relative ${activeVotingGiftId === gift.id ? 'border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.2)]' : 'border-slate-700'}`}>
                  {gift.holder && (
                    <button 
                      onClick={() => setPkModalGift(gift)}
                      className="absolute top-2 right-2 p-2 bg-slate-700 rounded-full hover:bg-white hover:text-black transition-colors"
                      title="手動變更持有者"
                    >
                      <Edit3 size={14} />
                    </button>
                  )}

                  <div className="flex justify-between items-start mb-4 pr-8">
                    <div>
                      <h3 className="font-bold text-lg text-white">{gift.slogan}</h3>
                      <div className="text-xs text-slate-500 mt-1">From: {gift.provider}</div>
                    </div>
                    {gift.holder && <span className="bg-slate-900 text-white px-2 py-1 rounded text-xs">Holder: {gift.holder}</span>}
                  </div>

                  <div className="space-y-2">
                    {!gift.holder ? (
                      activeVotingGiftId === gift.id ? (
                        <button 
                          onClick={() => onStopVote(gift.id)}
                          className="w-full bg-red-600 hover:bg-red-500 text-white py-3 rounded font-bold flex items-center justify-center gap-2"
                        >
                          <StopCircle /> 結束投票 & 產生受害者
                        </button>
                      ) : (
                        <button 
                          onClick={() => onStartVote(gift.id)}
                          disabled={activeVotingGiftId !== null} 
                          className="w-full bg-purple-600 hover:bg-purple-500 text-white py-3 rounded font-bold flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Play /> 發起投票
                        </button>
                      )
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                         <button 
                          onClick={() => onToggleLock(gift.id)}
                          className={`py-2 rounded font-bold flex items-center justify-center gap-2 border ${gift.isLocked ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-slate-700 border-slate-600 text-slate-300'}`}
                        >
                          {gift.isLocked ? <><Gavel size={16}/> 強制鎖定</> : <><Unlock size={16}/> 解除鎖定</>}
                        </button>
                         <button className="bg-slate-700 text-slate-500 cursor-not-allowed py-2 rounded text-sm">已分配</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'S2' && (
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 text-center">
            <RefreshCw size={48} className="mx-auto text-red-500 mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">S2 最終搶奪階段</h2>
            <p className="text-slate-400">請使用上方的 R1 / S1 分頁來管理持有者變更與鎖定狀態。</p>
            <p className="text-slate-500 text-sm mt-2">點擊任何禮物卡片右上角的 <Edit3 size={12} className="inline"/> 即可交換禮物持有者。</p>
          </div>
        )}
      </div>
    </div>
  );
};

// --- 主程式 (App) ---
export default function App() {
  const [role, setRole] = useState<'PLAYER' | 'HOST'>('PLAYER');
  const [gifts, setGifts] = useState(INITIAL_GIFTS);
  const [currentUser, setCurrentUser] = useState<Player | null>(null);
  
  const [activeVotingGiftId, setActiveVotingGiftId] = useState<string | null>(null);

  const handleJoin = (name: string, inputGifts: { good: any, bad: any }) => {
    const newGoodGift: GiftItem = {
      id: `g${Date.now()}a`, type: 'GOOD', provider: name, holder: null, 
      slogan: inputGifts.good.slogan, tags: inputGifts.good.tags, isRevealed: false, isLocked: false
    };
    const newBadGift: GiftItem = {
      id: `g${Date.now()}b`, type: 'BAD', provider: name, holder: null, 
      slogan: inputGifts.bad.slogan, tags: inputGifts.bad.tags, isRevealed: false, isLocked: false
    };

    setGifts(prev => [...prev, newGoodGift, newBadGift]);
    setCurrentUser({ id: `p${Date.now()}`, name, hasGift: false, wishedGiftId: null });
  };

  const handleWish = (giftId: string) => {
    if (!currentUser) return;
    setCurrentUser(prev => prev ? { ...prev, wishedGiftId: giftId } : null);
  };

  // --- 主台動作邏輯 ---

  const handleHostAssign = (giftId: string, winnerName: string) => {
    setGifts(prev => prev.map(g => g.id === giftId ? { ...g, holder: winnerName } : g));
    
    // 如果剛好分給當前 user，更新他的狀態
    if (winnerName === currentUser?.name) {
      setCurrentUser(prev => prev ? { ...prev, hasGift: true } : null);
    }
  };

  const handleStartVote = (giftId: string) => setActiveVotingGiftId(giftId);
  
  const handleStopVote = (giftId: string) => {
    setActiveVotingGiftId(null);
    const victims = ['Kevin', 'Mary', 'John', currentUser?.name || 'User'];
    const victim = victims[Math.floor(Math.random() * victims.length)];
    setGifts(prev => prev.map(g => g.id === giftId ? { ...g, holder: victim } : g));
  };

  const handleToggleLock = (giftId: string) => {
    setGifts(prev => prev.map(g => g.id === giftId ? { ...g, isLocked: !g.isLocked } : g));
  };

  const handleRevealProvider = (giftId: string) => {
    setGifts(prev => prev.map(g => g.id === giftId ? { ...g, isRevealed: true } : g));
  };

  return (
    <div className="relative">
      <div className="fixed bottom-4 right-4 z-50 flex gap-2">
        <button 
          onClick={() => setRole(role === 'PLAYER' ? 'HOST' : 'PLAYER')}
          className="bg-white text-black px-4 py-2 rounded-full font-bold shadow-2xl border-2 border-black flex items-center gap-2 hover:scale-105 transition-transform"
        >
          {role === 'PLAYER' ? <Monitor size={16} /> : <Smartphone size={16} />}
          切換至 {role === 'PLAYER' ? '主控台' : '玩家端'}
        </button>
      </div>

      {role === 'PLAYER' ? (
        !currentUser ? (
          <LoginScreen onJoin={handleJoin} />
        ) : (
          <PlayerView 
            gifts={gifts} 
            user={currentUser} 
            activeVotingGiftId={activeVotingGiftId}
            onWish={handleWish} 
          />
        )
      ) : (
        <HostDashboard 
          gifts={gifts} 
          activeVotingGiftId={activeVotingGiftId}
          onAssign={handleHostAssign}
          onToggleLock={handleToggleLock}
          onStartVote={handleStartVote}
          onStopVote={handleStopVote}
          onRevealProvider={handleRevealProvider}
        />
      )}
    </div>
  );
}