/**
 * 供「製作者遊覽」使用的替身回覆。
 * 這些資料只在前端記憶體中，不呼叫真實 API、不寫入 D1。
 * 頁面沿用同一個 Form / Compare / RouteGallery / 結算頁。
 */
import { QUESTIONS, ROLES, type Role } from "./questions";
export type TourPhase="answer"|"waiting"|"reveal"|"result";
type Answer=Record<string,any>;
type TourFinalists=Partial<Record<Role,string[]>>;
export function tourFixture(step:number,role:Role):Answer {
 const question=QUESTIONS[step];
 if(!question)return {};
 if(question.kind==="rating"){
  return Object.fromEntries((question.items||[]).map(([k],i)=>{
   const score = (step===8 ? (role==="yanzhen" ? [5,3,5,3,4,4] : [4,5,4,5,3,4])[i] : 2+((step*2+i*3+(role==="hanyu"?1:0))%4));
   return [k,Math.max(1,Math.min(5,score??3))];
  }));
 }
 if(question.kind==="postcard")return role==="yanzhen"?{keep:["created","surprise"],drop:"challenge"}:{keep:["comfort","view"],drop:"challenge"};
 if(question.kind==="coins")return role==="yanzhen"?{food:2,scenery:2,craft:2,active:1,rest:1}:{food:1,scenery:2,craft:1,active:1,rest:3};
 if(question.kind==="reality")return role==="yanzhen"?{preferred:1100,cap:1900,cold:3,effort:4}:{preferred:900,cap:1700,cold:2,effort:3};
 if(question.kind==="note")return {message:role==="yanzhen"?"如果找到一個讓你很喜歡的地方，希望可以一起多停一下。":"希望我們總能在旅行裡，找到屬於自己的小驚喜。"};
 return {};
}
export type TourState={
 role:Role;step:number;revealed:boolean;finished:boolean;
 joined:Role[];submitted:Role[];
 answers:Record<Role,Record<string,Answer>>;
 finalists:TourFinalists;
};
export function makeTourState(
 role:Role,
 step:number,
 phase:TourPhase,
 ownOverrides:Record<number,Answer>={},
 finalists:TourFinalists={}
):TourState{
 const finished=phase==="result"||step>=QUESTIONS.length;
 const currentStep=finished?QUESTIONS.length:Math.max(0,Math.min(QUESTIONS.length-1,step));
 const revealed=phase==="reveal"&&!finished;
 const answers:Record<Role,Record<string,Answer>>={yanzhen:{},hanyu:{}};
 if(finished) {
  QUESTIONS.forEach((_q,i)=>{for(const r of ROLES)answers[r][String(i)]=r===role&&ownOverrides[i]?ownOverrides[i]:tourFixture(i,r);});
 } else if(revealed){
  for(const r of ROLES)answers[r][String(currentStep)]=r===role&&ownOverrides[currentStep]?ownOverrides[currentStep]:tourFixture(currentStep,r);
 }else if(phase==="waiting"){
  answers[role][String(currentStep)]=ownOverrides[currentStep]||tourFixture(currentStep,role);
 }
 return {role,step:currentStep,revealed,finished,joined:ROLES,submitted:finished||revealed?[...ROLES]:phase==="waiting"?[role]:[],
  answers,finalists:finished?{yanzhen:["A","D","H"],hanyu:["A","C","D"],...finalists}:{}
 };
}
