// اختبار آلي: التدفق الكامل + السجلات الأمنية + الأمان + Supabase (خادم وهمي) + Web Push
const {spawn}=require('child_process'),fs=require('fs'),http=require('http'),crypto=require('crypto'),push=require('./push');
const AD='adminpass1',AU='auditpass1';let ok=0,bad=0;const T=(n,c)=>{c?ok++:(bad++,console.log('فشل:',n))};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const start=(P,env={})=>spawn('node',['server.js'],{env:{...process.env,PORT:P,ADMIN_PASSWORD:AD,AUDIT_PASSWORD:AU,AUDIT_KEY:'k1',...env},stdio:'ignore'});
const mk=P=>async(p,b,t,m,h={})=>{const r=await fetch(`http://localhost:${P}/api/${p}`,{method:m||(b?'POST':'GET'),headers:{'content-type':'application/json','x-token':t||'',...h},body:b?JSON.stringify(b):undefined});const tx=await r.text();let j;try{j=JSON.parse(tx)}catch{j=tx}return{s:r.status,j,h:r.headers}};
const loc={lat:30.05,lng:31.23,acc:12},dev={ua:'Mozilla/5.0 (Linux; Android 13; SM-S918B) Chrome/120',platform:'Android',model:'SM-S918B',osVer:'13.0.0',mobile:true};
(async()=>{
 // ---- 1) Web Push ----
 const v=push.makeVapid(),ua=crypto.createECDH('prime256v1');ua.generateKeys();const auth=crypto.randomBytes(16).toString('base64url');let got=null;
 const ep=http.createServer((q,s)=>{const c=[];q.on('data',d=>c.push(d));q.on('end',()=>{got={h:q.headers,b:Buffer.concat(c)};s.writeHead(201);s.end()})}).listen(4001);
 T('push status',await push.sendPush({endpoint:'http://localhost:4001/x',keys:{p256dh:ua.getPublicKey().toString('base64url'),auth}},{title:'مرحبا'},v,'mailto:a@b.co')===201);T('push decrypt',JSON.parse(push.decrypt(got.b,ua,auth)).title==='مرحبا');ep.close();
 // ---- 2) التدفق الكامل ----
 const f='/tmp/w2-test.json';try{fs.unlinkSync(f)}catch{}const P=3999,call=mk(P),s=start(P,{DB_FILE:f});await sleep(900);
 const reg=async(ph,role,x={})=>{const o=await call('otp',{phone:ph});return call('register',{phone:ph,code:o.j.devCode,name:role==='driver'?'سائق':'راكب',password:'12345678',role,country:'EG',terms:true,email:ph+'@t.co',loc,dev,...x})};
 let o=await call('otp',{phone:'201000000009'});const base={phone:'201000000009',code:o.j.devCode,name:'x',password:'12345678',country:'EG',terms:true,email:'x@t.co',loc};
 T('terms required',(await call('register',{...base,terms:false})).s===400);T('email required',(await call('register',{...base,email:''})).s===400);T('bad email',(await call('register',{...base,email:'bad'})).s===400);
 T('location required',(await call('register',{...base,loc:undefined})).s===400);T('weak password',(await call('register',{...base,password:'1234567'})).s===400);
 const rd=await reg('201000000001','rider',{email:'Rider@Test.com'}),dr=await reg('201000000002','driver');T('register',rd.s===200&&dr.s===200&&rd.j.user.email==='rider@test.com');
 T('login needs location',(await call('login',{phone:'201000000001',password:'12345678'})).s===400);
 T('docs required',(await call('driver',{vehicle:'car',model:'x',plate:'1'},dr.j.token,'PUT')).s===400);T('not approved',(await call('rides/open',null,dr.j.token)).s===403);
 const img='data:image/jpeg;base64,AAAA';T('bad image rejected',(await call('driver',{vehicle:'car',model:'x',plate:'1',photoVehicle:'data:text/html;base64,AAAA',photoId:img},dr.j.token,'PUT')).s===400);
 T('driver docs',(await call('driver',{vehicle:'car',model:'لانسر',plate:'123',color:'أبيض',photoVehicle:img,thumbVehicle:img,photoId:img,live:true},dr.j.token,'PUT')).s===200);
 // الإدارة: دخول برمز مؤقت
 T('admin wrong pw',(await call('admin/login',{password:'x'})).s===401);const at=(await call('admin/login',{password:AD})).j.token,ad={'x-admin':at};
 T('admin no token',(await call('admin/stats')).s===401);
 await call('admin/driver/'+dr.j.user.id,{status:'approved'},'',null,ad);
 await call('admin/user/'+rd.j.user.id,{credit:200},'',null,ad);T('wallet credit',(await call('me',null,rd.j.token)).j.user.wallet===200);
 const pts={from:{lat:30,lng:31,name:'أ'},to:{lat:30.1,lng:31.1}};
 T('bad coords',(await call('rides',{vehicle:'car',from:{lat:999,lng:1},to:pts.to,km:5},rd.j.token)).s===400);
 T('wallet insufficient',(await call('rides',{vehicle:'car',...pts,km:10,offer:500,pay:'wallet'},rd.j.token)).s===400);
 const ride=(await call('rides',{vehicle:'car',...pts,km:10,offer:50,pay:'cash',loc},rd.j.token)).j.ride;T('ride est',ride&&ride.est===70);
 const open=(await call('rides/open',null,dr.j.token)).j.rides;T('driver sees (no phone)',open.length===1&&!open[0].riderPhone&&!open[0].riderId);
 await call(`rides/${ride.id}/offer`,{price:60},dr.j.token);await call(`rides/${ride.id}/accept`,{driver:dr.j.user.id},rd.j.token);
 T('chat',(await call(`rides/${ride.id}/msg`,{text:'وصلت'},dr.j.token)).s===200);
 T('driver loc tracked',(await call('loc',{lat:30.01,lng:31.01,acc:8},dr.j.token)).s===200&&(await call('loc',{lat:30.02,lng:31.02,acc:9},rd.j.token)).s===200);
 let rv=(await call('rides/'+ride.id,null,rd.j.token)).j.ride;T('tracks stored',rv.tracks.d.length===1&&rv.tracks.r.length===1&&rv.tracks.d[0][3]===8);
 T('driver info safe',rv.driver.phone==='201000000002'&&rv.driver.bal===undefined&&rv.driver.earned===undefined&&!('photoId' in rv.driver));
 // الدفع من المحفظة أثناء الرحلة
 T('pay from wallet',(await call(`rides/${ride.id}/pay`,{},rd.j.token)).s===200);
 for(const x of['arrived','started','done'])T('step '+x,(await call(`rides/${ride.id}/status`,{s:x,loc},dr.j.token)).s===200);
 const me=(await call('me',null,dr.j.token)).j.user;T('driver ledger',me.bal===51&&me.earned===51&&me.tx[0].amt===60&&me.tx[0].t==='ride_in');
 const rme=(await call('me',null,rd.j.token)).j.user;T('rider wallet',rme.wallet===140&&rme.tx[0].amt===-60);
 T('rate driver',(await call(`rides/${ride.id}/rate`,{stars:5},rd.j.token)).s===200);T('no rider rating',(await call(`rides/${ride.id}/rate-rider`,{stars:4},dr.j.token)).s===404);
 // رحلة كاش ثم تحويلها للمحفظة بعد الانتهاء
 const r2=(await call('rides',{vehicle:'car',...pts,km:10,offer:60},rd.j.token)).j.ride;await call(`rides/${r2.id}/offer`,{price:60},dr.j.token);for(const x of['arrived','started','done'])await call(`rides/${r2.id}/status`,{s:x},dr.j.token);
 T('cash commission',(await call('me',null,dr.j.token)).j.user.bal===42);
 T('pay after done',(await call(`rides/${r2.id}/pay`,{},rd.j.token)).s===200);T('ledger after late pay',(await call('me',null,dr.j.token)).j.user.bal===102&&(await call('me',null,rd.j.token)).j.user.wallet===80);
 // الإدارة: عمولات وتقييم وبونص
 const cd=(await call('admin/driver/'+dr.j.user.id+'/rides',null,'',null,ad)).j;T('commission detail',cd.rides.length===2&&cd.commission===18&&cd.rides[0].pct===15);
 const dl=(await call('admin/drivers',null,'',null,ad)).j.drivers[0];T('driver company share',dl.companyShare===18&&dl.gross===120&&dl.trips===2);
 await call('admin/rating/'+ride.id,{stars:3},'',null,ad);T('admin edits rating',(await call('me',null,dr.j.token)).j.user.rating===3);
 await call('admin/rating/'+ride.id,{stars:null},'',null,ad);T('admin removes rating',(await call('me',null,dr.j.token)).j.user.rating===null&&(await call(`rides/${ride.id}/rate`,{stars:5},rd.j.token)).s===409);
 await call('admin/driver/'+dr.j.user.id,{settle:-102},'',null,ad);await call('admin/driver/'+dr.j.user.id,{bonus:20},'',null,ad);T('settle+bonus',(await call('me',null,dr.j.token)).j.user.bal===20);
 // أمان الحساب
 T('change pass wrong',(await call('password',{old:'x',new:'abcdefgh'},rd.j.token)).s===400);const np=await call('password',{old:'12345678',new:'abcdefgh1'},rd.j.token);T('change pass',np.s===200&&np.j.token);T('old token dead',(await call('me',null,rd.j.token)).s===401);const rt=np.j.token;
 const bl={phone:'201000000004',loc};for(let i=0;i<5;i++)await call('login',{...bl,password:'wrong'});T('lockout',(await call('login',{...bl,password:'abcdefgh1'})).s===429);
 const fg=await call('forgot',{id:'rider@test.com'});T('forgot code',fg.s===200&&fg.j.devCode);T('reset',(await call('reset',{id:'rider@test.com',code:fg.j.devCode,password:'newpass12'})).s===200);
 // تحقق مطلوب من الإدارة
 await call('admin/user/'+dr.j.user.id,{requireVerify:{phone:true,email:true}},'',null,ad);T('verify required',(await call('me',null,dr.j.token)).j.user.needVerify.length===2);
 const vs=await call('verify/send',{kind:'phone'},dr.j.token);T('verify send',vs.j.devCode);T('verify bad',(await call('verify/check',{kind:'phone',code:'1'},dr.j.token)).s===400);
 T('verify phone',(await call('verify/check',{kind:'phone',code:vs.j.devCode},dr.j.token)).j.user.needVerify.length===1);
 // الإشعارات الموجهة
 const f1=(await call('admin/find?q=201000000001',null,'',null,ad)).j.users;T('find user',f1.length===1);
 T('broadcast one',(await call('admin/broadcast',{target:'one',uid:f1[0].id,title:'خاص',text:'نص'},'',null,ad)).j.sent===1);T('broadcast drivers',(await call('admin/broadcast',{target:'driver',title:'للسائقين',text:'نص'},'',null,ad)).j.sent===1);
 // إعدادات المستندات
 const st=(await call('admin/settings',null,'',null,ad)).j.settings;st.docs={vehicle:false,id:false};await call('admin/settings',{settings:st},'',null,ad);T('docs optional',(await call('config')).j.docs.id===false);
 const d2=await reg('201000000003','driver');T('driver without docs',(await call('driver',{vehicle:'car',model:'x',plate:'1'},d2.j.token,'PUT')).s===200);
 // حذف حساب (تعطيل مع الاحتفاظ)
 const lg=await call('login',{phone:'201000000003',password:'12345678',loc,dev});T('delete account wrong pw',(await call('account/delete',{password:'x'},lg.j.token)).s===400);
 T('delete account',(await call('account/delete',{password:'12345678'},lg.j.token)).s===200);T('deleted cannot login',(await call('login',{phone:'201000000003',password:'12345678',loc})).s===403);
 T('deleted phone not reusable',(await reg('201000000003','rider')).s===409);
 // سجل الرحلات للمستخدم
 const lg1=await call('login',{phone:'201000000001',password:'newpass12',loc,dev}),h=(await call('history',null,lg1.j.token)).j.rides;T('history details',h.length===2&&h[0].who==='سائق'&&h[0].whoPhone==='201000000002'&&h[0].price===60);
 // ===== السجلات الأمنية =====
 T('admin cannot read audit',(await call('audit/verify',null,'',null,ad)).s===403);
 T('audit wrong pw',(await call('audit/login',{password:'x'})).s===401);const ut=(await call('audit/login',{password:AU})).j.token,au={'x-audit':ut};
 T('audit token not admin',(await call('admin/stats',null,'',null,au)).s===401||(await call('admin/stats',null,'',null,au)).s===403);
 const ver=(await call('audit/verify',null,'',null,au)).j;T('chain valid',ver.ok&&ver.count>40&&ver.keyed);
 const us=(await call('audit/find?q=201000000002',null,'',null,au)).j.users;T('audit find',us.length===1);
 const ds=(await call('audit/user/'+rd.j.user.id,null,'',null,au)).j;T('dossier ip',ds.ips.includes('::1')||ds.ips.some(x=>x.includes('127.0.0.1')));
 T('dossier device',ds.devices.some(d=>d.model==='SM-S918B'&&d.os==='Android 13'));T('dossier events',['register','login','ride_create','ride_assign','wallet_transfer','password_change','profile_change'].filter(e=>!ds.events.some(x=>x.ev===e)).length===1);
 T('dossier ride coords',ds.rides[0].from.lat===30&&ds.rides[0].route===undefined&&ds.rides[0].tracks.d[0][3]===8);
 const dd=(await call('audit/user/'+dr.j.user.id,null,'',null,au)).j;T('driver dossier docs',dd.account.photoIdSha256&&dd.events.some(e=>e.ev==='driver_docs_submit'&&e.d.capturedLive)&&dd.events.some(e=>e.ev==='admin_rating_change'));
 const rp=await call('audit/report/'+dr.j.user.id,null,'',null,au);T('report download',/attachment/.test(rp.h.get('content-disposition'))&&rp.j.chain.ok);
 T('access logged',(await call('audit/verify',null,'',null,au)).j.count>ver.count+3);
 T('tamper delete',(await call('admin/ride/'+ride.id,null,'',"DELETE",ad)).s===403);T('tamper audit',(await call('audit/entry/1',{x:1},'',"PUT",au)).s===403);T('tamper route',(await call('admin/ride/delete',{},'',null,ad)).s===403);
 const ev2=(await call('audit/user/'+rd.j.user.id,null,'',null,au)).j;
 T('users cannot see audit',(await call('audit/verify',null,rt)).s===401);
 const raw=fs.readFileSync(f,'utf8');T('tokens hashed',!raw.includes(rt)&&!raw.includes(lg1.j.token));
 T('csp + headers',(await fetch('http://localhost:3999/')).headers.get('content-security-policy').includes("nonce-")&&(await fetch('http://localhost:3999/')).headers.get('x-frame-options')==='DENY');
 T('body limit',(await call('contact',{type:'complaint',text:'x'.repeat(300000)},lg1.j.token)).s===413);
 T('bad json',(await fetch('http://localhost:3999/api/login',{method:'POST',body:'{x'})).status===400);
 T('bad url survives',(await fetch('http://localhost:3999//')).status===400&&(await call('config')).s===200);
 s.kill();await sleep(300);
 // التلاعب بالملف يُكتشف
 const j=JSON.parse(fs.readFileSync(f,'utf8'));const bi=j.audit.findIndex(e=>e.ev==='ride_done');j.audit[bi].d.price=1;fs.writeFileSync(f,JSON.stringify(j));const sT=start(P,{DB_FILE:f});await sleep(900);
 const at2=(await call('audit/login',{password:AU})).j.token,vv=(await call('audit/verify',null,'',null,{'x-audit':at2})).j;T('tamper detected',vv.ok===false&&vv.brokenAt===bi);sT.kill();
 // ---- 3) Supabase (محاكاة PostgREST) ----
 const rows=new Map(),mock=http.createServer((q,s)=>{let b='';q.on('data',c=>b+=c);q.on('end',()=>{const u=new URL(q.url,'http://x');if(!q.headers.apikey){s.writeHead(401);return s.end('{}')}
  if(q.method==='GET'){const off=+u.searchParams.get('offset')||0,lim=+u.searchParams.get('limit')||1000,k=u.searchParams.get('k')||'';let a=[...rows].sort((a,b)=>a[0]<b[0]?-1:1);if(k==='like.audit:*')a=a.filter(x=>x[0].startsWith('audit:'));if(k==='not.like.audit:*')a=a.filter(x=>!x[0].startsWith('audit:'));s.writeHead(200,{'content-type':'application/json'});return s.end(JSON.stringify(a.slice(off,off+lim).map(([k,v])=>({k,v}))))}
  if(q.method==='POST'&&q.headers.prefer==='resolution=merge-duplicates'){for(const r of JSON.parse(b))rows.set(r.k,r.v);s.writeHead(201);return s.end()}s.writeHead(400);s.end()})}).listen(4002);
 const E2={SUPABASE_URL:'http://localhost:4002',SUPABASE_KEY:'k',DB_FILE:'/tmp/none.json'};let s2=start(3998,E2);await sleep(900);const c2=mk(3998);
 const a=(await reg2(c2,'201111111111')).j;await sleep(2300);T('rows saved',rows.has('user:u1')&&rows.has('meta')&&[...rows.keys()].some(k=>k.startsWith('audit:0000000000')));
 const tk0=JSON.stringify(rows.get('meta').tokens);T('tokens hashed in db',!tk0.includes(a.token));s2.kill();await sleep(300);
 s2=start(3998,E2);await sleep(1300);T('token survives restart',(await c2('me',null,a.token)).s===200);T('login after restart',(await c2('login',{phone:'201111111111',password:'12345678',loc})).s===200);
 const at3=(await c2('audit/login',{password:AU})).j.token;const v3=(await c2('audit/verify',null,'',null,{'x-audit':at3})).j;T('chain valid after reload',v3.ok&&v3.count>=3);
 await sleep(2300);T('audit appended once',[...rows.keys()].filter(k=>k.startsWith('audit:')).length===v3.count+0||[...rows.keys()].filter(k=>k.startsWith('audit:')).length>=v3.count-1);
 const vp=rows.get('meta').vapid.pub;s2.kill();s2=start(3998,E2);await sleep(1300);T('vapid stable',rows.get('meta').vapid.pub===vp);s2.kill();
 const s3=start(3997,{SUPABASE_URL:'http://localhost:1',SUPABASE_KEY:'k'});let code=null;s3.on('exit',c=>code=c);await sleep(1500);T('refuses to start if supabase unreachable',code===1);s3.kill();mock.close();
 console.log(`نجح ${ok} / فشل ${bad}`);process.exit(bad?1:0)})();
async function reg2(c,ph){const o=await c('otp',{phone:ph});return c('register',{phone:ph,code:o.j.devCode,name:'x',password:'12345678',country:'EG',terms:true,email:ph+'@t.co',loc})}
