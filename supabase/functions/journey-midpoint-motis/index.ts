import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.2';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
const fixed=[{id:'beverello',name:'Napoli Molo Beverello',lat:40.8388,lon:14.2548},{id:'centrale',name:'Napoli Centrale',lat:40.8523,lon:14.2724},{id:'portici',name:'Portici',lat:40.816,lon:14.337}];
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return json({error:'Metodo non consentito'},405);
 const authorization=req.headers.get('authorization')??'';if(!authorization.startsWith('Bearer '))return json({error:'Accesso richiesto'},401);
 const url=Deno.env.get('SUPABASE_URL')??'',anon=Deno.env.get('SUPABASE_ANON_KEY')??'';
 const client=createClient(url,anon,{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
 const {data:auth,error}=await client.auth.getUser();if(error||!auth.user)return json({error:'Sessione non valida'},401);
 try{
  const text=await req.text();if(text.length>2048)return json({error:'Richiesta troppo grande'},413);const body=JSON.parse(text);
  if(typeof body.visitId!=='string'||!/^[a-f0-9-]{36}$/i.test(body.visitId))return json({error:'Incontro non valido'},400);
  const {data:context,error:denied}=await client.rpc('get_journey_context',{p_visit:body.visitId});if(denied||!context?.me)return json({error:'Incontro non disponibile'},403);
  if(!context.mine?.city||!context.partner?.city||!context.mine.modes?.length||!context.partner.modes?.length)return json({error:'Indicate le partenze nelle impostazioni e salvate i mezzi di entrambi.'},400);
  let last=0;
  const api=async(input:Record<string,unknown>)=>{
   const delay=1100-(Date.now()-last);if(delay>0)await new Promise(r=>setTimeout(r,delay));last=Date.now();
   const r=await fetch(url+'/functions/v1/journey-plan',{method:'POST',headers:{Authorization:authorization,apikey:anon,'Content-Type':'application/json'},body:JSON.stringify({visitId:body.visitId,...input}),signal:AbortSignal.timeout(20000)});
   const data=await r.json();if(!r.ok||data.error)throw Error('Percorso non disponibile');return data;
  };
  const location=async(city:string)=>(await api({action:'lookup',text:city,near:fixed[1]})).places[0];
  const island=(p:{city:string;modes:string[]})=>/\bischia\b/i.test(p.city)&&p.modes.includes('Aliscafo');
  const [mine,partner]=[context.mine,context.partner];
  const a=island(mine)?fixed[0]:await location(mine.city),b=island(partner)?fixed[0]:await location(partner.city);
  if(!a||!b)return json({candidates:[]});
  const points=island(mine)||island(partner)?fixed:[{...a,id:'origin-a'},{...b,id:'origin-b'},{id:'middle',name:'Punto intermedio da verificare',lat:(a.lat+b.lat)/2,lon:(a.lon+b.lon)/2}];
  const approach=async(person:{city:string;modes:string[]},from:typeof a,to:typeof a)=>{
   if(person.modes.some(m=>['Auto','Aereo','Traghetto','Bus'].includes(m)))throw Error('Mezzo non supportato');
   const sea=island(person),extra=sea?33000:0;const departure=Date.now()+(sea?45*60000:0);
   if(Math.abs(from.lat-to.lat)<.00001&&Math.abs(from.lon-to.lon)<.00001)return{meters:extra,minutes:sea?45:0};
   const p=Object.fromEntries(new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(departure).map(v=>[v.type,v.value]));
   // MOTIS RAIL includes regional/long-distance rail, SUBURBAN and SUBWAY.
   // Prefer it when both are selected; metro-only would exclude mainline rail.
   const mode=person.modes.includes('Treno')?'train':person.modes.includes('Metro')?'metro':'walk';
   const data=await api({preset:'shared',from,to,direction:'out',mode,day:`${p.year}-${p.month}-${p.day}`,hour:`${p.hour}:${p.minute}`});
   const option=data.options.find((o:{complete:boolean;uncertain:boolean})=>o.complete&&!o.uncertain);if(!option)throw Error('Distanza mancante');
   return{meters:option.meters+extra,minutes:Math.ceil(option.seconds/60)+(sea?45:0)};
  };
  const candidates=[];for(const point of points){try{const own=await approach(mine,a,point),other=await approach(partner,b,point);candidates.push({...point,mine:own,partner:other,source:'api'});}catch{/* Missing routes never become straight-line distances. */}}
  return json({candidates,boundedSearch:true,comparedAt:new Date().toISOString(),provider:'Transitous',notice:'Tre candidati; partenze indicative dei luoghi scelti, non indirizzi GPS.'});
 }catch{return json({error:'Confronto non disponibile. Controlla i luoghi e riprova.'},502);}
});
