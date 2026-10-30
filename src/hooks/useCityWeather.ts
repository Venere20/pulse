import { useEffect,useState } from 'react';
import { CityWeather,fetchCityWeather } from '../utils/weather';
import { useScreenActive } from './useActivity';
/** Bind cached values to their city pair so changing cities never relabels old temperatures. */
export function useCityWeather(myCity?:string|null,partnerCity?:string|null){
 const active=useScreenActive();
 const key=JSON.stringify([myCity,partnerCity]);
 const [snapshot,setSnapshot]=useState<{key:string;mine:CityWeather|null;theirs:CityWeather|null}|null>(null);
 useEffect(()=>{
  if(!active||!myCity||!partnerCity)return;
  let alive=true;
  let controller=new AbortController();
  const load=()=>{controller.abort();controller=new AbortController();return Promise.all([fetchCityWeather(myCity,controller.signal),fetchCityWeather(partnerCity,controller.signal)]).then(([mine,theirs])=>{
   if(alive)setSnapshot(previous=>({key,mine:mine??(previous?.key===key?previous.mine:null),theirs:theirs??(previous?.key===key?previous.theirs:null)}));
  }).catch(()=>{});};
  void load();const timer=setInterval(load,15*60000);return()=>{alive=false;controller.abort();clearInterval(timer);};
 },[key,myCity,partnerCity,active]);
 const valid=snapshot?.key===key;
 return {mine:valid?snapshot.mine:null,theirs:valid?snapshot.theirs:null,loading:!!myCity&&!!partnerCity&&!valid};
}
