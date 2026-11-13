// اختبار: أرقام الدول، تسجيل غير مكتمل، استعادة الحساب، المدفوعات، البونص، الوكلاء، تنبيهات الأجهزة، السرعة
const {spawn}=require('child_process'),fs=require('fs');
const AD='adminpass1',AU='auditpass1';let ok=0,bad=0;const T=(n,c)=>{c?ok++:(bad++,console.log('فشل:',n))};const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const f='/tmp/w2-test2.json';try{fs.unlinkSync(f)}catch{}const P=3996;
const s=spawn('node',['server.js'],{env:{...process.env,PORT:P,ADMIN_PASSWORD:AD,AUDIT_PASSWORD:AU,AUDIT_KEY:'k',DB_FILE:f,LOCK_MS:900,LEAD_MS:0},stdio:'ignore'});
const call=async(p,b,t,m,h={})=>{const r=await fetch(`http://localhost:${P}/api/${p}`,{method:m||(b?'POST':'GET'),headers:{'content-type':'application/json','x-token':t||'',...h},body:b?JSON.stringify(b):undefined});const tx=await r.text();let j;try{j=JSON.parse(tx)}catch{j=tx}return{s:r.status,j,h:r.headers}};
const loc={lat:30.05,lng:31.23,acc:12};let did=0;const dev=(id,model='SM-S918B')=>({ua:'Mozilla/5.0 (Linux; Android 13; '+model+') Chrome',model,id,fp:'fp'+model});
const reg=async(ph,role,x={})=>{const o=await call('otp',{phone:ph,country:'EG'});if(o.s!==200)return o;return call('register',{phone:ph,code:o.j.devCode,name:'م'+ph.slice(-3),password:'12345678',role,country:'EG',terms:true,email:ph+'@t.co',loc,dev:dev('d'+ph),...x})};
(async()=>{await sleep(900);
 T('health',(await fetch(`http://localhost:${P}/health`)).status===200);
 const rg=await fetch(`http://localhost:${P}/`,{headers:{'accept-encoding':'gzip'}});T('gzip html',rg.headers.get('content-encoding')==='gzip');
 // أرقام الدول
 T('not a phone',(await call('otp',{phone:'abcdef',country:'EG'})).s===400);T('short number',(await call('otp',{phone:'0101234',country:'EG'})).s===400);
 T('US number with EG country rejected',(await call('otp',{phone:'2125551234',country:'EG'})).s===400);T('KW number with EG rejected',(await call('otp',{phone:'+96551234567',country:'EG'})).s===400);
 const o1=await call('otp',{phone:'01012345678',country:'EG'});T('local EG format ok',o1.s===200);T('KW number with KW ok',(await call('otp',{phone:'51234567',country:'KW'})).s===200);
 const rl0=(await call('admin/login',{password:AD})).j.token,ad={'x-admin':rl0};
 const L=(await call('admin/leads',null,'',null,ad)).j.leads;T('leads captured',L.length===2&&L.some(l=>l.phone==='201012345678'));
 T('lead closed after register',(await call('register',{phone:'01012345678',code:o1.j.devCode,name:'م',password:'12345678',role:'rider',country:'EG',terms:true,email:'a1@t.co',loc,dev:dev('d01012345678')})).s===200&&(await call('admin/leads',null,'',null,ad)).j.leads.every(l=>l.phone!=='201012345678'));
 await call('admin/lead/965'+'51234567',{status:'contacted',note:'اتصلت'},'',null,ad);
 // تسجيل ودخول بنفس الرقم بصيغ مختلفة
 const lg=await call('login',{phone:'+20 101 234 5678',password:'12345678',country:'EG',loc,dev:dev('d01012345678')});T('login any format',lg.s===200&&lg.j.user.phone==='201012345678');
 // قفل لمدة قصيرة
 for(let i=0;i<5;i++)await call('login',{phone:'01012345678',password:'bad',country:'EG',loc});T('locked',(await call('login',{phone:'01012345678',password:'12345678',country:'EG',loc})).s===429);
 await sleep(1100);T('unlocked after short wait',(await call('login',{phone:'01012345678',password:'12345678',country:'EG',loc})).s===200);
 // سائق وراكب ورحلة
 const rd=lg.j,dr=(await reg('01022222222','driver')).j;const img='data:image/jpeg;base64,AAAA';
 await call('driver',{vehicle:'car',model:'x',plate:'1',photoVehicle:img,photoId:img,live:true},dr.token,'PUT');await call('admin/driver/'+dr.user.id,{status:'approved'},'',null,ad);
 // استعادة الحساب
 await call('recover/request',{phone:'01022222222',country:'EG',note:'نسيت',dev:dev('new-dev','Pixel 7')});T('recovery rate limit',(await call('recover/request',{phone:'01022222222',country:'EG'})).s===200);
 const rc=(await call('admin/recoveries',null,'',null,ad)).j.tickets;T('recovery listed',rc.length>=1);const ev=(await call('admin/recovery/'+rc[rc.length-1].id,null,'',null,ad)).j;T('evidence',ev.user.phone==='201022222222'&&ev.match.deviceKnown===false&&Array.isArray(ev.rides));
 T('needs 2 checks',(await call('admin/recovery/'+rc[rc.length-1].id+'/issue',{mode:'code',checks:['device']},'',null,ad)).s===400);T('needs callback or questions',(await call('admin/recovery/'+rc[rc.length-1].id+'/issue',{mode:'code',checks:['device','ip']},'',null,ad)).s===400);
 const is=(await call('admin/recovery/'+rc[rc.length-1].id+'/issue',{mode:'code',checks:['callback','questions']},'',null,ad)).j;T('code issued',/^\d{8}$/.test(is.code));
 T('wrong code',(await call('recover/use',{phone:'01022222222',country:'EG',code:'00000000',password:'newpassword1'})).s===400);T('use code',(await call('recover/use',{phone:'01022222222',country:'EG',code:is.code,password:'newpassword1'})).s===200);T('code single use',(await call('recover/use',{phone:'01022222222',country:'EG',code:is.code,password:'newpassword2'})).s===400);
 T('old token dead',(await call('me',null,dr.token)).s===401);const dl=(await call('login',{phone:'01022222222',password:'newpassword1',country:'EG',loc,dev:dev('d01022222222')})).j;T('login with new pw',!!dl.token);
 await call('recover/request',{phone:'01022222222',country:'EG'});const rc2=(await call('admin/recoveries',null,'',null,ad)).j.tickets;const tp=(await call('admin/recovery/'+rc2[0].id+'/issue',{mode:'temp',checks:['callback','email']},'',null,ad)).j;T('temp password',tp.password.length===10);
 const tl=(await call('login',{phone:'01022222222',password:tp.password,country:'EG',loc})).j;T('mustChange flag',tl.user.mustChange===true);T('blocked until change',(await call('rides/open',null,tl.token)).s===403&&(await call('me',null,tl.token)).s===200);
 const ch=await call('password',{old:tp.password,new:'finalpass123'},tl.token);T('change clears flag',ch.s===200&&ch.j.user.mustChange===false);const dtok=ch.j.token;
 // مدفوعات
 const st=(await call('admin/settings',null,'',null,ad)).j.settings;st.payments={instapay:{on:true,link:'https://ipn.eg/S/wasalni/pay?amt={amount}&ref={ref}',payee:'wasalni@instapay',note:'حوّل المبلغ بالضبط'},cash:{on:true,link:'',payee:'01099999999',note:''}};
 T('http link rejected',(await call('admin/settings',{settings:{...st,payments:{...st.payments,cash:{on:true,link:'http://x'}}}},'',null,ad)).s===400);await call('admin/settings',{settings:st},'',null,ad);
 const cf=(await call('config')).j;T('config pay no link',cf.pay.instapay.on&&cf.pay.cash.on&&!JSON.stringify(cf).includes('ipn.eg'));
 const pts={from:{lat:30,lng:31},to:{lat:30.1,lng:31.1}};const ride=(await call('rides',{vehicle:'car',...pts,km:10,offer:60},rd.token)).j.ride;await call(`rides/${ride.id}/offer`,{price:60},dtok);await call(`rides/${ride.id}/accept`,{driver:dr.user.id},rd.token);
 const pp=await call('pay/online',{kind:'ride',ride:ride.id,method:'instapay',amount:1},rd.token);T('ride pay fixed amount',pp.j.payment.amount===60&&pp.j.payment.url==='https://ipn.eg/S/wasalni/pay?amt=60&ref='+pp.j.payment.id);
 T('same payment reused',(await call('pay/online',{kind:'ride',ride:ride.id,method:'cash'},rd.token)).j.payment.id===pp.j.payment.id);
 T('submit needs ref',(await call(`pay/${pp.j.payment.id}/submit`,{ref:'1'},rd.token)).s===400);T('submit',(await call(`pay/${pp.j.payment.id}/submit`,{ref:'TX-12345'},rd.token)).s===200);
 const pc=(await call('admin/payments',null,'',null,ad)).j.payments[0];T('admin sees payment',pc.status==='submitted'&&pc.amount===60);
 T('confirm payment',(await call('admin/payment/'+pc.id,{action:'confirm'},'',null,ad)).s===200);T('double confirm blocked',(await call('admin/payment/'+pc.id,{action:'confirm'},'',null,ad)).s===409);
 T('ride switched to wallet',(await call('rides/'+ride.id,null,rd.token)).j.ride.pay==='wallet'&&(await call('me',null,rd.token)).j.user.wallet===60);
 for(const x of['arrived','started','done'])await call(`rides/${ride.id}/status`,{s:x,loc},dtok);
 const dme=(await call('me',null,dtok)).j.user;T('driver ledger after online ride',dme.bal===51&&dme.tx[0].t==='ride_in');
 // عمولة سائق عبر الدفع الإلكتروني
 const r2=(await call('rides',{vehicle:'car',...pts,km:10,offer:100},rd.token)).j.ride;await call(`rides/${r2.id}/offer`,{price:100},dtok);for(const x of['arrived','started','done'])await call(`rides/${r2.id}/status`,{s:x},dtok);
 T('driver owes after cash',(await call('me',null,dtok)).j.user.bal===36);const cp=await call('pay/commission',{method:'cash',amount:1},dtok);
 // الرصيد 36 موجب فلا عمولة مستحقة
 T('no commission when balance positive',cp.s===409);
 // ضبط رصيد سالب: خصم من السائق
 await call('admin/driver/'+dr.user.id,{settle:-100,reason:'خصم'},'',null,ad);const neg=(await call('me',null,dtok)).j.user.bal;T('negative balance',neg===-64);
 const cp2=await call('pay/commission',{method:'instapay'},dtok);T('commission amount server-side',cp2.j.payment.amount===64&&cp2.j.payment.kind==='commission');await call(`pay/${cp2.j.payment.id}/submit`,{ref:'COM-998877'},dtok);await call('admin/payment/'+cp2.j.payment.id,{action:'confirm'},'',null,ad);T('commission settled',(await call('me',null,dtok)).j.user.bal===0);
 T('duplicate ref',(await call('pay/online',{kind:'topup',amount:50,method:'cash'},rd.token).then(async r=>call(`pay/${r.j.payment.id}/submit`,{ref:'tx-12345'},rd.token))).s===409);
 const pr=await call('admin/payment-request',{uid:rd.user.id,amount:200,method:'cash'},'',null,ad);T('admin payment request',pr.s===200&&(await call('pay/mine',null,rd.token)).j.payments.some(p=>p.id===pr.j.id&&p.amount===200));
 T('rejecting payment',(await call('admin/payment/'+pr.j.id,{action:'reject',note:'لم نستلم'},'',null,ad)).s===200);
 // بونص وتحويل
 T('bonus all drivers',(await call('admin/bonus',{target:'driver',amount:25,kind:'appreciation',message:'شكراً'},'',null,ad)).j.sent===1&&(await call('me',null,dtok)).j.user.bonuses[0].amt===25);
 const w0=(await call('me',null,rd.token)).j.user.wallet;await call('admin/bonus',{target:'one',uid:rd.user.id,amount:10,kind:'welcome'},'',null,ad);T('bonus to one rider',(await call('me',null,rd.token)).j.user.wallet===w0+10);
 const b0=(await call('me',null,dtok)).j.user.bal;await call('admin/transfer',{from:rd.user.id,to:dr.user.id,amount:5,reason:'تسوية'},'',null,ad);T('admin transfer',(await call('me',null,dtok)).j.user.bal===b0+5&&(await call('me',null,rd.token)).j.user.wallet===w0+5);
 // وكلاء
 T('agent bad pct',(await call('admin/agent',{name:'وكيل',phone:'01033333333',email:'ag@t.co',country:'EG',driverPct:10,agentPct:12},'',null,ad)).s===400);
 const ag=(await call('admin/agent',{name:'وكيل',phone:'01033333333',email:'ag@t.co',country:'EG',driverPct:20,agentPct:5,code:'AG1234'},'',null,ad)).j;T('agent created',ag.code==='AG1234'&&ag.password.length===10);
 T('bad agent code',(await reg('01044444444','driver',{agentCode:'NOPE99'})).s===400);const d2=(await reg('01055555555','driver',{agentCode:'ag1234'})).j;
 await call('driver',{vehicle:'car',model:'x',plate:'2',photoVehicle:img,photoId:img},d2.token,'PUT');await call('admin/driver/'+d2.user.id,{status:'approved'},'',null,ad);
 const r3=(await call('rides',{vehicle:'car',...pts,km:10,offer:200},rd.token)).j.ride;await call(`rides/${r3.id}/offer`,{price:200},d2.token);for(const x of['arrived','started','done'])await call(`rides/${r3.id}/status`,{s:x},d2.token);
 const al=(await call('login',{phone:'01033333333',password:ag.password,country:'EG',loc})).j;T('agent login must change',al.user.mustChange&&al.user.role==='agent');const at=(await call('password',{old:ag.password,new:'agentpass123'},al.token)).j.token;
 const ah=(await call('agent/home',null,at)).j;T('agent earnings',ah.bal===10&&ah.drivers.length===1&&ah.drivers[0].mine===10&&ah.code==='AG1234');
 const d2m=(await call('me',null,d2.token)).j.user;T('driver charged agent total pct',d2m.bal===-40&&d2m.earned===160);
 const cd=(await call('admin/driver/'+d2.user.id+'/rides',null,'',null,ad)).j;T('company share after agent',cd.agentShare===10&&cd.companyShare===30&&cd.commission===40);
 const ags=(await call('admin/agents',null,'',null,ad)).j.agents[0];T('admin agents list',ags.drivers===1&&ags.companyShare===30&&ags.bal===10);
 T('agent cannot use driver api',(await call('rides/open',null,at)).s===403);await call('admin/agent/'+ag.id,{settle:-10},'',null,ad);T('agent payout',(await call('agent/home',null,at)).j.bal===0);
 await call('admin/driver-agent/'+d2.user.id,{code:''},'',null,ad);T('driver detached',(await call('admin/drivers',null,'',null,ad)).j.drivers.find(d=>d.id===d2.user.id).agentId===undefined);
 // تنبيهات الأجهزة
 const rA=(await reg('01066666666','rider')).j;await call('login',{phone:'01066666666',password:'12345678',country:'EG',loc,dev:dev('another-phone','Pixel 8')});
 T('new device alert',(await call('admin/alerts',null,'',null,ad)).j.alerts.some(a=>a.type==='new_device'&&a.uid===rA.user.id));
 const rB=(await reg('01077777777','rider',{dev:dev('d01066666666')}));T('shared device alert',(await call('admin/alerts',null,'',null,ad)).j.alerts.some(a=>a.type==='shared_device'&&a.data.others[0].id===rA.user.id));
 await call('account/delete',{password:'12345678'},rA.token);await reg('01088888888','rider',{dev:dev('d01066666666')});T('reuse after delete alert',(await call('admin/alerts',null,'',null,ad)).j.alerts.some(a=>a.type==='device_reused_after_delete'));
 T('alerts count in stats',(await call('admin/stats',null,'',null,ad)).j.alerts>=3);
 s.kill();console.log(`نجح ${ok} / فشل ${bad}`);process.exit(bad?1:0)})();
