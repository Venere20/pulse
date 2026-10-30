// Runs the existing shared photo UI suite against the current isolated export.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),{spawn}=require('node:child_process');
(async()=>{const file=path.resolve('scripts/serve-local-demo.cjs'),m=new Module(file,module);m.filename=file;m.paths=module.paths;m._compile(fs.readFileSync(file,'utf8').replace("path.resolve(__dirname, '../.feature-build/design-system-2-web')",JSON.stringify(path.resolve('.feature-build/release-20261030-web'))),file);
 const server=m.exports;await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{const code=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['scripts/test-shared-photo-editor-ui.cjs',String(server.address().port)],{stdio:'inherit'});child.on('error',reject);child.on('exit',resolve);});process.exitCode=code??1;}finally{await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
