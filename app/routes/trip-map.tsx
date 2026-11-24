import { useEffect, useRef, useState } from "react";
import type { MetaFunction } from "react-router";
import "../styles/trip-map-ukiyo.css";
import "../styles/trip-map-story.css";
import { ThreeDayPrelude, RouteGallery } from "../features/trip-map/TravelStory";
import { TripFinale } from "../features/trip-map/TripFinale";
import "../styles/trip-map-finale.css";
import { makeTourState, type TourPhase } from "../features/trip-map/tour";
import "../styles/trip-map-creator.css";
import { ArrowRight, Check, ChevronRight, Heart, LockKeyhole } from "lucide-react";
import { PEOPLE, QUESTIONS, ROUTES, ROUTE_KEYS, ROLES, pairFit, validAnswer, type Answers, type Role } from "../features/trip-map/questions";

export const meta:MetaFunction=()=>[{title:"旅の謎｜我們的旅行地圖 · 彥禎 × 涵郁"},{name:"description",content:"浮世繪風格的新竹雙人同步解謎旅行"}];

type Value=Record<string,any>;
type State={
 role:Role; step:number; revealed:boolean; finished:boolean; joined:Role[]; submitted:Role[];
 answers:Record<Role,Record<string,Value>>; finalists:Partial<Record<Role,string[]>>;
};
const other=(r:Role):Role=>r==="yanzhen"?"hanyu":"yanzhen";
const toAmount=(n:unknown)=>"NT$ "+Number(n||0).toLocaleString("zh-TW");
const inputBase="tm-textbox w-full rounded-xl border border-emerald-900/15 bg-white px-4 py-3 text-slate-800 outline-none focus:ring-2 focus:ring-emerald-600/30";
const cardBase="tm-paper-card rounded-2xl border border-emerald-900/10 bg-white/90 p-5 shadow-sm md:p-7";
const buttonBase="tm-action rounded-xl px-5 py-3 font-semibold transition disabled:cursor-not-allowed disabled:opacity-40";
const labelFor=(qIndex:number,k:string)=>QUESTIONS[qIndex]?.items?.find(i=>i[0]===k)?.[1]||k;

function defaultValue(step:number):Value{
 const q=QUESTIONS[step]; if(!q) return {};
 if(q.kind==="rating")return {};
 if(q.kind==="postcard")return {keep:[],drop:""};
 if(q.kind==="coins")return Object.fromEntries((q.items||[]).map(([k])=>[k,0]));
 if(q.kind==="reality")return {preferred:1000,cap:1800,cold:3,effort:3};
 if(q.kind==="note")return {message:""};
 return {};
}
function tokenGen(){return Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,"0")).join("");}
async function send(op:string,role:Role,token:string,payload:Value={}){
 const res=await fetch("/api/trip-map",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({op,role,token,...payload}),cache:"no-store"});
 let body:any={};try{body=await res.json();}catch{}
 if(!res.ok)throw new Error(body.error||"伺服器回應錯誤，請稍後重試");
 return body.state as State;
}

function Marks({value,onChange,low,high}:{value?:number;onChange:(n:number)=>void;low?:string;high?:string}){
 return <div className="tm-marks flex items-center gap-1.5">
  {[1,2,3,4,5].map(n=><button type="button" key={n} aria-label={String(n)+" 分"} aria-pressed={value===n} onClick={()=>onChange(n)} className={"flex h-10 min-w-0 flex-1 items-center justify-center rounded-xl border text-sm font-bold transition "+(value===n?"border-emerald-900 bg-emerald-900 text-white":"border-emerald-900/15 bg-emerald-50/60 text-emerald-950 hover:bg-emerald-100")}>{n}</button>)}
  <span className="ml-2 hidden w-20 text-xs text-slate-500 sm:block">{value===1?low:value===5?high:value?value+" 分":""}</span>
 </div>;
}
function Compare({step,answers}:{step:number;answers:Record<Role,Value>}){
 const q=QUESTIONS[step]; const a=answers.yanzhen||{},b=answers.hanyu||{};
 return <div className="space-y-3">
  <div className="grid grid-cols-2 gap-3 text-center text-sm font-semibold text-emerald-900"><div>彥禎</div><div>涵郁</div></div>
  {q.kind==="rating" && q.items?.map(([k,t])=><div key={k} className="rounded-2xl bg-emerald-50/80 p-3">
   <div className="mb-2 text-sm text-slate-700">{t}</div>
   <div className="grid grid-cols-2 gap-3 text-center text-lg font-bold"><div className={a[k]===b[k]?"text-emerald-700":"text-slate-800"}>{a[k]??"–"} <span className="text-xs font-normal">/ 5</span></div><div className={a[k]===b[k]?"text-emerald-700":"text-slate-800"}>{b[k]??"–"} <span className="text-xs font-normal">/ 5</span></div></div>
  </div>)}
  {q.kind==="coins" && q.items?.map(([k,t])=><div key={k} className="rounded-2xl bg-emerald-50/80 p-3">
   <div className="mb-2 text-sm">{t}</div><div className="grid grid-cols-2 gap-3 text-center font-bold"><div>{a[k]??0} 枚</div><div>{b[k]??0} 枚</div></div>
  </div>)}
  {q.kind==="postcard" && <div className="grid grid-cols-2 gap-3 text-sm">
   {ROLES.map(r=><div key={r} className="rounded-2xl bg-emerald-50 p-3"><div className="mb-2 font-bold">最想收藏</div>{(answers[r]?.keep||[]).map((k:string)=><p key={k} className="mb-2">{labelFor(step,k)}</p>)}<div className="mt-3 border-t border-emerald-900/10 pt-2 text-slate-500">不留：{labelFor(step,answers[r]?.drop)}</div></div>)}
  </div>}
  {q.kind==="reality" && <div className="grid grid-cols-2 gap-3 text-sm">{ROLES.map(r=><div key={r} className="space-y-2 rounded-2xl bg-emerald-50 p-3"><p>舒服花費：<b>{toAmount(answers[r]?.preferred)}</b></p><p>絕對上限：<b>{toAmount(answers[r]?.cap)}</b></p><p>寒冷接受度：{answers[r]?.cold}/5</p><p>步行接受度：{answers[r]?.effort}/5</p></div>)}</div>}
  {q.kind==="note" && <div className="grid grid-cols-2 gap-3">{ROLES.map(r=><div key={r} className="min-h-28 rounded-2xl bg-emerald-50 p-4 whitespace-pre-wrap text-sm">{answers[r]?.message||"留白，也是選擇。"}</div>)}</div>}
 </div>;
}
function Form({step,value,onChange}:{step:number;value:Value;onChange:(v:Value)=>void}){
 const q=QUESTIONS[step];const assign=(k:string,v:any)=>onChange({...value,[k]:v});
 return <div className="space-y-5">
 {q.kind==="rating" && q.items?.map(([k,t])=><div key={k} className="rounded-2xl border border-emerald-900/10 bg-emerald-50/45 p-4"><p className="mb-3 text-sm font-medium leading-relaxed">{t}</p><Marks value={value[k]} onChange={v=>assign(k,v)} low={q.low} high={q.high}/></div>)}
 {q.kind==="postcard" && q.items?.map(([k,t])=>{
  const keep:string[]=value.keep||[],drop=value.drop||"";
  const setKeep=()=>{if(keep.includes(k))assign("keep",keep.filter(x=>x!==k));else if(keep.length<2)onChange({...value,keep:[...keep,k],drop:drop===k?"":drop});};
  const setDrop=()=>onChange({...value,drop:drop===k?"":k,keep:keep.filter(x=>x!==k)});
  return <div key={k} className="rounded-2xl border border-emerald-900/10 bg-emerald-50/45 p-4"><p className="mb-3 text-sm">{t}</p><div className="flex flex-wrap gap-2"><button onClick={setKeep} type="button" className={"rounded-xl px-4 py-2 text-sm font-bold "+(keep.includes(k)?"bg-emerald-900 text-white":"bg-white text-emerald-900 border border-emerald-800/20")}>收藏 {keep.includes(k)?"✓":""}</button><button onClick={setDrop} type="button" className={"rounded-xl px-4 py-2 text-sm font-semibold "+(drop===k?"bg-amber-200 text-amber-900":"bg-white border border-amber-800/20 text-amber-900")}>沒拍到也沒關係 {drop===k?"✓":""}</button></div></div>;
 })}
 {q.kind==="postcard"&&<p className="text-sm text-slate-500">已收藏 {(value.keep||[]).length} / 2 張；另選一張最不在意的。</p>}
 {q.kind==="coins"&&<div className="rounded-2xl bg-amber-50 p-4 text-amber-950"><b>還有 {8-(q.items||[]).reduce((s,[k])=>s+Number(value[k]||0),0)} 枚金幣</b> 可以分配</div>}
 {q.kind==="coins"&&q.items?.map(([k,t])=><div key={k} className="flex items-center gap-3 rounded-2xl bg-emerald-50/65 p-4"><div className="flex-1 text-sm">{t}</div><button aria-label={"減少"+t} className="h-10 w-10 rounded-xl border border-emerald-900/20 bg-white text-xl" disabled={!value[k]} onClick={()=>assign(k,Number(value[k]||0)-1)}>−</button><span className="w-7 text-center font-bold">{value[k]||0}</span><button aria-label={"增加"+t} className="h-10 w-10 rounded-xl border border-emerald-900/20 bg-white text-xl" disabled={(q.items||[]).reduce((s,[n])=>s+Number(value[n]||0),0)>=8} onClick={()=>assign(k,Number(value[k]||0)+1)}>＋</button></div>)}
 {q.kind==="reality"&&<div className="space-y-5">
  <label className="block text-sm font-semibold">每人一天，花起來舒服的金額（NT$）<input className={inputBase+" mt-2"} type="number" min="0" max="10000" step="100" value={value.preferred??""} onChange={e=>assign("preferred",Number(e.target.value))}/></label>
  <label className="block text-sm font-semibold">每人一天，絕對不希望超過（NT$）<input className={inputBase+" mt-2"} type="number" min="0" max="20000" step="100" value={value.cap??""} onChange={e=>assign("cap",Number(e.target.value))}/></label>
  <div><p className="mb-3 text-sm font-semibold">冬天在戶外待久一點，你能接受多少？</p><Marks value={value.cold} onChange={v=>assign("cold",v)} low="很怕冷" high="可以保暖出遊"/></div>
  <div><p className="mb-3 text-sm font-semibold">一天安排散步或有坡度的步道，你能接受多少？</p><Marks value={value.effort} onChange={v=>assign("effort",v)} low="輕鬆就好" high="也喜歡健行"/></div>
  <p className="text-xs leading-6 text-slate-500">預算只作為候選路線的提醒；實際花費仍需確認當天的票價、餐飲及交通。</p>
 </div>}
 {q.kind==="note"&&<textarea rows={5} maxLength={400} placeholder="想偷偷留下的一句話或一個小驚喜……" className={inputBase} value={value.message||""} onChange={e=>assign("message",e.target.value)}/>}
 </div>;
}
function extract(state:State,role:Role):Answers{
 const a:Answers={};
 QUESTIONS.forEach((q,i)=>{a[q.id]=state.answers[role]?.[String(i)]||{};});
 return a;
}

export default function TripMap(){
 const [session,setSession]=useState<{role:Role;token:string}|null>(null);
 const [state,setState]=useState<State|null>(null);
 const [form,setForm]=useState<Value>({});
 const [choice,setChoice]=useState<string[]>([]);
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(false);
 const [creatorTour,setCreatorTour]=useState(false);
 const tourOverrides=useRef<Record<number,Value>>({});
 const tourFinalists=useRef<Partial<Record<Role,string[]>>>({});
 const lastRef=useRef<string>("");
 const sessionRef=useRef(session); sessionRef.current=session;
 function startTour(){
  setError("");setCreatorTour(true);tourOverrides.current={};tourFinalists.current={};lastRef.current="";
  const role:Role="yanzhen";setSession({role,token:"creator-tour-only"});
  setState(makeTourState(role,0,"answer"));setChoice([]);
 }
 function tourJump(step:number,phase:TourPhase){
  if(!sessionRef.current)return;
  const nextStep=phase==="result"?QUESTIONS.length:Math.max(0,Math.min(QUESTIONS.length-1,step));
  setError("");setState(makeTourState(sessionRef.current.role,nextStep,phase,tourOverrides.current,tourFinalists.current));
 }
 async function enter(role:Role){
  setLoading(true);setError("");
  const key="trip-map-2027-"+role;
  const saved=localStorage.getItem(key);
  const token=saved||tokenGen();
  try{
   const s=await send("claim",role,token);
   if(!saved)localStorage.setItem(key,token);
   setSession({role,token});setState(s);setChoice(s.finalists?.[role]||[]);
  }catch(e){setError(e instanceof Error?e.message:"無法登入");}
  finally{setLoading(false);}
 }
 async function invoke(op:string,payload:Value={}){
  if(!sessionRef.current) return;
  if(creatorTour){
   const role=sessionRef.current.role;
   if(op==="answer"&&state&&validAnswer(state.step,payload.answer)){
    tourOverrides.current[state.step]=structuredClone(payload.answer);tourJump(state.step,"waiting");
   }else if(op==="advance"&&state){
    tourJump(state.step+1,state.step+1>=QUESTIONS.length?"result":"answer");
   }else if(op==="finalists"&&Array.isArray(payload.choices)){
    tourFinalists.current={...tourFinalists.current,[role]:[...payload.choices]};tourJump(QUESTIONS.length,"result");
   }
   return;
  }
  setBusy(true);setError("");
  try{const s=await send(op,sessionRef.current.role,sessionRef.current.token,payload);setState(s);}
  catch(e){setError(e instanceof Error?e.message:"連線失敗");}
  finally{setBusy(false);}
 }
 useEffect(()=>{
  if(!session||creatorTour)return;
  let active=true;
  const poll=async()=>{
   try{const s=await send("state",session.role,session.token);if(active)setState(s);}
   catch(e){if(active)setError(e instanceof Error?e.message:"讀取狀態失敗");}
  };
  const id=window.setInterval(poll,2500);
  return ()=>{active=false;window.clearInterval(id);};
 },[session?.role,session?.token,creatorTour]);
 useEffect(()=>{
  if(!session||!state)return;
  const key=session.role+"-"+state.step;
  if(lastRef.current===key)return;
  lastRef.current=key;
  setForm(state.answers?.[session.role]?.[String(state.step)]||defaultValue(state.step));
  window.scrollTo({top:0,behavior:"smooth"});
 },[state?.step,session?.role]);
 if(!session)return <div className="tm-ukiyo min-h-screen">
  <main className="tm-entry">
   <div className="tm-entry__eyebrow"><span>旅の謎解き · 2027 / 01 / 02</span></div>
   <div className="tm-cover">
    <img className="tm-cover__art" src="/trip-map/ukiyo-fuji.svg" alt="朱紅日輪、富士山與層層海浪構成的浮世繪風格旅行圖景" />
    <div className="tm-cover__wash" aria-hidden="true"/>
    <div className="tm-cover__copy">
     <div className="tm-stamp" aria-hidden="true">謎</div>
     <p className="tm-cover__kicker">第壱章　ふたりの旅</p>
     <h1 className="tm-cover__title">我們的<br/>旅行地圖</h1>
     <span className="tm-cover__jp" lang="ja">ふたりの旅の地図</span>
     <p className="tm-cover__lead">第一天在風城相遇，第三天從市區帶著回憶返程。中間最自由的那一天，還是一張空白地圖；用十道謎題，把它寫成兩個人都期待的故事。</p>
    </div>
    <span className="tm-cover__side" aria-hidden="true" lang="ja">旅のしるべ　一期一会</span>
   </div>
   <ThreeDayPrelude/>
   <div className="tm-entry__intro">
    <p className="tm-progress-kicker text-xs font-bold tracking-[.23em]">壱 · 謎解きのはじまり</p>
    <h2 className="mt-2">請領取你的旅人身分</h2>
    <p>一人一個入口，各自解開同一題。兩人都送出答案，才會一起翻開謎底。</p>
   </div>
   <div className="tm-role-grid">
    {ROLES.map(role=><button key={role} disabled={loading} onClick={()=>enter(role)} className="tm-role-card disabled:opacity-40">
     <div className="tm-role-card__seal" aria-hidden="true">{PEOPLE[role][0]}</div>
     <div className="tm-role-card__name">{PEOPLE[role]}</div>
     <div className="tm-role-card__hint">選擇此身分，展開手札 <ArrowRight size={15}/></div>
    </button>)}
   </div>
   <div className="tm-creator-entry"><button type="button" onClick={startTour}><span aria-hidden="true">試</span><span>製作者遊覽</span><small>查看作答、等待、揭曉與結算頁</small></button></div>
   <div className="tm-entry__note"><span className="tm-serif font-bold" lang="ja">旅の心得 · </span>請各自使用自己的手機或瀏覽器。首次選擇身分後，裝置會保存專屬識別碼；目前不支援自行換機。</div>
   {!!error&&<p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
   <p className="tm-scroll-note">— 旅の謎 · ふたりで解く小さな物語 —</p>
  </main>
 </div>;
 if(!state)return <div className="tm-ukiyo min-h-screen p-12 text-center">旅の謎 · 地圖展開中……</div>;
 const me=session.role,them=other(me),q=QUESTIONS[state.step],answered=state.submitted.includes(me),theAnswered=state.submitted.includes(them);
 const reveal=state.revealed&&!state.finished;
 const answers={yanzhen:state.answers.yanzhen?.[String(state.step)]||{},hanyu:state.answers.hanyu?.[String(state.step)]||{}};
 const fits=state.finished?pairFit({yanzhen:extract(state,"yanzhen"),hanyu:extract(state,"hanyu")}):[];
 const finalNames=(r:Role)=>state.finalists?.[r]||[];
 const bothFinal=finalNames("yanzhen").length>=2&&finalNames("hanyu").length>=2;
 return <div className="tm-ukiyo min-h-screen pb-20">
  <div className="tm-kana-watermark tm-kana-watermark--left" lang="ja" aria-hidden="true">旅の謎</div>
  <div className="tm-kana-watermark tm-kana-watermark--right" lang="ja" aria-hidden="true">一期一会</div>
  <header className="tm-topbar"><div className="tm-topbar__inner">
   <div className="tm-topbar__brand"><span className="tm-topbar__crest" aria-hidden="true">旅</span><span>我們的旅行地圖<small className="tm-topbar__sub ml-2" lang="ja">ふたりの旅</small></span></div>
   <div className="tm-topbar__state">{PEOPLE[me]} <span className="tm-online" lang="ja">{creatorTour?"試作巡覽":"謎解き中 · 同步"}</span></div>
  </div></header>
  <div className="tm-scene-banner" aria-hidden="true"><img src="/trip-map/ukiyo-fuji.svg" alt=""/><span className="tm-scene-banner__label" lang="ja">旅の途中 · 道しるべ</span></div>
  {creatorTour&&<div className="tm-tour-console" role="region" aria-label="製作者遊覽操作台">
    <div className="tm-tour-console__label"><b>試</b> 製作者遊覽 <small>原版畫面 · 虛構資料 · 不寫入 D1</small></div>
    <div className="tm-tour-console__buttons">
     <button type="button" onClick={()=>tourJump(state.step-1,"answer")} disabled={state.step<=0}>上一題</button>
     <button type="button" onClick={()=>tourJump(state.finished?0:state.step,"answer")}>作答頁</button>
     <button type="button" onClick={()=>tourJump(state.finished?0:state.step,"waiting")}>等待頁</button>
     <button type="button" onClick={()=>tourJump(state.finished?0:state.step,"reveal")}>對答案</button>
     <button type="button" onClick={()=>tourJump(state.step+1,"answer")} disabled={state.step>=QUESTIONS.length-1}>下一題</button>
     <button type="button" onClick={()=>tourJump(QUESTIONS.length,"result")}>結算頁</button>
     <button type="button" className="tm-tour-console__exit" onClick={()=>{setCreatorTour(false);setSession(null);setState(null);lastRef.current="";}}>離開遊覽</button>
    </div>
   </div>}
  <div className="tm-board relative z-10 mx-auto max-w-3xl space-y-5 px-4 py-6 md:px-6 md:py-10">
   {!state.finished&&<div className="tm-progress-kicker flex items-center justify-between text-xs font-bold"><span>{q.chapter}</span><span>第 {state.step+1} / {QUESTIONS.length} 題</span></div>}
   {!state.finished&&<div className="tm-progress-bar h-2 overflow-hidden rounded-full bg-emerald-900/10"><div className="h-full rounded-full bg-emerald-700 transition-all" style={{width:((state.step+1)/QUESTIONS.length*100)+"%"}}/></div>}
   {state.finished ? <>
    <TripFinale matches={fits}>
    <RouteGallery selected={choice} onToggle={(id)=>setChoice(old=>old.includes(id)?old.filter(x=>x!==id):old.length<3?[...old,id]:old)}/>
    <section className={cardBase}><h2 className="text-xl font-black">我們各自想留下哪幾條路？</h2><p className="my-3 text-sm text-slate-600">請各自選擇 2～3 條想進一步討論的路線。這是最後共同拍板的起點。</p>
     <div className="grid gap-2 sm:grid-cols-2">{ROUTE_KEYS.map(id=><button key={id} type="button" onClick={()=>setChoice(old=>old.includes(id)?old.filter(x=>x!==id):old.length<3?[...old,id]:old)} className={"rounded-xl border p-3 text-left text-sm transition "+(choice.includes(id)?"border-emerald-800 bg-emerald-900 text-white":"border-emerald-900/10 bg-emerald-50 hover:bg-emerald-100")}>{choice.includes(id)?"✓ ":""}{id} · {ROUTES[id].name}</button>)}</div>
     <button disabled={busy||choice.length<2||choice.length>3} onClick={()=>invoke("finalists",{choices:choice})} className={buttonBase+" mt-4 w-full bg-emerald-900 text-white"}>保存我的候選 ({choice.length}/3)</button>
     <div className="mt-5 grid grid-cols-2 gap-3 text-sm">{ROLES.map(r=><div key={r} className="rounded-xl bg-emerald-50 p-3"><b>{PEOPLE[r]}</b><p className="mt-2">{finalNames(r).length?finalNames(r).join("、"):"尚未選定"}</p></div>)}</div>
     {bothFinal&&<div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm"><b>兩人都選好了。</b>共同選中的有：{finalNames("yanzhen").filter(x=>finalNames("hanyu").includes(x)).join("、")||"目前沒有重複選項，可互相說說原因。"}。接下來就能從這些候選一起拍板。</div>}
    </section>
    <section className={cardBase}><h2 className="mb-3 text-xl font-black">給彼此的秘密註記</h2><Compare step={QUESTIONS.length-1} answers={{yanzhen:state.answers.yanzhen?.[String(QUESTIONS.length-1)]||{},hanyu:state.answers.hanyu?.[String(QUESTIONS.length-1)]||{}}}/></section>
    </TripFinale>
   </> : <>
    <section className={cardBase}><div className="tm-question-stamp"><span aria-hidden="true">{reveal?"解":"問"}</span>{reveal?"答え合わせ · 謎底揭曉":"旅の謎 · "+String(state.step+1).padStart(2,"0")}</div><h1 className="mt-5 text-2xl font-black leading-snug md:text-3xl">{q.title}</h1><div className="tm-question-rule" aria-hidden="true"/><p className="mt-5 leading-7 text-slate-600">{q.desc}</p></section>
    {!reveal ? <section className={cardBase}>
     {answered?<div className="py-10 text-center"><LockKeyhole className="mx-auto mb-4 text-emerald-800" size={36}/><h2 className="text-xl font-bold">你的答案已封存</h2><p className="mt-3 text-slate-600">{theAnswered?"你們已經答完，正在準備揭曉……":"正在等 "+PEOPLE[them]+" 完成這一題"}</p><p className="mt-3 text-xs text-slate-500">另一位完成後會自動揭曉，不必重新整理。</p></div>:
     <><Form step={state.step} value={form} onChange={setForm}/><button disabled={busy||!validAnswer(state.step,form)} onClick={()=>invoke("answer",{step:state.step,answer:form})} className={buttonBase+" mt-6 w-full bg-emerald-900 text-white"}>送出這一題 <ArrowRight className="ml-2 inline-block" size={16}/></button><p className="mt-3 text-center text-xs text-slate-500">兩人都送出後，答案會同時解鎖。</p></>}
    </section>:<section className={cardBase}><div className="mb-5 tm-reveal-tag"><Heart size={18}/>答え合わせ · 雙人答案揭曉</div><Compare step={state.step} answers={answers}/><div className="tm-response-box mt-6 bg-amber-50 p-4"><p className="mb-2 text-xs font-bold tracking-wider text-amber-800">ひとこと · 聊聊這題</p><p className="leading-7 text-amber-950">{q.talk}</p></div><button disabled={busy} onClick={()=>invoke("advance",{step:state.step})} className={buttonBase+" mt-6 flex w-full items-center justify-center gap-2 bg-emerald-900 text-white"}>{state.step===QUESTIONS.length-1?"展開我們的旅行報告":"一起前往下一題"} <ChevronRight size={17}/></button><p className="mt-3 text-center text-xs text-slate-500">任一人按下，兩台裝置都會一起前進。</p></section>}
    <div className="grid grid-cols-2 gap-3 text-center text-xs"><div className={"rounded-xl p-3 "+(state.submitted.includes("yanzhen")?"bg-emerald-200 text-emerald-900":"bg-white text-slate-500")}>{state.submitted.includes("yanzhen")?<Check size={15} className="mr-1 inline"/>:null}彥禎 {state.submitted.includes("yanzhen")?"已完成":"作答中"}</div><div className={"rounded-xl p-3 "+(state.submitted.includes("hanyu")?"bg-emerald-200 text-emerald-900":"bg-white text-slate-500")}>{state.submitted.includes("hanyu")?<Check size={15} className="mr-1 inline"/>:null}涵郁 {state.submitted.includes("hanyu")?"已完成":"作答中"}</div></div>
   </>}
   {!!error&&<div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}<button className="ml-3 underline" onClick={()=>setError("")}>關閉</button></div>}
   <footer className="pt-5 text-center text-xs leading-6 text-slate-500">旅の謎 · 2027 / 01 / 02 · 新竹旅行<br/>{creatorTour?"這些遊覽資料只在本頁，不會影響正式紀錄":"本頁每 2.5 秒同步一次 · 你們的回答保存在專案 D1 資料庫"}</footer>
  </div>
 </div>;
}
