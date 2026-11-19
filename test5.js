// اختبار: مواقع الطرفين، الإشعارات الإلزامية، إشعارات الإدارة الفورية، الإحصاءات الحقيقية
const {spawn}=require('child_process'),fs=require('fs');
const AD='adminpass1';let ok=0,bad=0;const T=(n,c)=>{c?ok++:(bad++,console.log('فشل:',n))};const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const f='/tmp/w2-test5.json';try{fs.unlinkSync(f)}catch{}const P=3990;
const s=spawn('node',['server.js'],{env:{...process.env,PORT:P,ADMIN_PASSWORD:AD,AUDIT_PASSWORD:'auditpass1',DB_FILE:f,LEAD_MS:0},stdio:'ignore'});
const call=async(p,b,t,m,h={})=>{const r=await fetch(`http://localhost:${P}/api/${p}`,{method:m||(b?'POST':'GET'),headers:{'content-type':'application/json','x-token':t||'',...h},body:b?JSON.stringify(b):undefined});const tx=await r.text();let j;try{j=JSON.parse(tx)}catch{j=tx}return{s:r.status,j}};
const loc={lat:30.05,lng:31.23,acc:12},img='data:image/jpeg;base64,AAAA';
const reg=async(ph,role,x={})=>{const o=await call('otp',{phone:ph,country:'EG'});return(await call('register',{phone:ph,code:o.j.devCode,name:'م'+ph.slice(-3),password:'12345678',role,country:'EG',terms:true,email:ph+'@t.co',loc,dev:{id:'d'+ph},...x})).j};
(async()=>{await sleep(900);
 const ownerT=(await call('admin/login',{password:AD})).j.token,ad={'x-admin':ownerT};
 const fa=(await call('admin/admin',{name:'محاسب',user:'acc',role:'finance'},'',null,ad)).j,fh={'x-admin':(await call('admin/login',{user:'acc',password:fa.password})).j.token};
 T('config force notifications default',(await call('config')).j.forceNotif===true);
 const st=(await call('admin/settings',null,'',null,ad)).j.settings;st.forceNotifications=false;await call('admin/settings',{settings:st},'',null,ad);T('admin can relax',(await call('config')).j.forceNotif===false);st.forceNotifications=true;await call('admin/settings',{settings:st},'',null,ad);
 const rd=await reg('01011111111','rider'),dr=await reg('01022222222','driver'),dr2=await reg('01022222223','driver');
 T('me shows push devices',(await call('me',null,rd.token)).j.user.pushDevices===0);await call('push',{sub:{endpoint:'https://x.example/1',keys:{p256dh:'a',auth:'b'}}},rd.token);T('push device counted',(await call('me',null,rd.token)).j.user.pushDevices===1);
 T('unsupported raises alert',(await call('push/unsupported',{ua:'old'},dr.token)).s===200&&(await call('admin/alerts',null,'',null,ad)).j.alerts.some(a=>a.type==='push_unsupported'));
 // خلاصة الإدارة الفورية
 const f0=(await call('admin/feed',null,'',null,ad)).j;T('feed has epoch',!!f0.epoch);const last0=f0.last;
 await call('driver',{vehicle:'car',model:'x',plate:'1',photoVehicle:img,photoId:img},dr.token,'PUT');await call('driver',{vehicle:'car',model:'y',plate:'2',photoVehicle:img,photoId:img},dr2.token,'PUT');
 await call('contact',{type:'complaint',text:'لدي مشكلة في الرحلة'},rd.token);await call('contact',{type:'topup',text:'طلب شحن المحفظة بمبلغ 100'},rd.token);await call('recover/request',{phone:'01011111111',country:'EG'});
 let fd=(await call(`admin/feed?since=${last0}&epoch=${f0.epoch}`,null,'',null,ad)).j.items;T('owner sees all events',['driver_pending','ticket','recovery'].every(t=>fd.some(x=>x.type===t))&&fd.some(x=>x.title==='طلب شحن رصيد'));
 const ff=(await call(`admin/feed?since=${last0}&epoch=${f0.epoch}`,null,'',null,fh)).j.items;T('finance sees only money events',ff.some(x=>x.title==='طلب شحن رصيد')&&!ff.some(x=>x.type==='driver_pending')&&!ff.some(x=>x.type==='recovery'));
 T('feed since works',(await call(`admin/feed?since=${(await call('admin/feed',null,'',null,ad)).j.last}&epoch=${f0.epoch}`,null,'',null,ad)).j.items.length===0);
 T('admin push sub',(await call('admin/push-sub',{sub:{endpoint:'https://y.example/1',keys:{p256dh:'a',auth:'b'}}},'',null,ad)).s===200&&!!(await call('admin/vapid',null,'',null,ad)).j.key);
 await call('admin/driver/'+dr.user.id,{status:'approved'},'',null,ad);await call('admin/driver/'+dr2.user.id,{status:'approved'},'',null,ad);
 // مواقع الطرفين
 await call('loc',{lat:30.0,lng:31.0,acc:8},dr.token);await call('loc',{lat:30.01,lng:31.01,acc:8},dr2.token);
 const pts={from:{lat:30.0,lng:31.0,name:'أ'},to:{lat:30.1,lng:31.1,name:'ب'}};
 const ride=(await call('rides',{vehicle:'car',...pts,km:12,offer:100},rd.token)).j.ride;
 T('rider loc hidden before assign',(await call('rides/open',null,dr.token)).j.rides[0].riderLoc===undefined);
 await call('loc',{lat:30.02,lng:31.02,acc:9},rd.token);
 // تخطي وإحصاءات القبول والرفض
 await call(`rides/${ride.id}/skip`,{},dr2.token);await call(`rides/${ride.id}/skip`,{},dr2.token);T('skip counted once',(await call('captain/stats',null,dr2.token)).j.skipped===1&&(await call('captain/stats',null,dr2.token)).j.rejectRate===100);
 T('skipped hidden from list',(await call('rides/open',null,dr.token)).j.rides[0].skipped===undefined);
 await call(`rides/${ride.id}/offer`,{price:100,accept:true},dr.token);
 const cur=(await call('rides/open',null,dr.token)).j.cur;T('captain sees rider live location',cur.riderLoc&&cur.riderLoc[0]===30.02&&cur.locAt.r>0);
 const rv=(await call('rides/'+ride.id,null,rd.token)).j.ride;T('rider sees captain location and own',rv.driver.loc[0]===30.0&&rv.riderLoc[0]===30.02);
 T('stranger cannot see ride',(await call('rides/'+ride.id,null,dr2.token)).s===404);
 for(const x of['arrived','started','done'])await call(`rides/${ride.id}/status`,{s:x,loc},dr.token);
 T('rider loc hidden after done',(await call('rides/'+ride.id,null,rd.token)).j.ride.riderLoc===undefined);
 // الإحصاءات الحقيقية
 await call('account/delete',{password:'12345678'},(await reg('01033333333','rider')).token);const rcancel=(await call('rides',{vehicle:'car',...pts,km:3,offer:20},rd.token)).j.ride;await call(`rides/${rcancel.id}/status`,{s:'cancelled'},rd.token);
 const sx=(await call('admin/stats',null,'',null,ad)).j;
 T('users stats',sx.users.riders.total===2&&sx.users.riders.deleted===1&&sx.users.riders.active===1&&sx.users.drivers.approved===2&&sx.users.drivers.online===2&&sx.users.drivers.pending===0);
 T('orders stats',sx.orders.total===2&&sx.orders.done===1&&sx.orders.cancelled===1&&sx.orders.cancelledByRider===1&&sx.orders.noCaptain===1&&sx.orders.byService.car.total===2&&sx.orders.accepted===1);
 T('captain app-wide stats',sx.orders.captains.received===4&&sx.orders.captains.responded===1&&sx.orders.captains.skipped===1&&sx.orders.captains.acceptRate===25&&sx.orders.captains.rejectRate===25);
 const dl=(await call('admin/drivers',null,'',null,ad)).j.drivers.find(d=>d.id===dr2.user.id);T('per captain stats in admin',dl.rx===2&&dl.rsp===0&&dl.skp===1&&dl.online===true);
 const del=(await call('admin/deleted',null,'',null,fh)).j.users;T('deleted section',del.length===1&&del[0].deletedAt>0);T('support cannot see deleted',(await call('admin/deleted',null,'',null,{'x-admin':(await call('admin/admin',{name:'د',user:'sup',role:'support'},'',null,ad).then(async r=>(await call('admin/login',{user:'sup',password:r.j.password})).j.token))})).s===403);
 s.kill();console.log(`نجح ${ok} / فشل ${bad}`);process.exit(bad?1:0)})();
