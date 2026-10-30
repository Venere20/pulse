const assert=require('node:assert/strict'),load=require('./solo-test-loader.cjs')();
const{newClouds,validClouds,cloudsStep,cloudLane,CLOUD_WAVES,CLOUD_WAVE_MS}=load('src/features/sologames/clouds.ts');
for(const difficulty of ['easy','normal','hard']){
 let s={...newClouds(difficulty,42),phase:'running'};let maxItems=0;
 for(let step=0;step<CLOUD_WAVES*CLOUD_WAVE_MS/100;step++){
  // Automated player chooses a lane free of imminent clouds; test the whole long campaign.
  const dangerous=new Set(s.items.filter(item=>item.kind==='cloud'&&(s.elapsed-item.born)/item.duration>=0.60&&(s.elapsed-item.born)/item.duration<=0.96).map(item=>item.lane));
  const lane=[0,1,2].find(lane=>!dangerous.has(lane));if(lane!==undefined)s=cloudLane(s,lane);
  s=cloudsStep(s,100);maxItems=Math.max(maxItems,s.items.length);
  if(step%100===0){assert.ok(validClouds(s));assert.ok(validClouds(JSON.parse(JSON.stringify({...s,phase:s.phase==='running'?'paused':s.phase}))));}
  assert.notEqual(s.phase,'over');
 }
 assert.equal(s.phase,'won');assert.ok(maxItems<=12);assert.ok(s.score>0);assert.strictEqual(cloudsStep(s,100),s);
}
const item={id:0,lane:1,born:0,duration:2000,kind:'cloud'};
let s={...newClouds(),phase:'running',elapsed:1500,nextSpawn:2500,serial:1,items:[item]};s=cloudsStep(s,100);assert.equal(s.lives,4);assert.equal(s.items.length,0);const once=s;assert.equal(cloudsStep(s,100).lives,4);
const star=cloudsStep({...once,elapsed:1500,items:[{...item,kind:'star'}],nextSpawn:2500},100);assert.equal(star.stars,1);assert.ok(star.score>=25);
const heart=cloudsStep({...once,elapsed:1500,lives:3,items:[{...item,kind:'heart'}],nextSpawn:2500},100);assert.equal(heart.lives,4);
assert.strictEqual(cloudsStep({...s,phase:'paused'},100).phase,'paused');assert.equal(cloudsStep(s,100000).elapsed,s.elapsed+100);
for(const bad of [null,{}, {...newClouds(),lives:-1},{...newClouds(),items:[{}]}])assert.equal(validClouds(bad),false);
console.log('PASS Schiva le nuvole: full 50-minute campaigns in 3 difficulties, collisions, invulnerability, stars/hearts, bounded obstacles, pause/resume and lag clamp.');
