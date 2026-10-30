import React, { useState } from 'react';
import { Linking, View } from 'react-native';
import { Button, Card, Chip, Input, T } from '../../ui/primitives';
import { DateField } from '../../ui/DateField';
import { supabase } from '../../config/supabase';
import { useFeatureAction } from '../FeatureFrame';
import { featureRpc } from '../useFeatureRows';
import { confirmAction } from '../../utils/confirm';
import type { Visit } from '../../types/travel';
import type { JourneyLeg } from './model';

interface Place {name:string;lat:number;lon:number;subtitle?:string;stay:number}
interface Option {meters:number|null;seconds:number;start:string;end:string;complete:boolean;uncertain:boolean;legs:{label:string}[]}
interface Stage {mode:'walk'|'metro'|'train';options:Option[];choice:number}
const central:Place={name:'Napoli Centrale',lat:40.8523,lon:14.2724,stay:0};
const beverello:Place={name:'Molo Beverello',lat:40.8388,lon:14.2548,stay:0};
const clock=(t:string)=>new Date(t).toLocaleTimeString('it-IT',{timeZone:'Europe/Rome',hour:'2-digit',minute:'2-digit'});
const dateParts=(time:number)=>Object.fromEntries(new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(time).map(p=>[p.type,p.value]));
export function RoutePlanner({visit,userId,partnerId,myCity,onChanged}:{visit:Visit;userId:string;partnerId:string;myCity:string;onChanged:()=>Promise<unknown>}){
 const {busy,run}=useFeatureAction();const [opened,setOpened]=useState(false);
 const [who,setWho]=useState<'me'|'partner'|'both'>('both'),[direction,setDirection]=useState<'out'|'back'>('out');
 const [day,setDay]=useState(()=>{const p=dateParts(Date.now());return `${p.year}-${p.month}-${p.day}`;}),[hour,setHour]=useState('10:00');
 const [points,setPoints]=useState<Place[]>([central]),[stages,setStages]=useState<Stage[]>([]),[query,setQuery]=useState(''),[places,setPlaces]=useState<Place[]>([]);
 const [island,setIsland]=useState(/\bischia\b/i.test(myCity)),[message,setMessage]=useState('');
 const invalidate=(next=points)=>{setPoints(next);setStages(next.slice(1).map((_,i)=>({mode:stages[i]?.mode??'walk',options:[],choice:0})));setMessage('Percorso modificato: ricalcola prima di salvare.');};
 const api=async(body:Record<string,unknown>)=>{const {data,error}=await supabase.functions.invoke('journey-plan',{body:{visitId:visit.id,...body}});if(error||data?.error){let text=data?.error;if(!text&&error&&'context'in error){try{text=(await (error.context as Response).json()).error;}catch{}}throw Error(text||'Servizio dei percorsi non disponibile. Puoi inserire i chilometri manualmente.');}return data;};
 const chooseWho=(value:typeof who)=>{setWho(value);invalidate();};
 const calculate=()=>run(async()=>{
  const p=await import('./routeTime');let time=p.italianDeparture(day,hour);const next:Stage[]=stages.map(s=>({...s,options:[],choice:0}));setStages(next);
  time+=points[0].stay*60000;
  for(let i=0;i<next.length;i++){
   if(i)await new Promise(resolve=>setTimeout(resolve,1100));
   const at=dateParts(time);setMessage(`Calcolo tratto ${i+1} di ${next.length}…`);
   const data=await api({preset:'shared',from:points[i],to:points[i+1],mode:next[i].mode,direction,day:`${at.year}-${at.month}-${at.day}`,hour:`${at.hour}:${at.minute}`});
   next[i]={...next[i],options:data.options,choice:0};setStages([...next]);const option=next[i].options[0];
   if(!option?.complete||option.uncertain){setMessage('Un tratto non è disponibile o ha una distanza incompleta. Cambia mezzo o orario.');return;}
   time=Math.ceil((Date.parse(option.end)+points[i+1].stay*60000)/60000)*60000;
  }setMessage('Rivedi le opzioni e conferma le tratte percorse.');
 });
 const save=()=>run(async()=>{
  if(!stages.length||stages.some(s=>!s.options[s.choice]?.complete||s.options[s.choice].uncertain))throw Error('Calcola tutte le tappe prima di salvare.');
  if(!await confirmAction('Conferma percorso','Le tappe sostituiranno le tratte dello stesso gruppo e direzione, aggiornando statistiche e traguardi anche per incontri passati.','Conferma'))return;
  const participants=who==='both'?[userId,partnerId]:[who==='me'?userId:partnerId];
  const keep=(visit.journey_plan?.legs??[]).filter(l=>l.direction!==direction||l.participants.length!==participants.length||!participants.every(id=>l.participants.includes(id)));
  const legs:JourneyLeg[]=stages.map((s,i)=>({id:`route-${who}-${direction}-${i}`,from:points[i].name,to:points[i+1].name,mode:s.mode==='walk'?'Cammino':s.mode==='metro'?'Metro':'Treno',participants,direction,distance_m:s.options[s.choice].meters!,source:'api'}));
  if(who==='me'&&island){const endpoint=direction==='out'?points[0]:points.at(-1)!;if(Math.abs(endpoint.lat-beverello.lat)>.003||Math.abs(endpoint.lon-beverello.lon)>.003)throw Error('Per aggiungere i 33 km del mare, la parte terrestre deve iniziare a Beverello (andata) o terminarvi (ritorno).');const sea:JourneyLeg={id:`sea-${who}-${direction}`,from:direction==='out'?'Ischia Porto':beverello.name,to:direction==='out'?beverello.name:'Ischia Porto',mode:'Aliscafo',participants,direction,distance_m:33000,source:'reference'};if(direction==='out')legs.unshift(sea);else legs.push(sea);}
  if(keep.length+legs.length>40)throw Error('Il viaggio completo può contenere al massimo 40 tratti.');
  await featureRpc('save_visit_journey',{p_visit:visit.id,p_legs:[...keep,...legs]});await onChanged();setMessage('Percorso salvato: chilometri e statistiche aggiornati.');
 });
 if(!opened)return <Button label="Pianifica percorsi e tappe" variant="secondary" disabled={busy} onPress={()=>setOpened(true)} />;
 return <Card><View pointerEvents={busy?'none':'auto'} style={{gap:12}}><T v="title">Percorsi e tappe</T><T tone="muted">Scegli i luoghi in ordine. I tratti insieme contano una sola volta. Andata e ritorno si calcolano separatamente.</T>
  <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{([['me','Il mio percorso'],['partner','Percorso del partner'],['both','Insieme']]as const).map(([v,l])=><Chip key={v} label={l} selected={who===v} onPress={busy?undefined:()=>chooseWho(v)} />)}</View>
  <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{(['out','back']as const).map(v=><Chip key={v} label={v==='out'?'Andata / giornata':'Ritorno'} selected={direction===v} onPress={busy?undefined:()=>{setDirection(v);invalidate();}} />)}</View>
  <DateField label="Giorno del percorso" value={day} disabled={busy} onChange={v=>{setDay(v);invalidate();}} />
  <Input label="Partenza · ora italiana (HH:MM)" value={hour} maxLength={5} editable={!busy} onChangeText={v=>{setHour(v);invalidate();}} />
  {who==='me'&&<><Chip label="Includi aliscafo Ischia–Beverello: 33 km" selected={island} onPress={busy?undefined:()=>{setIsland(v=>!v);invalidate();}} /><T v="caption" tone="muted">Riferimento personale di 33 km per direzione. Non è un orario marittimo verificato. La sequenza terrestre usa l’orario scelto sopra.</T><Button small variant="ghost" label="Usa Beverello come punto terrestre" disabled={busy} onPress={()=>invalidate([beverello,...points.filter(p=>p.name!==beverello.name)])} /></>}
  {points.map((point,i)=><View key={i} style={{gap:6}}><T bold>{i+1}. {point.name}</T><T v="caption" tone="muted">{point.subtitle}</T>
   <View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}><Button small variant="ghost" label={`Su tappa ${i+1}`} disabled={busy||i===0} onPress={()=>{const n=[...points];[n[i-1],n[i]]=[n[i],n[i-1]];invalidate(n);}} /><Button small variant="ghost" label={`Rimuovi tappa ${i+1}`} disabled={busy||points.length<=1} onPress={()=>invalidate(points.filter((_,j)=>i!==j))} /></View>
   <Input label={`Sosta tappa ${i+1} · minuti (0–720)`} value={String(point.stay)} keyboardType="number-pad" editable={!busy} onChangeText={v=>{const n=Number(v);if(Number.isInteger(n)&&n>=0&&n<=720)invalidate(points.map((p,j)=>j===i?{...p,stay:n}:p));}} />
  </View>)}
  <Input label="Aggiungi luogo, stazione o locale" value={query} maxLength={100} editable={!busy} onChangeText={setQuery} />
  <Button label="Cerca luogo" variant="secondary" disabled={busy||query.trim().length<2} onPress={()=>run(async()=>{setPlaces([]);const data=await api({action:'lookup',text:query,near:points.at(-1)??central});setPlaces(data.places.map((p:Place)=>({...p,stay:0})));setMessage(data.places.length?'Seleziona il luogo corretto.':'Nessun luogo trovato. Prova un nome o un indirizzo diverso.');})} />
  {places.map((p,i)=><Button key={i} label={`${p.name} · ${p.subtitle||'Luogo trovato'}`} variant="ghost" disabled={busy} onPress={()=>{if(points.length>=30){setMessage('Massimo 30 tappe in questa sequenza.');return;}invalidate([...points,p]);setPlaces([]);setQuery('');}} />)}
  <Button label="Inverti ordine delle tappe" variant="ghost" disabled={busy||points.length<2} onPress={()=>invalidate([...points].reverse())} />
  {stages.map((stage,i)=><View key={i} style={{gap:8}}><T bold>{points[i].name} → {points[i+1].name}</T><View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{([['walk','Cammino'],['metro','Metro'],['train','Treno']]as const).map(([v,l])=><Chip key={v} label={l} selected={stage.mode===v} onPress={busy?undefined:()=>setStages(old=>old.map((s,j)=>({...s,mode:j===i?v:s.mode,options:j>=i?[]:s.options})))} />)}</View>
   {stage.options.map((o,j)=><Button key={j} variant={stage.choice===j?'secondary':'ghost'} small disabled={busy||!o.complete||o.uncertain} label={`${o.meters===null?'Incompleto':(o.meters/1000).toLocaleString('it-IT')+' km'} · ${clock(o.start)}–${clock(o.end)} · ${Math.ceil(o.seconds/60)} min`} onPress={()=>setStages(old=>old.map((s,k)=>k===i?{...s,choice:j}:k>i?{...s,options:[]}:s))} />)}</View>)}
  <T accessibilityLiveRegion="polite">{message}</T><Button label="Calcola tutte le tappe" loading={busy} disabled={!stages.length} onPress={calculate} />
  <Button label="Conferma e salva queste tappe" disabled={busy||!stages.length||stages.some(s=>!s.options[s.choice]?.complete||s.options[s.choice].uncertain)} onPress={save} />
  <T v="caption" tone="muted">Stime dei percorsi, senza GPS. Servizio volontario: può non coprire tutte le tratte. Dati inviati solo quando cerchi; nessun aggiornamento automatico in background.</T>
  <Button small label="Dati Transitous e fonti dei trasporti" variant="ghost" onPress={()=>void Linking.openURL('https://transitous.org/sources/')} /><Button small label="© OpenStreetMap contributors" variant="ghost" onPress={()=>void Linking.openURL('https://www.openstreetmap.org/copyright')} />
  <Button variant="ghost" label="Chiudi pianificatore" disabled={busy} onPress={()=>setOpened(false)} />
 </View></Card>;
}
