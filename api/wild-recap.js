const json=(res,status,body)=>res.status(status).json(body);

function outputText(data){
  if(data.output_text)return data.output_text;
  return (data.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('\n');
}
function esc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function list(items,render){return items?.length?`<ul>${items.map(x=>`<li>${render(x)}</li>`).join('')}</ul>`:'<p style="color:#777">None.</p>';}

export default async function handler(req,res){
  if(req.method!=='POST')return json(res,405,{error:'Method not allowed'});
  try{
    const token=(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
    if(!token)return json(res,401,{error:'Sign in required'});
    const supabaseUrl=process.env.VITE_SUPABASE_URL;
    const supabaseKey=process.env.VITE_SUPABASE_ANON_KEY;
    const openaiKey=process.env.OPENAI_API_KEY;
    if(!openaiKey)return json(res,503,{error:'Wild Recap needs OPENAI_API_KEY in Vercel.'});
    const auth=await fetch(`${supabaseUrl}/auth/v1/user`,{headers:{apikey:supabaseKey,Authorization:`Bearer ${token}`}});
    if(!auth.ok)return json(res,401,{error:'Invalid Wild60 session'});

    const {signed_url,filename='wild60.webm',company,people=[],rocks=[],todos=[],pressure_points=[],recipients=[],meeting_score=null}=req.body||{};
    if(!signed_url)return json(res,400,{error:'Missing recording URL'});
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

    const truth={company:company?.name||'Company',people:people.map(p=>({id:p.id,name:p.full_name,email:p.email,title:p.title})),rocks:rocks.map(r=>({id:r.id,title:r.title,owner_person_id:r.owner_person_id,due_date:r.due_date,status:r.status})),todos:todos.map(t=>({id:t.id,title:t.title,assignee_person_id:t.assignee_person_id,due_date:t.due_date,completed:t.completed})),pressure_points:pressure_points.map(p=>({id:p.id,title:p.title,owner_person_id:p.owner_person_id,due_date:p.due_date,resolved:p.resolved}))};
    const prompt=`You are Wild Recap, the AI Meeting Assistant inside Wild60.\n\nGOVERNING RULE: The database is the truth. The AI is the listener. Never suggest creating an item that is already represented in DATABASE TRUTH, even if it is discussed repeatedly. Only suggest uncaptured commitments/issues heard in the transcript. Do not invent owners or due dates.\n\nDATABASE TRUTH:\n${JSON.stringify(truth)}\n\nTRANSCRIPT:\n${transcript}\n\nReturn ONLY valid JSON with this exact shape:\n{"summary":{"headline":"one sentence","wild_wins":["..."],"vital_signs":["..."],"decisions":["..."],"pressure_points":["..."],"locked_in":["..."],"still_open":["..."]},"suggestions":[{"kind":"todo|rock|pressure_point","title":"...","details":"...","suggested_person_name":null,"due_date":null,"reason":"brief quote-free explanation"}]}\n\nKeep the recap concise, specific and accountability-focused. A Rock is a substantial 90-day outcome; a To-Do is a short commitment; a Pressure Point is an unresolved issue needing discussion/decision.`;
    const ai=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${openaiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model:'gpt-5.6',input:prompt})});
    if(!ai.ok)throw new Error(`Wild Recap generation failed: ${await ai.text()}`);
    const raw=outputText(await ai.json()).trim().replace(/^```json\s*/i,'').replace(/```$/,'').trim();
    let recap;try{recap=JSON.parse(raw)}catch{throw new Error('Wild Recap returned an invalid summary format.');}

    let emailed=false;
    const resendKey=process.env.RESEND_API_KEY;
    const cleanRecipients=[...new Set(recipients.filter(Boolean))].slice(0,50);
    if(resendKey&&cleanRecipients.length){
      const s=recap.summary||{};
      const html=`<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;color:#171717"><div style="background:#111;color:#fff;padding:24px"><div style="color:#ff2f8b;font-size:12px;font-weight:800;letter-spacing:2px">WILD BELIEF CO. / WILD60</div><h1 style="margin:8px 0 0;font-size:34px">WILD RECAP™</h1><p style="color:#bbb;margin:8px 0 0">Record it. Capture it. Lock it in.</p></div><div style="padding:26px;border:1px solid #eee"><p style="font-size:18px;font-weight:700">${esc(s.headline||'Your Wild60 recap is ready.')}</p>${meeting_score?`<p><b>Wild60 Score:</b> ${esc(meeting_score)} / 10</p>`:''}<h3 style="color:#ff2f8b">WHAT WE WON</h3>${list(s.wild_wins,esc)}<h3 style="color:#ff2f8b">WHAT WE DECIDED</h3>${list(s.decisions,esc)}<h3 style="color:#ff2f8b">PRESSURE POINTS</h3>${list(s.pressure_points,esc)}<h3 style="color:#ff2f8b">LOCKED IN</h3>${list(s.locked_in,esc)}<h3 style="color:#ff2f8b">STILL OPEN</h3>${list(s.still_open,esc)}<p style="margin-top:28px;color:#777;font-size:12px">Wild Recap uses Wild60 as the source of truth. AI suggestions are not added to Rocks, To-Dos or Pressure Points until a leader confirms them.</p></div></div>`;
      const mail=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${resendKey}`,'Content-Type':'application/json'},body:JSON.stringify({from:'Wild Belief Co. | Wild60 <notifications@wildbeliefco.com>',to:cleanRecipients,subject:`Wild Recap — ${company?.name||'Wild60'}`,html})});
      emailed=mail.ok;
    }
    return json(res,200,{transcript,summary:recap.summary||{},suggestions:recap.suggestions||[],emailed});
  }catch(e){console.error(e);return json(res,500,{error:e.message||'Wild Recap failed'});}
}
