const fs=require('fs'),vm=require('vm'),ts=require('typescript'),assert=require('node:assert/strict');const m={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/features/partnergames/secretRecovery.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:m.exports,module:m,AbortController,setTimeout,clearTimeout,require:()=>({recoveryDelay:()=>1,transientReadFailure:e=>e.message.includes('network')})});
const recover=m.exports.recoverGameSecret,sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{let count=0;await new Promise((resolve,reject)=>{const stop=recover(async()=>{if(++count===1)throw Error('network');return{word:'CUORE'}},value=>{try{assert.equal(value.word,'CUORE');assert.equal(count,2);stop();resolve()}catch(e){reject(e)}},()=>{});});
 count=0;let errors=0;let stop=recover(async()=>{count++;throw Error('Accesso negato')},()=>assert.fail(),()=>errors++);await sleep(20);stop();assert.equal(count,1);assert.equal(errors,1);
 let finished;let signal;const accepted=[];stop=recover(s=>{signal=s;return new Promise(r=>finished=r)},value=>accepted.push(value),()=>assert.fail());await sleep(5);stop();assert.equal(signal.aborted,true);finished({word:'OLD ACCOUNT'});await sleep(5);assert.equal(accepted.length,0);
 count=0;stop=recover(async()=>{count++;return{}},()=>{},()=>{});stop();await sleep(5);assert.equal(count,0);
 console.log('PASS secret recovery: transient retry, permanent failure surfaced without loop, abort/late-response isolation and unmounted scene cleanup');
})().catch(e=>{console.error(e);process.exitCode=1});
