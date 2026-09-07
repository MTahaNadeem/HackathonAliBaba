'use client';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
import {Checkbox} from '@/components/ui/checkbox';
export function Choice({label,value,options,onChange}:{label:string;value:string;options:string[];onChange:(v:string)=>void}){return <label className="field"><span>{label}</span><Select value={value} onValueChange={v=>{if(v!==null)onChange(String(v))}}><SelectTrigger className="raah-select"><SelectValue/></SelectTrigger><SelectContent>{options.map(o=><SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select></label>}
export function CheckField({label,checked,onChange}:{label:string;checked:boolean;onChange:(v:boolean)=>void}){return <label className="check-field"><Checkbox checked={checked} onCheckedChange={v=>onChange(v===true)}/><span>{label}</span></label>}
export function Empty({title,text,action,onAction}:{title:string;text:string;action?:string;onAction?:()=>void}){return <div className="empty-panel"><h3>{title}</h3><p>{text}</p>{action&&<button className="button blue" onClick={onAction}>{action}</button>}</div>}
