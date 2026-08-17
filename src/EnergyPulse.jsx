import React,{useEffect,useMemo,useState}from'react';
import{Activity,TrendingUp}from'lucide-react';
import{supabase}from'./supabase';

function weekKey(date){const d=new Date(date);const day=d.getDay();d.setDate(d.getDate()-day);d.setHours(0,0,0,0);return d.toISOString().slice(0,10)}
function weekLabel(key){return new Date(`${key}T12:00:00`).toLocaleDateString('en-US',{month:'short',day:'numeric'})}

export default function EnergyPulse({company,people,ratings,onChange}){
 const[history,setHistory]=useState([]);
 useEffect(()=>{load()},[company?.id]);
 async function load(){if(!company?.id)return;const{data,error}=await supabase.from('energy_pulse_ratings').select('rating,rated_at').eq('company_id',company.id).order('rated_at',{ascending:false}).limit(500);if(error){console.error(error);return}setHistory(data||[])}
 const teamAverage=useMemo(()=>{const vals=people.map(p=>Number(ratings[p.id])).filter(v=>Number.isFinite(v));return vals.length?(vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1):'—'},[people,ratings]);
 const trend=useMemo(()=>{const grouped={};history.forEach(r=>{const key=weekKey(r.rated_at);(grouped[key] ||= []).push(Number(r.rating))});return Object.entries(grouped).map(([key,vals])=>({key,avg:vals.reduce((a,b)=>a+b,0)/vals.length})).sort((a,b)=>a.key.localeCompare(b.key)).slice(-8)},[history]);
 return <section className="energyPulsePanel"><div className="energyPulseHead"><div><span className="eyebrow">ENERGY PULSE</span><h2>HOW'S THE TEAM SHOWING UP?</h2><p>Rate the energy in the room from 1.0 to 5.0. Decimals are welcome — 3.7 is different from 4.0.</p></div><div className="energyAverage"><Activity/><div><span>TEAM ENERGY</span><b>{teamAverage}</b><small>/ 5.0</small></div></div></div><div className="energyPeople">{people.map(p=><div className="energyPerson" key={p.id}><div><b>{p.full_name}</b><span>{p.title||'Team Member'}</span></div><div className="energyInputWrap"><input type="number" min="1" max="5" step="0.1" inputMode="decimal" value={ratings[p.id]??''} onChange={e=>{const raw=e.target.value;if(raw==='')return onChange(p.id,'');const n=Math.max(1,Math.min(5,Number(raw)));onChange(p.id,Number.isFinite(n)?Math.round(n*10)/10:'')}} placeholder="—"/><small>/ 5</small></div></div>)}</div><div className="energyTrend"><div className="energyTrendTitle"><TrendingUp/><div><b>TEAM ENERGY TREND</b><span>Weekly average from saved Wild60 meetings</span></div></div>{!trend.length?<p className="muted">Your weekly trend will begin after you save your first Energy Pulse.</p>:<div className="energyTrendGrid">{trend.map(w=><div className="energyWeek" key={w.key}><span>{weekLabel(w.key)}</span><div className="energyBar"><i style={{width:`${(w.avg/5)*100}%`}}/></div><b>{w.avg.toFixed(1)}</b></div>)}</div>}</div></section>
}
