const assert=require('node:assert/strict'),load=require('./solo-test-loader.cjs')();
const{newWordSearch,searchPuzzle,searchLine,findSearchWord,hintSearch,nextWordSearch,validWordSearch}=load('src/features/sologames/wordSearch.ts');
for(const difficulty of ['easy','normal','hard']){let s=newWordSearch(difficulty,42);const seen=new Set();for(let level=0;level<200;level++){
 const puzzle=searchPuzzle(s),key=puzzle.letters.join('');assert.ok(!seen.has(key));seen.add(key);assert.equal(key,searchPuzzle(s).letters.join(''));assert.ok(validWordSearch(s));assert.strictEqual(nextWordSearch(s),s);
 s=hintSearch(s);for(const word of puzzle.words){assert.equal(word.cells.map(i=>puzzle.letters[i]).join(''),word.text);s=findSearchWord(s,word.cells.at(-1),word.cells[0]);const old=s;assert.strictEqual(findSearchWord(s,word.cells[0],word.cells.at(-1)),old);}
 assert.ok(validWordSearch(JSON.parse(JSON.stringify(s))));assert.equal(s.found.length,puzzle.words.length);if(level<199)s=nextWordSearch(s);else assert.strictEqual(nextWordSearch(s),s);
}assert.equal(seen.size,200);}
assert.equal(searchLine(8,7,8),null);assert.equal(searchLine(8,-1,5),null);
for(const bad of [null,{}, {...newWordSearch(),found:[{text:'FALSO',cells:[0,1,2,3,4]}]},{...newWordSearch(),hints:['XXXXX']}])assert.equal(validWordSearch(bad),false);
console.log('PASS Trova le parole: 600 generated grids, placements, reverse/end-point selection, no repeated grids, duplicate scoring guard, hints, resume and campaign end.');
