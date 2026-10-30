'use strict';
const MODES={WALK:'Cammino',REGIONAL_RAIL:'Treno regionale',HIGHSPEED_RAIL:'Alta velocità',LONG_DISTANCE:'Treno',NIGHT_RAIL:'Treno notturno',SUBWAY:'Metro',SUBURBAN:'Treno metropolitano',BUS:'Autobus',TRAM:'Tram',FERRY:'Traghetto'};
const PRESETS={
 ischia:{id:'ischia',title:'Il tuo arrivo',from:'Ischia Porto',to:'Napoli Centrale',origin:'40.8388,14.2548',destination:'40.8523,14.2724',groundFrom:'Napoli · Molo Beverello',who:'a',modes:['metro','walk'],defaultMode:'metro'},
 'san-marcellino':{id:'san-marcellino',title:'L’arrivo del partner',from:'San Marcellino–Frignano',to:'Napoli Centrale',origin:'it-trenitalia_09005',destination:'40.8523,14.2724',who:'b',modes:['train'],defaultMode:'train'},
 roma:{id:'roma',title:'Il viaggio insieme',from:'Napoli Centrale',to:'Roma Termini',origin:'40.8523,14.2724',destination:'41.9009,12.5021',who:'both',modes:['train'],defaultMode:'train'}
};
function haversine(a,b){const R=6371008.8,toRad=x=>x*Math.PI/180,p1=toRad(a[0]),p2=toRad(b[0]),dp=p2-p1,dl=toRad(b[1]-a[1]);return 2*R*Math.asin(Math.min(1,Math.sqrt(Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2)));}
function decodeGeometry(geometry){
 if(!geometry||typeof geometry.points!=='string'||geometry.points.length>200000||![5,6,7].includes(geometry.precision))return [];
 let i=0,lat=0,lon=0;const points=[],scale=10**geometry.precision,s=geometry.points;
 function read(){let value=0,shift=0,b;do{if(i>=s.length||shift>30)throw Error('Geometria incompleta');b=s.charCodeAt(i++)-63;if(b<0||b>63)throw Error('Geometria non valida');value+=(b&31)*2**shift;shift+=5;}while(b>=32);return value%2?-(Math.floor(value/2)+1):value/2;}
 try{while(i<s.length){lat+=read();lon+=read();const point=[lat/scale,lon/scale];if(Math.abs(point[0])>90||Math.abs(point[1])>180||points.length>=20000)return [];points.push(point);}return points;}catch{return [];}
}
function geometryDistance(points){return points.slice(1).reduce((n,p,i)=>n+haversine(points[i],p),0);}
function legValue(leg,index){
 if(!leg||!leg.from||!leg.to||typeof leg.mode!=='string'||!Number.isFinite(leg.duration)||leg.duration<0||!Number.isFinite(Date.parse(leg.startTime))||!Number.isFinite(Date.parse(leg.endTime)))throw Error('Tratta incompleta restituita dal servizio.');
 let points=decodeGeometry(leg.legGeometry);
 for(const [point,place]of [[points[0],leg.from],[points.at(-1),leg.to]])if(point&&Number.isFinite(place.lat)&&Number.isFinite(place.lon)&&haversine(point,[place.lat,place.lon])>1500){points=[];break;}
 const unique=new Set(points.map(p=>p.join(','))).size;
 const transit=leg.mode!=='WALK';
 // MOTIS documents `distance` for NON-transit legs only. Transit uses polyline.
 const providerDistance=!transit&&Number.isFinite(leg.distance)&&leg.distance>=0?leg.distance:null;
 const sparse=transit&&unique<=Math.max(2,(leg.intermediateStops?.length??0)+2);
 const meters=providerDistance??(unique>2?geometryDistance(points):null);
 return {id:index,mode:leg.mode,label:MODES[leg.mode]??leg.mode,from:String(leg.from.name??'Partenza').slice(0,140),to:String(leg.to.name??'Arrivo').slice(0,140),
  line:String(leg.displayName??leg.routeShortName??leg.tripShortName??'').slice(0,100),agency:String(leg.agencyName??'').slice(0,100),source:String(leg.source??'').slice(0,120),
  start:leg.startTime,end:leg.endTime,seconds:leg.duration,meters:meters===null?null:Math.round(meters),pointCount:unique,
  distanceSource:providerDistance!==null?'provider':meters===null?'missing':sparse?'sparse':'geometry',points,
  straightMeters:points.length>1?Math.round(haversine(points[0],points.at(-1))):null,realTime:leg.realTime===true,cancelled:leg.cancelled===true};
}
function normalize(data,metadata){
 if(!data||!Array.isArray(data.itineraries)||!Array.isArray(data.direct))throw Error('Risposta MOTIS non riconosciuta.');
 const options=[...data.itineraries,...data.direct].slice(0,5).map((item,i)=>{
  if(!Array.isArray(item.legs)||!item.legs.length||item.legs.length>40||!Number.isFinite(item.duration)||item.duration<0||!Number.isFinite(Date.parse(item.startTime))||!Number.isFinite(Date.parse(item.endTime))||Date.parse(item.endTime)<Date.parse(item.startTime))throw Error('Itinerario non valido.');
  const legs=item.legs.map(legValue),p=PRESETS[metadata.preset],back=metadata.direction==='back';let start=item.startTime,end=item.endTime;
  if(p){if(!legs[0].from||['START','END'].includes(legs[0].from))legs[0].from=back?p.to:p.groundFrom??p.from;if(!legs.at(-1).to||['START','END'].includes(legs.at(-1).to))legs.at(-1).to=back?p.groundFrom??p.from:p.to;}
  if(metadata.preset==='shared'){legs[0].from=metadata.from.name;legs.at(-1).to=metadata.to.name;}
  if(metadata.preset==='ischia'){
   const departure=back?Date.parse(item.endTime):Date.parse(metadata.requestedTime??new Date(Date.parse(item.startTime)-2700000).toISOString());
   const reference={id:'sea-reference',mode:'FERRY',label:'Aliscafo · riferimento',from:back?p.groundFrom:'Ischia Porto',to:back?'Ischia Porto':p.groundFrom,start:new Date(departure).toISOString(),end:new Date(departure+2700000).toISOString(),seconds:2700,meters:33000,pointCount:0,points:[],straightMeters:null,distanceSource:'reference',realTime:false,cancelled:false};
   if(back){legs.push(reference);end=reference.end;}else{legs.unshift(reference);start=reference.start;}
  }
  const missing=legs.some(l=>l.meters===null),cancelled=legs.some(l=>l.cancelled);
  return {id:String(i),start,end,seconds:Math.round((Date.parse(end)-Date.parse(start))/1000),transfers:item.transfers??0,legs,
   meters:missing?null:legs.reduce((n,l)=>n+l.meters,0),partialMeters:legs.reduce((n,l)=>n+(l.meters??0),0),complete:!missing&&!cancelled,cancelled,
   uncertain:legs.some(l=>['missing','sparse'].includes(l.distanceSource))};
 });
 return {...metadata,options};
}
function romeInstant(day,hour){
 if(typeof day!=='string'||typeof hour!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(hour))throw Error('Controlla data e ora.');
 const wall=Date.parse(day+'T'+hour+':00Z');if(!Number.isFinite(wall)||new Date(wall).toISOString().slice(0,10)!==day)throw Error('Data non valida.');
 const fmt=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});let t=wall;
 for(let i=0;i<3;i++){const p=Object.fromEntries(fmt.formatToParts(t).map(x=>[x.type,x.value]));t+=wall-Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00Z`);}
 const p=Object.fromEntries(fmt.formatToParts(t).map(x=>[x.type,x.value]));if(`${p.year}-${p.month}-${p.day}`!==day||`${p.hour}:${p.minute}`!==hour)throw Error('Questo orario non esiste nel fuso italiano.');return new Date(t).toISOString();
}
function validate(input){
 if(input?.preset==='shared'){
  if(!['walk','metro','train'].includes(input.mode)||!['out','back'].includes(input.direction))throw Error('Mezzo o direzione non validi.');
  return {preset:'shared',from:checkedPlace(input.from),to:checkedPlace(input.to),direction:input.direction,mode:input.mode,time:romeInstant(input.day,input.hour),day:input.day,hour:input.hour};
 }
 if(!input||!Object.hasOwn(PRESETS,input.preset)||!['out','back'].includes(input.direction)||!PRESETS[input.preset].modes.includes(input.mode))throw Error('Selezione del percorso non valida.');
 return {preset:input.preset,direction:input.direction,mode:input.mode,time:romeInstant(input.day,input.hour),day:input.day,hour:input.hour};
}
function planUrl(config,base='https://api.transitous.org'){
 const p=config.preset==='shared'?{origin:config.from.lat+','+config.from.lon,destination:config.to.lat+','+config.to.lon}:PRESETS[config.preset],back=config.preset!=='shared'&&config.direction==='back',url=new URL('/api/v6/plan',base);
 const params={fromPlace:back?p.destination:p.origin,toPlace:back?p.origin:p.destination,time:config.time,transitModes:config.mode==='walk'?'':config.mode==='metro'?'SUBWAY,SUBURBAN':'RAIL',directModes:config.mode==='walk'?'WALK':'',preTransitModes:'WALK',postTransitModes:'WALK',numItineraries:'2',detailedLegs:'true',language:'it'};
 if(config.preset==='ischia'&&!back)params.time=new Date(Date.parse(config.time)+2700000).toISOString();
 if(config.mode==='walk')params.maxDirectTime='3600';
 for(const[k,v]of Object.entries(params))url.searchParams.set(k,v);return url;
}
function sumSelections(selections){
 const result={total:0,shared:0,out:0,back:0,a:0,b:0,count:0};
 for(const entry of Object.values(selections)){
  if(!entry||(!Object.hasOwn(PRESETS,entry.preset)&&entry.kind!=='shared-stop')||!['out','back'].includes(entry.direction)||!Number.isFinite(entry.meters)||entry.meters<0)continue;
  const who=entry.kind==='shared-stop'?'both':PRESETS[entry.preset].who,meters=entry.meters;
  result.total+=meters;result[entry.direction]+=meters;result.count++;
  if(who==='both'){result.shared+=meters;result.a+=meters;result.b+=meters;}else result[who]+=meters;
 }
 return result;
}
function checkedPlace(p){if(!p||typeof p.name!=='string'||!p.name.trim()||p.name.length>120||!Number.isFinite(p.lat)||!Number.isFinite(p.lon)||Math.abs(p.lat)>90||Math.abs(p.lon)>180)throw Error('Seleziona un luogo valido dai risultati.');return {name:p.name.trim(),lat:p.lat,lon:p.lon,subtitle:typeof p.subtitle==='string'?p.subtitle.slice(0,160):''};}
function lookupPlaces(data){if(!Array.isArray(data))throw Error('Risposta dei luoghi non valida.');return data.filter(p=>typeof p.name==='string'&&p.name&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)).slice(0,8).map(p=>checkedPlace({name:p.name,lat:p.lat,lon:p.lon,subtitle:[...new Set((p.areas??[]).filter(a=>a.adminLevel>=8).map(a=>a.name))].join(' · ')}));}
export {PRESETS,MODES,haversine,decodeGeometry,geometryDistance,legValue,normalize,romeInstant,validate,planUrl,sumSelections,checkedPlace,lookupPlaces};

