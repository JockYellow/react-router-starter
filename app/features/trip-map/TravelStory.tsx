import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Compass, Footprints, MapPin, Sparkles, X } from "lucide-react";
import { ROUTE_STORIES, type RouteStory, type StoryId } from "./stories";
import { REAL_PHOTOS, commonsImage, commonsSource, type Photo } from "./photos";

export function ThreeDayPrelude(){
 const days=[
  {day:"D1",date:"1/1 · 五",jp:"序ノ巻",title:"在風城打開故事",desc:"抵達新竹、入住火車站附近的旅宿。從東門城、護城河、老街與市區美食開始，讓夜晚先有一點旅行的味道。",tags:["市區漫遊","入住・晚餐","輕鬆相處"]},
  {day:"D2",date:"1/2 · 六",jp:"本ノ巻",title:"把一整天交給我們的選擇",desc:"三日旅途最自由的一天。六條路線、六種心動；這場雙人解謎，就是要找出你們願意一起走進的兩三段旅卷。",tags:["六條候選","完整一日遊","今天的謎底"]},
  {day:"D3",date:"1/3 · 日",jp:"結ノ巻",title:"替故事留下溫柔收尾",desc:"上午參加主日聚會。中午後仍留在新竹市區，可以從新竹公園、玻璃工藝與咖啡散步中挑一段，然後帶著回憶返程。",tags:["主日聚會","市區短行程","悠閒返程"]}
 ];
 return <section className="tm-three-days" aria-label="新竹三天兩夜旅行架構">
  <div className="tm-three-days__intro">
   <span className="tm-three-days__eyebrow" lang="ja">三日旅帖 · 旅のはじまり</span>
   <h2>這趟旅行，有三個篇章。</h2>
   <p>元旦連假的三天兩夜，新竹市區是故事的起點與終點；最精彩的第二天，還是一張等待你們親自填上的空白地圖。</p>
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
  <div className="tm-three-days__footnote"><span lang="ja">旅の道しるべ</span> · 同一間住宿連住兩晚，選定 D2 後，再把三天的細節慢慢補上。</div>
 </section>;
}

function RealityPhoto({photo,priority=false}:{photo:Photo;priority?:boolean}){
 const [failed,setFailed]=useState(false);
 return <div className="tm-reality-photo">
  {failed?
   <div className="tm-reality-photo__unavailable">照片目前無法載入，<a href={commonsSource(photo.file)} target="_blank" rel="noopener noreferrer">開啟原始圖片</a></div>:
   <img src={commonsImage(photo.file)} alt={photo.label} loading={priority?"eager":"lazy"} referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>}
  <div className="tm-reality-photo__credit">
   <span>{photo.label}</span>
   <a href={commonsSource(photo.file)} target="_blank" rel="noopener noreferrer" aria-label={"查看"+photo.label+"的照片作者與授權"}>實景照片 · 作者及授權</a>
  </div>
 </div>;
}
function ScrollVignette({story,index}:{story:RouteStory;index:number}){
 const beat=story.journey[index];
 return <div className="tm-story-beat" key={beat.part}>
  <div className="tm-story-beat__image">
   <RealityPhoto photo={REAL_PHOTOS[story.id][index]}/>
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
 useEffect(()=>{
  const old=document.body.style.overflow;
  document.body.style.overflow="hidden";
  const keydown=(e:KeyboardEvent)=>{if(e.key==="Escape")onClose();};
  window.addEventListener("keydown",keydown);
  return ()=>{document.body.style.overflow=old;window.removeEventListener("keydown",keydown);};
 },[onClose]);
 const choose=()=>{
  if(!selected&&!canAdd){setWarning(true);return;}
  onToggle(story.id);
  setWarning(false);
 };
 return <div className="tm-story-overlay" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
  <div className="tm-story-modal" role="dialog" aria-modal="true" aria-label={story.title+" 旅卷"}>
   <button type="button" className="tm-story-close" onClick={onClose} aria-label="關閉旅卷"><X size={19}/><span>收起旅卷</span></button>
   <div className="tm-story-modal__hero">
    <RealityPhoto photo={REAL_PHOTOS[story.id][0]} priority/>
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
     <div><span>旅の気分</span><strong>{story.dayFeel}</strong></div>
     <div><span>主要體驗</span><strong>{story.activity}</strong></div>
     <div><span>旅途步調</span><strong>{story.pace}</strong></div>
     <div><span>交通方式</span><strong>{story.transport}</strong></div>
    </div>
    <div className="tm-story-chips" aria-label="代表性景點">{story.highlight.map(x=><span key={x}><MapPin size={12} aria-hidden="true"/>{x}</span>)}</div>
    <div className="tm-story-section-head">
     <span lang="ja">旅の記録 · 真實景色</span>
     <h3>看看這一天，實際會遇見的風景</h3>
     <p>從早晨到午後，把不同的景色與體驗串成一段完整的旅行。</p>
    </div>
    <div className="tm-story-beats">{[0,1,2].map(i=><ScrollVignette key={i} story={story} index={i}/>)}</div>
    <div className="tm-story-section-head tm-story-section-head--small">
     <span lang="ja">寄り道 · 隱藏支線</span>
     <h3>還有這些可以慢慢發現</h3>
    </div>
    <div className="tm-story-sidequests">{story.optional.map((x,i)=><div className="tm-story-sidequest" key={x.title}><b>{String(i+1).padStart(2,"0")}</b><div><h4>{x.title}</h4><p>{x.detail}</p></div></div>)}</div>
    <div className="tm-story-ending"><span lang="ja">旅の余韻</span><p>{story.closing}</p></div>
    <div className="tm-story-question"><span lang="ja">ふたりの会話 · 聊聊這段旅程</span><p>{story.discussion}</p></div>
    <div className="tm-story-modal__actions">
     <button type="button" className={"tm-story-pick "+(selected?"tm-story-pick--selected":"")} onClick={choose}>{selected?<Check size={18}/>:<Sparkles size={18}/>} {selected?"已加入我們的候選":"把這條旅卷收進候選"}</button>
     <button type="button" className="tm-story-dismiss" onClick={onClose}>回到六條旅卷 <ArrowLeft size={16}/></button>
     {warning&&<p className="tm-story-warning" role="status">候選最多保留三條，先在頁面下方移除其中一條就能替換。</p>}
    </div>
   </div>
  </div>
 </div>;
}
export function RouteGallery({selected,onToggle}:{selected:string[];onToggle:(id:StoryId)=>void}){
 const [opened,setOpened]=useState<StoryId|null>(null);
 const openStory=ROUTE_STORIES.find(s=>s.id===opened);
 return <section className="tm-story-gallery" aria-label="D2 六大旅行方案">
  <div className="tm-story-gallery__intro">
   <div className="tm-story-gallery__seal" aria-hidden="true">六</div>
   <span lang="ja">六つの旅の扉 · 六扇旅行之門</span>
   <h2>答案揭曉了，旅卷才真正展開。</h2>
   <p>這個週六，你們想一起過什麼樣的一天？每張旅卷裡都藏著三段景色、三段故事，還有能自由延伸的支線。點開看看，再把喜歡的兩三條留下。</p>
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
     <div className="tm-story-card__footer"><span><Footprints size={13}/> {story.pace}</span><strong>揭開旅卷 <ArrowRight size={16}/></strong></div>
    </div>
   </button>)}
  </div>
  <p className="tm-story-gallery__caption"><Compass size={16}/> 這六條都是一日旅遊提案，等你們挑出共同心動的選項，再把真正的行程寫進旅行地圖。</p>
  {openStory&&<RouteDetail key={openStory.id} story={openStory} onClose={()=>setOpened(null)} selected={selected.includes(openStory.id)} onToggle={onToggle} canAdd={selected.length<3}/>}
 </section>;
}
