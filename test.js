// اختبار آلي: التدفق الكامل + الإشعارات + التخزين في Supabase (خادم وهمي) + تشفير Web Push
const {spawn}=require('child_process'),fs=require('fs'),http=require('http'),crypto=require('crypto'),push=require('./push');
const AD='testpass';let ok=0,bad=0;const T=(n,c)=>{c?ok++:(bad++,console.log('فشل:',n))};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const start=(P,env={})=>spawn('node',['server.js'],{env:{...process.env,PORT:P,ADMIN_PASSWORD:AD,...env},stdio:'ignore'});
const mk=P=>async(p,b,t,m,h={})=>{const r=await fetch(`http://localhost:${P}/api/${p}`,{method:m||(b?'POST':'GET'),headers:{'content-type':'application/json','x-token':t||'',...h},body:b?JSON.stringify(b):undefined});return{s:r.status,j:await r.json()}};
(async()=>{
 // ---- 1) تشفير Web Push وتوقيع VAPID ----
 const v=push.makeVapid(),ua=crypto.createECDH('prime256v1');ua.generateKeys();const auth=crypto.randomBytes(16).toString('base64url');
 let got=null;const ep=http.createServer((q,s)=>{const c=[];q.on('data',d=>c.push(d));q.on('end',()=>{got={h:q.headers,b:Buffer.concat(c)};s.writeHead(201);s.end()})}).listen(4001);
 const st=await push.sendPush({endpoint:'http://localhost:4001/x',keys:{p256dh:ua.getPublicKey().toString('base64url'),auth}},{title:'مرحبا',body:'اختبار'},v,'mailto:a@b.co');
 T('push status',st===201);T('push decrypt',JSON.parse(push.decrypt(got.b,ua,auth)).title==='مرحبا');
 const [,jwt,k]=got.h.authorization.match(/t=([^,]+), k=(.+)/);const[h,c,sg]=jwt.split('.');
 const pubKey=crypto.createPublicKey({key:{kty:'EC',crv:'P-256',x:Buffer.from(k,'base64url').subarray(1,33).toString('base64url'),y:Buffer.from(k,'base64url').subarray(33).toString('base64url')},format:'jwk'});
 T('vapid signature',crypto.verify('sha256',Buffer.from(h+'.'+c),{key:pubKey,dsaEncoding:'ieee-p1363'},Buffer.from(sg,'base64url')));ep.close();
 // ---- 2) التدفق الكامل (ملف محلي) ----
 const f='/tmp/w2-test.json';try{fs.unlinkSync(f)}catch{}const P=3999,call=mk(P),s=start(P,{DB_FILE:f});await sleep(900);
 const img='data:image/jpeg;base64,AAAA',reg=async(ph,role,extra={})=>{const o=await call('otp',{phone:ph});return call('register',{phone:ph,code:o.j.devCode,name:role==='driver'?'سائق':'راكب',password:'123456',role,country:'EG',terms:true,...extra})};
 let o=await call('otp',{phone:'201000000009'});T('terms required',(await call('register',{phone:'201000000009',code:o.j.devCode,name:'x',password:'123456',country:'EG'})).s===400);
 T('bad email',(await call('register',{phone:'201000000009',code:o.j.devCode,name:'x',password:'123456',country:'EG',terms:true,email:'bad'})).s===400);
 const rd=await reg('201000000001','rider',{email:'Rider@Test.com'}),dr=await reg('201000000002','driver');T('register',rd.s===200&&dr.s===200&&rd.j.user.email==='rider@test.com');
 T('docs required',(await call('driver',{vehicle:'car',model:'x',plate:'1'},dr.j.token,'PUT')).s===400);T('not approved',(await call('rides/open',null,dr.j.token)).s===403);
 await call('driver',{vehicle:'car',model:'لانسر',plate:'123',color:'أبيض',photoVehicle:img,thumbVehicle:img,photoId:img},dr.j.token,'PUT');
 T('admin auth',(await call('admin/stats',null,'',null,{'x-admin':'bad'})).s===401);const ad={'x-admin':AD};
 await call('admin/driver/'+dr.j.user.id,{status:'approved'},'',null,ad);
 T('approval notified',(await call('notes',null,dr.j.token)).j.unread===1);
 // محفظة
 await call('admin/user/'+rd.j.user.id,{credit:200},'',null,ad);T('wallet credit',(await call('me',null,rd.j.token)).j.user.wallet===200);
 const pts={from:{lat:30,lng:31},to:{lat:30.1,lng:31.1}};
 T('wallet insufficient',(await call('rides',{vehicle:'car',...pts,km:10,offer:500,pay:'wallet'},rd.j.token)).s===400);
 const ride=(await call('rides',{vehicle:'car',...pts,km:10,offer:50,pay:'wallet'},rd.j.token)).j.ride;T('ride est',ride&&ride.est===70);
 T('driver notified new ride',(await call('notes',null,dr.j.token)).j.notes[0].title==='طلب رحلة جديد');
 const open=(await call('rides/open',null,dr.j.token)).j.rides;T('driver sees',open.length===1&&!open[0].riderPhone);
 await call(`rides/${ride.id}/offer`,{price:60},dr.j.token);T('rider notified offer',(await call('notes',null,rd.j.token)).j.notes[0].title==='عرض جديد على طلبك');
 await call(`rides/${ride.id}/accept`,{driver:dr.j.user.id},rd.j.token);
 // محادثة
 T('chat rider',(await call(`rides/${ride.id}/msg`,{text:'أنا عند البوابة'},rd.j.token)).s===200);T('chat driver',(await call(`rides/${ride.id}/msg`,{text:'وصلت'},dr.j.token)).s===200);
 let rv=(await call('rides/'+ride.id,null,rd.j.token)).j.ride;T('chat visible',rv.msgs.length===2&&rv.msgs[0].f==='r');
 T('driver info safe',rv.driver.phone==='201000000002'&&rv.driver.thumb===img&&rv.driver.bal===undefined&&rv.driver.earned===undefined&&!('photoId' in rv.driver));
 T('lite hides thumb',!(await call('rides/'+ride.id+'?lite=1',null,rd.j.token)).j.ride.driver.thumb);
 for(const x of['arrived','started','done'])T('step '+x,(await call(`rides/${ride.id}/status`,{s:x},dr.j.token)).s===200);
 const me=(await call('me',null,dr.j.token)).j.user;T('wallet ride balance',me.bal===51&&me.trips===1&&me.earned===51);
 T('rider wallet deducted',(await call('me',null,rd.j.token)).j.user.wallet===140);
 T('rate driver',(await call(`rides/${ride.id}/rate`,{stars:5},rd.j.token)).s===200);T('rate rider',(await call(`rides/${ride.id}/rate-rider`,{stars:4},dr.j.token)).s===200);
 T('ratings',(await call('me',null,dr.j.token)).j.user.rating===5&&(await call('me',null,rd.j.token)).j.user.rating===4);
 // رحلة كاش وعمولة
 const r2=(await call('rides',{vehicle:'car',...pts,km:10,offer:60},rd.j.token)).j.ride;await call(`rides/${r2.id}/offer`,{price:60},dr.j.token);for(const x of['arrived','started','done'])await call(`rides/${r2.id}/status`,{s:x},dr.j.token);
 T('cash commission',(await call('me',null,dr.j.token)).j.user.bal===42);
 await call('admin/driver/'+dr.j.user.id,{settle:-42},'',null,ad);await call('admin/driver/'+dr.j.user.id,{bonus:20},'',null,ad);T('settle+bonus',(await call('me',null,dr.j.token)).j.user.bal===20);
 // حساب: كلمة السر والاستعادة
 T('change pass wrong',(await call('password',{old:'x',new:'abcdef'},rd.j.token)).s===400);T('change pass',(await call('password',{old:'123456',new:'abcdef'},rd.j.token)).s===200);
 T('login new pass',(await call('login',{phone:'201000000001',password:'abcdef'})).s===200);
 T('forgot no email',(await call('forgot',{id:'201000000002'})).s===400);
 const fg=await call('forgot',{id:'rider@test.com'});T('forgot code',fg.s===200&&fg.j.devCode);
 T('reset bad',(await call('reset',{id:'rider@test.com',code:'000000',password:'newpass1'})).s===400);
 T('reset',(await call('reset',{id:'rider@test.com',code:fg.j.devCode,password:'newpass1'})).s===200);T('old session killed',(await call('me',null,rd.j.token)).s===401);T('login after reset',(await call('login',{phone:'201000000001',password:'newpass1'})).s===200);
 // مفضلة، ملف شخصي، اشتراك إشعارات، تواصل
 const rt=(await call('login',{phone:'201000000001',password:'newpass1'})).j.token;
 T('fav add',(await call('fav',{n:'البيت',lat:30,lng:31},rt)).j.user.favs.length===1);T('fav del',(await call('fav/del',{i:0},rt)).j.user.favs.length===0);
 T('profile',(await call('profile',{email:'a@b.co',avatar:img},rt,'PUT')).j.user.avatar===img);
 T('push sub',(await call('push',{sub:{endpoint:'https://x.example/1',keys:{p256dh:'a',auth:'b'}}},rt)).s===200);T('vapid key',(await call('vapid',null,rt)).j.key.length>80);
 T('ticket',(await call('contact',{type:'complaint',text:'مشكلة في الرحلة'},rt)).s===200);const tk=(await call('admin/tickets',null,'',null,ad)).j.tickets[0];T('admin sees ticket',tk&&tk.text.includes('مشكلة'));
 await call('admin/ticket/'+tk.id,{reply:'تم الحل'},'',null,ad);T('ticket reply notified',(await call('notes',null,rt)).j.notes[0].text==='تم الحل');
 T('broadcast',(await call('admin/broadcast',{role:'rider',title:'عرض',text:'خصم 10%',ad:true},'',null,ad)).j.sent===1);T('broadcast ad',(await call('config')).j.ads[0].title==='عرض');
 T('history',(await call('history',null,rt)).j.rides.length===2);
 const st2=(await call('admin/stats',null,'',null,ad)).j;T('stats',st2.done===2&&st2.storage==='ملف محلي');
 T('bad url survives',(await fetch('http://localhost:3999//')).status===400&&(await call('config')).s===200);s.kill();
 // ---- 3) Supabase (خادم وهمي يحاكي PostgREST) والبقاء بعد إعادة التشغيل ----
 const rows=new Map(),mock=http.createServer((q,s)=>{let b='';q.on('data',c=>b+=c);q.on('end',()=>{const u=new URL(q.url,'http://x');if(!q.headers.apikey){s.writeHead(401);return s.end('{}')}
  if(q.method==='GET'){const off=+u.searchParams.get('offset')||0,lim=+u.searchParams.get('limit')||1000;s.writeHead(200,{'content-type':'application/json'});return s.end(JSON.stringify([...rows].sort((a,b)=>a[0]<b[0]?-1:1).slice(off,off+lim).map(([k,v])=>({k,v}))))}
  if(q.method==='POST'&&q.headers.prefer==='resolution=merge-duplicates'){for(const r of JSON.parse(b))rows.set(r.k,r.v);s.writeHead(201);return s.end()}s.writeHead(400);s.end()})}).listen(4002);
 const E2={SUPABASE_URL:'http://localhost:4002',SUPABASE_KEY:'k',DB_FILE:'/tmp/none.json'};let s2=start(3998,E2);await sleep(900);const c2=mk(3998);
 const a=await reg2(c2,'201111111111');await sleep(2200);T('rows saved',rows.has('user:u1')&&rows.has('meta')&&rows.has('settings'));s2.kill();await sleep(300);
 s2=start(3998,E2);await sleep(1200);T('token survives restart',(await c2('me',null,a.token)).s===200);T('login after restart',(await c2('login',{phone:'201111111111',password:'123456'})).s===200);
 const vp=rows.get('meta').vapid.pub;s2.kill();s2=start(3998,E2);await sleep(1200);T('vapid stable',rows.get('meta').vapid.pub===vp);s2.kill();
 const s3=start(3997,{SUPABASE_URL:'http://localhost:1',SUPABASE_KEY:'k'});let code=null;s3.on('exit',c=>code=c);await sleep(1500);T('refuses to start if supabase unreachable',code===1);s3.kill();mock.close();
 console.log(`نجح ${ok} / فشل ${bad}`);process.exit(bad?1:0)})();
async function reg2(c,ph){const o=await c('otp',{phone:ph});return(await c('register',{phone:ph,code:o.j.devCode,name:'x',password:'123456',country:'EG',terms:true})).j}
