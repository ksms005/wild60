const json=(res,status,body)=>res.status(status).json(body);

function outputText(data){
  if(data.output_text)return data.output_text;
  return (data.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('\n');
}
function esc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function list(items,render){return items?.length?`<ul>${items.map(x=>`<li>${render(x)}</li>`).join('')}</ul>`:'<p style="color:#777">None.</p>';}
function dateLabel(v){if(!v)return'No due date';const d=new Date(`${v}T12:00:00`);return Number.isNaN(d.getTime())?v:d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});}
async function rest(url,key,token,table,companyId,select){
  const r=await fetch(`${url}/rest/v1/${table}?company_id=eq.${encodeURIComponent(companyId)}&select=${encodeURIComponent(select)}`,{headers:{apikey:key,Authorization:`Bearer ${token}`}});
  if(!r.ok)throw new Error(`Could not load ${table} from Wild60.`);
  return r.json();
}

export default async function handler(req,res){
  if(req.method!=='POST')return json(res,405,{error:'Method not allowed'});
  try{
    const token=(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
    if(!token)return json(res,401,{error:'Sign in required'});
    const supabaseUrl=process.env.VITE_SUPABASE_URL;
    const supabaseKey=process.env.VITE_SUPABASE_PUBLISHABLE_KEY||process.env.VITE_SUPABASE_ANON_KEY;
    const openaiKey=process.env.OPENAI_API_KEY;
    if(!supabaseUrl||!supabaseKey)return json(res,503,{error:'Wild Recap needs the Supabase URL and publishable key in Vercel.'});
    if(!openaiKey)return json(res,503,{error:'Wild Recap needs OPENAI_API_KEY in Vercel.'});
    const auth=await fetch(`${supabaseUrl}/auth/v1/user`,{headers:{apikey:supabaseKey,Authorization:`Bearer ${token}`}});
    if(!auth.ok)return json(res,401,{error:'Invalid Wild60 session'});

    const {signed_url,filename='wild60.webm',company,meeting_score=null}=req.body||{};
    const companyId=company?.id;
    if(!signed_url)return json(res,400,{error:'Missing recording URL'});
    if(!companyId)return json(res,400,{error:'Missing company workspace'});

    const [people,rocks,todos,pressurePoints]=await Promise.all([
      rest(supabaseUrl,supabaseKey,token,'company_people',companyId,'id,full_name,email,title,user_id'),
      rest(supabaseUrl,supabaseKey,token,'rocks',companyId,'id,title,description,owner_person_id,due_date,status'),
      rest(supabaseUrl,supabaseKey,token,'todos',companyId,'id,title,notes,assignee_person_id,due_date,completed'),
      rest(supabaseUrl,supabaseKey,token,'pressure_points',companyId,'id,title,detail,owner_person_id,due_date,resolved')
    ]);

    const audioRes=await fetch(signed_url);
    if(!audioRes.ok)throw new Error('Could not read the private meeting recording.');
    const audio=await audioRes.blob();
    const form=new FormData();
    form.append('file',audio,filename);
    form.append('model','gpt-4o-transcribe');
    form.append('language','en');
    form.append('prompt','Wild60 leadership meeting. Terms may include Wild Belief Co., Wild60, Wild Recap, Energy Pulse, Wild Wins, Vital Signs, Commitments, Pressure Points, Rocks, To-Dos, Lock It In, Executing, Drifting, Dropped, Locked In. Preserve names, assignments and due dates carefully.');
    const tr=await fetch('https://api.openai.com/v1/audio/transcriptions',{method:'POST',headers:{Authorization:`Bearer ${openaiKey}`},body:form});
    if(!tr.ok)throw new Error(`Transcription failed: ${await tr.text()}`);
    const transcript=(await tr.json()).text||'';

    const personById=Object.fromEntries(people.map(p=>[p.id,p.full_name]));
    const currentRocks=rocks.filter(r=>!['locked_in','dropped'].includes(r.status)).map(r=>`${r.title} — ${personById[r.owner_person_id]||'Unassigned'} — ${dateLabel(r.due_date)} — ${String(r.status||'executing').replaceAll('_',' ')}`);
    const currentTodos=todos.filter(t=>!t.completed).map(t=>`${t.title} — ${personById[t.assignee_person_id]||'Unassigned'} — ${dateLabel(t.due_date)}`);
    const currentPressure=pressurePoints.filter(p=>!p.resolved).map(p=>`${p.title} — ${personById[p.owner_person_id]||'Unassigned'} — ${dateLabel(p.due_date)}`);
    const completedRocks=rocks.filter(r=>r.status==='locked_in').map(r=>`${r.title} — ${personById[r.owner_person_id]||'Unassigned'} — Locked In`);
    const truth={company:company?.name||'Company',people:people.map(p=>({id:p.id,name:p.full_name,email:p.email,title:p.title})),rocks,todos,pressure_points:pressurePoints};

    const prompt=`You are Wild Recap, the AI Meeting Assistant inside Wild60.\n\nGOVERNING RULE: THE DATABASE IS THE TRUTH. THE AI IS THE LISTENER.\n\nDATABASE TRUTH:\n${JSON.stringify(truth)}\n\nTRANSCRIPT:\n${transcript}\n\nYour job has TWO separate parts:\n1. Summarize what was discussed.\n2. Extract EVERY DISTINCT actionable commitment or unresolved issue spoken in the transcript that is NOT already represented in DATABASE TRUTH.\n\nCRITICAL EXTRACTION RULES:\n- Do not collapse multiple commitments into one suggestion. If Stephanie has one commitment, Megan has another, and Craig has another, return THREE suggestions.\n- A spoken commitment may appear in locked_in_from_conversation AND still must appear in suggestions if it is not already in the database.\n- Only suppress a suggestion when a substantially equivalent Rock, To-Do, or Pressure Point already exists in DATABASE TRUTH.\n- Preserve the person name if explicitly spoken.\n- Preserve the due date when explicitly spoken. Resolve phrases like Friday or next Friday into YYYY-MM-DD using today's date ${new Date().toISOString().slice(0,10)}. If uncertain, use null.\n- Do not invent owners or dates.\n- Short execution commitments are To-Dos. Substantial 90-day outcomes are Rocks. Unresolved issues needing a decision are Pressure Points.\n\nReturn ONLY valid JSON with exactly this shape:\n{"summary":{"headline":"one sentence","wild_wins":["..."],"vital_signs":["..."],"decisions":["..."],"pressure_points_discussed":["..."],"locked_in_from_conversation":["..."],"still_open":["..."]},"suggestions":[{"kind":"todo|rock|pressure_point","title":"specific action title","details":"useful context","suggested_person_name":"exact spoken person name or null","due_date":"YYYY-MM-DD or null","reason":"why Wild Recap believes this should be captured"}]}\n\nBefore returning JSON, count the distinct actionable commitments/issues in the transcript and verify suggestions contains one entry for each uncaptured item.`;
    const ai=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${openaiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model:'gpt-5.6',input:prompt})});
    if(!ai.ok)throw new Error(`Wild Recap generation failed: ${await ai.text()}`);
    const raw=outputText(await ai.json()).trim().replace(/^```json\s*/i,'').replace(/```$/,'').trim();
    let recap;try{recap=JSON.parse(raw)}catch{throw new Error('Wild Recap returned an invalid summary format.');}
    recap.summary={...(recap.summary||{}),current_rocks:currentRocks,current_todos:currentTodos,current_pressure_points:currentPressure,locked_in:[...completedRocks,...(recap.summary?.locked_in_from_conversation||[])]};

    let emailed=false;
    const resendKey=process.env.RESEND_API_KEY;
    const cleanRecipients=[...new Set(people.filter(p=>p.email&&p.user_id).map(p=>p.email))].slice(0,50);
    if(resendKey&&cleanRecipients.length){
      const s=recap.summary||{};
      const html=`<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;color:#171717"><div style="background:#111;color:#fff;padding:24px"><div style="color:#ff2f8b;font-size:12px;font-weight:800;letter-spacing:2px">WILD BELIEF CO. / WILD60</div><h1 style="margin:8px 0 0;font-size:34px">WILD RECAP™</h1><p style="color:#bbb;margin:8px 0 0">Record it. Capture it. Lock it in.</p></div><div style="padding:26px;border:1px solid #eee"><p style="font-size:18px;font-weight:700">${esc(s.headline||'Your Wild60 recap is ready.')}</p>${meeting_score?`<p><b>Wild60 Score:</b> ${esc(meeting_score)} / 10</p>`:''}<h3 style="color:#ff2f8b">WHAT WE WON</h3>${list(s.wild_wins,esc)}<h3 style="color:#ff2f8b">WHAT WE DECIDED</h3>${list(s.decisions,esc)}<h3 style="color:#ff2f8b">ROCKS IN PLAY</h3>${list(s.current_rocks,esc)}<h3 style="color:#ff2f8b">TO-DOS IN PLAY</h3>${list(s.current_todos,esc)}<h3 style="color:#ff2f8b">PRESSURE POINTS IN PLAY</h3>${list(s.current_pressure_points,esc)}<h3 style="color:#ff2f8b">LOCKED IN</h3>${list(s.locked_in,esc)}<h3 style="color:#ff2f8b">STILL OPEN</h3>${list(s.still_open,esc)}<p style="margin-top:28px;color:#777;font-size:12px">Wild Recap uses Wild60 as the source of truth. New AI-heard commitments are only created after a leader approves them in Wild60.</p></div></div>`;
      const mail=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${resendKey}`,'Content-Type':'application/json'},body:JSON.stringify({from:'Wild Belief Co. | Wild60 <notifications@wildbeliefco.com>',to:cleanRecipients,subject:`Wild Recap — ${company?.name||'Wild60'}`,html})});
      emailed=mail.ok;
    }
    return json(res,200,{transcript,summary:recap.summary||{},suggestions:recap.suggestions||[],emailed});
  }catch(e){console.error(e);return json(res,500,{error:e.message||'Wild Recap failed'});}
}