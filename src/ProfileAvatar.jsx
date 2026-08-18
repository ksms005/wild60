import React,{useRef,useState}from'react';
import{Camera,LoaderCircle}from'lucide-react';
import{supabase}from'./supabase';
import'./profile-avatar.css';

function initials(name=''){return name.split(' ').filter(Boolean).map(x=>x[0]).join('').slice(0,2).toUpperCase()||'?'}

export default function ProfileAvatar({person,size='md',editable=false,companyId,onUpdated,className=''}){
 const input=useRef(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function choose(e){const file=e.target.files?.[0];if(!file||!person?.id||!companyId)return;setError('');if(!file.type.startsWith('image/'))return setError('Choose an image file.');if(file.size>5*1024*1024)return setError('Photo must be under 5 MB.');setBusy(true);try{const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'');const path=`${companyId}/${person.id}/avatar-${Date.now()}.${ext}`;const{error:uploadError}=await supabase.storage.from('team-avatars').upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type});if(uploadError)throw uploadError;const{data:urlData}=supabase.storage.from('team-avatars').getPublicUrl(path);const avatar_url=`${urlData.publicUrl}?v=${Date.now()}`;const{data,error:updateError}=await supabase.from('company_people').update({avatar_url}).eq('id',person.id).select().single();if(updateError)throw updateError;onUpdated?.(data)}catch(err){setError(err.message||'Could not upload photo.')}finally{setBusy(false);e.target.value=''}}
 return <div className={`profileAvatarWrap ${className}`} data-size={size}><div className="profileAvatar"><div className="profileAvatarFrame">{person?.avatar_url?<img src={person.avatar_url} alt={`${person.full_name||'Team member'} profile`}/>:<span>{initials(person?.full_name)}</span>}</div>{editable&&<button type="button" className="avatarEditBtn" title="Add or change profile photo" onClick={()=>input.current?.click()} disabled={busy}>{busy?<LoaderCircle className="avatarSpinner"/>:<Camera/>}</button>}</div>{editable&&<input ref={input} className="avatarFileInput" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={choose}/>} {error&&<small className="avatarError">{error}</small>}</div>
}
