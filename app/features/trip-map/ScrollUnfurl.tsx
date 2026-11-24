import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * 全站共用的手卷換頁儀式。動畫只蓋在現有頁面上，
 * 不複製正式表單、分數或雙人同步資料。
 * 呼叫端以 key 控制每一幕真正的狀態變化。
 */
export function ScrollUnfurl({title="下一卷展開",subtitle="旅のつづき"}:{title?:string;subtitle?:string}){
 const [mounted,setMounted]=useState(false);
 const [show,setShow]=useState(true);
 useEffect(()=>{
  if(window.matchMedia("(prefers-reduced-motion: reduce)").matches){
   setShow(false);
   return;
  }
  setMounted(true);
  const timer=window.setTimeout(()=>setShow(false),1050);
  return ()=>window.clearTimeout(timer);
 },[]);
 if(!mounted||!show)return null;
 return createPortal(
  <div className="tm-unfurl" aria-hidden="true">
   <div className="tm-unfurl__shade"/>
   <div className="tm-unfurl__paper">
    <div className="tm-unfurl__inner">
     <div className="tm-unfurl__stamp">旅</div>
     <p lang="ja">{subtitle}</p>
     <strong>{title}</strong>
     <span className="tm-unfurl__brush"/>
    </div>
   </div>
   <div className="tm-unfurl__rod tm-unfurl__rod--left"><span/></div>
   <div className="tm-unfurl__rod tm-unfurl__rod--right"><span/></div>
  </div>,
  document.body
 );
}
