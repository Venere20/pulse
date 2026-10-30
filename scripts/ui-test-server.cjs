// Serve a chosen exported app on loopback only. Never targets the live service.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
module.exports=async function serve(){
 const file=path.resolve('scripts/serve-local-demo.cjs'),m=new Module(file,module);m.filename=file;m.paths=module.paths;
 const root=path.resolve(process.env.PULSE_TEST_WEB_ROOT||'.feature-build/bugfix-20261030-web');
 if(!fs.existsSync(path.join(root,'index.html')))throw Error('Build the web test export first: '+root);
 m._compile(fs.readFileSync(file,'utf8').replace("path.resolve(__dirname, '../.feature-build/design-system-2-web')",JSON.stringify(root)),file);
 await new Promise(resolve=>m.exports.listen(0,'127.0.0.1',resolve));return m.exports;
};
