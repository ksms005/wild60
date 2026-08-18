import React,{useEffect,useMemo,useRef,useState}from'react';
import{Camera,LoaderCircle,Minus,Plus,X}from'lucide-react';
import{supabase}from'./supabase';
import'./profile-avatar.css';

const PREVIEW=320;
const OUTPUT=720;
function initials(name=''){return name.split(' ').filter(Boolean).map(x=>x[0]).join('').slice(0,2).toUpperCase()||'?'}
function clamp(v,min,max){return Math.max(min,Math.min(max,v))}

export default function ProfileAvatar({person,size='md',editable=false,companyId,onUpdated,className=''}){
 const inputRef=useRef(null),dragRef=useRef(null);
 const[busy,setBusy]=useState(false),[error,setError]=useState(''),[source,setSource]=useState(null),[fileName,setFileName]=useState('avatar.jpg'),[imageSize,setImageSize]=useState(null),[zoom,setZoom]=useState(1),[offset,setOffset]=useState({x:0,y:0});
 useEffect(()=>()=>{if(source)URL.revokeObjectURL(source)},[source]);
 const layout=useMemo(()=>{if(!imageSize)return null;const base=Math.max(PREVIEW/imageSize.w,PREVIEW/imageSize.h);const width=imageSize.w*base*zoom,height=imageSize.h*base*zoom;return{base,width,height,maxX:Math.max(0,(width-PREVIEW)/2),maxY:Math.max(0,(height-PREVIEW)/2)}},[imageSize,zoom]);
 useEffect(()=>{if(!layout)return;setOffset(o=>({x:clamp(o.x,-layout.maxX,layout.maxX),y:clamp(o.y,-layout.maxY,layout.maxY)}))},[layout?.maxX,layout?.maxY]);
 function resetCrop(){if(source)URL.revokeObjectURL(source);setSource(null);setImageSize(null);setZoom(1);setOffset({x:0,y:0});setError('');if(inputRef.current)inputRef.current.value=''}
 function choose(e){const file=e.target.files?.[0];if(!file)return;setError('');if(!file.type.startsWith('image/')){setError('Choose an image file.');e.target.value='';return}if(file.size>5*1024*1024){setError('Photo must be under 5 MB.');e.target.value='';return}if(source)URL.revokeObjectURL(source);setFileName(file.name||'avatar.jpg');setSource(URL.createObjectURL(file));setImageSize(null);setZoom(1);setOffset({x:0,y:0})}
 function startDrag(e){if(!layout)return;e.preventDefault();e.currentTarget.setPointerCapture?.(e.pointerId);const rect=e.currentTarget.getBoundingClientRect();dragRef.current={x:e.clientX,y:e.clientY,startX:offset.x,startY:offset.y,ratio:PREVIEW/rect.width}}
 function moveDrag(e){const d=dragRef.current;if(!d||!layout)return;const x=d.startX+(e.clientX-d.x)*d.ratio,y=d.startY+(e.clientY-d.y)*d.ratio;setOffset({x:clamp(x,-layout.maxX,layout.maxX),y:clamp(y,-layout.maxY,layout.maxY)})}
 function endDrag(){dragRef.current=null}
 async function saveCrop(){if(!source||!imageSize||!layout||!person?.id||!companyId)return;setBusy(true);setError('');try{const image=new Image();image.src=source;await image.decode();const canvas=document.createElement('canvas');canvas.width=OUTPUT;canvas.height=OUTPUT;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,OUTPUT,OUTPUT);const ratio=OUTPUT/PREVIEW;ctx.save();ctx.translate(OUTPUT/2+offset.x*ratio,OUTPUT/2+offset.y*ratio);ctx.scale(layout.base*zoom*ratio,layout.base*zoom*ratio);ctx.drawImage(image,-image.naturalWidth/2,-image.naturalHeight/2);ctx.restore();const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Could not create cropped photo.')),'image/jpeg',.9));const path=`${companyId}/${person.id}/avatar-${Date.now()}.jpg`;const{error:uploadError}=await supabase.storage.from('team-avatars').upload(path,blob,{cacheControl:'3600',upsert:false,contentType:'image/jpeg'});if(uploadError)throw uploadError;const{data:urlData}=supabase.storage.from('team-avatars').getPublicUrl(path);const avatar_url=`${urlData.publicUrl}?v=${Date.now()}`;const{data,error:updateError}=await supabase.from('company_people').update({avatar_url}).eq('id',person.id).select().single();if(updateError)throw updateError;onUpdated?.(data);resetCrop()}catch(err){setError(err.message||'Could not save cropped photo.')}finally{setBusy(false)}}
 const imageStyle=layout?{width:`${layout.width/PREVIEW*100}%`,height:`${layout.height/PREVIEW*100}%`,transform:`translate(-50%,-50%) translate(${offset.x/PREVIEW*100}%,${offset.y/PREVIEW*100}%)`}:{};
 return <>
  <div className={`profileAvatarWrap ${className}`} data-size={size}>
   <div className="profileAvatar"><div className="profileAvatarFrame">{person?.avatar_url?<img src={person.avatar_url} alt={`${person.full_name||'Team member'} profile`}/>:<span>{initials(person?.full_name)}</span>}</div>{editable&&<button type="button" className="avatarEditBtn" title="Add or change profile photo" onClick={()=>inputRef.current?.click()} disabled={busy}>{busy?<LoaderCircle className="avatarSpinner"/>:<Camera/>}</button>}</div>
   {editable&&<input ref={inputRef} className="avatarFileInput" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={choose}/>} {error&&!source&&<small className="avatarError">{error}</small>}
  </div>
  {source&&<div className="avatarCropBackdrop" onMouseDown={e=>{if(e.target===e.currentTarget)resetCrop()}}>
   <div className="avatarCropModal" role="dialog" aria-modal="true" aria-label="Crop profile photo">
    <div className="avatarCropHeader"><div><h2>CROP YOUR PHOTO</h2><p>Drag to position your face, then zoom until it feels right.</p></div><button type="button" className="avatarCropClose" onClick={resetCrop}><X/></button></div>
    <div className="avatarCropStageWrap"><div className="avatarCropStage" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}><img src={source} alt="Crop preview" draggable="false" style={imageStyle} onLoad={e=>setImageSize({w:e.currentTarget.naturalWidth,h:e.currentTarget.naturalHeight})}/><div className="avatarCropRing"/></div></div>
    <div className="avatarCropFooter"><div className="avatarZoomLabel">ZOOM</div><div className="avatarZoomRow"><button type="button" onClick={()=>setZoom(z=>clamp(Number((z-.1).toFixed(1)),1,3))}><Minus/></button><input type="range" min="1" max="3" step="0.05" value={zoom} onChange={e=>setZoom(Number(e.target.value))}/><button type="button" onClick={()=>setZoom(z=>clamp(Number((z+.1).toFixed(1)),1,3))}><Plus/></button></div>{error&&<div className="avatarCropError">{error}</div>}<div className="avatarCropActions"><button type="button" className="avatarCropCancel" onClick={resetCrop}>CANCEL</button><button type="button" className="avatarCropSave" onClick={saveCrop} disabled={busy||!imageSize}>{busy?'SAVING…':'SAVE PHOTO'}</button></div></div>
   </div>
  </div>}
 </>;
}
