
'use strict';
const VERSION='v4.4';
const STORAGE_VERSION=5;
const DAY_NAMES=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DAY_LONG=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const TIERS=['floor','standard','full'];
const TIER_ORDER={floor:0,standard:1,full:2};
const TIER_LABEL={floor:'Floor',standard:'Standard',full:'Full'};
const TIER_SUB={floor:'minimum',standard:'solid day',full:'stretch'};
const DEFAULT_CHAINS=[
 {key:'morning',title:'Morning',range:'4:30 – 7:45am',items:[
  {id:'wake',name:'Wake up',at:'04:30',end:'04:45',tier:'floor'},
  {id:'wash',name:'Wash · water · make bed',at:'04:45',end:'05:15',tier:'standard'},
  {id:'exercise',name:'Exercise · PWA session',at:'04:45',end:'05:05',tier:'floor'},
  {id:'mapping',name:"Read today's session map",at:'05:15',end:'05:25',tier:'standard'},
  {id:'s1',name:'Session 1',at:'05:25',end:'06:15',tier:'standard'},
  {id:'japa',name:'Nama Japa · 1 mala',at:'06:45',end:'07:00',tier:'floor'},
  {id:'breakfast',name:'Breakfast + milk',at:'07:30',end:'07:45',anchor:true}
 ]},
 {key:'work',title:'Work',range:'7:45am – 2:20pm',items:[
  {id:'terrace',name:'Terrace walk · 15 min',at:'07:45',end:'08:00',tier:'standard'},
  {id:'s2',name:'Session 2',at:'08:15',end:'09:00',tier:'standard'},
  {id:'s3',name:'Session 3',at:'09:00',end:'10:00',tier:'standard'},
  {id:'s4',name:'Session 4',at:'10:00',end:'11:00',tier:'full'},
  {id:'prep',name:'Trading prep · charts + notes',at:'11:00',end:'11:20',tier:'standard'},
  {id:'trade',name:'Trading work · minimum 30 min',at:'11:30',end:'12:00',tier:'floor'},
  {id:'tradeDeep',name:'Trading work · deep block',at:'12:00',end:'13:30',tier:'standard'},
  {id:'journal1',name:'Trade journal',at:'13:30',end:'14:00',tier:'floor'},
  {id:'water1',name:'Water bottle 1 of 2',at:'07:45',end:'14:20',label:'by 2:20pm',tier:'standard'},
  {id:'lunch',name:'Lunch',at:'14:00',end:'14:20',anchor:true}
 ]},
 {key:'afternoon',title:'Afternoon',range:'2:20 – 7:00pm',items:[
  {id:'reading',name:'Reading',at:'14:20',end:'15:00',tier:'standard'},
  {id:'s5',name:'Session 5',at:'15:00',end:'16:00',tier:'full'},
  {id:'s6',name:'Session 6',at:'16:00',end:'17:00',tier:'full'},
  {id:'s7',name:'Session 7',at:'17:00',end:'18:00',tier:'full'},
  {id:'s8',name:'Session 8',at:'18:00',end:'18:45',tier:'full'},
  {id:'water2',name:'Water bottle 2 of 2',at:'14:20',end:'19:00',label:'by 7:00pm',tier:'standard'},
  {id:'dinner',name:'Dinner',at:'18:45',end:'19:00',anchor:true}
 ]},
 {key:'night',title:'Night',range:'7:30 – 9:00pm',items:[
  {id:'journal2',name:"Journal today + write tomorrow's map",at:'19:30',end:'20:00',tier:'standard'},
  {id:'screens',name:'Phone out of reach · screens off',at:'20:00',end:'20:30',tier:'standard'},
  {id:'windown',name:'Wash face + feet · make bed',at:'20:00',end:'20:30',tier:'standard'},
  {id:'sleep',name:'Asleep',at:'20:45',end:'21:00',label:'by 9:00',tier:'floor'}
 ]}
];
const SATURDAY_OVERRIDES={prep:{name:"Pull up week's trades + charts"},trade:{name:'Weekly review · R-multiples, tags, lessons'},journal1:{name:"Write weekly summary + next week's focus"}};
const SUNDAY_ITEM={id:'sun_sleep',name:"Lights out by 9:00 · protect Monday",at:'20:15',end:'21:00',label:'by 9:00',tier:'floor'};
const clone=o=>JSON.parse(JSON.stringify(o));
const pad2=n=>String(n).padStart(2,'0');
const mins=s=>{const [h,m]=s.split(':').map(Number);return h*60+m};
const fmt=s=>{const [h,m]=s.split(':').map(Number),h12=h%12||12;return m?`${h12}:${pad2(m)}`:`${h12}:00`};
const dateKey=d=>`${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
const today=()=>new Date();
const addDays=(d,n)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()+n,12);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const storageGet=(k,def=null)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):def}catch{return def}};
const storageSet=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true}catch{return false}};
let state={date:null,target:'floor',targetLocked:false,prefTier:'floor',days:{},startDate:null,best:0,streak:0,atRisk:false,showStretch:false,routine:null,lastBackup:null,reminders:true,notifyLead:5,reviewOpen:false};
let deferredInstallPrompt=null,focusTimer=null,focusEnd=0;
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
function routine(){return state.routine||clone(DEFAULT_CHAINS)}
function chainsFor(dow,rec=null){if(dow===0)return[];const src=clone(rec?.routineSnapshot||routine());if(dow===6)return src.map(ch=>ch.key==='work'?{...ch,items:ch.items.map(i=>SATURDAY_OVERRIDES[i.id]?{...i,...SATURDAY_OVERRIDES[i.id]}:i)}:ch);return src}
function itemsFor(dow,rec=null){if(dow===0)return[SUNDAY_ITEM];return chainsFor(dow,rec).flatMap(c=>c.items.filter(i=>!i.anchor))}
function upTo(dow,tier,rec=null){return itemsFor(dow,rec).filter(i=>TIER_ORDER[i.tier]<=TIER_ORDER[tier])}
function getRec(k=state.date){return state.days[k]||null}
function ensureRec(k=state.date){if(!state.days[k])state.days[k]={target:state.target,status:{},committed:false,changed:false,routineSnapshot:clone(routine())};const r=state.days[k];if(!r.status)r.status={};if(!r.routineSnapshot)r.routineSnapshot=clone(routine());return r}
function status(id,k=state.date){return getRec(k)?.status?.[id]||null}
function achievedFor(rec,dow){if(!rec)return null;const st=rec.status||{};for(const t of ['full','standard','floor']){const arr=upTo(dow,t,rec);if(arr.length&&arr.every(i=>st[i.id]==='done'))return t}return null}
function levelFor(rec,dow){const a=achievedFor(rec,dow);return a?TIER_ORDER[a]+1:0}
function saveRec(k=state.date){storageSet('day:'+k,state.days[k])}
function saveMeta(){storageSet('meta',{version:STORAGE_VERSION,prefTier:state.prefTier,startDate:state.startDate,best:state.best,routine:state.routine,reminders:state.reminders,notifyLead:state.notifyLead,lastBackup:state.lastBackup||null})}
function migrateRecord(r){if(!r)return null;if(r.status)return r;return{target:r.tier||'floor',status:Object.fromEntries(Object.entries(r.checked||{}).filter(([,v])=>v).map(([id])=>[id,'done'])),committed:true,changed:false,routineSnapshot:clone(state.routine)}}
function load(){const now=today(),tk=dateKey(now),meta=storageGet('meta',{});state.date=tk;state.prefTier=meta.prefTier||'floor';state.startDate=meta.startDate||tk;state.best=Number(meta.best||0);state.routine=meta.routine||clone(DEFAULT_CHAINS);state.reminders=meta.reminders!==false;state.notifyLead=Number(meta.notifyLead??5);state.lastBackup=meta.lastBackup||null;state.days={};
 for(let i=0;i<800;i++){const d=addDays(now,-i),k=dateKey(d),raw=storageGet('day:'+k,null);if(!raw)continue;const r=migrateRecord(raw);state.days[k]=r;storageSet('day:'+k,r)}
 const rec=getRec();state.target=rec?.target||state.prefTier;state.targetLocked=!!rec?.committed;state.reviewOpen=now.getHours()>=19;recalcStreak(false);render();scheduleReminder()}
function recalcStreak(persist=true){let run=0,gap=0,best=0;let d=new Date((state.startDate||state.date)+'T12:00:00');const end=today();while(dateKey(d)<=dateKey(end)){if(d.getDay()!==0){const r=getRec(dateKey(d)),hit=!!achievedFor(r,d.getDay());if(hit){run++;gap=0;best=Math.max(best,run)}else{gap++;if(gap>=2)run=0}}d=addDays(d,1)}state.streak=run;state.best=Math.max(state.best||0,best);const y=addDays(end,-1);state.atRisk=y.getDay()!==0&&!achievedFor(getRec(dateKey(y)),y.getDay());if(persist)saveMeta()}
function targetProgress(t){const arr=upTo(today().getDay(),t);const done=arr.filter(i=>status(i.id)==='done').length;return{done,total:arr.length,met:arr.length>0&&done===arr.length}}
function commitTarget(t){const r=ensureRec();r.target=t;r.committed=true;r.changed=false;saveRec();state.target=t;state.targetLocked=true;state.prefTier=t;saveMeta();toast(`Target committed: ${TIER_LABEL[t]}`);render()}
function requestTarget(t){if(t===state.target)return;if(!state.targetLocked){state.target=t;render();return}if(TIER_ORDER[t]<TIER_ORDER[state.target]){openModal(`<div class="sheet"><h2>Downgrade today's target?</h2><p>This is a deliberate change, not a failure. Completed work stays recorded. Choose why the plan changed.</p><div class="row"><label>Reason</label><select id="downgradeReason"><option>Low energy / poor sleep</option><option>Unexpected event</option><option>Time constraint</option><option>Other</option></select></div><div class="actions"><button class="btn" data-close>Keep ${TIER_LABEL[state.target]}</button><button class="btn primary" data-confirm-downgrade="${t}">Move to ${TIER_LABEL[t]}</button></div></div>`);return}commitTarget(t)}
function mark(id,next,k=state.date){const d=today(),r=ensureRec(k),it=itemsFor(d.getDay(),r).find(x=>x.id===id);if(!it)return;const sameDay=k===state.date;if(sameDay&&mins(it.at)>d.getHours()*60+d.getMinutes()&&next!=='skipped'){toast('That block has not started yet.');return}r.status[id]=next;r.lastUpdated=new Date().toISOString();saveRec(k);if(sameDay){recalcStreak();render();scheduleReminder();navigator.vibrate?.(8)}else{recalcStreak();render()}}
function clearStatus(id,k=state.date){const r=ensureRec(k);delete r.status[id];saveRec(k);recalcStreak();render()}
function taskMenu(id){const now=today(),k=state.date,r=getRec(k),it=itemsFor(now.getDay(),r).find(x=>x.id===id)||SUNDAY_ITEM;if(!it)return;const cur=mins(now.getHours()+':'+pad2(now.getMinutes())),start=mins(it.at),future=start>cur;const s=status(id);const statusLabel={done:'Done',skipped:'Skipped',missed:'Missed'}[s]||'Not recorded';openModal(`<div class="sheet"><h2>${esc(it.name)}</h2><p>${fmt(it.at)}${it.end?' – '+fmt(it.end):''} · status: <b>${statusLabel}</b></p>${future?`<div class="risk" style="color:var(--muted);border-color:var(--line)">This block is upcoming. It cannot be marked done or missed before its start.</div>`:''}<div class="actions">${future?'':`<button class="btn primary" data-mark="done" data-id="${esc(id)}">✓ Done</button><button class="btn" data-mark="skipped" data-id="${esc(id)}">Skip intentionally</button><button class="btn danger" data-mark="missed" data-id="${esc(id)}">Mark missed</button>`}<button class="btn" data-mark="clear" data-id="${esc(id)}">Clear status</button><button class="btn" data-close>Close</button></div></div>`)}
function nextUp(){const now=today(),dow=now.getDay(),nm=now.getHours()*60+now.getMinutes();if(dow===0)return status(SUNDAY_ITEM.id)==='done'?{kind:'done'}:{kind:'now',item:SUNDAY_ITEM};const arr=upTo(dow,state.target);if(!arr.length)return{kind:'done'};const end=i=>i.end?mins(i.end):mins(i.at)+30,start=i=>mins(i.at);const dayEnd=Math.max(...arr.map(end));if(arr.every(i=>status(i.id)==='done'))return{kind:'done'};const open=arr.filter(i=>{const s=status(i.id);return s!=='done'&&s!=='skipped'&&s!=='missed'});if(!open.length||nm>=dayEnd){const missed=arr.filter(i=>status(i.id)==='missed').length,stillOpen=arr.filter(i=>{const s=status(i.id);return s!=='done'&&s!=='skipped'}).length;return{kind:'over',missed,open:stillOpen}}const overdue=open.filter(i=>end(i)<=nm),cur=open.find(i=>start(i)<=nm&&nm<end(i)),up=open.find(i=>start(i)>nm);if(cur)return{kind:'now',item:cur,late:overdue.length};if(up)return{kind:'up',item:up,inMin:start(up)-nm,late:overdue.length};return{kind:'late',item:overdue[0],late:Math.max(0,overdue.length-1)}}
function heroHTML(){const n=nextUp();if(n.kind==='done'){const idx=TIERS.indexOf(state.target);return `<section class="hero done"><div class="kick">${TIER_LABEL[state.target]} complete</div><h2>${idx<2?'You kept the floor.':'Ladder complete.'}</h2><div class="time">Stopping is a valid finish. More work is optional, not debt.</div>${idx<2?`<button class="btn ghost" style="margin-top:12px;width:100%" data-raise="${TIERS[idx+1]}">Raise target to ${TIER_LABEL[TIERS[idx+1]]}</button>`:''}</section>`}if(n.kind==='over'){const bits=[];if(n.open)bits.push(`${n.open} still open`);if(n.missed)bits.push(`${n.missed} marked missed`);const headline=bits.length?bits.join(' · '):'Day logged';return `<section class="hero over"><div class="kick">Day closed</div><h2>${headline}</h2><div class="time">Log what happened. Do not create catch-up debt tonight. Protect sleep.</div><button class="btn ghost" style="margin-top:12px;width:100%" data-open-review>Review today</button></section>`}const it=n.item;const kick=n.kind==='now'?'Now':n.kind==='up'?`Next · in ${n.inMin}m`:`Late · due ${fmt(it.end||it.at)}`;return `<section class="hero ${n.kind==='late'?'late':'now'}"><div class="kick">${kick}</div><h2>${esc(it.name)}</h2><div class="time">${it.label||`${fmt(it.at)} – ${fmt(it.end||it.at)}`}</div><div class="hero-actions"><button class="btn primary" data-focus="${esc(it.id)}">Focus</button><button class="btn" data-done="${esc(it.id)}">✓ Done</button></div>${n.late?`<div class="meta">${n.late} earlier item${n.late>1?'s':''} still open</div>`:''}<div class="focusHint">The app's job is to get you into the next block, not keep you checking the dashboard.</div></section>`}
function weekDates(){const t=today(),dow=t.getDay(),mon=addDays(t,dow===0?-6:1-dow);return Array.from({length:7},(_,i)=>addDays(mon,i))}
function rungHTML(d){const k=dateKey(d),r=getRec(k),lv=levelFor(r,d.getDay()),future=k>state.date;let cls=k===state.date?'today ':'';if(future)cls+='future ';else if(!r)cls+='skipped ';else if(!achievedFor(r,d.getDay()))cls+='missed ';if(r?.changed)cls+='adjusted';return `<button class="daycell ${cls}" data-history="${k}" aria-label="Open ${DAY_LONG[d.getDay()]} history"><div class="ladder" data-level="${lv}"><i></i><i></i><i></i></div><div class="dow">${DAY_NAMES[d.getDay()]}</div></button>`}
function statusPanel(){const arr=upTo(today().getDay(),state.target),done=arr.filter(i=>status(i.id)==='done').length,pct=arr.length?Math.round(done/arr.length*100):0;return `<section class="panel"><div class="panel-title">Today <small>${done}/${arr.length} ${TIER_LABEL[state.target]}</small></div><div class="progressbar"><i style="width:${pct}%"></i></div><div class="statline"><span><b>${pct}%</b> of today's committed target</span><span>${state.streak} day streak · best ${state.best}</span></div>${state.atRisk?`<div class="risk"><b>Recovery day.</b> Yesterday was not achieved. If you genuinely forgot to log it, repair it now; otherwise hit today's Floor and move on.<br><button class="btn small" style="margin-top:7px" data-repair-yesterday>Repair yesterday</button></div>`:''}<div class="week">${weekDates().map(rungHTML).join('')}</div></section>`}
function taskHTML(i,stretch=false){const s=status(i.id),now=today(),future=mins(i.at)>now.getHours()*60+now.getMinutes();const icon=s==='done'?'✓':s==='skipped'?'–':s==='missed'?'!':'';return `<div class="task ${stretch?'stretch ':''}${future?'upcoming':''}" data-status="${s||''}"><button class="box" data-done="${esc(i.id)}" aria-label="Mark ${esc(i.name)} done" ${future?'disabled':''}>${icon}</button><button class="name" data-task="${esc(i.id)}"><span>${esc(i.name)}</span></button><span class="time">${esc(i.label|| (fmt(i.at)+'–'+fmt(i.end)))}</span><button class="more" data-menu="${esc(i.id)}" aria-label="Task actions">⋯</button></div>${stretch?'<div class="stretchLabel">optional stretch</div>':''}`}
function chainHTML(ch){
 const lvl=TIER_ORDER[state.target];
 const rows=[]; let d=0,t=0;
 for(const i of ch.items){
  if(i.anchor){
   const label=i.label || (fmt(i.at)+'–'+fmt(i.end));
   rows.push('<div class="anchor"><span>'+esc(i.name)+'</span><span>'+esc(label)+'</span></div>');
   continue;
  }
  const inTier=TIER_ORDER[i.tier]<=lvl;
  if(inTier){
   t++;
   if(status(i.id)==='done')d++;
   rows.push(taskHTML(i,false));
  }else if(state.showStretch||status(i.id)){
   rows.push(taskHTML(i,true));
  }
 }
 if(!t)return '';
 const full=d===t?'full':'';
 return '<section class="section"><div class="section-head"><span style="color:var(--gold)">›</span><h2>'+esc(ch.title)+'</h2><span class="prog '+full+'">'+d+'/'+t+'</span><span class="range">'+esc(ch.range)+'</span></div>'+rows.join('')+'</section>';
}
function reviewHTML(){const now=today(),days=[];for(let i=27;i>=0;i--){const d=addDays(now,-i);if(d.getDay()===0||dateKey(d)<state.startDate)continue;days.push(d)}const achieved=days.filter(d=>!!achievedFor(getRec(dateKey(d)),d.getDay())).length;const standard=days.filter(d=>['standard','full'].includes(achievedFor(getRec(dateKey(d)),d.getDay()))).length;const full=days.filter(d=>achievedFor(getRec(dateKey(d)),d.getDay())==='full').length;const lk=leaks();return `<details class="details" ${state.reviewOpen?'open':''}><summary>Weekly review & history</summary><div class="reviewbody"><div class="reviewgrid"><table><tr><th>Date</th><th>Floor+</th><th>Standard+</th><th>Full</th><th>Change</th></tr>${days.slice(-14).map(d=>{const r=getRec(dateKey(d)),a=achievedFor(r,d.getDay());return `<tr><td>${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}</td><td>${a?'✓':''}</td><td>${a==='standard'||a==='full'?'✓':''}</td><td>${a==='full'?'✓':''}</td><td>${r?.changed?'adjusted':''}</td></tr>`}).join('')}</table></div><div class="reviewstats"><div class="metric"><span>Floor+ · 28d</span><b>${achieved}/${days.length}</b></div><div class="metric"><span>Standard+ · 28d</span><b>${standard}/${days.length}</b></div><div class="metric"><span>Full · 28d</span><b>${full}/${days.length}</b></div></div>${lk.length?`<div class="leaks"><b>Where the routine leaks</b><br>${lk.map(x=>`${esc(x.name)} — <b>${x.done}/${x.total}</b> done`).join('<br>')}</div>`:'<div class="leaks">No repeated leak detected yet.</div>'}<div style="margin-top:12px;font-size:10px;color:var(--muted)"><b style="color:var(--text)">Weekly rule:</b> change one routine element. Don't redesign the whole system after one bad day.</div></div></details>`}
function leaks(){const stats={};for(let n=1;n<=28;n++){const d=addDays(today(),-n);if(d.getDay()===0)continue;const r=getRec(dateKey(d));if(!r)continue;upTo(d.getDay(),r.target||'floor',r).forEach(i=>{const s=stats[i.id] ||= {name:i.name,total:0,done:0};s.total++;if(r.status?.[i.id]==='done')s.done++})}return Object.values(stats).filter(x=>x.total>=3&&x.done<x.total).sort((a,b)=>a.done/a.total-b.done/b.total).slice(0,3)}
function historyModal(k){if(k>state.date){toast('Future days are not available.');return}const d=new Date(k+'T12:00:00'),r=getRec(k),a=achievedFor(r,d.getDay());if(k===state.date){toast('Today is already on screen.');return}const items=itemsFor(d.getDay(),r),done=items.filter(i=>r?.status?.[i.id]==='done').length,sk=items.filter(i=>r?.status?.[i.id]==='skipped').length,mi=items.filter(i=>r?.status?.[i.id]==='missed').length;openModal(`<div class="sheet"><h2>${DAY_LONG[d.getDay()]} · ${d.getDate()} ${MONTHS[d.getMonth()]}</h2><p>${a?`Achieved: <b>${TIER_LABEL[a]}</b>`:'No tier achieved'} · ${done} done · ${sk} skipped · ${mi} missed${r?.changed?' · target adjusted':''}</p><div class="settings-section"><h3>Recorded blocks</h3>${items.map(i=>{const raw=r?.status?.[i.id]||null;const s={done:'Done',skipped:'Skipped',missed:'Missed'}[raw]||'Not recorded';return `<div class="statline"><span>${esc(i.name)}</span><span>${s}</span></div>`}).join('')}</div><div class="actions"><button class="btn" data-close>Close</button></div></div>`)}
function repairYesterday(){const y=addDays(today(),-1),k=dateKey(y),r=getRec(k);if(y.getDay()===0){toast('Sunday is not tracked.');return}if(r&&Object.keys(r.status||{}).length){toast('Yesterday already has a record. Do not rewrite it.');return}openModal(`<div class="sheet"><h2>Repair ${DAY_NAMES[y.getDay()]} ${y.getDate()} ${MONTHS[y.getMonth()]}</h2><p>Use this only when you genuinely forgot to log the day. This creates a transparent late-log record; it does not erase the missed day from your history.</p><div class="actions"><button class="btn primary" data-repair="floor">Mark Floor achieved</button><button class="btn" data-close>Leave unchanged</button></div></div>`)}
function applyRepair(){const y=addDays(today(),-1),k=dateKey(y),r={target:'floor',status:{},committed:true,changed:true,changeReason:'Late log repair',routineSnapshot:clone(routine()),repairedAt:new Date().toISOString()};upTo(y.getDay(),'floor',r).forEach(i=>r.status[i.id]='done');state.days[k]=r;saveRec(k);closeModal();recalcStreak();render();toast('Yesterday repaired transparently as Floor.')}
function settingsHTML(){const all=routine().flatMap(c=>c.items.filter(i=>!i.anchor));return `<div class="sheet"><h2>Settings</h2><p>Routine editing is a weekly-review tool. Keep the system stable long enough to learn from it.</p><div class="settings-section"><h3>Reminders</h3><div class="row"><label>Lead time</label><select id="lead"><option value="0">At start</option><option value="5">5 min</option><option value="10">10 min</option><option value="15">15 min</option></select></div><div class="row"><label>Enabled</label><button class="btn small" data-reminders="toggle">${state.reminders?'On':'Off'}</button></div><p>Notifications are best-effort while the app is active. Browser/OS background scheduling varies by platform; there is no server.</p></div><div class="settings-section"><h3>Routine editor</h3><div style="font-size:9px;color:var(--muted);margin-bottom:8px">Changes apply to new/current records. Existing records keep their routine snapshot.</div>${all.map(i=>`<div class="routine-row"><input data-rid="${i.id}" data-field="name" value="${esc(i.name)}"><input data-rid="${i.id}" data-field="at" type="time" value="${i.at}"><input data-rid="${i.id}" data-field="end" type="time" value="${i.end||i.at}"><select data-rid="${i.id}" data-field="tier"><option value="floor" ${i.tier==='floor'?'selected':''}>floor</option><option value="standard" ${i.tier==='standard'?'selected':''}>standard</option><option value="full" ${i.tier==='full'?'selected':''}>full</option></select><button class="iconbtn" style="width:32px;height:32px" data-reset-task="${i.id}" aria-label="Reset task">↺</button></div>`).join('')}<button class="btn primary" style="width:100%;margin-top:9px" data-save-routine>Save routine</button></div><div class="settings-section"><h3>Data</h3><p>Last backup: ${state.lastBackup?new Date(state.lastBackup).toLocaleString():'Never'}</p><div class="actions"><button class="btn" data-act="export">Export backup</button><button class="btn" data-act="import">Import backup</button></div></div><div class="actions"><button class="btn" data-close>Close</button></div></div>`}
function openModal(html){const m=$('#modal');if(!m)return false;try{m.innerHTML=html;m.classList.add('open');const lead=$('#lead');if(lead)lead.value=String(state.notifyLead);return true}catch(err){console.error('Modal render failed',err);toast('Could not open this panel.');return false}}
function openSettings(){try{const html=settingsHTML();if(!html)throw new Error('Empty settings view');return openModal(html)}catch(err){console.error('Settings failed to open',err);toast('Settings could not open. Please reload the app.');return false}}
function closeModal(){clearInterval(focusTimer);const m=$('#modal');m.classList.remove('open');m.innerHTML=''}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('show'),2400)}
function focusModal(id){const now=today(),it=itemsFor(now.getDay(),getRec()).find(x=>x.id===id)||SUNDAY_ITEM;if(!it)return;const nm=now.getHours()*60+now.getMinutes();if(mins(it.at)>nm){toast('Wait until this block starts.');return}const remaining=Math.max(1,(mins(it.end||it.at)-Math.max(nm,mins(it.at)))*60000);focusEnd=Date.now()+remaining;openModal(`<div class="sheet"><div class="focus-task">${esc(it.name)}</div><div class="focus-time" id="focusTime">00:00</div><div class="focus-note">One block. No dashboard. Execute the current task.</div><div class="actions"><button class="btn primary" data-done="${esc(id)}">✓ Finish</button><button class="btn" data-close>Exit focus</button></div></div>`);clearInterval(focusTimer);focusTimer=setInterval(updateFocus,500);updateFocus()}
function updateFocus(){const el=$('#focusTime');if(!el)return;const ms=Math.max(0,focusEnd-Date.now()),sec=Math.ceil(ms/1000);el.textContent=`${pad2(Math.floor(sec/60))}:${pad2(sec%60)}`;if(ms<=0)clearInterval(focusTimer)}
function scheduleReminder(){clearTimeout(scheduleReminder.timer);if(!state.reminders)return;const n=nextUp();if(!n.item||n.kind!=='up')return;const ms=Math.max(0,n.inMin*60000-state.notifyLead*60000);scheduleReminder.timer=setTimeout(()=>notify(`Next: ${n.item.name}`,`${fmt(n.item.at)} starts in ${state.notifyLead} min.`),ms)}
async function enableNotifications(){if(!('Notification'in window)){toast('Notifications are not supported here.');return}const p=await Notification.requestPermission();toast(p==='granted'?'Notifications enabled.':'Notification permission not granted.')}
function notify(title,body){if('Notification'in window&&Notification.permission==='granted')new Notification(title,{body});toast(`${title} · ${body}`)}
function snapshot(){const data={backupVersion:STORAGE_VERSION,appVersion:VERSION,exportedAt:new Date().toISOString(),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,meta:storageGet('meta',{}),days:{}};for(let i=0;i<800;i++){const d=addDays(today(),-i),k=dateKey(d),r=storageGet('day:'+k,null);if(r)data.days[k]=r}return data}
function exportData(){state.lastBackup=new Date().toISOString();saveMeta();const blob=new Blob([JSON.stringify(snapshot(),null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`discipline-ladder-${state.date}-backup.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500);toast('Backup exported.')}
function importData(text){let obj;try{obj=JSON.parse(text)}catch{toast('Not a valid JSON backup.');return}if(!obj||!obj.meta||!obj.days){toast('Not a Discipline Ladder backup.');return}if(!confirm(`Restore ${Object.keys(obj.days).length} day records? Matching records will be replaced.`))return;storageSet('meta',obj.meta);for(const[k,v]of Object.entries(obj.days)){if(/^\d{4}-\d{2}-\d{2}$/.test(k))storageSet('day:'+k,v)}load();toast('Backup restored.')}
function routineSave(){const r=clone(routine());let skipped=0;const timeOk=v=>/^\d{2}:\d{2}$/.test(v);for(const el of $$('[data-rid]')){const item=r.flatMap(c=>c.items).find(x=>x.id===el.dataset.rid);if(!item)continue;const f=el.dataset.field,v=el.value;if(f==='name'&&!v.trim()){skipped++;continue}if((f==='at'||f==='end')&&!timeOk(v)){skipped++;continue}item[f]=f==='name'?v.trim():v}for(const ch of r)for(const it of ch.items){if(it.end&&mins(it.end)<mins(it.at)){it.end=it.at;skipped++}}state.routine=r;saveMeta();closeModal();toast(skipped?`Routine saved. ${skipped} invalid field(s) kept unchanged.`:'Routine saved.');render()}
function resetTask(id){const d=clone(DEFAULT_CHAINS).flatMap(c=>c.items).find(x=>x.id===id),item=state.routine.flatMap(c=>c.items).find(x=>x.id===id);if(d&&item)Object.assign(item,d);openModal(settingsHTML())}
function footerHTML(){const install=deferredInstallPrompt?`<div class="install show"><span>Install Discipline Ladder as an app</span><button class="btn primary small" data-install>Install</button></div>`:'';return `${install}<div class="footer"><button class="btn" data-act="export">Export backup</button><button class="btn" data-act="import">Import backup</button><button class="btn" data-act="notify">Enable notifications</button></div><div class="ver">Discipline Ladder ${VERSION} · local-first</div>`}
function render(){const app=$('#app'),now=today(),dow=now.getDay(),dateStr=`${DAY_NAMES[dow]} ${now.getDate()} ${MONTHS[now.getMonth()]}`;if(dow===0){app.innerHTML=`<header class="top"><div><div class="eyebrow">${dateStr} · recovery day</div><h1>Sunday</h1><div class="sub">Recover, review, prepare. No catch-up debt.</div></div><button type="button" class="iconbtn" data-settings aria-label="Settings">⚙</button></header><div class="grid"><main class="maincol"><div id="hero">${heroHTML()}</div>${statusPanel()}<section class="panel"><div class="panel-title">Monday protection</div><div class="side-copy">Lights out by 9:00. The goal is to make Monday's first action easy, not to repay missed work.</div><button class="btn primary" style="width:100%;margin-top:10px" data-focus="sun_sleep">Protect sleep</button></section>${reviewHTML()}</main><aside class="sidecol"><div class="side-sticky"><section class="panel"><div class="panel-title">Recovery rule</div><div class="side-copy"><b>Never miss twice.</b><br>A missed day is data, not debt. Recover with the next minimum action.</div></section></div></aside></div>${footerHTML()}`;return}
 const sc=upTo(dow,'full').filter(i=>TIER_ORDER[i.tier]>TIER_ORDER[state.target]&&status(i.id)!=='done').length;app.innerHTML=`<header class="top"><div><div class="eyebrow">${dateStr}${dow===6?' · weekly review day':''}</div><h1>${DAY_LONG[dow]}</h1><div class="sub">One block at a time. Floor is enough to recover.</div></div><button type="button" class="iconbtn" data-settings aria-label="Settings">⚙</button></header><div class="targetbar">${TIERS.map(t=>{const p=targetProgress(t);return `<button class="target ${state.target===t?'active':''} ${p.met?'met':''}" data-tier="${t}" aria-pressed="${state.target===t}"><b>${TIER_LABEL[t]}</b><span>${TIER_SUB[t]}</span><span class="count">${p.met?'✓ ':''}${p.done}/${p.total}</span></button>`}).join('')}</div><div class="commitbar"><span class="label">Today's target: <b>${TIER_LABEL[state.target]}</b></span>${state.targetLocked?'<span class="pill">committed</span>':'<button class="btn small primary" data-commit="'+state.target+'">Commit target</button>'}<span class="locknote">Choose once. Upgrade intentionally. Downgrade only when reality genuinely changes.</span></div><div class="grid"><main class="maincol"><div id="hero">${heroHTML()}</div>${statusPanel()}${chainsFor(dow,getRec()).map(chainHTML).join('')}${sc?`<button class="btn" style="width:100%;margin-bottom:16px" data-act="stretch">${state.showStretch?'Hide':'Show'} ${sc} optional stretch item${sc>1?'s':''}</button>`:''}${reviewHTML()}</main><aside class="sidecol"><div class="side-sticky"><section class="panel"><div class="panel-title">System rule</div><div class="side-copy"><b>Never miss twice.</b><br>One bad day is tolerated. Two consecutive unachieved days reset the streak. No catch-up debt.</div></section><section class="panel"><div class="panel-title">Need less?</div><div class="side-copy">Use Floor when the day is genuinely constrained. A downgrade is recorded so the weekly review can distinguish adaptation from drift.</div><button class="btn" style="width:100%;margin-top:9px" data-downgrade>Downgrade to Floor</button></section></div></aside></div>${footerHTML()}`}
const ACTION_SELECTOR='[data-tier],[data-done],[data-focus],[data-task],[data-menu],[data-settings],[data-act],[data-commit],[data-raise],[data-downgrade],[data-close],[data-confirm-downgrade],[data-mark],[data-reminders],[data-save-routine],[data-reset-task],[data-repair-yesterday],[data-repair],[data-install],[data-history],[data-open-review]';
function actionTarget(target){return target?.closest?.(ACTION_SELECTOR)||null}
function hasData(el,key){return Object.prototype.hasOwnProperty.call(el.dataset,key)}
function handleActionClick(e){
 const t=actionTarget(e.target); if(!t)return;
 // One document-level dispatcher is intentional: #app is re-rendered and #modal is outside it.
 // Capture-phase handling makes navigation/actions resilient to DOM replacement.
 if(hasData(t,'close')){e.preventDefault();closeModal();return}
 if(hasData(t,'settings')){e.preventDefault();e.stopPropagation();openSettings();return}
 if(t.dataset.tier){requestTarget(t.dataset.tier);return}
 if(t.dataset.commit){commitTarget(t.dataset.commit);return}
 if(t.dataset.done){mark(t.dataset.done,'done');if($('#modal')?.classList.contains('open'))closeModal();return}
 if(t.dataset.focus){focusModal(t.dataset.focus);return}
 if(t.dataset.task){const it=itemsFor(today().getDay(),getRec()).find(x=>x.id===t.dataset.task);if(it){const nm=today().getHours()*60+today().getMinutes();if(mins(it.at)<=nm)focusModal(it.id);else taskMenu(it.id)}return}
 if(t.dataset.menu){taskMenu(t.dataset.menu);return}
 if(hasData(t,'install')&&deferredInstallPrompt){deferredInstallPrompt.prompt();deferredInstallPrompt.userChoice.finally(()=>{deferredInstallPrompt=null;render()});return}
 if(t.dataset.raise){commitTarget(t.dataset.raise);return}
 if(hasData(t,'downgrade')){requestTarget('floor');return}
 if(t.dataset.confirmDowngrade){const r=ensureRec();r.changed=true;r.target=t.dataset.confirmDowngrade;r.committed=true;r.changeReason=$('#downgradeReason')?.value||'Unspecified';saveRec();state.target=r.target;state.prefTier=r.target;saveMeta();closeModal();toast('Target downgraded deliberately.');render();return}
 if(t.dataset.repair){applyRepair();return}
 if(hasData(t,'repairYesterday')){repairYesterday();return}
 if(t.dataset.history){historyModal(t.dataset.history);return}
 if(t.dataset.mark){if(t.dataset.mark==='clear'){clearStatus(t.dataset.id);closeModal()}else{mark(t.dataset.id,t.dataset.mark);closeModal()}return}
 if(t.dataset.act==='stretch'){state.showStretch=!state.showStretch;render();return}
 if(t.dataset.act==='export'){exportData();return}
 if(t.dataset.act==='import'){$('#importFile')?.click();return}
 if(t.dataset.act==='notify'){enableNotifications();return}
 if(t.dataset.reminders==='toggle'){state.reminders=!state.reminders;saveMeta();openSettings();scheduleReminder();return}
 if(hasData(t,'openReview')){e.preventDefault();state.reviewOpen=true;render();requestAnimationFrame(()=>$('.details')?.scrollIntoView({behavior:'smooth',block:'start'}));return}
 if(hasData(t,'saveRoutine')){routineSave();return}
 if(t.dataset.resetTask){resetTask(t.dataset.resetTask);return}
}
document.addEventListener('click',handleActionClick,true);
document.addEventListener('toggle',e=>{if(e.target?.classList?.contains('details'))state.reviewOpen=e.target.open},true);
document.addEventListener('change',e=>{if(e.target?.id==='lead'){state.notifyLead=Number(e.target.value);saveMeta();scheduleReminder()}});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#modal')?.classList.contains('open')){e.preventDefault();closeModal()}});
$('#importFile').addEventListener('change',async e=>{const f=e.target.files[0];if(f)importData(await f.text());e.target.value=''});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e;render()});document.addEventListener('visibilitychange',()=>{if(!document.hidden){if(dateKey(today())!==state.date)load();else{recalcStreak();render();scheduleReminder()}}});setInterval(()=>{if(dateKey(today())!==state.date)load();else{const h=$('#hero');if(h)h.innerHTML=heroHTML();scheduleReminder()}},30000);
if('serviceWorker'in navigator)window.addEventListener('load',async()=>{try{const reg=await navigator.serviceWorker.register('sw.js');reg.update();}catch(err){console.warn(err)}});
load();
