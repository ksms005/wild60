import React,{useEffect,useMemo,useState} from 'react';
import {Flame,Target,CheckCircle2,AlertTriangle,CalendarDays,TrendingUp,ArrowRight,Star,ClipboardCheck} from 'lucide-react';
import {supabase} from './supabase';
const activeRock=r=>!['locked_in','dropped'].includes(r.status);
const dateText=d=>d?new Date(d+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'No due date';
const overdue=d=>Boolean(d&&d<new Date().toISOString().slice(0,10));
export default function WildDashboardPanel({session,company,people,rocks,todos,milestones,pressurePoints,onNavigate}){
 const [meeting,setMeeting]=useState(null);
 useEffect(()=>{let live=true;if(!company?.id)return;supabase.from('meetings').select('id,rating_average,ended_at,created_at').eq('company_id',company.id).order('ended_at',{ascending:false}).limit(1).then(({data,error})=>{if(live){if(error)console.error('Dashboard meeting:',error);setMeeting(data?.[0]||null)}});return()=>{live=false}},[company?.id]);
 const me=people.find(p=>p.user_id===session.user.id);
 const active=rocks.filter(activeRock),openTodos=todos.filter(t=>!t.completed),openPoints=pressurePoints.filter(p=>!p.resolved);
 const recentDone=todos.filter(t=>t.completed&&t.updated_at&&new Date(t.updated_at).getTime()>=Date.now()-7*86400000).length;
 const onTrack=active.filter(r=>r.status==='executing'&&!overdue(r.due_date)).length;
 const owned=active.filter(r=>r.owner_person_id===me?.id);
 const priorities=[...owned,...active.filter(r=>r.owner_person_id!==me?.id)].sort((a,b)=>(a.due_date||'9999').localeCompare(b.due_date||'9999')).slice(0,3);
 const points=openPoints.slice(0,4);
 return <section className="workspace wildDashboard commandDashboard">
  <div className="workspaceHead"><div><span className="eyebrow">YOUR WORKSPACE</span><h2>MY DASHBOARD</h2><p>Welcome back{me?.full_name?', '+me.full_name.split(' ')[0]:''}. Your team's progress, priorities, and momentum.</p></div><button className="primary" onClick={()=>onNavigate('meetingPicker')}><Flame/> START A MEETING</button></div>
  <div className="dashboardTiles commandTiles">
   <button className="dashboardTile" onClick={()=>onNavigate('rocks')}><Target size={19}/><span>Active Rocks</span><strong>{active.length}</strong><small>Company priorities <ArrowRight size={13}/></small></button>
   <button className="dashboardTile" onClick={()=>onNavigate('todos')}><ClipboardCheck size={19}/><span>Open To-Dos</span><strong>{openTodos.length}</strong><small>Team commitments <ArrowRight size={13}/></small></button>
   <button className="dashboardTile" onClick={()=>onNavigate('pressure')}><AlertTriangle size={19}/><span>Pressure Points</span><strong>{openPoints.length}</strong><small>Need decisions <ArrowRight size={13}/></small></button>
  </div>
  <div className="commandColumns">
   <section className="commandCard"><div className="commandCardTitle"><h3>NEEDS ATTENTION</h3><span>{openPoints.length} open</span></div>{points.length?points.map(p=><button type="button" key={p.id} className="commandListItem" onClick={()=>onNavigate('pressure')}><AlertTriangle size={17}/><span>{p.title}</span><small>Open</small><ArrowRight size={15}/></button>):<div className="commandEmpty"><CheckCircle2 size={20}/> No open Pressure Points. Nice work!</div>}<button className="commandFooter" onClick={()=>onNavigate('pressure')}>VIEW PRESSURE POINTS <ArrowRight size={14}/></button></section>
   <section className="commandCard"><div className="commandCardTitle"><h3>COMPANY PRIORITIES</h3><span>{active.length} active</span></div>{priorities.length?priorities.map(r=>{const ms=milestones.filter(m=>m.rock_id===r.id),done=ms.filter(m=>m.completed).length;return <button type="button" key={r.id} className="commandPriority" onClick={()=>onNavigate('rocks')}><span className="commandEyebrow">ACTIVE ROCK</span><strong>{r.title}</strong><small><CalendarDays size={13}/> {dateText(r.due_date)}{overdue(r.due_date)?' · Overdue':''}</small>{ms.length>0&&<><div className="commandProgress"><span style={{width:done/ms.length*100+'%'}}/></div><small>{done} of {ms.length} milestones complete</small></>}</button>}):<div className="commandEmpty">No active company Rocks.</div>}<button className="commandFooter" onClick={()=>onNavigate('rocks')}>VIEW ALL ROCKS <ArrowRight size={14}/></button></section>
  </div>
  <section className="commandCard commandMomentum"><div className="commandCardTitle"><h3>TEAM MOMENTUM</h3><span>Live company snapshot</span></div><div className="commandMomentumGrid"><button onClick={()=>onNavigate('todos')}><CheckCircle2 size={18}/><strong>{recentDone}</strong><span>To-Dos completed in the last 7 days*</span></button><button onClick={()=>onNavigate('rocks')}><TrendingUp size={18}/><strong>{onTrack} <small>/ {active.length}</small></strong><span>Rocks executing and not overdue</span></button><button onClick={()=>onNavigate('history')}><Star size={18}/><strong>{meeting?.rating_average!=null?Number(meeting.rating_average).toFixed(1):'—'}</strong><span>Latest saved meeting rating</span></button></div><p className="commandFinePrint">*Based on available To-Do update timestamps; this may include tasks edited after completion.</p></section>
 </section>;
}
