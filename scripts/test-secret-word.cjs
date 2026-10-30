const assert=require('node:assert/strict'),load=require('./solo-test-loader.cjs')();
const words=load('src/features/sologames/italianWords.ts').ITALIAN_WORDS;
const{newSecretWord,validSecretWord,secretTarget,guessWord,nextSecretWord,wordClues,wordResult,revealLetter,guessLimit,guessError}=load('src/features/sologames/secretWord.ts');
assert.ok(words.length>=200);assert.equal(words.length,new Set(words).size);assert.ok(words.every(w=>/^[A-Z]{5}$/.test(w)));
assert.equal(JSON.stringify(wordClues('MAMMA','AMORE')),JSON.stringify(['present','present','absent','absent','absent']));
assert.equal(JSON.stringify(wordClues('CARTA','TATTO')),JSON.stringify(['absent','correct','absent','correct','absent']));
for(const difficulty of ['easy','normal','hard']){let s=newSecretWord(difficulty,42);const seen=new Set();for(let i=0;i<200;i++){
 assert.ok(validSecretWord(s));const target=secretTarget(s);assert.ok(!seen.has(target));seen.add(target);assert.strictEqual(nextSecretWord(s),s);
 s=revealLetter(s);s=guessWord(s,target.toLowerCase());assert.equal(wordResult(s),'won');assert.strictEqual(guessWord(s,target),s);assert.ok(validSecretWord(JSON.parse(JSON.stringify(s))));
 if(i<199)s=nextSecretWord(s);else assert.strictEqual(nextSecretWord(s),s);
}assert.equal(s.solved,200);}
let s=newSecretWord();for(const w of words.filter(w=>w!==secretTarget(s)).slice(0,guessLimit(s.difficulty)))s=guessWord(s,w);assert.equal(wordResult(s),'lost');assert.ok(validSecretWord(s));assert.ok(guessError(s,'XXXXX'));assert.ok(guessError(s,'ABC'));
for(const bad of [null,{}, {...newSecretWord(),order:Array(200).fill(0)},{...newSecretWord(),hints:[7]}])assert.equal(validSecretWord(bad),false);
console.log('PASS Parola segreta: '+words.length+' Italian vocabulary entries, 200 distinct rounds per campaign, duplicate-letter clues, hints, wins/losses and resume.');
