const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
async function main(){
 let uploads=[],removals=[],fetches=0;
 const storage={from:bucket=>{assert.equal(bucket,'visit-covers');return {upload:async(...args)=>{uploads.push(args);return {error:null}},remove:async(paths)=>{removals.push(paths);return {error:null}}}}};
 const exports={};vm.runInNewContext(compile(fs.readFileSync('src/services/visitCovers.ts','utf8')),{exports,require:()=>({supabase:{storage}}),fetch:async()=>{fetches++;return {ok:true,headers:{get:()=> 'image/png; charset=binary'},arrayBuffer:async()=>new ArrayBuffer(4)}},Date,Math,Error});
 const path=await exports.uploadVisitCover('visit',{uri:'local'});assert.match(path,/^visit\/\d+-[a-z0-9]+\.png$/);assert.equal(uploads[0][2].upsert,false);assert.equal(uploads[0][2].contentType,'image/png');
 await assert.rejects(exports.uploadVisitCover('visit',{uri:'local',fileSize:8388609}),/8 MB/);assert.equal(fetches,1);
 await assert.rejects(exports.uploadVisitCover('visit',{uri:'local',mimeType:'image/gif'}),/Formato/);
 await exports.removeVisitCover(path);assert.equal(JSON.stringify(removals[0]),JSON.stringify([path]));
 for(const mode of ['large','read','upload']){
 const out={};vm.runInNewContext(compile(fs.readFileSync('src/services/visitCovers.ts','utf8')),{exports:out,require:()=>({supabase:{storage:{from:()=>({upload:async()=>({error:new Error('upload failed')})})}}}),fetch:async()=>({ok:mode!=='read',headers:{get:()=> 'image/jpeg'},arrayBuffer:async()=>new ArrayBuffer(mode==='large'?8388609:4)}),Date,Math,Error});
 await assert.rejects(out.uploadVisitCover('visit',{uri:'local'}),mode==='large'?/8 MB/:mode==='read'?/leggere/:/upload failed/);
 }
 const source=fs.readFileSync('src/screens/VisitDetailScreen.tsx','utf8');const handlers=source.slice(source.indexOf('  const choosePersonalCover ='),source.indexOf('  const expenses ='));
 const saveModule={};vm.runInNewContext(compile(fs.readFileSync('src/services/saveState.ts','utf8')),{exports:saveModule,Error,Set,Map});
 for(const scenario of ['ok','cancel','picker','rejected','network','refresh']){
 let deletes=[],writes=[],pending={current:false},success=[],errors=[];
 const ctx={ImagePicker:{launchImageLibraryAsync:async()=>{if(scenario==='picker')throw new Error('picker failed');return {canceled:scenario==='cancel',assets:[{uri:'local'}]}}},coverPending:pending,setCoverSaving:()=>{},uploadVisitCover:async()=> 'visit/new.png',removeVisitCover:async p=>deletes.push(p),visit:{id:'visit'},trackResult:async action=>action(),uncertainWrite:saveModule.uncertainWrite,supabase:{from:()=>({update:payload=>{writes.push(payload);return {eq:async()=>({error:scenario==='rejected'?{message:'permission denied'}:scenario==='network'?{message:'network timeout'}:null})}}})},toast:{success:m=>success.push(m),error:m=>errors.push(m)},setCoverOpen:()=>{},d:{refresh:async()=>{if(scenario==='refresh')throw new Error('refresh failed')}},Error};
 vm.runInNewContext(compile(handlers+'\nglobalThis.handlers={choosePersonalCover,useDefaultCover};'),ctx);
 await ctx.handlers.choosePersonalCover();assert.equal(pending.current,false);
 assert.deepEqual(deletes,scenario==='rejected'?['visit/new.png']:[]);
 for(const w of writes)assert.equal('memory_photos' in w,false);
 assert.equal(errors.length,['picker','rejected','network','refresh'].includes(scenario)?1:0);
 if(scenario==='ok'){await ctx.handlers.useDefaultCover();assert.equal(writes[1].cover_source,'default');assert.equal(writes[1].cover_storage_path,null)}
 }
 console.log('PASS: formats/8 MB/upload/remove; cancel/picker errors; private paths; default; memories unchanged; failed/uncertain/committed writes preserve correct files.');
}
main().catch(e=>{console.error(e);process.exit(1)});

