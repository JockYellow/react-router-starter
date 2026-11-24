import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, BookOpenText, ChevronRight, LockKeyhole, ScrollText, Sparkles } from "lucide-react";
import { ROUTES, type pairFit } from "./questions";
import { JourneyLedger } from "./JourneyLedger";

type Matches=ReturnType<typeof pairFit>;
type Scene=0|1|2|3|4;

/** 所有模式共用同一份結算劇場；孩子就是正式結算頁的既有路線與收藏元件。 */
export function TripFinale({matches,children}:{matches:Matches;children:ReactNode}){
 const [scene,setScene]=useState<Scene>(0);
 const [unlocked,setUnlocked]=useState(0);
 const top=matches.slice(0,3);
 const root=useRef<HTMLDivElement>(null);
 const next=(value:Scene)=>{setScene(value);root.current?.scrollIntoView({block:"start",behavior:"smooth"});};
 useEffect(()=>{
  if(scene!==1){setUnlocked(0);return;}
  const timers=[window.setTimeout(()=>setUnlocked(1),420),window.setTimeout(()=>setUnlocked(2),1150),window.setTimeout(()=>setUnlocked(3),1900)];
  return ()=>timers.forEach(window.clearTimeout);
 },[scene]);
 return <div className="tm-finale" ref={root}>
  <div className="tm-finale__progress" aria-label="結算揭曉進度"><span className={scene>=0?"is-active":""}/><span className={scene>=1?"is-active":""}/><span className={scene>=2?"is-active":""}/><span className={scene>=3?"is-active":""}/><span className={scene>=4?"is-active":""}/></div>
  {scene===0&&<section className="tm-finale-scene tm-finale-scene--intro" key="intro">
   <div className="tm-finale-scene__crest" aria-hidden="true"><span>解</span></div>
   <p className="tm-finale__eyebrow" lang="ja">終ノ章 · 兩張地圖終於攤開</p>
   <h1>我們各自出發，<br/>地圖卻慢慢畫向同一個地方。</h1>
   <div className="tm-finale-scene__line" aria-hidden="true"><span/><span/><span/></div>
   <p>十道問題，答的時候好像也沒想那麼多。<br/>但把它們放在一起，才發現原來每個選擇，都悄悄說了一點關於我們的事。</p>
   <button className="tm-finale__action" onClick={()=>next(1)}><ScrollText size={20}/>看看兩張地圖畫出了什麼<ArrowRight size={18}/></button>
  </section>}
  {scene===1&&<section className="tm-finale-scene tm-finale-scene--scores" key="scores">
   <p className="tm-finale__eyebrow" lang="ja">第一封密函 · 原來我們想得有點像</p>
   <h1>原來這三條路，<br/>我們都悄悄望了一眼。</h1>
   <p className="tm-finale__sub">把兩個人的期待攤開，竟然真的能找出一些相似的地方。當然啦，還有一點彼此想不到的小意外。</p>
   <div className="tm-finale__rankings">
    {top.map((m,i)=><div className={"tm-finale-rank "+(unlocked>=i+1?"is-revealed":"")} key={m.id} style={{transitionDelay:(i*75)+"ms"}}>
      <div className="tm-finale-rank__index"><span>{i+1}</span><small>{i===0?"第一眼就想去":"也很想去"}</small></div>
      <div className="tm-finale-rank__copy"><span>{ROUTES[m.id].subtitle}</span><h2>{ROUTES[m.id].name}</h2><div className="tm-finale-rank__individual">彥禎 {m.people.yanzhen.direct} / 5　·　涵郁 {m.people.hanyu.direct} / 5</div></div>
      <div className="tm-finale-rank__score"><strong>{unlocked>=i+1?m.score.toFixed(1):"？"}</strong><small>/ 5</small></div>
    </div>)}
   </div>
   <p className="tm-finale__sub tm-finale__sub--small">分數真的只能參考啦，畢竟人哪有這麼容易算懂？但如果你我都對同一條路有些期待，那就很值得認真看看。</p>
   <button className="tm-finale__action" onClick={()=>next(2)} disabled={unlocked<3}>分數先收好，後面還有東西<ChevronRight size={18}/></button>
  </section>}
  {scene===2&&<section className="tm-finale-scene tm-finale-scene--bill" key="bill">
   <div className="tm-finale-bill__rays" aria-hidden="true"/>
   <div className="tm-finale-bill__envelope" aria-hidden="true"><span>秘</span></div>
   <p className="tm-finale__eyebrow" lang="ja">第二封密函 · 等等，帳單來了</p>
   <h1>等等。<br/>旅行怎麼會沒有代價？</h1>
   <div className="tm-finale-bill__ellipsis">本次花費<span>.</span><span>.</span><span>.</span></div>
   <p>翻遍口袋，竟然找不到這筆消費的收據。<br/>它甚至沒有標幣別。<br/>……我開始覺得事情不太單純了。</p>
   <button className="tm-finale__action" onClick={()=>next(3)}><LockKeyhole size={20}/>都到這裡了，拆開看看<ChevronRight size={18}/></button>
  </section>}
  {scene===3&&<section className="tm-finale-scene tm-finale-scene--cost" key="cost">
   <p className="tm-finale__eyebrow" lang="ja">秘密帳本 · 這些還真的得親自還</p>
   <h1>原來這筆帳，<br/>要這樣還啊。</h1>
   <div className="tm-finale-cost__ledger"><JourneyLedger animated/></div>
   <p className="tm-finale__sub">糟糕，看來信用卡幫不上忙。<br/>只能等真正見面的時候，一筆一筆慢慢還了。</p>
   <button className="tm-finale__action" onClick={()=>next(4)}><BookOpenText size={20}/>好了好了，回來選旅行啦<ChevronRight size={18}/></button>
  </section>}
  {scene===4&&<section className="tm-finale-scene--routes" key="routes">
   <div className="tm-finale-routes__heading"><p className="tm-finale__eyebrow" lang="ja">最終篇 · 走進六條岔路</p><h1>山海都在遠方，<br/>我們還有一天可以一起去。</h1><p>山、海、老街、溫泉，六條路在眼前慢慢展開。我想我們一定沒辦法把所有地方都走完，但總會有一段，是兩個人都不想錯過的。</p></div>
   {children}
   <details className="tm-finale__scores-all">
    <summary>還想研究？六條路的分數都在這裡</summary>
    <div className="tm-finale__scores-all-grid">{matches.map(m=><div className="tm-finale__scores-all-row" key={m.id}>
      <div><span>{m.id} · {ROUTES[m.id].name}</span><b>{m.score.toFixed(1)} / 5</b></div>
      <div className="tm-finale__scores-all-bar"><span style={{width:(m.score/5*100)+"%"}}/></div>
    </div>)}</div>
   </details>
   <button type="button" className="tm-finale__restart" onClick={()=>next(0)}><Sparkles size={15}/>好啦，我就是想再揭曉一次</button>
  </section>}
 </div>;
}
