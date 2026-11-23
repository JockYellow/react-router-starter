import type { ActionFunctionArgs } from "react-router";
import { handleTripMap } from "../../features/trip-map/server";
export async function action(args:ActionFunctionArgs){
 try{return await handleTripMap(args);}
 catch(error){
  console.error("trip-map request failed",error);
  return Response.json({error:"伺服器暫時無法處理，請稍後重試。"}, {status:500,headers:{"Cache-Control":"no-store"}});
 }
}
export async function loader(){return new Response("Method Not Allowed",{status:405,headers:{Allow:"POST"}});}
