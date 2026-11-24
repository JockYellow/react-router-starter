/**
 * Wikimedia Commons 實景圖片來源。每一張依實際攝影地點標示，方便從旅卷回到原始圖片與授權頁。
 * 使用 Special:FilePath 載入 960px 寬的縮圖，不將他人作品重新提交到公開 Git repository。
 * 少量路段以同地區的實際景觀呈現；不使用其他縣市的照片冒充景點。
 */
export type Photo={file:string;label:string;note?:string};
export const REAL_PHOTOS:Record<string,[Photo,Photo,Photo]>={
 A:[
  {file:"Beipu Taiwan Street-vendor-01.jpg",label:"北埔鄉街區實景"},
  {file:"Lei cha at Beipu, Taiwan 2023-04-09.jpg",label:"北埔客家擂茶"},
  {file:"Emei Township Wikivoyage Banner.jpg",label:"峨眉湖實景"}
 ],
 C:[
  {file:"Neiwan Station 2024-01-06.jpg",label:"內灣車站"},
  {file:"Old Street Neiwan.jpg",label:"內灣老街"},
  {file:"2022 Neiwan Suspension Bridge.jpg",label:"內灣吊橋與山城河谷",note:"此照片呈現內灣山城風光；尖石溫泉請依實際預約場館查看湯屋照片。"}
 ],
 D:[
  {file:"新埔劉氏雙堂屋 (1).jpg",label:"新埔劉氏雙堂屋"},
  {file:"202510 藍染方巾與柿染方巾.jpg",label:"新埔柿染工藝成品",note:"照片同時展示兩種染布作品，其中棕色方巾來自新埔柿染坊。"},
  {file:"關西仙草加工廠 Guanxi Mesona Processing Plant - panoramio.jpg",label:"關西仙草產業實景"}
 ],
 F:[
  {file:"新竹漁港之一景.jpg",label:"新竹南寮漁港"},
  {file:"十七公里海岸線林道.JPG",label:"新竹十七公里海岸線沿途"},
  {file:"退潮時的香山濕地.jpg",label:"新竹香山濕地退潮時"}
 ],
 G:[
  {file:"新竹縣古蹟-湖口老街.jpg",label:"湖口老街紅磚建築"},
  {file:"湖口老街街屋門面近景.jpg",label:"湖口老街街屋細節",note:"這張是湖口老街街屋的實景，可作為小店與地方探索的參考。"},
  {file:"紅毛港紅樹林橋.jpg",label:"新豐紅毛港紅樹林橋"}
 ],
 H:[
  {file:"竹東週六夜市.jpg",label:"竹東在地市集（週六夜市）",note:"這張拍的是竹東週六夜市，僅展示街區市集氛圍，並非上午的竹東中央市場。"},
  {file:"蕭如松藝術園區日式建築.jpg",label:"蕭如松藝術園區日式建築"},
  {file:"大山背樂善堂 主廟正面 20200211.jpg",label:"橫山大山背樂善堂"}
 ]
};
export function commonsSource(file:string){return "https://commons.wikimedia.org/wiki/File:"+encodeURIComponent(file).replace(/%20/g,"_");}
// 直接使用 Wikimedia 的實際縮圖主機，避免 Special:FilePath 重新導向被 CSP 阻擋。
// Hash 為 Commons 以檔名（空格正規化為底線）計算的 MD5 前兩碼。
const COMMONS_HASH:Record<string,string> = {
 "Beipu Taiwan Street-vendor-01.jpg":"f1",
 "Lei cha at Beipu, Taiwan 2023-04-09.jpg":"c3",
 "Emei Township Wikivoyage Banner.jpg":"3c",
 "Neiwan Station 2024-01-06.jpg":"d3",
 "Old Street Neiwan.jpg":"83",
 "2022 Neiwan Suspension Bridge.jpg":"7e",
 "新埔劉氏雙堂屋 (1).jpg":"0b",
 "202510 藍染方巾與柿染方巾.jpg":"00",
 "關西仙草加工廠 Guanxi Mesona Processing Plant - panoramio.jpg":"1e",
 "新竹漁港之一景.jpg":"6a",
 "十七公里海岸線林道.JPG":"70",
 "退潮時的香山濕地.jpg":"37",
 "新竹縣古蹟-湖口老街.jpg":"4b",
 "湖口老街街屋門面近景.jpg":"2f",
 "紅毛港紅樹林橋.jpg":"64",
 "竹東週六夜市.jpg":"4e",
 "蕭如松藝術園區日式建築.jpg":"f9",
 "大山背樂善堂 主廟正面 20200211.jpg":"80"
};
export function commonsImage(file:string,width=800){
 const hash=COMMONS_HASH[file];
 if(!hash)return "https://commons.wikimedia.org/wiki/Special:FilePath/"+encodeURIComponent(file)+"?width="+width;
 const filename=encodeURIComponent(file.replace(/ /g,"_"));
 return "https://thumb.wikimedia.org/wikipedia/commons/thumb/"+hash[0]+"/"+hash+"/"+filename+"/"+width+"px-"+filename;
}
export function commonsOriginal(file:string){
 const hash=COMMONS_HASH[file];
 if(!hash)return commonsImage(file);
 return "https://upload.wikimedia.org/wikipedia/commons/"+hash[0]+"/"+hash+"/"+encodeURIComponent(file.replace(/ /g,"_"));
}

