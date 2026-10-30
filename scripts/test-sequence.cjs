const assert=require('node:assert/strict'),load=require('./solo-test-loader.cjs')();
const{newSequence,validSequence,sequencePattern,sequenceInput,advanceSequence,SEQUENCE_ROUNDS}=load('src/features/sologames/sequence.ts');
for(const difficulty of ['easy','normal','hard']){
 let s=newSequence(difficulty,42);for(let level=0;level<SEQUENCE_ROUNDS;level++){
  assert.ok(validSequence(s));assert.strictEqual(advanceSequence(s),s);s={...s,phase:'input'};const pattern=sequencePattern(s);assert.ok(pattern.length>=2&&pattern.length<=24);
  const wrong=sequenceInput(s,(pattern[0]+1)%4);assert.equal(wrong.lives,s.lives-1);assert.equal(wrong.phase,'ready');
  for(const pad of pattern)s=sequenceInput(s,pad);assert.ok(validSequence(s));const done=s;assert.strictEqual(sequenceInput(s,0),done);
  s=JSON.parse(JSON.stringify(s));assert.ok(validSequence(s));if(level<SEQUENCE_ROUNDS-1)s=advanceSequence(s);
 }assert.equal(s.phase,'won');assert.ok(s.score>10000);
}
let lost={...newSequence(),phase:'input'};for(let i=0;i<5;i++){lost={...lost,phase:'input'};lost=sequenceInput(lost,(sequencePattern(lost)[0]+1)%4);}assert.equal(lost.phase,'lost');assert.ok(validSequence(lost));
for(const bad of [null,{}, {...newSequence(),lives:-1},{...newSequence(),input:99},{...newSequence(),phase:'won'}])assert.equal(validSequence(bad),false);
console.log('PASS Sequenza luminosa: 120 rounds in all difficulties, length progression, wrong inputs, lives/game over, idempotent scores and resume.');
