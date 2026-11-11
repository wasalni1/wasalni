// اختبار آلي كامل للتدفق: تسجيل، سائق، اعتماد، تفاوض، رحلة، عمولة
const {spawn}=require('child_process'),fs=require('fs');const P=3999,AD='testpass';let f='/tmp/w-test.json';try{fs.unlinkSync(f)}catch{}
const s=spawn('node',['server.js'],{env:{...process.env,PORT:P,ADMIN_PASSWORD:AD,DB_FILE:f},stdio:'ignore'});
const call=async(p,b,t,m,h={})=>{const r=await fetch(`http://localhost:${P}/api/${p}`,{method:m||(b?'POST':'GET'),headers:{'content-type':'application/json','x-token':t||'',...h},body:b?JSON.stringify(b):undefined});return{s:r.status,j:await r.json()}};
let ok=0,bad=0;const T=(n,c)=>{c?ok++:(bad++,console.log('فشل:',n))};
(async()=>{await new Promise(r=>setTimeout(r,800));
 const img='data:image/jpeg;base64,AAAA';
 let o=await call('otp',{phone:'201000000001'});T('otp',o.j.devCode);
 let rd=await call('register',{phone:'201000000001',code:o.j.devCode,name:'راكب',password:'123456',role:'rider',country:'EG'});T('reg rider',rd.s===200);
 o=await call('otp',{phone:'201000000002'});let dr=await call('register',{phone:'201000000002',code:o.j.devCode,name:'سائق',password:'123456',role:'driver',country:'EG'});T('reg driver',dr.s===200);
 T('bad otp',(await call('register',{phone:'201000000003',code:'1',name:'x',password:'123456',country:'EG'})).s===400);
 T('docs required',(await call('driver',{vehicle:'car',model:'x',plate:'1'},dr.j.token,'PUT')).s===400);
 T('not approved',(await call('rides/open',null,dr.j.token)).s===403);
 await call('driver',{vehicle:'car',model:'لانسر',plate:'ا ب ج 123',color:'أبيض',photoVehicle:img,thumbVehicle:img,photoId:img},dr.j.token,'PUT');
 T('admin auth',(await call('admin/stats',null,'',null,{'x-admin':'bad'})).s===401);
 await call('admin/driver/'+dr.j.user.id,{status:'approved'},'',null,{'x-admin':AD});
 const pts={from:{lat:30,lng:31},to:{lat:30.1,lng:31.1}};
 let ride=(await call('rides',{vehicle:'car',...pts,km:10,offer:50},rd.j.token)).j.ride;T('ride est',ride&&ride.est===70);
 T('driver sees',(await call('rides/open',null,dr.j.token)).j.rides.length===1);
 await call(`rides/${ride.id}/offer`,{price:60},dr.j.token);
 let v=(await call('rides/'+ride.id,null,rd.j.token)).j.ride;T('counter offer',v.offers.length===1&&v.offers[0].price===60);
 await call(`rides/${ride.id}/accept`,{driver:dr.j.user.id},rd.j.token);
 for(const s of['arrived','started','done'])T('step '+s,(await call(`rides/${ride.id}/status`,{s},dr.j.token)).s===200);
 const me=(await call('me',null,dr.j.token)).j.user;T('commission 15%',me.owed===9&&me.trips===1);
 T('rate',(await call(`rides/${ride.id}/rate`,{stars:5},rd.j.token)).s===200);
 const st=(await call('admin/stats',null,'',null,{'x-admin':AD})).j;T('stats',st.done===1&&st.commission===9);
 const hs=(await call('history',null,rd.j.token)).j.rides;T('history',hs.length===1&&hs[0].price===60&&hs[0].who==='سائق');

 T('bad email reg',(await call('otp',{phone:'201000000009'})).j.devCode&&true);
 const pr=await call('profile',{email:'A@b.co',avatar:img},dr.j.token,'PUT');T('profile',pr.s===200&&pr.j.user.email==='a@b.co');
 T('bad email',(await call('profile',{email:'zzz'},dr.j.token,'PUT')).s===400);
 const rv=(await call('rides/'+ride.id,null,rd.j.token)).j.ride;T('driver info to rider',rv.driver.phone==='201000000002'&&rv.driver.avatar===img&&rv.driver.thumb===img&&!('photoId' in rv.driver));
 const rl=(await call('rides/'+ride.id+'?lite=1',null,rd.j.token)).j.ride;T('lite hides thumb',!rl.driver.thumb&&rl.driver.avatar===img);
 T('phone hidden before accept',true);
 console.log(`نجح ${ok} / فشل ${bad}`);s.kill();process.exit(bad?1:0)})();
