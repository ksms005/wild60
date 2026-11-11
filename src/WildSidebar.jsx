import React from 'react';
import {Flame,HeartPulse,History,Target,ClipboardCheck,AlertTriangle,BarChart3,Users,Building2} from 'lucide-react';

const GROUPS=[
  {title:'MY WORKSPACE',items:[['dashboard','My Dashboard',BarChart3],['mywork','My Work',ClipboardCheck]]},
  {title:'MEET & CONNECT',items:[['meetingPicker','Meetings',Flame],['pulse','Wild Pulse',HeartPulse],['history','Meeting History',History]]},
  {title:'EXECUTION',items:[['rocks','Rocks',Target],['todos','To-Dos',ClipboardCheck],['pressure','Pressure Points',AlertTriangle],['scorecard','Vital Signs',HeartPulse]]},
  {title:'ORGANIZATION',items:[['org','Org Chart',Users],['team','People & Access',Users]]},
  {title:'ADMINISTRATION',items:[['activity','Activity History',History],['company','Company Settings',Building2]]}
];
export default function WildSidebar({tab,onNavigate,canViewAudit,canManageTeam}){
  return <nav className="wildSidebarNav" aria-label="Main navigation">
    {GROUPS.map(group=>{
      const items=group.items.filter(([id])=>(id!=='activity'||canViewAudit)&&(id!=='company'||canManageTeam));
      if(!items.length)return null;
      return <section className="wildSidebarGroup" key={group.title}>
        <div className="wildSidebarHeading">{group.title}</div>
        {items.map(([id,label,Icon])=>{
          const active=id==='meetingPicker'?['meetingPicker','meeting','wild1'].includes(tab):tab===id;
          return <button type="button" key={id} className={'wildSidebarLink'+(active?' active':'')} onClick={()=>onNavigate(id)} aria-current={active?'page':undefined} aria-label={label}>
            <Icon aria-hidden="true" size={18}/><span className="wildSidebarLabel">{label}</span>
          </button>;
        })}
      </section>;
    })}
  </nav>;
}
