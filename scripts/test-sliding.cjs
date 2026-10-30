const assert=require('node:assert/strict'),load=require('./solo-test-loader.cjs')();
const{newSliding,validSliding,puzzleSolvable,solvedBoard,puzzleSolved,scramblePuzzle,slideTile,undoSlide,nextSliding,neighbours}=load('src/features/sologames/sliding.ts');
for(const size of [3,4,5]){
 let s=newSliding(size,42);const seen=new Set();for(let level=0;level<200;level++){
  assert.ok(validSliding(s));assert.ok(!puzzleSolved(s.board));assert.ok(puzzleSolvable(s.board,size));assert.ok(!seen.has(s.board.join(',')));seen.add(s.board.join(','));assert.strictEqual(nextSliding(s),s);
  const old=s;const tile=neighbours(size,s.board.indexOf(0))[0];s=slideTile(s,tile);assert.ok(validSliding(s));s=undoSlide(s);assert.equal(s.board.join(','),old.board.join(','));assert.equal(s.moves,2);
  const impossible=[...solvedBoard(size)];[impossible[0],impossible[1]]=[impossible[1],impossible[0]];assert.equal(puzzleSolvable(impossible,size),false);
  const oneAway=[...solvedBoard(size)];[oneAway[oneAway.length-1],oneAway[oneAway.length-2]]=[oneAway[oneAway.length-2],oneAway[oneAway.length-1]];
  const winning=slideTile({...s,board:oneAway},oneAway.length-1);assert.ok(puzzleSolved(winning.board));assert.equal(winning.completed,level+1);assert.strictEqual(slideTile(winning,0),winning);assert.strictEqual(undoSlide(winning),winning);
  if(level<199)s=nextSliding(winning);else assert.strictEqual(nextSliding(winning),winning);
 }assert.equal(seen.size,200);
}
assert.equal(scramblePuzzle(3,42,0).join(','),newSliding(3,42).board.join(','));
for(const bad of [null,{}, {...newSliding(),board:Array(9).fill(0)},{...newSliding(),history:[[]]}])assert.equal(validSliding(bad),false);
console.log('PASS Puzzle scorrevole: 600 distinct solvable levels, 3 sizes, parity, legal moves/undo, score guards, resume and final level.');
