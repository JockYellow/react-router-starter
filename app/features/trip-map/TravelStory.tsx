import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, Check, Compass, Footprints, MapPin, Sparkles, X } from "lucide-react";
import { ROUTE_STORIES, type RouteStory, type StoryId } from "./stories";
import { REAL_PHOTOS, commonsImage, commonsOriginal, commonsSource, type Photo } from "./photos";
import { ScrollUnfurl } from "./ScrollUnfurl";

export function ThreeDayPrelude(){
 const days=[
  {day:"D1",date:"1/1 · 五",jp:"序ノ巻",title:"第一天，先跟新竹打聲招呼",desc:"第一天抵達新竹，先把行李放好。東門城、護城河、舊城的小吃，都還在市區等著。今天不用跑太遠，我想先習慣身旁多了一個人一起走路的感覺。",tags:["舊城隨意走走","先安頓，再吃飯","慢慢走、慢慢聊"]},
  {day:"D2",date:"1/2 · 六",jp:"本ノ巻",title:"第二天，地圖還缺了最重要的一塊",desc:"今天最自由，也最令人猶豫。想往山裡走？想看海？還是乾脆找間老店待久一點？六條路攤開了，我有好多想去的地方，但更想知道你會把手指停在哪裡。",tags:["六條有趣的岔路","把整天交給它","一起選出答案"]},
  {day:"D3",date:"1/3 · 日",jp:"結ノ巻",title:"第三天，讓旅程慢慢落地",desc:"上午先參加主日聚會，午後留在新竹市區。公園、玻璃工藝、咖啡店，想逛哪裡就逛哪裡。旅行總得結束，但我想留一點時間，讓這兩天的事情慢慢沉下來。",tags:["上午主日聚會","午後留在市區","別急著說再見"]}
 ];
 return <section className="tm-three-days" aria-label="新竹三天兩夜旅行架構">
  <div className="tm-three-days__intro">
   <span className="tm-three-days__eyebrow" lang="ja">三日旅帖 · 旅のはじまり</span>
   <h2>一張地圖，先寫好了開頭和結尾。</h2>
   <p>元旦的三天兩夜，第一天與第三天大致留給新竹市區。真正懸而未決的是中間那個週六。路很多，時間只有一天——光靠我一個人的期待，好像還不太夠。</p>
  </div>
  <div className="tm-three-days__timeline">
   {days.map((d,i)=><article className={"tm-day-slip "+(i===1?"tm-day-slip--main":"")} key={d.day}>
    <div className="tm-day-slip__head"><span>{d.day}</span><span>{d.date}</span></div>
    <div className="tm-day-slip__jp" lang="ja">{d.jp}</div>
    <h3>{d.title}</h3>
    <p>{d.desc}</p>
    <div className="tm-day-slip__tags">{d.tags.map(t=><span key={t}>{t}</span>)}</div>
    {i===1&&<div className="tm-day-slip__seal" aria-hidden="true">謎</div>}
   </article>)}
  </div>
  <div className="tm-three-days__footnote"><span lang="ja">旅の道しるべ</span> · 兩晚先留在同一間住宿，至於中間那天要往哪裡走，就讓接下來的答案慢慢說話。</div>
 </section>;
}

function RealityPhoto({photo,priority=false,routeId}:{photo:Photo;priority?:boolean;routeId:string}){
 const [attempt,setAttempt]=useState(0);
 const imgSource=attempt===0?commonsImage(photo.file,960):commonsOriginal(photo.file);
 return <div className="tm-reality-photo">
  {attempt>=2?
   <div className="tm-reality-photo__fallback">
    <img src={"/trip-map/stories/"+routeId.toLowerCase()+".svg"} alt="插畫備援：原始實景照片暫時無法載入" loading="lazy"/>
    <a href={commonsSource(photo.file)} target="_blank" rel="noopener noreferrer">這張照片沒跑出來，點這裡看看原圖</a>
   </div>:
   <img src={imgSource} alt={photo.label} loading={priority?"eager":"lazy"} referrerPolicy="no-referrer" onError={()=>setAttempt(a=>Math.min(a+1,2))}/>}
  <div className="tm-reality-photo__credit">
   <span>{photo.label}</span>
   <a href={commonsSource(photo.file)} target="_blank" rel="noopener noreferrer" aria-label={"查看"+photo.label+"的照片作者與授權"}>看看這張照片從哪裡來</a>
  </div>
 </div>;
}
function ScrollVignette({story,index}:{story:RouteStory;index:number}){
 const beat=story.journey[index];
 return <div className="tm-story-beat" key={beat.part}>
  <div className="tm-story-beat__image">
   <RealityPhoto photo={REAL_PHOTOS[story.id][index]} routeId={story.id}/>
   <div className="tm-story-beat__scene">{beat.scene}</div>
  </div>
  <div className="tm-story-beat__body">
   <div className="tm-story-beat__marker"><span>{beat.part}</span><small>{beat.time}</small></div>
   {REAL_PHOTOS[story.id][index].note&&<p className="tm-reality-photo__note">{REAL_PHOTOS[story.id][index].note}</p>}
   <h4>{beat.heading}</h4>
   <p>{beat.description}</p>
  </div>
 </div>;
}
function RouteDetail({story,onClose,selected,onToggle,canAdd}:{story:RouteStory;onClose:()=>void;selected:boolean;onToggle:(id:StoryId)=>void;canAdd:boolean}){
 const [warning,setWarning]=useState(false);
 const overlayRef=useRef<HTMLDivElement>(null);
 const closeRef=useRef<HTMLButtonElement>(null);
 useEffect(()=>{
  // 保留開卷前的捲動位置：手機上鎖住背景，僅讓旅卷在獨立容器內捲動。
  const oldOverflow=document.body.style.overflow;
  const oldHtmlOverflow=document.documentElement.style.overflow;
  const restoreFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
  document.body.style.overflow="hidden";
  document.documentElement.style.overflow="hidden";
  overlayRef.current?.scrollTo({top:0,behavior:"instant"});
  closeRef.current?.focus({preventScroll:true});
  const keydown=(e:KeyboardEvent)=>{
   if(e.key==="Escape"){e.preventDefault();onClose();}
  };
  window.addEventListener("keydown",keydown);
  return ()=>{
   document.body.style.overflow=oldOverflow;
   document.documentElement.style.overflow=oldHtmlOverflow;
   window.removeEventListener("keydown",keydown);
   restoreFocus?.focus({preventScroll:true});
  };
 // 開關視窗才執行；避免收藏時父元件重繪造成捲動鎖定反覆解除。
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 const choose=()=>{
  if(!selected&&!canAdd){setWarning(true);return;}
  onToggle(story.id);
  setWarning(false);
 };
 return createPortal(<div ref={overlayRef} className="tm-story-overlay" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
  <div className="tm-story-modal" role="dialog" aria-modal="true" aria-label={story.title+" 旅卷"}>
   <button ref={closeRef} type="button" className="tm-story-close" onClick={onClose} aria-label="把旅卷收起來"><X size={19}/><span>先把這一卷收好</span></button>
   <div className="tm-story-modal__hero">
    <RealityPhoto photo={REAL_PHOTOS[story.id][0]} routeId={story.id} priority/>
    <div className="tm-story-modal__hero-shade"/>
    <div className="tm-story-modal__hero-caption">
     <p lang="ja">旅の謎 · {story.jp}</p>
     <h2><span>{story.id}</span> {story.title}</h2>
     <p>{story.tagline}</p>
    </div>
   </div>
   <div className="tm-story-modal__inside">
    <div className="tm-story-modal__opening"><p>{story.overture}</p><span className="tm-story-calligraphy" aria-hidden="true" lang="ja">旅</span></div>
    <div className="tm-story-meta" aria-label="行程基本資訊">
     <div><span>今天的感覺</span><strong>{story.dayFeel}</strong></div>
     <div><span>想玩的事情</span><strong>{story.activity}</strong></div>
     <div><span>走起來有多累</span><strong>{story.pace}</strong></div>
     <div><span>這天怎麼移動</span><strong>{story.transport}</strong></div>
    </div>
    <div className="tm-story-chips" aria-label="代表性景點">{story.highlight.map(x=><span key={x}><MapPin size={12} aria-hidden="true"/>{x}</span>)}</div>
    <div className="tm-story-section-head">
     <span lang="ja">旅の記録 · 先看看真正的景色</span>
     <h3>如果真的出發，我們會看見什麼？</h3>
     <p>照片先偷看一點。真正的風、聲音與那些意外，還是要等我們走進去才知道。</p>
    </div>
    <div className="tm-story-beats">{[0,1,2].map(i=><ScrollVignette key={i} story={story} index={i}/>)}</div>
    <div className="tm-story-section-head tm-story-section-head--small">
     <span lang="ja">寄り道 · 還能多走的岔路</span>
     <h3>如果還有時間，就再貪心一點</h3>
    </div>
    <div className="tm-story-sidequests">{story.optional.map((x,i)=><div className="tm-story-sidequest" key={x.title}><b>{String(i+1).padStart(2,"0")}</b><div><h4>{x.title}</h4><p>{x.detail}</p></div></div>)}</div>
    <div className="tm-story-ending"><span lang="ja">旅の余韻 · 回程時會想起什麼</span><p>{story.closing}</p></div>
    <div className="tm-story-question"><span lang="ja">ふたりの会話 · 這題想聽你說</span><p>{story.discussion}</p></div>
    <div className="tm-story-modal__actions">
     <button type="button" className={"tm-story-pick "+(selected?"tm-story-pick--selected":"")} onClick={choose}>{selected?<Check size={18}/>:<Sparkles size={18}/>} {selected?"這條已經收好了":"欸，這條我想去！先收起來"}</button>
     <button type="button" className="tm-story-dismiss" onClick={onClose}>換下一條看看 <ArrowLeft size={16}/></button>
     {warning&&<p className="tm-story-warning" role="status">欸欸，先別貪心！最多留三條，想換就先把其中一條放回去。</p>}
    </div>
   </div>
  </div>
  <ScrollUnfurl title={story.title+" · 旅卷展開"} subtitle={story.jp}/>
 </div>,document.body);
}
export function RouteGallery({selected,onToggle}:{selected:string[];onToggle:(id:StoryId)=>void}){
 const [opened,setOpened]=useState<StoryId|null>(null);
 const openStory=ROUTE_STORIES.find(s=>s.id===opened);
 return <section className="tm-story-gallery" aria-label="週六的六種旅行可能">
  <div className="tm-story-gallery__intro">
   <div className="tm-story-gallery__seal" aria-hidden="true">六</div>
   <span lang="ja">六つの旅の扉 · 六條岔路在等我們</span>
   <h2>終於可以看看，我們會往哪裡走了。</h2>
   <p>六條路都在這裡。有山、有海、有老街，還有一些我本來根本沒想到的地方。先別急著選，點開看看真正的景色；說不定最後讓你捨不得放下的，會是最意外的那一條。</p>
  </div>
  <div className="tm-story-grid">
   {ROUTE_STORIES.map(story=><button type="button" className="tm-story-card" key={story.id} onClick={()=>setOpened(story.id)} aria-label={"展開 "+story.title+" 旅卷"}>
    <div className="tm-story-card__art">
     <img src={"/trip-map/stories/"+story.id.toLowerCase()+".svg"} alt={story.gallery.join("、")+"的浮世繪風格插畫"} loading="lazy" />
     <div className="tm-story-card__number">{story.id}</div>
     {selected.includes(story.id)&&<div className="tm-story-card__saved"><Check size={13}/>已收藏</div>}
    </div>
    <div className="tm-story-card__body">
     <span className="tm-story-card__jp" lang="ja">{story.jp}</span>
     <h3>{story.title}</h3>
     <p className="tm-story-card__tagline">{story.tagline}</p>
     <p className="tm-story-card__summary">{story.activity}</p>
     <div className="tm-story-card__footer"><span><Footprints size={13}/> {story.pace}</span><strong>看看裡面有什麼 <ArrowRight size={16}/></strong></div>
    </div>
   </button>)}
  </div>
  <p className="tm-story-gallery__caption"><Compass size={16}/> 六條都只是一天的可能。先各自挑出喜歡的，然後一起看看，哪一段路值得真的走上一回。</p>
  {openStory&&<RouteDetail key={openStory.id} story={openStory} onClose={()=>setOpened(null)} selected={selected.includes(openStory.id)} onToggle={onToggle} canAdd={selected.length<3}/>}
 </section>;
}
