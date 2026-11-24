import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, BookOpenText, Check, ChevronRight, LockKeyhole, ScrollText, Sparkles } from "lucide-react";
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
   <p className="tm-finale__eyebrow" lang="ja">終ノ章 · ふたりの地図</p>
   <h1>兩張旅行地圖，<br/>終於重疊在一起。</h1>
   <div className="tm-finale-scene__line" aria-hidden="true"><span/><span/><span/></div>
   <p>走過十道問題，現在可以打開彼此心裡的風景了。<br/>你們的答案裡，藏著一張共同的旅行地圖。</p>
   <button className="tm-finale__action" onClick={()=>next(1)}><ScrollText size={20}/>揭開我們的旅行答案<ArrowRight size={18}/></button>
  </section>}
  {scene===1&&<section className="tm-finale-scene tm-finale-scene--scores" key="scores">
   <p className="tm-finale__eyebrow" lang="ja">第一封密函 · 旅の相性</p>
   <h1>最適合一起出發的<br/>三段旅程</h1>
   <p className="tm-finale__sub">依照你們的個別心動評分與旅行偏好，尋找兩人都願意走進的路線。</p>
   <div className="tm-finale__rankings">
    {top.map((m,i)=><div className={"tm-finale-rank "+(unlocked>=i+1?"is-revealed":"")} key={m.id} style={{transitionDelay:(i*75)+"ms"}}>
      <div className="tm-finale-rank__index"><span>{i+1}</span><small>{i===0?"最心動":"候選"}</small></div>
      <div className="tm-finale-rank__copy"><span>{ROUTES[m.id].subtitle}</span><h2>{ROUTES[m.id].name}</h2><div className="tm-finale-rank__individual">彥禎 {m.people.yanzhen.direct} / 5　·　涵郁 {m.people.hanyu.direct} / 5</div></div>
      <div className="tm-finale-rank__score"><strong>{unlocked>=i+1?m.score.toFixed(1):"？"}</strong><small>/ 5</small></div>
    </div>)}
   </div>
   <p className="tm-finale__sub tm-finale__sub--small">這些是旅行偏好的參考分數，最後由你們一起挑選；沒有心理測驗式的「相容率」。</p>
   <button className="tm-finale__action" onClick={()=>next(2)} disabled={unlocked<3}>收下這份答案，看看下一封密函<ChevronRight size={18}/></button>
  </section>}
  {scene===2&&<section className="tm-finale-scene tm-finale-scene--bill" key="bill">
   <div className="tm-finale-bill__rays" aria-hidden="true"/>
   <div className="tm-finale-bill__envelope" aria-hidden="true"><span>秘</span></div>
   <p className="tm-finale__eyebrow" lang="ja">第二封密函 · 旅の勘定</p>
   <h1>等等，<br/>還有一筆帳。</h1>
   <div className="tm-finale-bill__ellipsis">本次花費<span>.</span><span>.</span><span>.</span></div>
   <p>這份帳單沒有標明幣別，<br/>也沒有任何收據。<br/>只有三個需要一起清算的數字。</p>
   <button className="tm-finale__action" onClick={()=>next(3)}><LockKeyhole size={20}/>拆開神秘帳單<ChevronRight size={18}/></button>
  </section>}
  {scene===3&&<section className="tm-finale-scene tm-finale-scene--cost" key="cost">
   <p className="tm-finale__eyebrow" lang="ja">秘密帳本 · 代金は想い出</p>
   <h1>本次花費<br/>結算完成</h1>
   <div className="tm-finale-cost__ledger"><JourneyLedger animated/></div>
   <p className="tm-finale__sub">這份帳單不能刷卡、也無法轉帳。<br/>只能等旅行開始，再一筆一筆兌現。</p>
   <button className="tm-finale__action" onClick={()=>next(4)}><BookOpenText size={20}/>繼續開啟六條旅行繪卷<ChevronRight size={18}/></button>
  </section>}
  {scene===4&&<section className="tm-finale-scene--routes" key="routes">
   <div className="tm-finale-routes__heading"><p className="tm-finale__eyebrow" lang="ja">最終篇 · 六つの旅の扉</p><h1>目的地，現在由你們決定。</h1><p>六條旅行提案已全部解鎖。點開旅卷，看見真正的景色，再把心動的兩三條收藏起來。</p></div>
   {children}
   <button type="button" className="tm-finale__restart" onClick={()=>next(0)}><Sparkles size={15}/>重新播放結算故事</button>
  </section>}
 </div>;
}
