import type { Course, AssignmentReminder } from '../types';
import { getMeetingsForDate, getMeetingsForWeekAndDay, isCourseActiveInWeek } from '../data/academicCalendar';
import { localDate, toggleReminder } from '../utils/reminderUtils';
import { timeStringToMinutes, minutesToTimeString } from '../utils/dateUtils';
import { validDate, validTime, validateTool, type Snapshot, type BrowserContext, type ValidTool } from './protocol';

export type StudySession = {title:string;courseId?:string;date:string;startTime:string;endTime:string};
export type Proposal = {id:string;term:string;tool:ValidTool;before:Snapshot;after:Snapshot;courses?:Course[];sessions?:StudySession[];warnings:string[];status:'pending'|'saved'|'cancelled'|'undone';result?:unknown};
const copy = <T,>(x:T):T => JSON.parse(JSON.stringify(x));
export const fingerprint = (x:unknown) => JSON.stringify(x);
export function explicitReminderIntent(text:string):boolean {
  if(/(?:不要|不用|别|別)(?:再|帮我|幫我)?(?:创建|新建|添加|新增|提醒|保存|设置|設置)|do not|don't|never/i.test(text))return false;
  if(/是否|要不要|应该.{0,15}[吗？?]|應該.{0,15}[嗎？?]|should I|shall I/i.test(text))return false;
  return /提醒我|(?:创建|新建|添加|新增|建立|设.*|設.*|保存|儲存|加入).{0,30}提醒|提前.{0,12}提醒|remind me|(?:add|create|save|set).{0,30}reminder/i.test(text);
}
export const parseLocal = (s:string) => new Date(s+'T12:00:00');
export function addDays(s:string,n:number):string {const d=parseLocal(s);d.setDate(d.getDate()+n);return localDate(d);}
const termCourses = (s:Snapshot,e:BrowserContext) => s.courses.filter(c=>!c.term||c.term===e.term);
const linked = (id:string,s:Snapshot,e:BrowserContext) => {if(id && !termCourses(s,e).some(c=>c.id===id)) throw new Error('missing_target');};
export function validWeeks(value:string):boolean {
  if(!value?.trim())return false;
  return value.replace(/周/g,'').split(/[,，]/).every(part=>{
    const match=part.trim().match(/^(\d{1,2})(?:\s*-\s*(\d{1,2}))?$/);
    if(!match)return false;const start=Number(match[1]),end=Number(match[2]||match[1]);return start>=1&&end>=start&&end<=20;
  });
}
export function reminderOccurrences(item:AssignmentReminder,start:string,end:string):AssignmentReminder[] {
  if(item.completed)return [];
  const results:AssignmentReminder[]=[];
  if(!item.repeat||item.repeat==='none') return item.dueDate>=start&&item.dueDate<=end?[item]:[];
  // Walk the requested range, not potentially years of missed repeats.
  const anchor=parseLocal(item.dueDate);
  for(let date=start;date<=end;date=addDays(date,1)) {
    if(date<item.dueDate)continue;
    const day=parseLocal(date).getDay();
    const diff=Math.round((parseLocal(date).getTime()-anchor.getTime())/86400000);
    if(item.repeat==='weekly'&&diff%7!==0 || item.repeat==='weekdays'&&[0,6].includes(day))continue;
    if(!item.completedDates?.includes(date))results.push({...item,dueDate:date});
  }
  return results;
}
export function querySchedule(s:Snapshot,e:BrowserContext,start:string,end:string) {
  if(!validDate(start)||!validDate(end)||end<start||addDays(start,30)<end) throw new Error('date_range');
  const courses=termCourses(s,e),allowed=new Set(courses.map(c=>c.id));
  return Array.from({length:Math.round((parseLocal(end).getTime()-parseLocal(start).getTime())/86400000)+1},(_,i)=>{
    const date=addDays(start,i),schedule=getMeetingsForDate(courses,parseLocal(date));
    if(!e.adjust && schedule.weekInfo) schedule.meetings=getMeetingsForWeekAndDay(courses,schedule.weekInfo.weekNumber,schedule.day,false).meetings;
    return {date,classes:schedule.meetings.map(({course,session})=>({courseId:course.id,name:course.name,...session})),reminders:s.assignments.filter(a=>!a.courseId||allowed.has(a.courseId)).flatMap(a=>reminderOccurrences(a,date,date))};
  });
}
export function buildStudyPlan(a:Record<string,any>,s:Snapshot,e:BrowserContext):StudySession[] {
  linked(a.courseId,s,e);
  const start=timeStringToMinutes(a.dayStart),end=timeStringToMinutes(a.dayEnd);
  if(end<=start||a.durationMinutes>end-start)throw new Error('date_range');
  const sessions:StudySession[]=[];
  for(let i=0;i<a.days && sessions.length<a.sessions;i++){
    const date=addDays(a.startDate,i),day=querySchedule(s,e,date,date)[0];
    const occupied=day.classes.map(c=>[timeStringToMinutes(c.startTime)-a.gapMinutes,timeStringToMinutes(c.endTime)+a.gapMinutes]);
    // Avoid existing dated tasks as well as classes. A reminder occupies a short gap.
    occupied.push(...day.reminders.map(r=>[timeStringToMinutes(r.dueTime)-a.gapMinutes,timeStringToMinutes(r.dueTime)+(r.durationMinutes||0)+a.gapMinutes]));
    const earliest=date===e.today?Math.max(start,Math.ceil((timeStringToMinutes(e.time)+Math.max(1,a.gapMinutes))/5)*5):start;
    if(date<e.today)continue;
    let cursor=earliest,scheduledToday=0;
    const dailyTarget=Math.ceil((a.sessions-sessions.length)/(a.days-i));
    while(cursor+a.durationMinutes<=end && sessions.length<a.sessions && scheduledToday<dailyTarget){
      const overlap=occupied.filter(([b,f])=>cursor<f&&cursor+a.durationMinutes>b);
      if(overlap.length){cursor=Math.max(...overlap.map(x=>x[1]));continue;}
      sessions.push({title:a.title,courseId:a.courseId||undefined,date,startTime:minutesToTimeString(cursor),endTime:minutesToTimeString(cursor+a.durationMinutes)});
      scheduledToday++;
      cursor+=a.durationMinutes+a.gapMinutes;
    }
  }
  return sessions;
}
export function draftCourses(a:Record<string,any>,id:string,e:BrowserContext):Course[] {
  if(!a.courses.length)throw new Error('empty_draft');
  return a.courses.map((c:any,i:number)=>({id:`${id}-course-${i}`,name:c.name,code:c.code,term:e.term,weeks:c.weeks,schedulePending:c.schedulePending||undefined,instructor:c.instructor||undefined,credits:c.credits??0,color:['#527e45','#637f99','#9b815e'][i%3],reminderEnabled:true,reminderLeadTimeMinutes:15,meetings:c.meetings.map((m:any,j:number)=>({...m,id:`${id}-meeting-${i}-${j}`,type:m.type||'lecture'}))}));
}
export function studyPlanStillFits(sessions:StudySession[],a:Record<string,any>,s:Snapshot,e:BrowserContext):boolean {
  if(a.courseId&&!termCourses(s,e).some(c=>c.id===a.courseId))return false;
  return sessions.every((session,i)=>{
    if(session.date<e.today || session.date===e.today&&session.startTime<=e.time)return false;
    const begin=timeStringToMinutes(session.startTime),end=timeStringToMinutes(session.endTime),day=querySchedule(s,e,session.date,session.date)[0];
    const occupied=day.classes.map(c=>[timeStringToMinutes(c.startTime)-a.gapMinutes,timeStringToMinutes(c.endTime)+a.gapMinutes]);
    occupied.push(...day.reminders.map(r=>[timeStringToMinutes(r.dueTime)-a.gapMinutes,timeStringToMinutes(r.dueTime)+(r.durationMinutes||0)+a.gapMinutes]));
    occupied.push(...sessions.slice(0,i).filter(x=>x.date===session.date).map(x=>[timeStringToMinutes(x.startTime)-a.gapMinutes,timeStringToMinutes(x.endTime)+a.gapMinutes]));
    return !occupied.some(([b,f])=>begin<f&&end>b);
  });
}
export function courseIssues(drafts:Course[],existing:Course[]):{duplicateIds:string[];conflicts:string[];invalidIds:string[]} {
  const duplicateIds:string[]=[],conflicts:string[]=[],invalidIds:string[]=[];
  const signature=(c:Course)=>fingerprint({name:c.name.trim(),code:c.code,term:c.term,weeks:c.weeks,meetings:c.meetings.map(m=>({day:m.day,startTime:m.startTime,endTime:m.endTime,weeks:m.weeks,location:m.location})).sort((a,b)=>fingerprint(a).localeCompare(fingerprint(b)))});
  drafts.forEach((c,i)=>{
    if(!c.name.trim()||(!c.meetings.length&&!c.schedulePending)||(c.weeks&&!validWeeks(c.weeks))||c.meetings.some(m=>!validTime(m.startTime)||!validTime(m.endTime)||m.startTime>=m.endTime||!validWeeks(m.weeks||c.weeks||'')))invalidIds.push(c.id);
    if([...existing,...drafts.slice(0,i)].some(x=>signature(x)===signature(c)))duplicateIds.push(c.id);
    for(const x of [...existing,...drafts.slice(0,i)]){
      if(x.term!==c.term)continue;
      if(c.meetings.some(m=>x.meetings.some(n=>m.day===n.day&&m.startTime<n.endTime&&n.startTime<m.endTime&&Array.from({length:19},(_,k)=>k+1).some(w=>isCourseActiveInWeek(m.weeks||c.weeks,w)&&isCourseActiveInWeek(n.weeks||x.weeks,w)))))conflicts.push(`${c.name} / ${x.name}`);
    }
  });
  return {duplicateIds,conflicts:[...new Set(conflicts)],invalidIds};
}
export function prepareProposal(tool:ValidTool,id:string,s:Snapshot,e:BrowserContext,plans:Map<string,Proposal>):Proposal {
  validateTool(tool.name,tool.args);
  const a=tool.args,after=copy(s),warnings:string[]=[];
  const p:Proposal={id,term:e.term,tool,before:copy(s),after,warnings,status:'pending'};
  const findReminder=()=>{const r=after.assignments.find(r=>r.id===a.id);if(!r)throw new Error('missing_target');linked(r.courseId||'',s,e);return r;};
  const findCourse=()=>{const c=termCourses(after,e).find(c=>c.id===a.id);if(!c)throw new Error('missing_target');return c;};
  if(tool.name==='create_reminder'){
    linked(a.courseId,s,e);if(!a.title.trim())throw new Error('invalid_tool');
    after.assignments.unshift({title:a.title,dueDate:a.dueDate,dueTime:a.dueTime,repeat:a.repeat,priority:a.priority,reminderMinutesBefore:a.reminderMinutesBefore,notes:a.notes,id:`${id}-reminder`,courseId:a.courseId||undefined,type:a.type||'other',completed:false});
  } else if(tool.name==='update_reminder') {
    const r=findReminder();if(!Object.keys(a.changes).length)throw new Error('invalid_tool');linked(a.changes.courseId??r.courseId??'',s,e);
    Object.assign(r,a.changes,{courseId:(a.changes.courseId??r.courseId)||undefined,notificationSent:false});if(!r.title.trim())throw new Error('invalid_tool');
  } else if(tool.name==='delete_reminder') {findReminder();after.assignments=after.assignments.filter(r=>r.id!==a.id);
  } else if(tool.name==='complete_reminder') {const r=findReminder();if(r.completed)throw new Error('already_completed');after.assignments=after.assignments.map(x=>x.id===r.id?toggleReminder(r,new Date(`${e.today}T${e.time}:00`)):x);
  } else if(tool.name==='delete_course') {findCourse();after.courses=after.courses.filter(c=>c.id!==a.id);warnings.push(...after.assignments.filter(r=>r.courseId===a.id).map(r=>r.title));after.assignments=after.assignments.filter(r=>r.courseId!==a.id);
  } else if(tool.name==='update_course') {
    const c=findCourse();if(!Object.keys(a.changes).length)throw new Error('invalid_tool');Object.assign(c,a.changes);if(a.changes.meetings)c.meetings=c.meetings.map((m,i)=>({...m,id:`${id}-meeting-${i}`,type:m.type||'lecture'}));
    if(courseIssues([c],[]).invalidIds.length)throw new Error('incomplete_draft');
    warnings.push(...courseIssues([c],termCourses(s,e).filter(x=>x.id!==c.id)).conflicts);
  } else if(tool.name==='extract_courses') {p.courses=draftCourses(a,id,e);warnings.push(...a.uncertainties);after.courses.push(...p.courses);
  } else if(tool.name==='plan_study') {p.sessions=buildStudyPlan(a,s,e);if(!p.sessions.length)throw new Error('no_slots');if(p.sessions.length<a.sessions)warnings.push('partial_plan');
  } else if(tool.name==='save_study_plan') {
    const plan=plans.get(a.planId);if(!plan?.sessions)throw new Error('missing_target');
    // Validate the shown times; mere passage of a minute must not move still-valid slots.
    if(plan.term!==e.term || !studyPlanStillFits(plan.sessions,plan.tool.args,s,e))throw new Error('stale_plan');
    p.sessions=plan.sessions;after.assignments.unshift(...plan.sessions.map((x,i)=>({id:`${id}-reminder-${i}`,title:x.title,courseId:x.courseId,type:'reading' as const,dueDate:x.date,dueTime:x.startTime,notes:`${x.startTime}–${x.endTime}`,durationMinutes:timeStringToMinutes(x.endTime)-timeStringToMinutes(x.startTime),repeat:'none' as const,priority:'medium' as const,reminderMinutesBefore:10,completed:false})));
  } else throw new Error('invalid_tool');
  return p;
}
export class OperationLedger {
  private applied=new Set<string>();
  forgetFailed(id:string):void {this.applied.delete(id);}
  apply(p:Proposal,current:Snapshot):Snapshot {
    if(this.applied.has(p.id))throw new Error('duplicate_operation');
    if(fingerprint(p.before)!==fingerprint(current))throw new Error('stale_data');
    this.applied.add(p.id);return copy(p.after);
  }
  undo(p:Proposal,current:Snapshot):Snapshot {
    if(!this.applied.has(p.id))throw new Error('missing_target');
    // Undo only the changed records, preserving subsequent unrelated manual edits.
    const undoCollection=<T extends {id:string}>(before:T[],after:T[],now:T[]):T[]=>{
      const ids=new Set([...before,...after].map(x=>x.id)),changed=[...ids].filter(id=>fingerprint(before.find(x=>x.id===id))!==fingerprint(after.find(x=>x.id===id)));
      for(const id of changed)if(fingerprint(now.find(x=>x.id===id))!==fingerprint(after.find(x=>x.id===id)))throw new Error('stale_data');
      return [...now.filter(x=>!changed.includes(x.id)),...before.filter(x=>changed.includes(x.id))];
    };
    const result={courses:undoCollection(p.before.courses,p.after.courses,current.courses),assignments:undoCollection(p.before.assignments,p.after.assignments,current.assignments)};
    // Keep id in the ledger: a replay cannot reapply an undone operation.
    return result;
  }
}
