const fs=require('node:fs'),assert=require('node:assert/strict');const{PGlite}=require('@electric-sql/pglite');
(async()=>{const db=new PGlite();try{
 await db.exec("create role anon;create role authenticated;create table public.visits(id integer primary key,memory_photos text[],memory_notes text);grant usage on schema public to authenticated;grant select,insert,update on public.visits to authenticated;insert into visits values(1,array['old-photo','new-photo'],'original');");
 await db.exec(fs.readFileSync('supabase/migrations/20261017200000_memory_photo_settings.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20261017210000_memory_photo_rotation.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20261030091331_memory_five_photos.sql','utf8'));await db.exec('set role authenticated');
 const setting={mode:'fixed',crop:{x:.1,y:.2,width:.5,height:.6}},update=value=>db.query('update visits set memory_photo_settings=$1 where id=1',[value]);
 await update({'old-photo':setting});assert.deepEqual((await db.query('select memory_photo_settings from visits')).rows[0].memory_photo_settings,{'old-photo':setting});
 for(const rotation of [0,90,180,270]){await update({'old-photo':{...setting,rotation}});assert.equal((await db.query('select memory_photo_settings from visits')).rows[0].memory_photo_settings['old-photo'].rotation,rotation)}
 for(const rotation of [45,-90,360,90.5,'90',null])await assert.rejects(update({'old-photo':{...setting,rotation}}));await update({'old-photo':setting});
 for(const bad of [[],null,{'old-photo':null},{'old-photo':{mode:'stretch',crop:setting.crop}},{'old-photo':{mode:'adaptive',crop:{...setting.crop,width:0}}},{'old-photo':{mode:'adaptive',crop:{...setting.crop,x:.9}}},{'old-photo':{mode:'fixed',crop:{...setting.crop,y:'0.2'}}}])await assert.rejects(update(bad));
 assert.deepEqual((await db.query('select memory_photo_settings from visits')).rows[0].memory_photo_settings,{'old-photo':setting},'Rejected edit leaves saved layout unchanged');
 await update({'old-photo':setting,'not-a-visit-photo':setting});assert.equal(Object.keys((await db.query('select memory_photo_settings from visits')).rows[0].memory_photo_settings).length,1);
 await db.query("update visits set memory_photos=array['new-photo'] where id=1");assert.deepEqual((await db.query('select memory_photo_settings from visits')).rows[0].memory_photo_settings,{},'Legacy photo deletion prunes settings');
 await db.query("insert into visits(id,memory_photos)values(2,array['legacy'])");assert.deepEqual((await db.query('select memory_photo_settings from visits where id=2')).rows[0].memory_photo_settings,{});
 const five=['p1','p2','p3','p4','p5'];const layouts=Object.fromEntries(five.map(p=>[p,{...setting,rotation:90}]));
 await db.query('insert into visits(id,memory_photos,memory_photo_settings)values(3,$1,$2)',[five,layouts]);
 assert.deepEqual((await db.query('select memory_photo_settings from visits where id=3')).rows[0].memory_photo_settings,layouts,'Five cropped/rotated photos can be saved together');
 await assert.rejects(db.query('update visits set memory_photos=$1,memory_photo_settings=$2 where id=3',[[...five,'p6'],{...layouts,p6:setting}]),/Massimo cinque/);
 assert.equal((await db.query('select cardinality(memory_photos) as n from visits where id=3')).rows[0].n,5,'Failed sixth layout preserves five saved photos');
 await assert.rejects(db.query('select public.validate_memory_photo_settings()'));await db.exec('reset role;set role anon');await assert.rejects(db.query('update visits set memory_photo_settings=$1 where id=1',[{}]));
 console.log('PASS photo layout migration: defaults, saved settings, bounds/types rejection, unchanged data on failure, unmatched keys pruned, legacy photo removal and anonymous write denied');
}finally{await db.close()}})().catch(e=>{console.error(e);process.exitCode=1});
