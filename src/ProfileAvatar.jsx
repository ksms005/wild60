import React,{useEffect,useMemo,useRef,useState}from'react';
import{Camera,LoaderCircle,Minus,Plus,X}from'lucide-react';
import{supabase}from'./supabase';
import'./profile-avatar.css';

const PREVIEW=320;
const OUTPUT=720;
function initials(name=''){return name.split(' ').filter(Boolean).map(x=>x[0]).join('').slice(0,2).toUpperCase()||'?'}
function clamp(v,min,max){return Math.max(min,Math.min(max,v))}

export default function ProfileAvatar({person,size='md',editable=false,companyId,on