import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.2';
import { checkedPlace, validate, planUrl, normalize, lookupPlaces } from '../_shared/motis.js';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
const json=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
const cache=new Map<string,{at:number;value:unknown}>();
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return json({error:'Metodo non consentito'},405);
 const authorization=req.headers.get('authorization')??'';
 if(!authorization.startsWith('Bearer '))return json({error:'Accesso richiesto'},401);
 const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
 const {data:auth,error:authError}=await client.auth.getUser();
 if(authError||!auth.user)return json({error:'Sessione non valida'},401);
 try{
  const text=await req.text();if(text.length>4096)return json({error:'Richiesta troppo grande'},413);
  const body=JSON.parse(text);
  if(typeof body.visitId!=='string'||!/^[a-f0-9-]{36}$/i.test(body.visitId))return json({error:'Incontro non valido'},400);
  const context=await client.rpc('get_journey_context',{p_visit:body.visitId});
  if(context.error||!context.data?.me)return json({error:'Incontro non disponibile'},403);
  const lookup=body.action==='lookup';let config,url:URL;
  if(lookup){if(typeof body.text!=='string'||body.text.trim().length<2||body.text.length>100)return json({error:'Scrivi da 2 a 100 caratteri'},400);
   const near=checkedPlace(body.near);url=new URL('https://api.transitous.org/api/v1/geocode');
   for(const[k,v]of Object.entries({text:body.text.trim(),type:'PLACE,ADDRESS',language:'it',place:near.lat+','+near.lon,numResults:'6'}))url.searchParams.set(k,v);
  }else{config=validate(body);url=planUrl(config);}
  const key=auth.user.id+':'+url+':'+JSON.stringify([config?.preset,config?.from,config?.to]);const old=cache.get(key);
  if(old&&Date.now()-old.at<300000)return json(old.value);
  const budget=await client.rpc('claim_routing_request');
  if(budget.error||!budget.data)return json({error:'Attendi un secondo fra ricerche. Il servizio consente al massimo 120 richieste al giorno per la coppia.'},429);
  const response=await fetch(url,{headers:{'User-Agent':'Pulse/1.6.1 (+https://github.com/Venere20/pulse)','Accept':'application/json'},redirect:'error',signal:AbortSignal.timeout(20000)});
  if(!response.ok)return json({error:'Servizio dei percorsi temporaneamente non disponibile'},502);
  const raw=await response.text();if(raw.length>5000000)throw Error('Risposta troppo grande');const data=JSON.parse(raw);
  const value=lookup?{places:lookupPlaces(data)}:normalize(data,{preset:config.preset,from:config.from,to:config.to,direction:config.direction,requestedTime:config.time});
  cache.set(key,{at:Date.now(),value});if(cache.size>40)cache.delete(cache.keys().next().value!);
  return json(value);
 }catch{return json({error:'Controlla luoghi, data e ora oppure riprova più tardi.'},400);}
});
