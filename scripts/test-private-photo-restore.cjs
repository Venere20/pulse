const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
function load(file,mocks,extra={}){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:n=>mocks[n],Uint8Array,...extra});return module.exports;}
(async()=>{
 const paths=load('src/services/memoryPhotoPaths.ts',{}),origin='https://db.test',prefix=origin+'/storage/v1/object/public/meetings/';
 const fetched=[],uploads=[],tables=[],signed=[];
 const photos={memoryPhotoStoragePath:r=>paths.meetingPhotoPath(r,origin),memoryPhotoDownloadUrl:async r=>{signed.push(r);return origin+'/signed';}};
 const db={from:name=>{tables.push(name);return{upsert:()=>({select:async()=>({data:[],error:null})})}},storage:{from:bucket=>({upload:async(path,bytes,opts)=>{uploads.push({bucket,path,opts});return{error:null}}})}};
 let exists=true;
 const {restoreBackup}=load('src/services/restore.ts',{'react-native':{Platform:{OS:'web'}},'../config/supabase':{supabase:db},'./memoryPhotos':photos},{fetch:async(url,opts)=>{fetched.push({url,opts});return{ok:exists}}});
 const data={app:'couples-app',tables:{'users; DROP TABLE users;':[{id:'x'}]},photos:{'https://evil.test/secret':{mime:'image/jpeg',base64:'AQID'},[prefix+'v/p.svg']:{mime:'image/svg+xml',base64:'AQID'},[prefix+'v/p.jpg']:{mime:'image/jpeg',base64:'AQID'}}};
 await restoreBackup(JSON.stringify(data));assert.equal(fetched.length,1);assert.equal(fetched[0].url,origin+'/signed');assert.equal(uploads.length,0);assert.equal(tables.length,0);
 exists=false;await restoreBackup(JSON.stringify(data));assert.equal(uploads.length,1);assert.equal(uploads[0].path,'v/p.jpg');assert.equal(uploads[0].opts.upsert,false);assert.equal(signed.length,2);
 console.log('PASS private photo restore: authorized signed HEAD only; foreign hosts, active SVG and injected table names ignored; existing photos preserved; missing photos uploaded without overwrite.');
})().catch(e=>{console.error(e);process.exitCode=1});
