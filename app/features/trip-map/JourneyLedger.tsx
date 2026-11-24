import type { ReactNode } from "react";

/** 結算頁趣味彩蛋：只使用圖像與數字，不直接顯示文字解釋。 */
function EmbraceGlyph(){
 return <svg viewBox="0 0 72 72" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="擁抱">
  <circle cx="22" cy="19" r="8"/><circle cx="50" cy="19" r="8"/>
  <path d="M11 59V37q0-10 11-10c7 0 10 6 14 10 4-4 7-10 14-10q11 0 11 10v22"/>
  <path d="M13 37q10 4 23 17 13-13 23-17M21 57l15-8 15 8"/>
  <path d="M36 43c-7-7-12-9-12-15 0-4 3-7 7-7 3 0 4 2 5 4 1-2 3-4 6-4 4 0 7 3 7 7 0 6-6 9-13 15Z" fill="#bb6156" stroke="#a34237" strokeWidth="1"/>
 </svg>;
}
function KissGlyph(){
 return <svg viewBox="0 0 72 72" fill="none" stroke="currentColor" role="img" aria-label="親吻">
  <path d="M8 35c12-8 16-17 28-8 13-9 17 0 28 8-7 2-14 7-28 6-14 1-21-4-28-6Z" fill="#b34f4a" stroke="#943d3a" strokeWidth="2.8" strokeLinejoin="round"/>
  <path d="M11 35q14-3 25 0 13-3 25 0M17 40q19 20 39 0" stroke="#8f3d37" strokeWidth="2.5" strokeLinecap="round"/>
  <path d="M19 21l-3-5m40 5 3-5M36 17v-6" stroke="#be795c" strokeWidth="2.4" strokeLinecap="round"/>
 </svg>;
}
function MidnightGlyph(){
 return <svg viewBox="0 0 72 72" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="兩人的秘密時光">
   <path d="M15 21a15 15 0 0 0 20 20A20 20 0 1 1 15 21Z" fill="#bd8a63" stroke="#a7654a"/>
   <path d="M50 14v10m-5-5h10M59 29v8m-4-4h8" stroke="#bd8a63"/>
   <path d="M18 54V42c0-3 3-5 6-5h23c4 0 6 2 6 5v12M18 49h35M13 55h45v6H13z" stroke="#314b61" fill="#e4cfb0"/>
   <path d="M36 40c-7-6-9-10-9-13 0-5 7-8 9-2 3-6 10-3 10 2 0 3-3 7-10 13Z" fill="#b45753" stroke="#a44946" strokeWidth="1.7"/>
 </svg>;
}
const accounts:{n:number;icon:ReactNode;hint:string}[]=[
 {n:62,icon:<EmbraceGlyph/>,hint:"擁抱"},
 {n:19,icon:<KissGlyph/>,hint:"親吻"},
 {n:5,icon:<MidnightGlyph/>,hint:"兩人的秘密時光"}
];
export function JourneyLedger(){
 return <section className="tm-paper-card tm-ledger" aria-label="旅途花費趣味帳本">
  <div className="tm-ledger__header"><div><p lang="ja">旅の勘定 · ふたりの秘密帳</p><h2>旅途花費</h2></div><span className="tm-ledger__seal" aria-hidden="true">秘</span></div>
  <div className="tm-ledger__row">
   {accounts.map((account,i)=><div className="tm-ledger__item" key={i} aria-label={account.hint+" "+account.n+" 次"}>
    <span className="tm-ledger__icon">{account.icon}</span>
    <span className="tm-ledger__number">{account.n}<span aria-hidden="true"> ×</span></span>
   </div>)}
  </div>
  <p className="tm-ledger__footer">此帳單不收現金。請於旅途之中，慢慢結清。</p>
 </section>;
}
