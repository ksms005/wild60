import React,{useEffect,useMemo,useState} from 'react';
import {Flame,Target,CheckCircle2,AlertTriangle,CalendarDays,TrendingUp,TrendingDown,Minus,ArrowRight,Star,ClipboardCheck} from 'lucide-react';
import {supabase} from './supabase';
const activeRock=r=>!['locked_in','dropped'].includes(r.status);
const dateText=d=>d?new Date(d+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'No due date';
const today=()=>new Date().toLocaleDateString('en-CA',{year:'numeric',month:'2-digit',day:'2-digit'});
const daysUntil=d=>{if(!d)return null;const [y,m,day]=d.split('-').map(Number);return Math.round((Date.UTC(y,m-1,day)-Date.UTC(...today().split('-').map((v,i)=>i===1?Number(v)-1:Number(v))))/86400000)};
const overdue=d=>daysUntil(d)!==null&&daysUntil(d)<0;
const deadline=d=>{const n=daysUntil(d);return n===null?null:n<0?{label:`Overdue ${-n}d`,tone:'late'}:n===0?{label:'Due today',tone:'soon'}:n<=7?{label:`Due in ${n}d`,tone:'soon'}:null};
export default function WildDashboardPanel({session,company,people,rocks,todos,milestones,pressurePoints,onNavigate}){
 const [meetings,setMeetings]=useState([]);
 useEffect(()=>{let live=true;if(!company?.id)return;supabase.from('meetings').select('id,rating_average,ended_at,created_at').eq('company_id',company.id).eq('status','completed').not('rating_average','is',null).order('ended_at',{ascending:false}).limit(2).then(({data,error})=>{if(live){if(error)console.error('Dashboard meeting:',error);setMeetings(data||[])}});return()=>{live=false}},[company?.id]);
 const me=people.find(p=>p.user_id===session.user.id);
 const active=rocks.filter(activeRock),openTodos=todos.filter(t=>!t.completed),openPoints=pressurePoints.filter(p=>!p.resolved);
 const recentDone=todos.filter(t=>t.completed&&t.completed_at&&new Date(t.completed_at).getTime()>=Date.now()-7*86400000).length;
 const onTrack=active.filter(r=>r.status==='executing'&&!overdue(r.due_date)).length;
 const meeting=meetings[0],previous=meetings[1],ratingDelta=meeting&&previous?Number(meeting.rating_average)-Number(previous.rating_average):null;
 const owned=active.filter(r=>r.owner_person_id===me?.id);
 const priorities=[...owned,...active.filter(r=>r.owner_person_id!==me?.id)].sort((a,b)=>(a.due_date||'9999').localeCompare(b.due_date||'9999')).slice(0,3);
 const attention=[
 ...active.filter(r=>r.status==='drifting'||overdue(r.due_date)).map(r=>({id:'r'+r.id,title:r.title,type:'Rock',label:r.status==='drifting'?'Drifting':'Overdue Rock',priority:overdue(r.due_date)?0:2,due:r.due_date,tab:'rocks'})),
 ...todos.filter(t=>!t.completed&&overdue(t.due_date)).map(t=>({id:'t'+t.id,title:t.title,type:'To-Do',label:'Overdue To-Do',priority:0,due:t.due_date,tab:'todos'})),
 ...milestones.filter(m=>!m.completed&&overdue(m.due_date)).map(m=>({id:'m'+m.id,title:m.title,type:'Milestone',label:'Overdue Milestone',priority:0,due:m.due_date,tab:'rocks'})),
 ...openPoints.map(p=>({id:'p'+p.id,title:p.title,type:'Pressure Point',label:'Needs decision',priority:3,due:null,tab:'pressure'})),
 ...active.filter(r=>r.status!=='drifting'&&deadline(r.due_date)?.tone==='soon').map(r=>({id:'sr'+r.id,title:r.title,type:'Rock',label:deadline(r.due_date).label,priority:4,due:r.due_date,tab:'rocks'})),
 ...todos.filter(t=>!t.completed&&deadline(t.due_date)?.tone==='soon').map(t=>({id:'st'+t.id,title:t.title,type:'To-Do',label:deadline(t.due_date).label,priority:4,due:t.due_date,tab:'todos'})),
 ...milestones.filter(m=>!m.completed&&deadline(m.due_date)?.tone==='soon').map(m=>({id:'sm'+m.id,title:m.title,type:'Milestone',label:deadline(m.due_date).label,priority:4,due:m.due_date,tab:'rocks'}))
 ].sort((a,b)=>a.priority-b.priority||(a.due||'9999').localeCompare(b.due||'9999'));
 const urgent=attention.slice(0,5);
 return <section className="workspace wildDashboard commandDashboard">
  <div className="workspaceHead"><div><span className="eyebrow">YOUR WORKSPACE</span><h2>MY DASHBOARD</h2><p>Welcome back{me?.full_name?', '+me.full_name.split(' ')[0]:''}. Your team's progress, priorities, and momentum.</p></div><button className="primary" onClick={()=>onNavigate('meetingPicker')}><Flame/> START A MEETING</button></div>
  <div className="dashboardTiles commandTiles">
   <button className="dashboardTile" onClick={()=>onNavigate('rocks')}><Target size={19}/><span>Active Rocks</span><strong>{active.length}</strong><small>Company priorities <ArrowRight size={13}/></small></button>
   <button className="dashboardTile" onClick={()=>onNavigate('todos')}><ClipboardCheck size={19}/><span>Open To-Dos</span><strong>{openTodos.length}</strong><small>Team commitments <ArrowRight size={13}/></small></button>
   <button className="dashboardTile" onClick={()=>onNavigate('pressure')}><AlertTriangle size={19}/><span>Pressure Points</span><strong>{openPoints.length}</strong><small>Need decisions <ArrowRight size={13}/></small></button>
  </div>
  <div className="commandColumns">
   <section className="commandCard"><div className="commandCardTitle"><h3>NEEDS ATTENTION</h3><span>{attention.length} items</span></div>{urgent.length?urgent.map(item=><button type="button" key={item.id} className="commandListItem" onClick={()=>onNavigate(item.tab)}><AlertTriangle size={17}/><span>{item.title}<em className="commandAttentionType">{item.type}</em></span><small className={item.priority===0?'commandLate':item.priority===4?'commandSoon':''}>{item.label}</small><ArrowRight size={15}/></button>):<div className="commandEmpty"><CheckCircle2 size={20}/> No urgent commitments or Pressure Points.</div>}<button className="commandFooter" onClick={()=>onNavigate('pressure')}>VIEW PRESSURE POINTS <ArrowRight size={14}/></button></section>
   <section className="commandCard"><div className="commandCardTitle"><h3>COMPANY PRIORITIES</h3><span>{active.length} active</span></div>{priorities.length?priorities.map(r=>{const ms=milestones.filter(m=>m.rock_id===r.id),done=ms.filter(m=>m.completed).length;return <button type="button" key={r.id} className="commandPriority" onClick={()=>onNavigate('rocks')}><span className="commandEyebrow">{r.status==='drifting'?'DRIFTING':'ACTIVE ROCK'} <span className={deadline(r.due_date)?.tone==='late'?'commandLate':'commandSoon'}>{deadline(r.due_date)?.label||''}</span></span><strong>{r.title}</strong><small><CalendarDays size={13}/> {dateText(r.due_date)}{overdue(r.due_date)?' · Overdue':''}</small>{ms.length>0&&<><div className="commandProgress"><span style={{width:done/ms.length*100+'%'}}/></div><small>{done} of {ms.length} milestones complete · {ms.length-done} remaining · {Math.round(done/ms.length*100)}%</small></>}</button>}):<div className="commandEmpty">No active company Rocks.</div>}<button className="commandFooter" onClick={()=>onNavigate('rocks')}>VIEW ALL ROCKS <ArrowRight size={14}/></button></section>
  </div>
  <section className="commandCard commandMomentum"><div className="commandCardTitle"><h3>TEAM MOMENTUM</h3><span>Live company snapshot</span></div><div className="commandMomentumGrid"><button onClick={()=>onNavigate('todos')}><CheckCircle2 size={18}/><strong>{recentDone}</strong><span>To-Dos completed in the last 7 days</span></button><button onClick={()=>onNavigate('rocks')}><TrendingUp size={18}/><strong>{onTrack} <small>/ {active.length}</small></strong><span>Rocks executing and not overdue</span></button><button onClick={()=>onNavigate('history')} aria-label={ratingDelta===null?'Latest meeting rating':ratingDelta>0?'Latest meeting rating improved':ratingDelta<0?'Latest meeting rating declined':'Latest meeting rating unchanged'}>{ratingDelta===null?<Star size={18}/>:ratingDelta>0?<TrendingUp size={18} color="#22C55E" aria-label="Rating increased"/>:ratingDelta<0?<TrendingDown size={18} color="#EF4444" aria-label="Rating decreased"/>:<Minus size={18} color="#EAB308" aria-label="Rating unchanged"/>}<strong>{meeting?.rating_average!=null?Number(meeting.rating_average).toFixed(2):'—'}</strong><span>Last meeting rating</span><small className="commandPreviousRating">{previous?.rating_average!=null?`Previous meeting: ${Number(previous.rating_average).toFixed(2)}`:'No previous rating yet'}</small></button></div><p className="commandFinePrint">Completed To-Dos use their recorded completion date. Meeting trends compare the latest two rated meetings.</p></section>
 </section>;
}
