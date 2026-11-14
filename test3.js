// اختبار: أسئلة الطلب، النطاق 10 كم، رسوم الطريق، تنبيهات الموقع، إحصاءات الكابتن، التوصيل
const {spawn}=require('child_process'),fs=require('fs');
const AD='adminpass1';let ok=0,bad=0;const T=(n,c)=>{c?ok++:(bad++,console.log('فشل:',n))};const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const f='/tmp/w2-test3.json';try{fs.unlinkSync(f)}catch{}const P=3993;
const s=spawn('node',['server.js'],{env:{...process.env,PORT:P,ADMIN_PASSWORD:AD,AUDIT_PASSWORD:'auditpass1',DB_FILE:f,WAVE_MS:600,GPS_SILENT_MS:900,WATCH_MS:200},stdio:'ignore'});
const call=async(p,b,t,m,h={})=>{const r=await fetch(`http://localhost:${P}/api/${p}`,{method:m||(b?'POST':'GET'),headers:{'content-type':'application/json','x-token':t||'',...h},body:b?JSON.stringify(b):undefined});const tx=await r.text();let j;try{j=JSON.parse(tx)}catch{j=tx}return{s:r.status,j}};
const loc={lat:30.05,lng:31.23,acc:12};const img='data:image/jpeg;base64,AAAA';
const reg=async(ph,role,x={})=>{const o=await call('otp',{phone:ph,country:'EG'});return(await call('register',{phone:ph,code:o.j.devCode,name:'م'+ph.slice(-3),password:'12345678',role,country:'EG',terms:true,email:ph+'@t.co',loc,dev:{id:'d'+ph},...x})).j};
(async()=>{await sleep(900);
 const ad={'x-admin':(await call('admin/login',{password:AD})).j.token};
 const mkDriver=async(ph,la,ln,vehicle='car')=>{const d=await reg(ph,'driver');await call('driver',{vehicle,model:'x',plate:'1',photoVehicle:img,photoId:img},d.token,'PUT');await call('admin/driver/'+d.user.id,{status:'approved'},'',null,ad);if(la!==undefined)await call('loc',{lat:la,lng:ln,acc:8},d.token);return d};
 const rd=await reg('01011111111','rider');await call('admin/user/'+rd.user.id,{credit:500},'',null,ad);
 const near=await mkDriver('01022222221',30.0,31.0),far=await mkDriver('01022222222',31.5,32.5),unk=await mkDriver('01022222223'),mid=await mkDriver('01022222224',30.12,31.12);
 T('delivery vehicle exists',!!(await call('config')).j.vehicles.delivery);
 const pts={from:{lat:30.0,lng:31.0,name:'شارع الحجاز'},to:{lat:30.1,lng:31.1,name:'الحصري'}};
 T('order needs details',(await call('rides',{vehicle:'delivery',...pts,km:5},rd.token)).s===400);
 const ride=(await call('rides',{vehicle:'car',...pts,km:12,offer:100,pax:3,assist:true,bags:2,mins:25},rd.token)).j.ride;
 T('questions stored',ride.pax===3&&ride.assist===true&&ride.bags===2&&ride.mins===25);
 const nn=async u=>(await call('notes',null,u.token)).j.notes.filter(n=>n.title==='طلب رحلة جديد').length;
 T('near driver notified',await nn(near)===1&&(await call('notes',null,near.token)).j.notes[0].text.includes('يبعد عنك'));T('far driver not notified',await nn(far)===0);T('unknown-location driver notified',await nn(unk)===1);T('out of radius not yet',await nn(mid)===0);
 const op=(await call('rides/open',null,near.token)).j.rides;T('near sees with distance',op.length===1&&op[0].pickupKm<1&&op[0].pax===3&&op[0].assist===true);T('far does not see',(await call('rides/open',null,far.token)).j.rides.length===0);
 await sleep(900);T('mid (14km) outside 10km never notified',await nn(mid)===0);
 await call('admin/settings',{settings:{...(await call('admin/settings',null,'',null,ad)).j.settings,radiusKm:30}},'',null,ad);T('radius setting',(await call('rides/open',null,mid.token)).j.rides.length===1);
 // رسوم الطريق
 await call(`rides/${ride.id}/offer`,{price:100,accept:true},near.token);const rid=ride.id;
 T('assigned',(await call('rides/'+rid,null,rd.token)).j.ride.status==='assigned'&&(await call('rides/'+rid,null,rd.token)).j.ride.driverKm<1);
 T('toll bad amount',(await call(`rides/${rid}/toll`,{amount:-5},near.token)).s===400);
 T('toll propose',(await call(`rides/${rid}/toll`,{amount:30,note:'كارتة الطريق الدائري'},near.token)).s===200);T('proposer cannot respond',(await call(`rides/${rid}/toll/respond`,{accept:true},near.token)).s===409);
 T('rider rejects',(await call(`rides/${rid}/toll/respond`,{accept:false},rd.token)).j.ride.tolls===undefined);
 await call(`rides/${rid}/toll`,{amount:20},near.token);const ag=(await call(`rides/${rid}/toll/respond`,{accept:true},rd.token)).j.ride;T('toll agreed',ag.tolls===20&&ag.total===120&&ag.tollProposal===undefined);
 // دفع إلكتروني + تنبيه الكابتن
 const st=(await call('admin/settings',null,'',null,ad)).j.settings;st.payments.instapay={on:true,link:'',payee:'x@instapay',note:''};await call('admin/settings',{settings:st},'',null,ad);
 const pp=(await call('pay/online',{kind:'ride',ride:rid,method:'instapay'},rd.token)).j.payment;T('online amount includes tolls',pp.amount===120);
 await call(`pay/${pp.id}/submit`,{ref:'TXN-777777'},rd.token);T('captain told not to collect cash',(await call('notes',null,near.token)).j.notes[0].title==='العميل حوّل المبلغ إلكترونياً');
 T('captain sees pay state',(await call('rides/open',null,near.token)).j.cur.payState==='submitted');
 // GPS
 await call('loc',{lat:30.0,lng:31.0,acc:8},rd.token);
 T('gps off notifies other',(await call('gps',{ok:false,reason:'denied'},rd.token)).s===200&&(await call('notes',null,near.token)).j.notes[0].title==='تنبيه: الموقع متوقف');
 T('admin gps alert',(await call('admin/alerts',null,'',null,ad)).j.alerts.some(a=>a.type==='gps_off'&&a.data.role==='rider'));
 await call('loc',{lat:30.0,lng:31.0,acc:8},rd.token);T('gps back notifies',(await call('notes',null,near.token)).j.notes[0].title==='عاد الموقع');
 await sleep(1500);T('silent watchdog',(await call('admin/alerts',null,'',null,ad)).j.alerts.some(a=>a.type==='gps_silent'));
 // إنهاء: الرسوم خارج العمولة
 for(const x of['arrived','started','done'])await call(`rides/${rid}/status`,{s:x,loc},near.token);
 const dm=(await call('me',null,near.token)).j.user;T('commission on price only',dm.bal===-15&&dm.earned===105);
 const cdl=(await call('admin/driver/'+near.user.id+'/rides',null,'',null,ad)).j;T('admin commission excludes tolls',cdl.commission===15&&cdl.price===100);
 // محفظة مع رسوم
 const r2=(await call('rides',{vehicle:'car',...pts,km:12,offer:100,pay:'wallet'},rd.token)).j.ride;await call(`rides/${r2.id}/offer`,{price:100,accept:true},near.token);await call(`rides/${r2.id}/toll`,{amount:20},rd.token);await call(`rides/${r2.id}/toll/respond`,{accept:true},near.token);
 const w0=(await call('me',null,rd.token)).j.user.wallet;for(const x of['arrived','started','done'])await call(`rides/${r2.id}/status`,{s:x},near.token);
 T('wallet charged total with tolls',(await call('me',null,rd.token)).j.user.wallet===w0-120&&(await call('me',null,near.token)).j.user.bal===-15+120-15);
 // إحصاءات الكابتن
 const cs=(await call('captain/stats',null,near.token)).j;T('captain stats',cs.todayDone===2&&cs.total===2&&cs.acceptRate===100&&cs.goal===10&&cs.rating===null);
 T('stats driver only',(await call('captain/stats',null,rd.token)).s===403);
 // توصيل طلبات
 const dv=await mkDriver('01033333331',30.0,31.0,'delivery');
 const o=(await call('rides',{vehicle:'delivery',...pts,km:4,offer:30,order:{place:'مطعم الشرق',qty:2,desc:'وجبتان كفتة',price:150,comment:'بدون بصل'}},rd.token)).j.ride;
 T('order saved',o.kind==='order'&&o.order.place==='مطعم الشرق'&&o.order.price===150&&o.pax===1);const ol=(await call('rides/open',null,dv.token)).j.rides;T('delivery captain sees order',ol.length===1&&ol[0].order.desc==='وجبتان كفتة');
 T('delivery notified',(await call('notes',null,dv.token)).j.notes[0].title==='طلب توصيل جديد');
 s.kill();console.log(`نجح ${ok} / فشل ${bad}`);process.exit(bad?1:0)})();
