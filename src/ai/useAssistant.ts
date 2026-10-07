import { useEffect, useRef, useState } from 'react';
import type { Course } from '../types';
import { localDate } from '../utils/reminderUtils';
import { MAX_ROUNDS, readSSE, validateImages, validateTool, type BrowserContext, type ChatMessage, type ImageInput, type Snapshot, type StreamEvent } from './protocol';
import { OperationLedger, courseIssues, explicitReminderIntent, fingerprint, prepareProposal, querySchedule, type Proposal } from './operations';

export type ChatEntry = {id:string;turnId:string;role:'user'|'assistant';text:string;images?:ImageInput[]};
export type DataBridge = {read:()=>Snapshot;write:(next:Snapshot)=>void};
export function useAssistant(bridge:DataBridge,term:string,adjust:boolean,language:string) {
  const [entries,setEntries]=useState<ChatEntry[]>([]),[proposals,setProposals]=useState<Proposal[]>([]);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[status,setStatus]=useState<{configured:boolean;model:string}|null>(null);
  const [input,setInput]=useState(''),[images,setImages]=useState<ImageInput[]>([]),[consent,setConsent]=useState(false);
  const history=useRef<ChatMessage[]>([]),ledger=useRef(new OperationLedger()),plans=useRef(new Map<string,Proposal>()),abort=useRef<AbortController|null>(null),guard=useRef(false),operations=useRef(new Map<string,Proposal>());
  const retry=useRef<{text:string;images:string;turnId:string;known:Map<string,string>}|null>(null);
  const creationIntent=useRef(false);
  const latest=useRef({bridge,term,adjust,language});latest.current={bridge,term,adjust,language};
  useEffect(()=>{const c=new AbortController();fetch('/api/ai/status',{signal:c.signal}).then(r=>r.json()).then(setStatus).catch(()=>{if(!c.signal.aborted)setError('connection');});return()=>{c.abort();abort.current?.abort();};},[]);
  const context=():BrowserContext=>{const now=new Date();return {term:latest.current.term,today:localDate(now),time:`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,language:latest.current.language,adjust:latest.current.adjust};};
  const replace=(p:Proposal)=>{operations.current.set(p.id,p);plans.current.set(p.id,p);setProposals(prev=>prev.some(x=>x.id===p.id)?prev.map(x=>x.id===p.id?p:x):[...prev,p]);};
  const save=(p:Proposal)=>{
    if(latest.current.term!==p.term)throw new Error('term_changed');
    const next=ledger.current.apply(p,latest.current.bridge.read());
    try{latest.current.bridge.write(next);}catch(e){ledger.current.forgetFailed(p.id);throw e;}
    p={...p,status:'saved',result:{status:'saved',operationId:p.id,addedReminders:next.assignments.filter(x=>!p.before.assignments.some(b=>b.id===x.id)),addedCourses:next.courses.filter(x=>!p.before.courses.some(b=>b.id===x.id))}};replace(p);return p;
  };
  const resultFor=(p:Proposal)=>p.result||{status:'pending_confirmation',operationId:p.id,courses:p.courses,sessions:p.sessions,warnings:p.warnings,changes:p.tool.args};
  const boundedHistory=()=>{
    const users=history.current.map((m,i)=>m.role==='user'?i:-1).filter(i=>i>=0);
    let sliced=history.current.slice(users[Math.max(0,users.length-6)]??0);
    while(sliced.length>1&&(sliced.length>60||JSON.stringify(sliced).length>55000)){
      const next=sliced.findIndex((m,i)=>i>0&&m.role==='user');if(next<0)break;sliced=sliced.slice(next);
    }
    // Keep current screenshots only. Old previews stay in UI but are not resubmitted/billed.
    const lastImage=sliced.map((m,i)=>Array.isArray(m.content)?i:-1).filter(i=>i>=0).pop();
    return sliced.map((m,i)=>Array.isArray(m.content)&&i!==lastImage?{...m,content:m.content.filter(p=>p.type==='text').map(p=>(p as {text:string}).text).join('\n')}:m);
  };
  async function send(text=input,attachments=images) {
    if(guard.current||(!text.trim()&&!attachments.length))return;
    if(!consent){setError('consent');return;}if(!status?.configured){setError('missing_key');return;}
    try{validateImages(attachments);}catch(e){setError((e as Error).message);return;}
    guard.current=true;setBusy(true);setError('');const controller=new AbortController();abort.current=controller;
    const original=text.trim(),originalImages=[...attachments],termAtStart=latest.current.term;
    if(explicitReminderIntent(original)&&!attachments.length)creationIntent.current=true;
    else if(attachments.length||original.length>300||/是否|要不要|应该|應該|哪些|查询|查.*(?:课|安排|事项)|查詢|识别|辨識|导入|匯入|删除|刪除|修改|取消|不要|安排.*(?:学习|复习)|should I|shall I|what |when |schedule|delete|cancel|import|plan|update/i.test(original))creationIntent.current=false;
    const resuming=retry.current?.text===original&&retry.current?.images===fingerprint(attachments)?retry.current:null;
    const turnId=resuming?.turnId||crypto.randomUUID();retry.current=null;
    setEntries(prev=>[...prev,{id:crypto.randomUUID(),turnId,role:'user',text:original,images:originalImages}]);setInput('');setImages([]);
    const content:ChatMessage['content']=attachments.length?[{type:'text',text:original||'请识别这份课表，生成可编辑草稿。'},...attachments.map(x=>({type:'image_url' as const,image_url:{url:x.url}}))]:original;
    history.current.push({role:'user',content});
    const retryHistoryStart=history.current.length;let wrote=false,createdPreview=false;
    const known=resuming?.known||new Map<string,string>();
    try {
      for(let round=0;round<MAX_ROUNDS;round++) {
        if(controller.signal.aborted)throw new DOMException('Aborted','AbortError');
        if(latest.current.term!==termAtStart)throw new Error('term_changed');
        const assistantId=crypto.randomUUID();let answer='',calls:import('./protocol').ToolCall[]=[],done=false,failure='';
        setEntries(prev=>[...prev,{id:assistantId,turnId,role:'assistant',text:''}]);
        const snapshot=latest.current.bridge.read(),env=context();
        const activeCourses=snapshot.courses.filter(c=>!c.term||c.term===env.term),ids=new Set(activeCourses.map(c=>c.id));
        const response=await fetch('/api/ai/chat',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({messages:boundedHistory(),context:env,summary:{courses:activeCourses.map(c=>({id:c.id,name:c.name,code:c.code})),reminders:snapshot.assignments.filter(r=>!r.courseId||ids.has(r.courseId)).map(r=>({id:r.id,title:r.title,courseId:r.courseId,dueDate:r.dueDate,dueTime:r.dueTime,repeat:r.repeat,completed:r.completed}))}})});
        if(!response.ok){const body=await response.json().catch(()=>({}));throw new Error(body.code||'connection');}
        if(!response.body)throw new Error('invalid_output');
        await readSSE(response.body,value=>{const event=JSON.parse(value) as StreamEvent;if(event.type==='text'){answer+=event.text;setEntries(prev=>prev.map(x=>x.id===assistantId?{...x,text:answer}:x));}if(event.type==='tools')calls=event.calls;if(event.type==='error')failure=event.code;if(event.type==='done')done=true;},controller.signal);
        if(failure||!done||controller.signal.aborted)throw new Error(failure||'stopped');
        if(!answer&&calls.length)setEntries(prev=>prev.filter(x=>x.id!==assistantId));
        if(latest.current.term!==termAtStart)throw new Error('term_changed');
        history.current.push({role:'assistant',content:answer,...(calls.length?{tool_calls:calls}:{})});
        if(!calls.length)break;
        for(const call of calls){
          let result:unknown;
          try {
            if(controller.signal.aborted)throw new Error('stopped');
            const tool=validateTool(call.function.name,JSON.parse(call.function.arguments)),state=latest.current.bridge.read();
            if(tool.name==='get_schedule'){
              result=querySchedule(state,context(),tool.args.startDate,tool.args.endDate);
              if(JSON.stringify(result).length>12000)result={status:'too_many_results',message:'Query a smaller date range.'};
            }
            else {
              const signature=fingerprint(tool.name==='create_reminder'?{name:tool.name,title:tool.args.title,courseId:tool.args.courseId,dueDate:tool.args.dueDate,dueTime:tool.args.dueTime,repeat:tool.args.repeat}:tool),existing=known.get(signature);
              if(existing)result=resultFor(operations.current.get(existing)!);
              else {
                const id=`ai-${turnId}-${call.id}`,p=prepareProposal(tool,id,state,context(),plans.current);replace(p);known.set(signature,id);createdPreview=true;
                const explicit=tool.name==='save_study_plan'?explicitReminderIntent(original):creationIntent.current;
                if((tool.name==='create_reminder'||tool.name==='save_study_plan')&&explicit){const saved=save(p);wrote=true;result=resultFor(saved);}else result=resultFor(p);
              }
            }
          }catch(e){result={status:'failed',code:(e as Error).message};}
          history.current.push({role:'tool',tool_call_id:call.id,content:JSON.stringify(result)});
        }
        if(round===MAX_ROUNDS-1)throw new Error('round_limit');
      }
      if(wrote)creationIntent.current=false;
    }catch(e){
      const code=controller.signal.aborted?'stopped':(e as Error).message;setError(code);
      // Preserve input/previews, and never replay already saved operations automatically.
      if(!wrote&&!createdPreview)history.current.splice(retryHistoryStart-1);
      setInput(original);setImages(originalImages);
      if(wrote||createdPreview)retry.current={text:original,images:fingerprint(attachments),turnId,known};
    }finally{guard.current=false;setBusy(false);abort.current=null;}
  }
  function confirm(p:Proposal,edited?:Course[]) {
    setError('');if(p.status!=='pending'||p.tool.name==='plan_study')return;
    try {
      if(latest.current.term!==p.term)throw new Error('term_changed');
      if(p.tool.name==='extract_courses'){
        const drafts=edited||p.courses||[],issues=courseIssues(drafts,latest.current.bridge.read().courses);
        if(issues.invalidIds.length)throw new Error('incomplete_draft');if(issues.duplicateIds.length)throw new Error('duplicate_course');
        p={...p,courses:drafts,after:{...p.before,courses:[...p.before.courses,...drafts]}};
      }
      if(fingerprint(p.before)!==fingerprint(latest.current.bridge.read())){
        const refreshed=prepareProposal(p.tool,p.id,latest.current.bridge.read(),context(),plans.current);
        if(p.courses){refreshed.courses=p.courses;refreshed.after.courses=[...refreshed.before.courses,...p.courses];}
        replace(refreshed);throw new Error('stale_data');
      }
      const saved=save(p);updateHistory(saved);
    }catch(e){setError((e as Error).message);}
  }
  function updateHistory(p:Proposal){
    for(const m of history.current)if(m.role==='tool'&&typeof m.content==='string'){try{const value=JSON.parse(m.content);if(value.operationId===p.id)m.content=JSON.stringify(resultFor(p));}catch{/* query results do not carry an operation id */}}
  }
  function cancel(p:Proposal){const next={...p,status:'cancelled' as const,result:{status:'cancelled',operationId:p.id}};replace(next);updateHistory(next);}
  function undo(p:Proposal){try{latest.current.bridge.write(ledger.current.undo(p,latest.current.bridge.read()));const next={...p,status:'undone' as const,result:{status:'undone',operationId:p.id}};replace(next);updateHistory(next);setError('');}catch(e){setError((e as Error).message==='stale_data'?'undo_stale':(e as Error).message);}}
  function savePlan(p:Proposal){try{const prepared=prepareProposal({name:'save_study_plan',args:{planId:p.id}},`${p.id}-save`,latest.current.bridge.read(),context(),plans.current);const saved=save(prepared);history.current.push({role:'user',content:`Saved plan ${p.id} by clicking Add reminders. Actual result: ${JSON.stringify(saved.result)}`});setError('');}catch(e){setError((e as Error).message);}}
  function editDraft(p:Proposal,course:Course){const current=operations.current.get(p.id)||p;const drafts=p.courses!.map(c=>c.id===course.id?course:c);const updated={...current,courses:drafts,after:{...current.before,courses:[...current.before.courses,...drafts]}};replace(updated);updateHistory(updated);}
  function newChat(){if(guard.current)return;creationIntent.current=false;retry.current=null;history.current=[];setEntries([]);setProposals([]);plans.current.clear();operations.current.clear();setInput('');setImages([]);setError('');}
  return {entries,proposals,busy,error,status,input,setInput,images,setImages,consent,setConsent,send,stop:()=>abort.current?.abort(),newChat,confirm,cancel,undo,savePlan,editDraft};
}
