import type { ActionFunctionArgs } from "react-router";
import { requireBlogDb } from "../../lib/d1.server";
import { PEOPLE, QUESTIONS, ROUTE_KEYS, ROLES, validAnswer, type Role } from "./questions";

type Db = D1Database;
let schemaSeen = false;
async function init(db:Db){
 if(schemaSeen) return;
 try { await db.prepare("SELECT step FROM trip_duo_progress WHERE id=1").first(); schemaSeen=true; return; } catch { /* fresh installation */ }
 await db.batch([
  db.prepare("CREATE TABLE IF NOT EXISTS trip_duo_progress (id INTEGER PRIMARY KEY CHECK(id=1), step INTEGER NOT NULL DEFAULT 0, revealed INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
  db.prepare("CREATE TABLE IF NOT EXISTS trip_duo_players (role TEXT PRIMARY KEY, token_hash TEXT NOT NULL, joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
  db.prepare("CREATE TABLE IF NOT EXISTS trip_duo_answers (role TEXT NOT NULL, step INTEGER NOT NULL, payload TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(role,step))"),
  db.prepare("CREATE TABLE IF NOT EXISTS trip_duo_finalists (role TEXT PRIMARY KEY, choices TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)")
 ]);
 await db.prepare("INSERT OR IGNORE INTO trip_duo_progress (id,step,revealed) VALUES (1,0,0)").run();
 schemaSeen=true;
}
/**
 * 使用者要求清空早期跨裝置試玩的資料。
 * 透過 D1 交易式單次重置標記，防止 Worker 冷啟動重複清除正式答案。
 * 只影響 trip_duo_ 前綴資料，保留網站其他資料。
 */
const INITIAL_RESET_KEY="trip-map-creator-tour-reset-2026-11-24-v1";
let initialResetComplete=false;
async function runOneTimeRequestedReset(db:Db){
 if(initialResetComplete)return;
 await db.prepare("CREATE TABLE IF NOT EXISTS trip_duo_maintenance (key TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
 const onlyFirst="NOT EXISTS (SELECT 1 FROM trip_duo_maintenance WHERE key=?)";
 // Batch 內按順序交易執行：若已有標記，所有刪除與重置皆不會生效。
 await db.batch([
  db.prepare("DELETE FROM trip_duo_answers WHERE "+onlyFirst).bind(INITIAL_RESET_KEY),
  db.prepare("DELETE FROM trip_duo_finalists WHERE "+onlyFirst).bind(INITIAL_RESET_KEY),
  db.prepare("DELETE FROM trip_duo_players WHERE "+onlyFirst).bind(INITIAL_RESET_KEY),
  db.prepare("UPDATE trip_duo_progress SET step=0,revealed=0,updated_at=CURRENT_TIMESTAMP WHERE id=1 AND "+onlyFirst).bind(INITIAL_RESET_KEY),
  db.prepare("INSERT OR IGNORE INTO trip_duo_maintenance(key) VALUES (?)").bind(INITIAL_RESET_KEY)
 ]);
 initialResetComplete=true;
}

const denied=(message:string,status=400)=>Response.json({error:message},{status,headers:{"Cache-Control":"no-store"}});
function roleOf(input:unknown):Role|null{return typeof input==="string"&&ROLES.includes(input as Role)? input as Role:null;}
function tokenOkay(t:unknown){return typeof t==="string"&&t.length>=30&&t.length<=256&&/^[a-zA-Z0-9_-]+$/.test(t);}
async function digest(t:string){
 const hash=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(t));
 return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,"0")).join("");
}
async function authenticated(db:Db,role:Role,token:string){
 const row=await db.prepare("SELECT token_hash FROM trip_duo_players WHERE role=?").bind(role).first<{token_hash:string}>();
 return !!row && row.token_hash===await digest(token);
}
type Progress={step:number;revealed:number};
async function getProgress(db:Db){
 return (await db.prepare("SELECT step,revealed FROM trip_duo_progress WHERE id=1").first<Progress>()) || {step:0,revealed:0};
}
async function state(db:Db,role:Role){
 const progress=await getProgress(db);
 const all=progress.step>=QUESTIONS.length;
 const count=await db.prepare("SELECT role,step,payload FROM trip_duo_answers").all<{role:Role;step:number;payload:string}>();
 const items=count.results??[];
 const current=items.filter(x=>x.step===progress.step);
 if(!all && progress.revealed===0 && current.length===2){
  await db.prepare("UPDATE trip_duo_progress SET revealed=1,updated_at=CURRENT_TIMESTAMP WHERE id=1 AND step=? AND revealed=0").bind(progress.step).run();
  progress.revealed=1;
 }
 const answers:Record<string,Record<string,unknown>>={yanzhen:{},hanyu:{}};
 for(const x of items){ if(answers[x.role] && (all || (progress.revealed===1 && x.step===progress.step) || (x.role===role && x.step===progress.step))){
  try { answers[x.role][String(x.step)]=JSON.parse(x.payload); } catch{}
 }}
 const players=await db.prepare("SELECT role FROM trip_duo_players").all<{role:Role}>();
 const finalists=await db.prepare("SELECT role,choices FROM trip_duo_finalists").all<{role:Role;choices:string}>();
 const choices:Record<string,string[]>={};
 for(const item of finalists.results??[]) {try { choices[item.role]=JSON.parse(item.choices); }catch{}}
 return {
  role, step:progress.step,revealed:!!progress.revealed,finished:all,
  joined:(players.results??[]).map(x=>x.role),
  submitted:ROLES.filter(r=>current.some(x=>x.role===r)),
  answers,finalists:choices,questionCount:QUESTIONS.length
 };
}

export async function handleTripMap({request,context}:ActionFunctionArgs){
 if(request.method!=="POST") return denied("這個入口目前無法用這種方式開啟。",405);
 const size=Number(request.headers.get("content-length")||0); if(size>12000) return denied("一次送來的內容太多了，請稍微縮短再試。",413);
 let body:any; try{body=await request.json();}catch{return denied("資料沒能好好送到，請再試一次。");}
 const op=body?.op; const role=roleOf(body?.role); const token=body?.token;
 if(!role || !tokenOkay(token))return denied("好像沒認出你的身分，請回到旅人入口再試。");
 const db=requireBlogDb(context); await init(db); await runOneTimeRequestedReset(db);
 if(op==="claim"){
  const hash=await digest(token);
  await db.prepare("INSERT OR IGNORE INTO trip_duo_players (role,token_hash) VALUES (?,?)").bind(role,hash).run();
  if(!await authenticated(db,role,token))return denied(PEOPLE[role]+"的旅人身分已經留在另一台裝置上。目前還不能自行換機，請回到最初選擇的那台。",409);
  return Response.json({ok:true,state:await state(db,role)},{headers:{"Cache-Control":"no-store"}});
 }
 if(!await authenticated(db,role,token))return denied("這台裝置還沒有這位旅人的通行證，請回到原本認領的那台。",403);
 if(op==="state")return Response.json({ok:true,state:await state(db,role)},{headers:{"Cache-Control":"no-store"}});
 if(op==="answer"){
  const step=body.step; const current=await getProgress(db);
  if(!Number.isInteger(step)||step!==current.step || step>=QUESTIONS.length || current.revealed)return denied("這一題已經翻頁了，重新整理後就能接上進度。",409);
  if(!validAnswer(step,body.answer))return denied("這題好像還漏了一點什麼，確認每個選項都答完再送出吧。");
  await db.prepare("INSERT INTO trip_duo_answers (role,step,payload) VALUES (?,?,?) ON CONFLICT(role,step) DO UPDATE SET payload=excluded.payload,updated_at=CURRENT_TIMESTAMP").bind(role,step,JSON.stringify(body.answer)).run();
  return Response.json({ok:true,state:await state(db,role)},{headers:{"Cache-Control":"no-store"}});
 }
 if(op==="advance"){
  const step=body.step;
  if(!Number.isInteger(step))return denied("好像走錯題目了，請重新整理看看。");
  await db.prepare("UPDATE trip_duo_progress SET step=step+1,revealed=0,updated_at=CURRENT_TIMESTAMP WHERE id=1 AND step=? AND revealed=1 AND step<?").bind(step,QUESTIONS.length).run();
  return Response.json({ok:true,state:await state(db,role)},{headers:{"Cache-Control":"no-store"}});
 }
 if(op==="finalists"){
  const progress=await getProgress(db);
  if(progress.step<QUESTIONS.length) return denied("還有幾道題目沒揭曉，先把故事走完吧。",409);
  const cs=body.choices;
  if(!Array.isArray(cs)||cs.length<2||cs.length>3||new Set(cs).size!==cs.length||!cs.every((x:unknown)=>typeof x==="string"&&ROUTE_KEYS.includes(x)))return denied("最後只能留兩到三條不同的路線，再挑一下吧。");
  await db.prepare("INSERT INTO trip_duo_finalists (role,choices) VALUES (?,?) ON CONFLICT(role) DO UPDATE SET choices=excluded.choices,updated_at=CURRENT_TIMESTAMP").bind(role,JSON.stringify(cs)).run();
  return Response.json({ok:true,state:await state(db,role)},{headers:{"Cache-Control":"no-store"}});
 }
 return denied("這個操作目前走不通，回到剛才的頁面再試試。");
}
