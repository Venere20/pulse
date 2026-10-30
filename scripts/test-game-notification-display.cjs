const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
function load(file,mocks={}){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:n=>mocks[n],Map,Set,Date,setTimeout,clearTimeout,Uint8Array,console});return module.exports;}
(async()=>{const activity=load('src/services/gameActivity.ts');let handler;
 load('src/services/notification.ts',{'expo-device':{},'expo-notifications':{setNotificationHandler:h=>handler=h,setNotificationChannelAsync:async()=>{},AndroidImportance:{MAX:5}},'react-native':{Platform:{OS:'android'}},'../config/supabase':{supabase:{}},'./gameActivity':activity,'./coolingActivity':{quietDuringCooling:()=>false}});
 const notice=url=>({request:{content:{data:{url}}}});
 for(const game of activity.SHARED_GAMES){const leave=activity.enterGame(game);const quiet=await handler.handleNotification(notice('/play/'+game));assert.equal(quiet.shouldShowBanner,false);assert.equal(quiet.shouldShowList,false);assert.equal(quiet.shouldPlaySound,false);assert.equal((await handler.handleNotification(notice('/checkin'))).shouldShowBanner,true);assert.equal(activity.suppressGameNotice({url:'/#/play/'+game}),true);leave();assert.equal((await handler.handleNotification(notice('/play/'+game))).shouldShowBanner,true)}
 const old=activity.enterGame('tris'),current=activity.enterGame('tris');old();assert.equal(activity.suppressGameNotice({url:'/play/tris'}),true);current();assert.equal(activity.suppressGameNotice({url:'https://evil.test/play/tris'}),false);
 const events={},shown=[];let windows=[];vm.runInNewContext(fs.readFileSync('public/sw.js','utf8'),{URL,self:{location:{origin:'https://pulse.test'},registration:{showNotification:async(title,options)=>shown.push({title,options})},addEventListener:(n,f)=>events[n]=f},clients:{matchAll:async()=>windows}});
 async function push(url){let pending;events.push({data:{json:()=>({title:'Test',url})},waitUntil:p=>pending=p});await pending}
 windows=[{visibilityState:'visible',url:'https://pulse.test/play/tris'}];await push('/play/tris');assert.equal(shown.length,0);
 await push('/play/connect4');assert.equal(shown.length,1);await push('/checkin');assert.equal(shown.length,2);
 windows=[{visibilityState:'hidden',url:'https://pulse.test/play/tris'}];await push('/play/tris');assert.equal(shown.length,3);
 windows=[{visibilityState:'visible',url:'https://pulse.test/#/play/tris'}];await push('/#/play/tris');assert.equal(shown.length,3);
 console.log('PASS notification display: native banner/list/sound muted only in the matching active game; web visible game suppresses late alerts; background and safety alerts preserved.');
})().catch(e=>{console.error(e);process.exitCode=1});
