/**
 * ==========================================================================================
 * PART 1: CLOUDFLARE D1 完整資料庫 Schema
 * ==========================================================================================
 * 請在 Cloudflare D1 Console 執行以下 SQL 來建立資料表：
 * * -- 1. 類別表 (Categories)
 * CREATE TABLE IF NOT EXISTS categories (
 * id INTEGER PRIMARY KEY AUTOINCREMENT,
 * slug TEXT UNIQUE NOT NULL,       -- 唯一識別碼 (如: style, background)
 * label TEXT NOT NULL,             -- 顯示名稱 (如: 畫風, 背景)
 * type TEXT DEFAULT 'required',    -- 類型: 'required'(必填), 'optional'(選填), 'group'(群組)
 * min_count INTEGER DEFAULT 1,     -- 群組最少抽幾個
 * max_count INTEGER DEFAULT 1,     -- 群組最多抽幾個
 * sort_order INTEGER DEFAULT 0     -- 排序權重
 * );
 * * -- 2. 提示詞表 (Prompts)
 * CREATE TABLE IF NOT EXISTS prompts (
 * id INTEGER PRIMARY KEY AUTOINCREMENT,
 * category_slug TEXT NOT NULL,     -- 關聯到 categories.slug
 * value TEXT NOT NULL,             -- 實際的英文 Prompt
 * label TEXT,                      -- 顯示的中文名稱
 * is_active BOOLEAN DEFAULT 1      -- 是否啟用
 * );
 * * -- 3. (選用) 建立索引以加速查詢
 * CREATE INDEX IF NOT EXISTS idx_prompts_category ON prompts(category_slug);
 * * ==========================================================================================
 * PART 2: 後端 API 範例 (functions/api/admin.js) - 處理 CUD 操作
 * ==========================================================================================
 * export async function onRequestPost(context) {
 * const { request, env } = context;
 * const body = await request.json();
 * const { action, table, data } = body; 
 * // 預期 body 格式: { action: 'create'|'update'|'delete', table: 'categories'|'prompts', data: {...} }
 * * if (table === 'categories') {
 * if (action === 'create') {
 * await env.DB.prepare("INSERT INTO categories (slug, label, type, min_count, max_count, sort_order) VALUES (?, ?, ?, ?, ?, ?)").bind(data.slug, data.label, data.type, data.min, data.max, data.sort).run();
 * }
 * // ... 其他 update/delete 邏輯
 * }
 * // ... 簡單回傳成功
 * return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" }});
 * }
 */

import React, { useState, useEffect } from 'react';
import { 
  Dice5, Copy, Lock, Unlock, RefreshCw, Database, Loader2, 
  Settings, Plus, Trash2, Edit2, Save, X, ArrowLeft, Code, FileJson 
} from 'lucide-react';

// --- 模擬資料 (Mock Data) ---
const MOCK_DB_DATA = [
  {
    id: 1, slug: 'subject', label: '主體', type: 'required', min_count: 1, max_count: 1, sort_order: 1,
    items: [
      { id: 101, value: 'girl', label: '少女', is_active: true },
      { id: 102, value: 'cat', label: '貓咪', is_active: true },
      { id: 103, value: 'robot', label: '機器人', is_active: true },
    ]
  },
  {
    id: 2, slug: 'style', label: '畫風', type: 'required', min_count: 1, max_count: 1, sort_order: 2,
    items: [
      { id: 201, value: 'oil painting', label: '油畫', is_active: true },
      { id: 202, value: 'watercolor', label: '水彩', is_active: true },
      { id: 203, value: 'cyberpunk', label: '賽博龐克', is_active: true },
    ]
  },
  {
    id: 4, slug: 'environment', label: '環境', type: 'group', min_count: 1, max_count: 2, sort_order: 3,
    items: [
      { id: 401, value: 'forest', label: '森林', is_active: true },
      { id: 402, value: 'city ruins', label: '城市廢墟', is_active: true },
      { id: 403, value: 'ocean', label: '海洋', is_active: true },
    ]
  }
];

// ==========================================
// Component: API Developer Guide Modal
// ==========================================
const ApiGuideModal = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b bg-slate-50">
          <h3 className="text-lg font-bold flex items-center gap-2 text-slate-800">
            <Code size={20} className="text-blue-600"/> 後端 API 開發指南
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-full"><X size={20}/></button>
        </div>
        
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-700">
          
          <section>
            <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
              <Database size={16}/> 資料庫結構 (D1 Schema)
            </h4>
            <div className="bg-slate-900 text-slate-50 p-4 rounded-lg font-mono text-xs overflow-x-auto">
              <code className="whitespace-pre">{`-- Categories Table
id (INT, PK), slug (TEXT), label (TEXT), type (TEXT), 
min_count (INT), max_count (INT), sort_order (INT)

-- Prompts Table
id (INT, PK), category_slug (TEXT, FK), value (TEXT), 
label (TEXT), is_active (BOOL)`}</code>
            </div>
          </section>

          <section>
            <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
              <FileJson size={16}/> 預期 API Payload (JSON)
            </h4>
            <p className="mb-2">後端 API 應接收以下格式的 POST 請求以更新資料：</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="font-semibold text-xs mb-1 text-blue-600">新增類別 (Create Category)</p>
                <div className="bg-slate-100 p-3 rounded border border-slate-200 font-mono text-xs">
{`{
  "action": "create",
  "table": "categories",
  "data": {
    "slug": "weather",
    "label": "天氣",
    "type": "optional",
    "min_count": 0,
    "max_count": 1,
    "sort_order": 99
  }
}`}
                </div>
              </div>

              <div>
                <p className="font-semibold text-xs mb-1 text-green-600">新增提示詞 (Create Prompt)</p>
                <div className="bg-slate-100 p-3 rounded border border-slate-200 font-mono text-xs">
{`{
  "action": "create",
  "table": "prompts",
  "data": {
    "category_slug": "weather",
    "value": "sunny day",
    "label": "晴天"
  }
}`}
                </div>
              </div>
            </div>
          </section>

          <div className="bg-amber-50 border border-amber-200 p-3 rounded text-amber-800 text-xs">
            <strong>💡 提示：</strong> 請在 Cloudflare Pages Functions 中實作 <code>/api/admin</code> 端點來處理這些請求，並使用 <code>env.DB.prepare(...).run()</code> 執行 SQL。
          </div>
        </div>
        
        <div className="p-4 border-t bg-slate-50 text-right">
          <button onClick={onClose} className="px-4 py-2 bg-slate-800 text-white rounded hover:bg-slate-700">了解</button>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// Component: Admin Panel (Data Manager)
// ==========================================
const AdminPanel = ({ data, onUpdateData, onClose }) => {
  const [activeTab, setActiveTab] = useState(data[0]?.slug || '');
  const [showApiGuide, setShowApiGuide] = useState(false);
  
  // Local state for forms
  const [newCatMode, setNewCatMode] = useState(false);
  const [newPromptMode, setNewPromptMode] = useState(false);
  const [catForm, setCatForm] = useState({ slug: '', label: '', type: 'required', min: 1, max: 1 });
  const [promptForm, setPromptForm] = useState({ value: '', label: '' });

  const activeCategory = data.find(c => c.slug === activeTab);

  // --- Mock CRUD Handlers (Simulating Backend) ---
  const handleAddCategory = () => {
    if (!catForm.slug || !catForm.label) return alert("請填寫 Slug 和 Label");
    const newCat = {
      id: Date.now(),
      slug: catForm.slug,
      label: catForm.label,
      type: catForm.type,
      min_count: parseInt(catForm.min),
      max_count: parseInt(catForm.max),
      items: [],
      sort_order: data.length + 1
    };
    onUpdateData([...data, newCat]);
    setNewCatMode(false);
    setActiveTab(newCat.slug);
    setCatForm({ slug: '', label: '', type: 'required', min: 1, max: 1 });
  };

  const handleDeleteCategory = (slug) => {
    if (!confirm(`確定要刪除類別 ${slug} 嗎？底下的所有 Prompt 都會消失！`)) return;
    const newData = data.filter(c => c.slug !== slug);
    onUpdateData(newData);
    if (activeTab === slug) setActiveTab(newData[0]?.slug || '');
  };

  const handleAddPrompt = () => {
    if (!promptForm.value || !promptForm.label) return alert("請填寫 Prompt 和 Label");
    const updatedData = data.map(cat => {
      if (cat.slug === activeTab) {
        return {
          ...cat,
          items: [...cat.items, {
            id: Date.now(),
            value: promptForm.value,
            label: promptForm.label,
            is_active: true
          }]
        };
      }
      return cat;
    });
    onUpdateData(updatedData);
    setNewPromptMode(false);
    setPromptForm({ value: '', label: '' });
  };

  const handleDeletePrompt = (itemId) => {
    if (!confirm("確定刪除此 Prompt?")) return;
    const updatedData = data.map(cat => {
      if (cat.slug === activeTab) {
        return { ...cat, items: cat.items.filter(i => i.id !== itemId) };
      }
      return cat;
    });
    onUpdateData(updatedData);
  };

  return (
    <div className="fixed inset-0 bg-slate-100 z-50 flex flex-col">
      {/* Header */}
      <div className="bg-slate-900 text-white p-4 shadow-md flex justify-between items-center">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-full transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Database size={20} className="text-blue-400"/> 資料庫管理
          </h2>
        </div>
        <div className="flex gap-2">
           <button 
             onClick={() => setShowApiGuide(true)}
             className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded text-xs flex items-center gap-2 text-blue-300"
           >
             <Code size={14}/> 開發者 API 指南
           </button>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Sidebar: Categories */}
        <div className="w-1/4 min-w-[250px] bg-white border-r border-slate-200 flex flex-col">
          <div className="p-3 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">類別列表</span>
            <button 
              onClick={() => setNewCatMode(true)} 
              className="p-1.5 bg-blue-600 text-white rounded hover:bg-blue-700" title="新增類別"
            >
              <Plus size={16}/>
            </button>
          </div>
          
          <div className="overflow-y-auto flex-1">
            {newCatMode && (
              <div className="p-3 bg-blue-50 border-b border-blue-100 animate-in slide-in-from-top-2">
                <div className="space-y-2">
                  <input className="w-full text-sm p-1 border rounded" placeholder="ID (Slug, e.g. style)" value={catForm.slug} onChange={e => setCatForm({...catForm, slug: e.target.value})} />
                  <input className="w-full text-sm p-1 border rounded" placeholder="顯示名稱 (Label)" value={catForm.label} onChange={e => setCatForm({...catForm, label: e.target.value})} />
                  <div className="flex gap-2">
                    <select className="text-sm border rounded p-1 flex-1" value={catForm.type} onChange={e => setCatForm({...catForm, type: e.target.value})}>
                      <option value="required">必填 (Required)</option>
                      <option value="optional">選用 (Optional)</option>
                      <option value="group">群組 (Group)</option>
                    </select>
                  </div>
                  {(catForm.type === 'group') && (
                     <div className="flex items-center gap-2 text-xs">
                        數: <input type="number" className="w-12 border p-1" value={catForm.min} onChange={e=>setCatForm({...catForm, min:e.target.value})}/> 
                        ~ <input type="number" className="w-12 border p-1" value={catForm.max} onChange={e=>setCatForm({...catForm, max:e.target.value})}/>
                     </div>
                  )}
                  <div className="flex gap-2 mt-2">
                    <button onClick={handleAddCategory} className="flex-1 bg-blue-600 text-white text-xs py-1 rounded">儲存</button>
                    <button onClick={() => setNewCatMode(false)} className="flex-1 bg-slate-200 text-slate-600 text-xs py-1 rounded">取消</button>
                  </div>
                </div>
              </div>
            )}

            {data.map(cat => (
              <div 
                key={cat.id}
                onClick={() => setActiveTab(cat.slug)}
                className={`p-3 border-b border-slate-50 cursor-pointer flex justify-between items-center hover:bg-slate-50 transition-colors ${activeTab === cat.slug ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}`}
              >
                <div>
                  <div className="font-bold text-sm text-slate-800">{cat.label}</div>
                  <div className="text-[10px] text-slate-400 font-mono">{cat.slug} • {cat.type}</div>
                </div>
                {activeTab === cat.slug && (
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat.slug); }} className="text-slate-300 hover:text-red-500">
                    <Trash2 size={14}/>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right Content: Prompts */}
        <div className="flex-1 bg-slate-50 flex flex-col">
          {activeCategory ? (
            <>
              {/* Toolbar */}
              <div className="p-4 bg-white border-b border-slate-200 flex justify-between items-center shadow-sm">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">{activeCategory.label} <span className="text-slate-400 font-normal text-sm">({activeCategory.items.length} items)</span></h3>
                  <p className="text-xs text-slate-500">類型: {activeCategory.type} {activeCategory.type==='group' && `(${activeCategory.min_count}~${activeCategory.max_count})`}</p>
                </div>
                <button 
                  onClick={() => setNewPromptMode(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded text-sm font-bold flex items-center gap-2 shadow-sm"
                >
                  <Plus size={16}/> 新增 Prompt
                </button>
              </div>

              {/* Add Prompt Form */}
              {newPromptMode && (
                <div className="p-4 bg-emerald-50 border-b border-emerald-100 flex gap-2 items-end animate-in fade-in">
                  <div className="flex-1">
                    <label className="text-[10px] text-emerald-700 font-bold uppercase">Prompt Value (English)</label>
                    <input autoFocus className="w-full p-2 border border-emerald-300 rounded text-sm" placeholder="e.g. oil painting" value={promptForm.value} onChange={e => setPromptForm({...promptForm, value: e.target.value})} />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] text-emerald-700 font-bold uppercase">顯示名稱 (Chinese)</label>
                    <input className="w-full p-2 border border-emerald-300 rounded text-sm" placeholder="e.g. 油畫" value={promptForm.label} onChange={e => setPromptForm({...promptForm, label: e.target.value})} />
                  </div>
                  <button onClick={handleAddPrompt} className="bg-emerald-600 text-white p-2 rounded hover:bg-emerald-700 h-[38px] w-[38px] flex items-center justify-center"><Save size={18}/></button>
                  <button onClick={() => setNewPromptMode(false)} className="bg-slate-200 text-slate-600 p-2 rounded hover:bg-slate-300 h-[38px] w-[38px] flex items-center justify-center"><X size={18}/></button>
                </div>
              )}

              {/* Table */}
              <div className="p-4 overflow-y-auto flex-1">
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                      <tr>
                        <th className="p-3 w-16 text-center">ID</th>
                        <th className="p-3">Prompt Value</th>
                        <th className="p-3">標籤 (Label)</th>
                        <th className="p-3 w-20 text-center">狀態</th>
                        <th className="p-3 w-16 text-center">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeCategory.items.map(item => (
                        <tr key={item.id} className="hover:bg-slate-50 group">
                          <td className="p-3 text-center text-slate-400 font-mono text-xs">{item.id}</td>
                          <td className="p-3 font-mono text-slate-700">{item.value}</td>
                          <td className="p-3 text-slate-600">{item.label}</td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${item.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {item.is_active ? 'Active' : 'Disabled'}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <button 
                              onClick={() => handleDeletePrompt(item.id)}
                              className="text-slate-300 hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={16}/>
                            </button>
                          </td>
                        </tr>
                      ))}
                      {activeCategory.items.length === 0 && (
                        <tr>
                          <td colSpan="5" className="p-8 text-center text-slate-400 italic">
                            此類別尚無 Prompt，請點擊右上方新增。
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
             <div className="flex-1 flex items-center justify-center text-slate-400">
               請選擇左側類別以編輯內容
             </div>
          )}
        </div>
      </div>
      
      {showApiGuide && <ApiGuideModal onClose={() => setShowApiGuide(false)} />}
    </div>
  );
};


// ==========================================
// Main App Component
// ==========================================
const App = () => {
  const [configData, setConfigData] = useState([]);
  const [draws, setDraws] = useState({});
  const [locks, setLocks] = useState({});
  const [loading, setLoading] = useState(true);
  const [useMock, setUseMock] = useState(false);
  const [view, setView] = useState('generator'); // 'generator' | 'admin'

  // 1. Fetch Data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/data'); 
        if (!res.ok) throw new Error("API not found");
        const data = await res.json();
        setConfigData(data);
      } catch (err) {
        // console.warn("Using Mock Data");
        setConfigData(MOCK_DB_DATA);
        setUseMock(true);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // 2. Initial Roll
  useEffect(() => {
    if (configData.length > 0 && Object.keys(draws).length === 0) {
      rollAll();
    }
  }, [configData]);

  // --- Logic Helpers ---
  const getRandomItems = (pool, count) => {
    if (!pool || pool.length === 0) return [];
    const activePool = pool.filter(i => i.is_active !== false); // Filter inactive
    const shuffled = [...activePool].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  };

  const rollCategory = (catSlug) => {
    const catConfig = configData.find(c => c.slug === catSlug);
    if (!catConfig || locks[catSlug]) return;

    let count = 1;
    let shouldDraw = true;

    if (catConfig.type === 'optional') shouldDraw = Math.random() > 0.5;
    else if (catConfig.type === 'group') {
      const min = catConfig.min_count || 1;
      const max = catConfig.max_count || 1;
      count = Math.floor(Math.random() * (max - min + 1)) + min;
    }

    if (!shouldDraw) {
      setDraws(prev => ({ ...prev, [catSlug]: [] }));
    } else {
      setDraws(prev => ({ ...prev, [catSlug]: getRandomItems(catConfig.items, count) }));
    }
  };

  const rollAll = () => {
    const newDraws = { ...draws };
    configData.forEach(cat => {
      if (locks[cat.slug]) return;
      
      let count = 1;
      let shouldDraw = true;

      if (cat.type === 'optional') shouldDraw = Math.random() > 0.5;
      else if (cat.type === 'group') {
        const min = cat.min_count || 1;
        const max = cat.max_count || 1;
        count = Math.floor(Math.random() * (max - min + 1)) + min;
      }

      newDraws[cat.slug] = shouldDraw ? getRandomItems(cat.items, count) : [];
    });
    setDraws(newDraws);
  };

  const toggleLock = (slug) => setLocks(p => ({ ...p, [slug]: !p[slug] }));
  
  const toggleCategoryActive = (slug) => {
    const current = draws[slug];
    if (current && current.length > 0) setDraws(p => ({ ...p, [slug]: [] }));
    else rollCategory(slug);
  };

  const copyPrompt = () => {
    const text = configData
      .map(cat => draws[cat.slug]?.map(i => i.value).join(', '))
      .filter(Boolean).join(', ');
    navigator.clipboard.writeText(text);
    alert("已複製: " + text);
  };

  // --- Render ---

  if (view === 'admin') {
    return <AdminPanel data={configData} onUpdateData={setConfigData} onClose={() => setView('generator')} />;
  }

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin mr-2"/> Loading...</div>;

  const generatedPrompt = configData.map(cat => draws[cat.slug]?.map(i => i.value).join(', ')).filter(Boolean).join(', ');

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans text-slate-800">
      
      {/* Navbar */}
      <div className="sticky top-0 z-40 bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-4xl mx-auto p-4">
           {/* Top Bar with Admin Toggle */}
           <div className="flex justify-between items-center mb-2">
             <h1 className="text-sm font-bold text-slate-400 tracking-wider uppercase">Prompt Generator</h1>
             <button 
               onClick={() => setView('admin')}
               className="text-slate-400 hover:text-slate-800 transition-colors p-1" 
               title="資料庫管理"
             >
               <Settings size={18} />
             </button>
           </div>

          <div className="bg-slate-100 rounded-lg p-3 mb-3 border border-slate-200 min-h-[60px] max-h-[100px] overflow-y-auto text-sm font-mono text-slate-600">
            {generatedPrompt || <span className="text-slate-400 italic">...</span>}
          </div>
          
          <div className="flex gap-2">
            <button onClick={rollAll} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-transform">
              <Dice5 size={18} /> 隨機生成
            </button>
            <button onClick={copyPrompt} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-md flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-transform">
              <Copy size={18} /> 複製
            </button>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-4xl mx-auto p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {configData.map(cat => {
          const isLocked = locks[cat.slug];
          const hasContent = draws[cat.slug] && draws[cat.slug].length > 0;
          const isOptional = cat.type === 'optional';

          let cardBorder = "border-slate-200", bgHeader = "bg-white", badgeColor = "bg-blue-100 text-blue-700";
          if (isLocked) { cardBorder = "border-amber-300 ring-1 ring-amber-100"; bgHeader = "bg-amber-50"; }
          else if (!hasContent && isOptional) { cardBorder = "border-slate-100"; bgHeader = "bg-slate-50"; }
          
          if (cat.type === 'optional') badgeColor = "bg-pink-100 text-pink-700";
          if (cat.type === 'group') badgeColor = "bg-orange-100 text-orange-700";

          return (
            <div key={cat.id} className={`flex flex-col rounded-xl border ${cardBorder} bg-white shadow-sm transition-all duration-200 overflow-hidden`}>
              <div 
                className={`flex items-center justify-between p-2 border-b border-slate-100 cursor-pointer ${bgHeader}`}
                onClick={() => isOptional ? toggleCategoryActive(cat.slug) : rollCategory(cat.slug)}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  {isOptional && (
                    <div className={`w-3 h-3 rounded border flex items-center justify-center ${hasContent ? 'bg-pink-500 border-pink-500' : 'border-slate-300 bg-white'}`}>
                      {hasContent && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                    </div>
                  )}
                  <span className={`text-[9px] px-1 py-0.5 rounded font-bold uppercase ${badgeColor}`}>{cat.type === 'group' ? 'GRP' : (cat.type === 'optional' ? 'OPT' : 'REQ')}</span>
                  <span className={`text-sm font-bold truncate ${(!hasContent && isOptional) ? 'text-slate-400' : 'text-slate-700'}`}>{cat.label}</span>
                </div>
              </div>

              <div 
                className={`p-2 flex-1 min-h-[50px] flex flex-wrap content-start gap-1 cursor-pointer hover:bg-slate-50 transition-colors ${!hasContent ? 'opacity-50' : ''}`}
                onClick={() => !isLocked && rollCategory(cat.slug)}
              >
                {hasContent ? draws[cat.slug].map((item, idx) => (
                    <span key={`${item.id}-${idx}`} className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">{item.label || item.value}</span>
                )) : <span className="text-xs text-slate-300 w-full text-center py-2">-</span>}
              </div>

              <div className="flex border-t border-slate-100 divide-x divide-slate-100">
                <button onClick={(e) => { e.stopPropagation(); toggleLock(cat.slug); }} className={`flex-1 py-2 flex items-center justify-center text-xs font-medium ${isLocked ? 'bg-amber-100 text-amber-700' : 'text-slate-400 hover:bg-slate-50'}`}>
                  {isLocked ? <Lock size={12}/> : <Unlock size={12}/>}
                </button>
                <button onClick={(e) => { e.stopPropagation(); rollCategory(cat.slug); }} disabled={isLocked} className="flex-1 py-2 flex items-center justify-center text-xs font-medium text-slate-400 hover:bg-slate-50 disabled:opacity-30">
                  <RefreshCw size={12}/>
                </button>
              </div>
            </div>
          );
        })}
      </div>
      
      {useMock && <div className="fixed bottom-4 right-4 bg-yellow-100 text-yellow-800 text-[10px] px-2 py-1 rounded border border-yellow-200">Mock Mode</div>}
    </div>
  );
};

export default App;