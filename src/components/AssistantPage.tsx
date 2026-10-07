import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { ArrowUp, Check, CheckCircle2, CircleHelp, CalendarDays, ListPlus, ImagePlus, BookOpen, MessageSquarePlus, Square, Undo2, X, Pencil, AlertCircle } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext';
import { useAssistant, type DataBridge } from '../ai/useAssistant';
import { courseIssues, type Proposal } from '../ai/operations';
import { MAX_IMAGES, MAX_IMAGE_BYTES, validateImages, type ImageInput } from '../ai/protocol';
import type { Course } from '../types';

const CourseEditor=lazy(()=>import('./CourseFormModal').then(m=>({default:m.CourseFormModal})));
export function AssistantPage({bridge,term,adjust,visible}:{bridge:DataBridge;term:string;adjust:boolean;visible:boolean}) {
  const {t,language}=useTranslation(),ai=useAssistant(bridge,term,adjust,language),file=useRef<HTMLInputElement>(null),input=useRef<HTMLTextAreaElement>(null),bottom=useRef<HTMLDivElement>(null);
  const [editing,setEditing]=useState<{proposal:Proposal;course:Course}|null>(null),[uploadError,setUploadError]=useState('');
  useEffect(()=>{if(visible&&ai.entries.length){const transcript=bottom.current?.parentElement;transcript?.scrollTo({top:transcript.scrollHeight,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}},[ai.entries.length,ai.busy,visible]);
  const quick=[{key:'query',Icon:CalendarDays},{key:'create',Icon:ListPlus},{key:'extract',Icon:ImagePlus},{key:'study',Icon:BookOpen}];
  async function attach(files:FileList|null) {
    if(!files)return;setUploadError('');
    try {
      if(files.length+ai.images.length>MAX_IMAGES || [...files].reduce((n,f)=>n+f.size,0)>MAX_IMAGE_BYTES)throw new Error('image_limit');
      const added:ImageInput[]=[];
      for(const f of Array.from(files)) {
        if(!['image/png','image/jpeg','image/webp'].includes(f.type))throw new Error('image_type');
        const url=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result as string);r.onerror=reject;r.readAsDataURL(f);});
        added.push({name:f.name,url});
      }
      const all=[...ai.images,...added];validateImages(all);ai.setImages(all);
    }catch(e){setUploadError((e as Error).message);}finally{if(file.current)file.current.value='';}
  }
  const errors:Record<string,string>={timeout:'timeout',rate_limit:'rateLimited',invalid_key:'invalidKey',provider_error:'providerUnavailable',storage_failed:'storageFailed',missing_key:'missingKey',connection:'dataUnavailable',image_limit:'imageLimit',image_type:'imageType',consent:'needConsent',stopped:'stopped',stale_data:'stale',stale_plan:'stalePlan',term_changed:'termChanged',no_slots:'noSlots',incomplete_draft:'incomplete',duplicate_course:'duplicateCourse',invalid_output:'invalid',invalid_tool:'invalid',round_limit:'roundLimit'};
  const fieldLabels:Record<string,string>={title:'titleLabel',courseId:'courseLabel',dueDate:'dateLabel',dueTime:'timeLabel',repeat:'repeatLabel',priority:'priorityLabel',reminderMinutesBefore:'leadLabel',notes:'notesLabel',type:'typeLabel'};
  function valueLabel(field:string,value:unknown){if(field==='type')return t(`reminders.types.${value}`);if(field==='repeat')return t(`ai.repeat${value==='daily'?'Daily':value==='weekdays'?'Weekdays':value==='weekly'?'Weekly':'None'}`);if(field==='priority')return t(`reminders.${value}`);if(field==='courseId')return bridge.read().courses.find(c=>c.id===value)?.name||t('reminders.noCourseAssociation');return String(value??t('ai.unknown'));}
  const errorText=(code:string)=>t(`ai.${code==='undo_stale'?'undoStale':errors[code]||'error'}`);
  const dayLabel=(day:string)=>t(`days.${({M:'monday',T:'tuesday',W:'wednesday',R:'thursday',F:'friday',S:'saturday',U:'sunday'} as Record<string,string>)[day]}`);
  const statusLabels={pending:'pending',saved:'saved',cancelled:'cancelled',undone:'undone'};
  function describe(p:Proposal){const a=p.tool.args;const course=p.before.courses.find(c=>c.id===a.id);const reminder=p.before.assignments.find(r=>r.id===a.id);return a.title||course?.name||reminder?.title||t(p.sessions?'ai.plan':'ai.courses');}
  function operationLabel(p:Proposal){const n=p.tool.name;return t(`ai.${n.startsWith('delete')?'delete':n.startsWith('update')?'update':n==='complete_reminder'?'complete':'add'}`);}
  const renderProposal=(p:Proposal)=>{
          const issues=p.courses?courseIssues(p.courses,bridge.read().courses.filter(c=>!p.courses.some(x=>x.id===c.id))):null;
          const blocked=!!issues&&(!!issues.invalidIds.length||!!issues.duplicateIds.length);
          const added=p.after.assignments.filter(r=>!p.before.assignments.some(x=>x.id===r.id));
          const changed=p.after.assignments.filter(r=>p.before.assignments.some(x=>x.id===r.id && JSON.stringify(x)!==JSON.stringify(r)));
          const coursesChanged=p.after.courses.filter(c=>p.before.courses.some(x=>x.id===c.id&&JSON.stringify(x)!==JSON.stringify(c)));
          return <article className={`ai-result is-${p.status}${p.courses?' has-draft':''}`} key={p.id}>
            <div className="ai-result-heading"><span className="ai-result-icon">{p.status==='saved'?<CheckCircle2 size={18}/>:p.sessions?<CalendarDays size={18}/>:<CircleHelp size={18}/>}</span><div><strong>{operationLabel(p)} · {describe(p)}</strong><span>{p.tool.name==='plan_study'?t('ai.plan'):t(`ai.${statusLabels[p.status]}`)}</span></div></div>
            <div className="ai-result-body">
            {[...added,...changed].map(r=><div className="ai-result-row" key={r.id}><strong>{r.title}</strong><span>{r.dueDate} · {r.dueTime}{r.repeat&&r.repeat!=='none'?` · ${t(`ai.repeat${r.repeat==='daily'?'Daily':r.repeat==='weekly'?'Weekly':'Weekdays'}`)}`:''}</span>{r.notes&&<span>{r.notes}</span>}</div>)}
            {p.tool.name==='update_reminder'&&<div className="ai-changes">{Object.entries(p.tool.args.changes).map(([k,v])=><p key={k}>{t(k==='type'?'reminders.typeLabel':`ai.${fieldLabels[k]}`)}：{valueLabel(k,p.before.assignments.find(r=>r.id===p.tool.args.id)?.[k as keyof import('../types').AssignmentReminder])} → {valueLabel(k,v)}</p>)}</div>}
            {coursesChanged.map(c=><div className="ai-result-row" key={c.id}><strong>{c.name}</strong><span>{c.weeks}</span>{c.meetings.map(m=><span key={m.id}>{t(`days.${({M:'monday',T:'tuesday',W:'wednesday',R:'thursday',F:'friday',S:'saturday',U:'sunday'} as const)[m.day]}`)} {m.startTime}–{m.endTime} · {m.location} · {m.weeks||c.weeks}</span>)}</div>)}
            {p.tool.name.startsWith('delete')&&<div className="ai-result-row"><strong>{describe(p)}</strong>{p.tool.name==='delete_reminder'&&<span>{p.before.assignments.find(r=>r.id===p.tool.args.id)?.dueDate} · {p.before.assignments.find(r=>r.id===p.tool.args.id)?.dueTime}</span>}</div>}
            {p.courses?.map(c=><div className="ai-course-draft" key={c.id}><div><strong>{c.name||t('ai.incomplete')}</strong>{(c.code||c.weeks||c.schedulePending)&&<span>{c.code} {c.schedulePending&&!c.meetings.length?t('ai.pendingSchedule'):c.weeks}</span>}{c.meetings.map(m=><span key={m.id}>{dayLabel(m.day)} · {m.startTime||t('ai.noTime')}–{m.endTime||t('ai.noTime')} · {m.weeks||c.weeks||t('ai.unknownWeeks')} · {m.location}</span>)}</div>{p.status==='pending'&&<div className="ai-draft-controls"><button aria-label={`${t('ai.edit')} ${c.name}`} onClick={()=>setEditing({proposal:p,course:c})}><Pencil size={14}/></button><button aria-label={`${t('ai.remove')} ${c.name}`} onClick={()=>{const keep=p.courses!.filter(x=>x.id!==c.id);if(!keep.length)ai.cancel(p);else ai.editDraft({...p,courses:keep},keep[0]);}}><X size={14}/></button></div>}</div>)}
            {p.sessions&&!added.length&&<div className="ai-plan-list">{p.sessions.map((s,i)=><div key={i}><span>{s.date}</span><strong>{s.startTime}–{s.endTime}</strong><span>{s.title}</span></div>)}</div>}
            {issues?.invalidIds.length>0&&<p className="ai-warning">{t('ai.incomplete')}</p>}{issues?.duplicateIds.length>0&&<p className="ai-warning">{t('ai.duplicateCourse')}</p>}{issues?.conflicts.map((x,i)=><p className="ai-warning" key={i}>{t('ai.conflict')} · {x}</p>)}
            {p.warnings.length>0&&<div className="ai-warning"><strong>{t(p.tool.name==='delete_course'?'ai.linkedDelete':'ai.warnings')}</strong>{p.warnings.map((w,i)=><p key={i}>{w==='partial_plan'?t('ai.partial'):w}</p>)}</div>}
            </div>
            <div className="ai-result-actions">{p.status==='pending'&&<>{p.tool.name==='plan_study'?<button className="ai-primary-button" onClick={()=>ai.savePlan(p)} disabled={ai.busy||ai.proposals.some(x=>x.id===`${p.id}-save`&&x.status==='saved')}><ListPlus size={15}/>{t('ai.addPlan')}</button>:<button className="ai-primary-button" disabled={ai.busy||blocked} onClick={()=>ai.confirm(p)}><Check size={15}/>{t(p.courses?'ai.import':'ai.confirm')}</button>}<button className="ai-text-button" disabled={ai.busy} onClick={()=>ai.cancel(p)}>{t('ai.cancel')}</button></>}{p.status==='saved'&&<button className="ai-text-button" disabled={ai.busy} onClick={()=>ai.undo(p)}><Undo2 size={14}/>{t('ai.undo')}</button>}</div>
          </article>;
        };
  return <section className="ai-column" hidden={!visible} aria-label={t('ai.title')}>
    <div className="ai-heading"><button className="ai-text-button" onClick={ai.newChat} disabled={ai.busy}><MessageSquarePlus size={16}/>{t('ai.newChat')}</button></div>
    <div className="ai-workspace">
      <div className="ai-service"><span className={`ai-dot ${ai.status?.configured?'is-ready':''}`}/><span>{ai.status?.model||'DeepSeek Flash'}</span><span>{t(!ai.status?'ai.connecting':ai.status.configured?'ai.ready':'ai.offline')}</span></div>
      <div className="ai-transcript" aria-busy={ai.busy}>
        {!ai.entries.length&&<div className="ai-welcome"><span className="ai-welcome-icon"><BookOpen size={26}/></span><h3>{t('ai.welcome')}</h3><div className="ai-quick-actions">{quick.map(({key,Icon})=><button key={key} onClick={()=>{ai.setInput(t(`ai.${key}Prompt`));input.current?.focus();}}><Icon size={18}/><span>{t(`ai.${key}`)}</span></button>)}</div></div>}
        {ai.entries.map((entry,index)=><React.Fragment key={entry.id}><div className={`ai-message is-${entry.role}`}><span className="ai-message-role">{t(entry.role==='user'?'ai.you':'ai.assistant')}</span>{entry.text?<p>{entry.text}</p>:<p className="ai-muted">{ai.busy?t('ai.thinking'):t('ai.empty')}</p>}{entry.images?.length>0&&<div className="ai-attachments">{entry.images.map((x,i)=><img key={i} src={x.url} alt={x.name}/>)}</div>}</div>{!ai.entries.slice(index+1).some(x=>x.turnId===entry.turnId)&&<div className="ai-operations">{ai.proposals.filter(p=>p.id.startsWith(`ai-${entry.turnId}-`)).map(renderProposal)}</div>}</React.Fragment>)}
        <div ref={bottom}/>
      </div>
      <form className="ai-composer" onSubmit={e=>{e.preventDefault();void ai.send();}}>
        {!ai.consent&&<div className="ai-privacy"><p>{t('ai.privacy')}</p><label><input type="checkbox" checked={ai.consent} onChange={e=>ai.setConsent(e.target.checked)}/>{t('ai.consent')}</label></div>}
        {ai.status&&!ai.status.configured&&<p className="ai-warning">{t('ai.missingKey')}</p>}
        {(ai.error||uploadError)&&<div className="ai-error" role="alert"><AlertCircle size={16}/><span>{errorText(uploadError||ai.error)}</span></div>}
        {ai.images.length>0&&<div className="ai-attachment-previews">{ai.images.map((x,i)=><div key={i}><img src={x.url} alt={x.name}/><button type="button" aria-label={`${t('ai.remove')} ${x.name}`} onClick={()=>ai.setImages(ai.images.filter((_,j)=>j!==i))}><X size={13}/></button></div>)}</div>}
        <textarea ref={input} value={ai.input} onChange={e=>ai.setInput(e.target.value)} placeholder={t('ai.placeholder')} aria-label={t('ai.placeholder')} maxLength={12000} rows={3} onKeyDown={e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();void ai.send();}}}/>
        <div className="ai-composer-bottom"><div><button type="button" className="ai-text-button" disabled={ai.busy} onClick={()=>file.current?.click()}><ImagePlus size={17}/>{t('ai.attach')}</button><span className="ai-upload-hint">{t('ai.limits')}</span></div><button type="button" className="ai-primary-button ai-send" onClick={()=>ai.busy?ai.stop():void ai.send()} disabled={!ai.busy&&(!ai.consent||(!ai.input.trim()&&!ai.images.length)||!ai.status?.configured)}>{ai.busy?<Square size={14}/>:<ArrowUp size={17}/>}<span>{t(ai.busy?'ai.stop':'ai.send')}</span></button></div>
        <input ref={file} hidden type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={e=>void attach(e.target.files)}/>
      </form>
    </div>
    {editing&&<Suspense fallback={null}><CourseEditor isOpen draftMode onClose={()=>setEditing(null)} initialCourse={editing.course} activeTerm={term} onSaveCourse={c=>{ai.editDraft(editing.proposal,c);setEditing(null);}}/></Suspense>}
  </section>;
}
