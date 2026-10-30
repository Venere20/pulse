/** Wall clock in Rome, never the phone time zone. Reject DST gaps. */
export function italianDeparture(day:string,hour:string) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(hour))throw Error('Controlla la data e scrivi l’ora con due cifre: per esempio 07:10.');
  const wall=Date.parse(day+'T'+hour+':00Z');if(!Number.isFinite(wall)||new Date(wall).toISOString().slice(0,10)!==day)throw Error('Data non valida.');
  const fmt=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});let t=wall;
  const parts=(value:number)=>Object.fromEntries(fmt.formatToParts(value).map(p=>[p.type,p.value]));
  for(let i=0;i<3;i++){const p=parts(t);t+=wall-Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00Z`);}
  const p=parts(t);if(`${p.year}-${p.month}-${p.day}`!==day||`${p.hour}:${p.minute}`!==hour)throw Error('Questo orario non esiste nel fuso italiano.');return t;
}
