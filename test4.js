// اختبار: مسؤولون بأدوار، السجل المالي والكشوف، الحملات، الوكلاء، الأجهزة، العملاء المحتملون، الجدول
const {spawn}=require('child_process'),fs=require('fs');
const AD='adminpass1';let ok=0,bad=0;const T=(n,c)=>{c?ok++:(bad++,console.log('فشل:',n))};const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const f='/tmp/w2-test4.json';try{fs.unlinkSync(f)}catch{}const P=3992;let logs='';
const s=spawn('node',['server.js'],{env:{...process.env,PORT:P,ADMIN_PASSWORD:AD,AUDIT_PASSWORD:'auditpass1',AUDIT_KEY:'k',DB_FILE:f,CAMP_MS:300,LEAD_MS:0,LOCK_MS:500},stdio:['ignore','pipe','pipe']});s.stdout.on('data',d=>logs+=d);s.stderr.on('data',d=>logs+=d);
const call=async(p,b,t,m,h={})=>{const r=await fetch(`http://localhost:${P}/api/${p}`,{method:m||(b?'POST':'GET'),headers:{'content-type':'application/json','x-token':t||'',...h},body:b?JSON.stringify(b):undefined});const tx=await r.text();let j;try{j=JSON.parse(tx)}catch{j=tx}return{s:r.status,j}};
const loc={lat:30.05,lng:31.23,acc:12},img='data:image/jpeg;base64,AAAA';let dn=0;
const reg=async(ph,role,x={})=>{const o=await call('otp',{phone:ph,country:'EG'});const r=await call('register',{phone:ph,code:o.j.devCode,name:'م'+ph.slice(-3),password:'12345678',role,country:'EG',terms:true,email:ph+'@t.co',loc,dev:{id:'d'+ph},...x});return{...r.j,s:r.s,code:o.j.devCode}};
(async()=>{await sleep(900);
 const owner=(await call('admin/login',{password:AD})).j,ad={'x-admin':owner.token};T('owner login',owner.role==='owner'&&owner.name==='المالك');
 const fa=(await call('admin/admin',{name:'سلمى المحاسبة',user:'salma',role:'finance'},'',null,ad)).j,sa=(await call('admin/admin',{name:'سعد الدعم',user:'saad',role:'support'},'',null,ad)).j;T('admins created',fa.password&&sa.password);
 T('bad admin pw',(await call('admin/login',{user:'salma',password:'x'})).s===401);
 const ft=(await call('admin/login',{user:'salma',password:fa.password})).j,fh={'x-admin':ft.token},st=(await call('admin/login',{user:'saad',password:sa.password})).j,sh={'x-admin':st.token};
 T('finance reads payments',(await call('admin/payments',null,'',null,fh)).s===200);T('finance cannot read settings',(await call('admin/settings',null,'',null,fh)).s===403);T('finance cannot approve driver',(await call('admin/driver/u1',{status:'approved'},'',null,fh)).s===403);
 T('support cannot confirm payment',(await call('admin/payment/p1',{action:'confirm'},'',null,sh)).s===403);T('support reads leads',(await call('admin/leads',null,'',null,sh)).s===200);T('support cannot see admins',(await call('admin/admins',null,'',null,sh)).s===403);
 T('backup owner only',(await call('admin/backup',null,'',null,fh)).s===403&&typeof (await call('admin/backup',null,'',null,ad)).j==='object');
 const bk=(await call('admin/backup',null,'',null,ad)).j;T('backup has no tokens',!('tokens' in bk)&&!!bk.users);
 // مستخدمون
 const rd=await reg('01011111111','rider'),dr=await reg('01022222222','driver');await call('driver',{vehicle:'car',model:'x',plate:'1',photoVehicle:img,photoId:img},dr.token,'PUT');await call('admin/driver/'+dr.user.id,{status:'approved'},'',null,ad);
 // محاسب: تعديل رصيد بسبب وتكرار
 T('adjust needs reason',(await call('admin/wallet-adjust',{uid:rd.user.id,amount:100},'',null,fh)).s===400);
 const idem='k-'+Date.now();await call('admin/wallet-adjust',{uid:rd.user.id,amount:300,reason:'شحن نقدي',idem},'',null,fh);await call('admin/wallet-adjust',{uid:rd.user.id,amount:300,reason:'شحن نقدي',idem},'',null,fh);
 T('idempotent adjust',(await call('me',null,rd.token)).j.user.wallet===300);T('debit over balance rejected',(await call('admin/wallet-adjust',{uid:rd.user.id,amount:-999,reason:'خطأ'},'',null,fh)).s===400);
 await call('admin/wallet-adjust',{uid:rd.user.id,amount:-50,reason:'تصحيح'},'',null,fh);const sm=(await call('statement',null,rd.token)).j;T('rider statement',sm.entries.length===2&&sm.entries[0].a===-50&&sm.entries[0].bal===250&&sm.entries[0].by==='سلمى المحاسبة'&&sm.balances.wallet===250);
 const au=(await call('audit/login',{password:'auditpass1'})).j.token,ah={'x-audit':au};const dos=(await call('audit/user/'+rd.user.id,null,'',null,ah)).j;T('audit has admin name and before/after',dos.events.some(e=>e.ev==='admin_wallet_adjust'&&e.adm&&e.adm.name==='سلمى المحاسبة'&&e.d.before===300&&e.d.after===250));
 // حملات ومكافآت
 const pts={from:{lat:30,lng:31},to:{lat:30.1,lng:31.1}};
 const c1=(await call('admin/campaign',{title:'ترحيب',desc:'أهلاً',kind:'welcome',amount:40,target:'rider',nonWithdrawable:true,maxUses:2},'',null,fh)).j;T('campaign granted',c1.granted===1&&c1.status==='active');
 let me=(await call('me',null,rd.token)).j.user;T('promo separate',me.promo===40&&me.wallet===250&&me.spendable===290&&me.bonuses[0].title==='ترحيب');
 T('no double grant',(await call('admin/campaign/'+c1.id,{action:'grant'},'',null,fh)).j.granted===1&&(await call('admin/campaign/'+c1.id,{action:'grant'},'',null,fh)).j.granted===0);
 me=(await call('me',null,rd.token)).j.user;T('max uses 2',me.promo===80);
 T('end before start rejected',(await call('admin/campaign',{title:'x',amount:5,target:'rider',start:Date.now()+1000,end:Date.now()},'',null,fh)).s===400);
 const c2=(await call('admin/campaign',{title:'غداً',kind:'special',amount:7,target:'driver',start:Date.now()+700},'',null,fh)).j;T('pending campaign',c2.status==='pending'&&c2.granted===0);await sleep(1300);
 T('scheduler grants',(await call('me',null,dr.token)).j.user.bonuses.some(b=>b.title==='غداً'&&b.label==='مكافأة خاصة'));
 // الدفع يستهلك المكافأة أولاً
 const ride=(await call('rides',{vehicle:'car',...pts,km:12,offer:100,pay:'wallet'},rd.token)).j.ride;await call(`rides/${ride.id}/offer`,{price:100,accept:true},dr.token);for(const x of['arrived','started','done'])await call(`rides/${ride.id}/status`,{s:x,loc},dr.token);
 me=(await call('me',null,rd.token)).j.user;T('promo spent first',me.promo===0&&me.wallet===230);
 const ds=(await call('statement',null,dr.token)).j;T('driver statement',ds.entries.some(e=>e.t==='wallet_in'&&e.a===100)&&ds.entries.some(e=>e.t==='commission'&&e.a===-15)&&ds.entries[0].bal===ds.balances.bal);
 const rv=(await call('admin/campaign/'+c1.id,{action:'cancel',reverse:true},'',null,fh)).j;T('cancel reverses',rv.reversed===1&&(await call('me',null,rd.token)).j.user.wallet===150);T('cancel twice blocked',(await call('admin/campaign/'+c1.id,{action:'cancel'},'',null,fh)).s===409);
 // عمولات وتسويات
 const r2=(await call('rides',{vehicle:'car',...pts,km:12,offer:200},rd.token)).j.ride;await call(`rides/${r2.id}/offer`,{price:200,accept:true},dr.token);await call(`rides/${r2.id}/toll`,{amount:15},dr.token);await call(`rides/${r2.id}/toll/respond`,{accept:true},rd.token);for(const x of['arrived','started','done'])await call(`rides/${r2.id}/status`,{s:x},dr.token);
 const b1=(await call('me',null,dr.token)).j.user.bal;T('driver balance',b1===62);
 let cm=(await call('admin/commissions',null,'',null,fh)).j;T('commissions fresh not overdue',cm.drivers[0].owed===0||cm.drivers[0].overdue===0);
 await call('admin/driver-adjust',{uid:dr.user.id,kind:'deduct',amount:100,reason:'مخالفة'},'',null,fh);T('deduct',(await call('me',null,dr.token)).j.user.bal===b1-100);
 cm=(await call('admin/commissions',null,'',null,fh)).j;T('owed shown',cm.drivers[0].owed===38&&cm.totals.owed===38);
 const stg=(await call('admin/settings',null,'',null,ad)).j.settings;stg.commissionDueDays=0;await call('admin/settings',{settings:stg},'',null,ad);cm=(await call('admin/commissions',null,'',null,fh)).j;T('overdue when due days 0',cm.drivers[0].overdue===38);
 await call('admin/driver-adjust',{uid:dr.user.id,kind:'received',amount:38,reason:'استلام نقدي'},'',null,fh);cm=(await call('admin/commissions',null,'',null,fh)).j;T('collected tracked',cm.totals.collected===38&&cm.totals.owed===0);
 T('history tolls',(await call('history',null,rd.token)).j.rides.some(r=>r.tolls===15)&&(await call('admin/driver/'+dr.user.id+'/rides',null,'',null,fh)).j.rides.some(r=>r.tolls===15));
 // وكلاء
 const ag=(await call('admin/agent',{name:'وكيل',phone:'01033333333',email:'ag@t.co',country:'EG',driverPct:20,agentPct:5},'',null,ad)).j;T('AGT code',ag.code==='AGT1001');const ag2=(await call('admin/agent',{name:'وكيل2',phone:'01033333334',email:'ag2@t.co',country:'EG',driverPct:20,agentPct:5},'',null,ad)).j;T('AGT sequence',ag2.code==='AGT1002');
 const al=(await call('login',{phone:'01033333333',password:ag.password,country:'EG',loc})).j;const at=(await call('password',{old:ag.password,new:'agentpass123'},al.token)).j.token;
 T('invite',(await call('agent/invite',{phone:'01044444444',name:'كابتن مدعو'},at)).s===200);T('invite registered phone rejected',(await call('agent/invite',{phone:'01022222222'},at)).s===409);
 const d3=await reg('01044444444','driver');T('invite links without code',d3.s===200&&(await call('admin/drivers',null,'',null,ad)).j.drivers.find(d=>d.id===d3.user.id).agentId===al.user.id);T('agent notified of registration',(await call('notes',null,at)).j.notes[0].title==='سجّل كابتن جديد عن طريقك');
 await call('driver',{vehicle:'car',model:'x',plate:'3',photoVehicle:img,photoId:img},d3.token,'PUT');T('agent notified of docs',(await call('notes',null,at)).j.notes[0].title==='أكمل أحد كباتنك بياناته');await call('admin/driver/'+d3.user.id,{status:'approved'},'',null,ad);T('agent notified of approval',(await call('notes',null,at)).j.notes[0].title==='تم اعتماد أحد كباتنك');
 const r3=(await call('rides',{vehicle:'car',...pts,km:12,offer:200},rd.token)).j.ride;await call(`rides/${r3.id}/offer`,{price:200,accept:true},d3.token);for(const x of['arrived','started','done'])await call(`rides/${r3.id}/status`,{s:x},d3.token);
 let ah2=(await call('agent/home',null,at)).j;T('agent dashboard',ah2.bal===10&&ah2.counts.total===1&&ah2.counts.active===1&&ah2.paid===0&&ah2.invites[0].status==='approved'&&ah2.tx[0].t==='agent_share'&&ah2.drivers[0].mine===10);
 T('withdraw too much',(await call('agent/withdraw',{amount:99},at)).s===400);T('withdraw',(await call('agent/withdraw',{amount:10},at)).s===200);T('one pending withdraw',(await call('agent/withdraw',{amount:1},at)).s===409);
 const pw=(await call('admin/payments',null,'',null,fh)).j.payments.find(p=>p.kind==='payout');T('admin sees payout',pw&&pw.amount===10&&pw.methodName==='تحويل يدوي');await call('admin/payment/'+pw.id,{action:'confirm'},'',null,fh);ah2=(await call('agent/home',null,at)).j;T('payout applied',ah2.bal===0&&ah2.paid===10);
 const st2=(await call('admin/stats',null,'',null,ad)).j;T('independent vs affiliated',st2.independentDrivers===1&&st2.affiliatedDrivers===1);
 const agd=(await call('admin/agent/'+al.user.id+'/drivers',null,'',null,fh)).j;T('admin agent drivers',agd.drivers.length===1&&agd.drivers[0].agentShare===10&&agd.drivers[0].companyShare===30);
 await call('admin/agent/'+al.user.id,{name:'وكيل معدّل'},'',null,ad);T('agent edit',(await call('admin/agents',null,'',null,fh)).j.agents.find(a=>a.id===al.user.id).name==='وكيل معدّل');
 // طلب تغيير الوكيل
 T('bad agent code',(await call('agent/change-request',{code:'ZZZ999'},dr.token)).s===400);T('change request',(await call('agent/change-request',{code:ag2.code,reason:'أريد الانضمام'},dr.token)).s===200);T('one open request',(await call('agent/change-request',{code:ag.code},dr.token)).s===409);T('pending flag',(await call('me',null,dr.token)).j.user.agentPending===true);
 const cr=(await call('admin/change-requests',null,'',null,ad)).j.requests[0];T('request listed',cr&&cr.toName==='وكيل2'&&cr.fromName==='مستقل');await call('admin/change-request/'+cr.id,{action:'approve'},'',null,ad);
 T('driver moved',(await call('me',null,dr.token)).j.user.agentName==='وكيل2');const oldRide=(await call('admin/driver/'+d3.user.id+'/rides',null,'',null,ad)).j.rides[0];T('old commissions untouched',oldRide.agentShare===10);
 // أجهزة وتنبيهات
 const rr=await reg('01055555555','rider');for(const id of['x1','x2','x3'])await call('login',{phone:'01055555555',password:'12345678',country:'EG',loc,dev:{id}});T('many devices alert',(await call('admin/alerts',null,'',null,sh)).j.alerts.some(a=>a.type==='many_devices'&&a.data.count>=3));
 for(const id of['y1','y2','y3'])await call('login',{phone:'01066666666',password:'bad',country:'EG',loc,dev:{id}});T('multi device failed attempts alert',(await call('admin/alerts',null,'',null,sh)).j.alerts.some(a=>a.type==='login_multi_device_attempts'));
 await call('profile',{email:'new55@t.co'},rr.token,'PUT');T('email change alert',(await call('admin/alerts',null,'',null,sh)).j.alerts.some(a=>a.type==='contact_change'&&a.data.to==='new55@t.co'));
 const dv=(await call('admin/devices?q=01055555555',null,'',null,sh)).j.devices;T('devices log',dv.length>=3&&dv[0].name&&dv[0].devId);
 // عملاء محتملون
 const o=await call('otp',{phone:'01077777777',country:'EG',name:'منى',role:'driver'});T('lead step requested',(await call('admin/leads',null,'',null,sh)).j.leads.find(l=>l.phone==='201077777777').step==='otp_requested');
 T('otp verify wrong',(await call('otp/verify',{phone:'01077777777',country:'EG',code:'000000'})).s===400);T('otp verify',(await call('otp/verify',{phone:'01077777777',country:'EG',code:o.j.devCode})).s===200);
 const ld=(await call('admin/leads',null,'',null,sh)).j.leads.find(l=>l.phone==='201077777777');T('lead verified',ld.step==='otp_verified'&&!!ld.phoneVerified&&ld.role==='driver');
 await call('admin/lead/201077777777',{status:'not_interested',reason:'لا يريد'},'',null,sh);T('lead status',(await call('admin/leads',null,'',null,sh)).j.leads.find(l=>l.phone==='201077777777').status==='not_interested');
 T('otp code not in logs',!logs.includes(o.j.devCode));
 // استعادة من ملف المستخدم
 const rt=(await call('admin/user/'+rd.user.id+'/recovery',{},'',null,ad)).j;T('recovery from user file',!!rt.ticket&&(await call('admin/recoveries',null,'',null,ad)).j.tickets.some(t=>t.id===rt.ticket));
 // جدول الكابتن
 T('bad schedule',(await call('captain/schedule',{days:[1,1],hours:4},dr.token)).s===400);await call('captain/schedule',{days:[1,1,1,1,1,1,1],hours:4},dr.token);const cs=(await call('captain/stats',null,dr.token)).j;T('schedule stats',cs.scheduledWeek===28&&cs.missedSessions===6&&cs.sched.hours===4);
 // طلب توصيل بعدة أصناف
 const dc=await reg('01088888888','driver');await call('driver',{vehicle:'delivery',model:'x',plate:'9',photoVehicle:img,photoId:img},dc.token,'PUT');await call('admin/driver/'+dc.user.id,{status:'approved'},'',null,ad);
 const od=(await call('rides',{vehicle:'delivery',...pts,km:4,offer:30,order:{place:'سوبر ماركت',items:[{qty:2,desc:'لبن',price:40},{qty:1,desc:'خبز',price:10},{qty:0,desc:''}],comment:'بسرعة'}},rd.token)).j.ride;T('order items',od.order.items.length===2&&od.order.price===50&&od.order.qty===3&&od.order.desc==='2× لبن، 1× خبز');
 // مسؤول موقوف
 await call('admin/admin/'+fa.id,{active:false},'',null,ad);T('disabled admin loses access',(await call('admin/payments',null,'',null,fh)).s===401);
 s.kill();console.log(`نجح ${ok} / فشل ${bad}`);process.exit(bad?1:0)})();
