import { Form, useLoaderData, useNavigation, useActionData, useSubmit } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useEffect, useState } from "react";
import { Trash2, MessageCircle, Gift, Info, User, Quote } from "lucide-react";

import { requireBlogDb } from "../../lib/d1.server";

interface VoteRecord {
  id: number;
  user_name: string;
  option_name: string;
  note?: string; // 備註
  created_at: string;
}

// 確保資料庫結構
async function ensureVotesTable(db: D1Database) {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_name TEXT NOT NULL,
      option_name TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`
  ).run();
}

// 1. 後端：讀取數據
export async function loader({ context }: LoaderFunctionArgs) {
  const db = requireBlogDb(context);
  await ensureVotesTable(db);

  // 撈出所有票，包含備註
  // 排序：新到舊 (這對前端判斷誰是第一位發起人很重要)
  const { results } = await db
    .prepare("SELECT id, user_name, option_name, note, created_at FROM votes ORDER BY datetime(created_at) DESC, id DESC")
    .all<VoteRecord>();
  
  return { votes: results || [] };
}

// 2. 後端：處理投票與刪除
export async function action({ request, context }: ActionFunctionArgs) {
  const db = requireBlogDb(context);
  await ensureVotesTable(db);
  const formData = await request.formData();
  const intent = formData.get("intent");

  // --- 處理刪除 (Retake) ---
  if (intent === "delete") {
    const voteId = formData.get("voteId");
    const currentUserName = formData.get("currentUserName");
    
    await db.prepare(
      "DELETE FROM votes WHERE id = ? AND user_name = ?"
    ).bind(voteId, currentUserName).run();

    return { success: true, type: "delete" };
  }

  // --- 處理投票 (Vote) ---
  const userName = (formData.get("userName") as string)?.trim();
  const optionName = (formData.get("optionName") as string)?.trim();
  const note = (formData.get("note") as string)?.trim() || null;

  if (!userName || !optionName) {
    return { error: "名字和主題都要填寫喔！" };
  }

  // 驗證 1：一人只能三票
  const userStats = await db.prepare(
    "SELECT COUNT(*) as count FROM votes WHERE user_name = ?"
  ).bind(userName).first<{ count: number }>();

  if (userStats && userStats.count >= 3) {
    return { error: `等等！${userName}，你的 3 票額度用完囉！先刪除舊的才能再投。` };
  }

  // 驗證 2：不能重複投同一個選項 (新增功能)
  const duplicateCheck = await db.prepare(
    "SELECT id FROM votes WHERE user_name = ? AND option_name = ?"
  ).bind(userName, optionName).first();

  if (duplicateCheck) {
    return { error: `你已經投過「${optionName}」囉！把票留給其他有趣的選項吧 (或是先刪除原本的重投)。` };
  }

  // 寫入資料庫
  await db.prepare(
    "INSERT INTO votes (user_name, option_name, note) VALUES (?, ?, ?)"
  ).bind(userName, optionName, note).run();

  return { success: true, lastUser: userName, type: "vote" };
}

// 3. 前端：顯示介面
export default function VotePage() {
  const { votes } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submit = useSubmit();
  
  const isSubmitting = navigation.state === "submitting";

  // 前端狀態
  const [currentUser, setCurrentUser] = useState("");
  const [inputOption, setInputOption] = useState("");
  const [inputNote, setInputNote] = useState("");

  // 自動填入名字
  useEffect(() => {
    const savedName = localStorage.getItem("vote_username");
    if (savedName) setCurrentUser(savedName);

    if (actionData?.lastUser) {
      setCurrentUser(actionData.lastUser);
      localStorage.setItem("vote_username", actionData.lastUser);
      if (actionData.type === "vote") {
        setInputOption(""); 
        setInputNote("");
      }
    }
  }, [actionData]);

  const handleNameChange = (val: string) => {
    setCurrentUser(val);
    localStorage.setItem("vote_username", val);
  };

  // --- 數據整理 ---
  const myVotes = votes.filter(v => v.user_name === currentUser);
  const remainingVotes = 3 - myVotes.length;

  const groupedVotes = votes.reduce((acc, curr) => {
    if (!acc[curr.option_name]) {
      acc[curr.option_name] = [];
    }
    acc[curr.option_name].push(curr);
    return acc;
  }, {} as Record<string, VoteRecord[]>);

  const sortedOptions = Object.entries(groupedVotes)
    .sort(([, aList], [, bList]) => bList.length - aList.length);

  const handleDelete = (id: number) => {
    if (!confirm("確定要撤回這一票嗎？")) return;
    const formData = new FormData();
    formData.append("intent", "delete");
    formData.append("voteId", id.toString());
    formData.append("currentUserName", currentUser);
    submit(formData, { method: "post" });
  };

  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-50 font-sans text-slate-800">
      <div className="min-h-full py-8 px-4">
        <div className="max-w-xl mx-auto space-y-8">
          
          {/* --- Header --- */}
          <div className="bg-gradient-to-br from-red-600 to-red-800 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden ring-4 ring-white">
            <div className="absolute top-[-20px] left-[-20px] w-32 h-32 bg-white opacity-10 rounded-full blur-2xl"></div>
            <div className="absolute bottom-[-10px] right-[-10px] w-24 h-24 bg-yellow-400 opacity-20 rounded-full blur-xl"></div>
            
            <div className="relative z-10 text-center">
              <div className="flex justify-center mb-4">
                <span className="bg-white/20 p-3 rounded-2xl backdrop-blur-sm">
                  <Gift size={40} className="text-white" />
                </span>
              </div>
              <h1 className="text-3xl font-black tracking-wider mb-2 drop-shadow-md">聖誕交換禮物 🎄</h1>
              <p className="text-red-100 font-medium text-lg">一人 3 票・主題大決鬥</p>
            </div>
          </div>

          {/* --- Dashboard --- */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <div className="mb-4">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 block">你的大名</label>
              <input
                type="text"
                value={currentUser}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="請輸入名字..."
                className="w-full text-lg font-bold bg-slate-50 border-b-2 border-slate-200 focus:border-red-500 px-4 py-2 outline-none transition-colors rounded-t-lg"
              />
            </div>

            {currentUser ? (
              <div>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-bold text-slate-600">你的已投項目</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${remainingVotes > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                    剩餘票數: {remainingVotes}
                  </span>
                </div>
                
                {myVotes.length === 0 ? (
                  <div className="text-center py-4 bg-slate-50 rounded-xl text-slate-400 text-sm border border-dashed border-slate-200">
                    尚未投票
                  </div>
                ) : (
                  <div className="space-y-2">
                    {myVotes.map((vote) => (
                      <div key={vote.id} className="flex justify-between items-center bg-red-50 border border-red-100 px-4 py-3 rounded-xl">
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="font-bold text-red-800 truncate">{vote.option_name}</div>
                          {vote.note && <div className="text-xs text-red-500 truncate opacity-80">{vote.note}</div>}
                        </div>
                        <button 
                          onClick={() => handleDelete(vote.id)}
                          className="p-2 text-red-400 hover:text-red-600 hover:bg-red-100 rounded-full transition-colors shrink-0"
                          title="撤回這一票"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-slate-400 text-sm py-2">👆 請先輸入名字才能開始操作</div>
            )}
          </div>

          {/* --- Voting Form --- */}
          <div className="bg-white rounded-2xl p-6 shadow-xl shadow-slate-200/50 border border-slate-100 relative overflow-visible">
            <div className="absolute top-[-12px] left-6 bg-slate-800 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
              我要投票 / 新增選項
            </div>

            <Form method="post" className="space-y-4 mt-2">
              <input type="hidden" name="intent" value="vote" />
              <input type="hidden" name="userName" value={currentUser} />

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">主題名稱</label>
                  <input
                    type="text"
                    name="optionName"
                    required
                    value={inputOption}
                    onChange={(e) => setInputOption(e.target.value)}
                    placeholder="例如：地獄禮物、紅色系..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 flex items-center gap-1">
                    補充說明 <span className="text-slate-300 font-normal">(選填，可以寫規則)</span>
                  </label>
                  <div className="relative">
                    <MessageCircle className="absolute left-3 top-3 text-slate-400" size={16} />
                    <input
                      type="text"
                      name="note"
                      value={inputNote}
                      onChange={(e) => setInputNote(e.target.value)}
                      placeholder="例如：金額 500 內、必須是二手..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 transition-all"
                    />
                  </div>
                </div>
              </div>

              {actionData?.error && (
                <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 p-3 rounded-lg border border-red-100 animate-pulse">
                  <Info size={16} />
                  {actionData.error}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || !currentUser || remainingVotes <= 0}
                className="w-full bg-red-600 hover:bg-red-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-lg font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-red-200 transform active:scale-95"
              >
                {isSubmitting ? "處理中..." : remainingVotes <= 0 ? "票數用完啦" : "送出投票 🔥"}
              </button>

              {sortedOptions.length > 0 && (
                <div className="pt-2">
                  <p className="text-xs text-slate-400 mb-2">或點選熱門主題 (會自動填入，可再補備註)：</p>
                  <div className="flex flex-wrap gap-2">
                    {sortedOptions.slice(0, 8).map(([opt]) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setInputOption(opt)}
                        className="text-xs font-medium px-3 py-1.5 bg-slate-100 hover:bg-red-50 hover:text-red-600 hover:border-red-200 border border-transparent rounded-full transition-all"
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </Form>
          </div>

          {/* --- Leaderboard --- */}
          <div className="space-y-4 pb-20">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 px-1">
              📊 即時戰況
            </h2>

            <div className="space-y-4">
              {sortedOptions.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl border-2 border-dashed border-slate-200">
                  <p className="text-slate-400 text-lg">還沒有人投票 🥶</p>
                  <p className="text-slate-300 text-sm">快來搶頭香！</p>
                </div>
              ) : (
                sortedOptions.map(([option, votesList], index) => {
                  const isTop2 = index < 2;
                  // 找出發起人 (陣列中最後一個，因為是依時間倒序排的)
                  const creatorVote = votesList[votesList.length - 1];
                  // 檢查發起人是否有備註
                  const hasCreatorNote = creatorVote && creatorVote.note;

                  return (
                    <div 
                      key={option}
                      className={`relative p-5 rounded-2xl border-2 transition-all ${
                        isTop2
                          ? 'bg-white border-yellow-400 shadow-xl shadow-yellow-100/50 z-10' 
                          : 'bg-white/80 border-transparent shadow-sm hover:shadow-md'
                      }`}
                    >
                      {/* Top Label */}
                      {isTop2 && (
                        <div className="absolute top-[-10px] right-4 bg-yellow-400 text-yellow-900 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider shadow-sm">
                          TOP {index + 1}
                        </div>
                      )}

                      <div className="mb-4">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 flex items-center justify-center rounded-full font-bold text-sm shrink-0 ${
                              index === 0 ? 'bg-yellow-100 text-yellow-700' :
                              index === 1 ? 'bg-slate-200 text-slate-600' :
                              'bg-slate-100 text-slate-400'
                            }`}>
                              #{index + 1}
                            </div>
                            <div>
                              <h3 className={`font-bold leading-tight ${isTop2 ? 'text-xl text-slate-900' : 'text-lg text-slate-700'}`}>
                                {option}
                              </h3>
                            </div>
                          </div>
                          <div className="text-center min-w-[3rem] shrink-0 ml-2">
                            <span className={`block text-2xl font-black ${index === 0 ? 'text-yellow-600' : 'text-slate-700'}`}>
                              {votesList.length}
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Votes</span>
                          </div>
                        </div>

                        {/* --- 發起人備註 (Highlight) --- */}
                        {hasCreatorNote && (
                          <div className="mt-2 ml-11 bg-slate-50 p-3 rounded-lg border-l-4 border-slate-300 text-sm text-slate-600 relative">
                            <Quote size={12} className="absolute top-2 left-2 text-slate-300 opacity-50" />
                            <div className="pl-2 font-medium">
                              <span className="text-xs text-slate-400 block mb-1">
                                發起人 ({creatorVote.user_name}) 說：
                              </span>
                              {creatorVote.note}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* --- 投票者列表 --- */}
                      <div className="pl-11">
                        <div className="flex flex-wrap gap-2">
                          {votesList.map((v) => {
                             // 如果是發起人且備註已經顯示在上面了，下面就只顯示名字
                             const isCreator = v.id === creatorVote.id;
                             const showNoteInChip = v.note && (!isCreator || !hasCreatorNote);

                             return (
                              <div 
                                key={v.id} 
                                className={`
                                  group relative inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-default
                                  ${isCreator 
                                    ? 'bg-red-50 border-red-100 text-red-700' // 發起人特別色
                                    : 'bg-slate-50 border-slate-100 text-slate-600 hover:border-red-200 hover:bg-red-50'
                                  }
                                `}
                              >
                                {isCreator && <User size={10} className="mr-1 opacity-50" />}
                                {v.user_name}
                                
                                {/* 一般備註 (氣泡顯示) */}
                                {showNoteInChip && (
                                  <div className="ml-1.5 flex items-center max-w-[150px]">
                                     <div className="h-3 w-[1px] bg-slate-300 mx-1"></div>
                                     <span className="truncate opacity-70 italic max-w-[100px]">{v.note}</span>
                                  </div>
                                )}
                              </div>
                             );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}