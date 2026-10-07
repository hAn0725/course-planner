import type { Course, AssignmentReminder } from '../types';

export const MAX_IMAGES = 4;
export const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
export const MAX_ROUNDS = 5;
export type ImageInput = { name: string; url: string };
export type ChatMessage = { role: 'user' | 'assistant' | 'tool'; content: string | Array<{type:'text';text:string} | {type:'image_url';image_url:{url:string}}>; tool_calls?: ToolCall[]; tool_call_id?: string };
export type ToolCall = { id: string; type:'function'; function:{name:string;arguments:string} };
export type Snapshot = { courses: Course[]; assignments: AssignmentReminder[] };
export type BrowserContext = { term:string; today:string; time:string; timezone:string; language:string; adjust:boolean };
export type StreamEvent = {type:'text';text:string} | {type:'tools';calls:ToolCall[]} | {type:'done'} | {type:'error';code:string};

type Schema = {type:string;properties?:Record<string,Schema>;required?:string[];items?:Schema;enum?:unknown[];maxLength?:number;maxItems?:number;minimum?:number;maximum?:number;format?:string;description?:string};
const str = (description='', maxLength=1000):Schema => ({type:'string',description,maxLength});
const date:Schema = {...str(),format:'date'};
const time:Schema = {...str(),format:'time'};
const number = (minimum:number,maximum:number):Schema => ({type:'integer',minimum,maximum});
const object = (properties:Record<string,Schema>, required=Object.keys(properties)):Schema => ({type:'object',properties,required});
const array = (items:Schema,maxItems=80):Schema => ({type:'array',items,maxItems});
const choice = (values:string[]):Schema => ({type:'string',enum:values});
const nullableId:Schema = {type:'string',description:'Use empty string for no linked course',maxLength:200};
const meeting = object({day:choice(['M','T','W','R','F','S','U']),startTime:time,endTime:time,location:str(),weeks:str('Actual week expression; never invent weeks'),type:choice(['lecture','lab','discussion','seminar','studio','office_hours','other'])},['day','startTime','endTime','location','weeks']);
// Unreadable screenshot fields may be empty; they remain an unsavable editable draft.
const draftMeeting = object({...meeting.properties!,startTime:{...str(),format:'draftTime'},endTime:{...str(),format:'draftTime'}},['day','startTime','endTime','location','weeks']);
const course = object({name:str('',200),code:str('',200),weeks:str(),meetings:array(draftMeeting,30),schedulePending:{type:'boolean',description:'True only if source explicitly says time/schedule pending, not unreadable'},instructor:str('',200),credits:{type:'number',minimum:0,maximum:40},location:str()},['name','code','weeks','meetings']);
const reminder = object({title:str('',300),courseId:nullableId,dueDate:date,dueTime:time,repeat:choice(['none','daily','weekdays','weekly']),priority:choice(['urgent','medium','low']),reminderMinutesBefore:number(0,10080),notes:str('',3000),type:choice(['assignment','midterm','final','quiz','project','reading','other'])},['title','courseId','dueDate','dueTime','repeat','priority','reminderMinutesBefore','notes']);
export const TOOL_SCHEMAS = {
  get_schedule: { description:'Read actual dated classes and recurring reminders for a range (maximum 31 days). Always use this before answering schedule questions.', parameters:object({startDate:date,endDate:date}) },
  create_reminder: { description:'Create a reminder only when user explicitly requests saving and provides an unambiguous date and time. Missing information: ask a question, do not guess.', parameters:reminder },
  update_reminder: { description:'Preview reminder changes, never saved without confirmation. Supply only changed fields.', parameters:object({id:str('',200),changes:object(reminder.properties!,[])}) },
  delete_reminder: { description:'Preview removal of an existing reminder.', parameters:object({id:str('',200)}) },
  complete_reminder: { description:'Preview completing a reminder (recurring reminders advance using app rules).', parameters:object({id:str('',200)}) },
  delete_course: { description:'Preview course removal, including linked reminders.', parameters:object({id:str('',200)}) },
  update_course: { description:'Preview course changes. For meetings supply the entire replacement meeting list.', parameters:object({id:str('',200),changes:object({name:str('',200),code:str('',200),weeks:str(),meetings:array(meeting,30),instructor:str('',200),credits:{type:'number',minimum:0,maximum:40},reminderEnabled:{type:'boolean'},reminderLeadTimeMinutes:number(0,1440)},[])}) },
  extract_courses: { description:'Preview course additions/import from text or screenshots. Never infer unreadable times/weeks/locations. Empty fields require user editing. No personal identifiers.', parameters:object({courses:array(course,80),uncertainties:array(str(),80)}) },
  plan_study: { description:'Generate a course-safe study plan, not saved. Defaults: next 7 days,09:00-21:00,45min sessions,10min gaps. User constraints override. Dates required, resolve from browser clock.', parameters:object({title:str('',300),courseId:nullableId,startDate:date,days:number(1,31),sessions:number(1,40),durationMinutes:number(10,240),gapMinutes:number(0,120),dayStart:time,dayEnd:time}) },
  save_study_plan: { description:'Save the previously generated plan as reminders ONLY after user explicitly requests adding it to reminders.', parameters:object({planId:str('',200)}) },
} satisfies Record<string,{description:string;parameters:Schema}>;
export type ToolName = keyof typeof TOOL_SCHEMAS;
export type ValidTool = {name:ToolName;args:Record<string,any>};
export const MODEL_TOOLS = Object.entries(TOOL_SCHEMAS).map(([name,tool]) => ({type:'function',function:{name,description:tool.description,parameters:toJsonSchema(tool.parameters)}}));
function toJsonSchema(s:Schema):unknown { return {...s,format:undefined,...(s.type==='object'?{additionalProperties:false,properties:Object.fromEntries(Object.entries(s.properties!).map(([k,v])=>[k,toJsonSchema(v)]))}:{}),...(s.items?{items:toJsonSchema(s.items)}:{})}; }
export function validDate(value:string):boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value+'T12:00:00Z');
  return !isNaN(d.getTime()) && d.toISOString().slice(0,10)===value;
}
export const validTime = (v:string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
function check(s:Schema,v:unknown):boolean {
  if (s.type==='boolean') return typeof v==='boolean';
  if (s.type==='object') return !!v && typeof v==='object' && !Array.isArray(v) && (s.required||[]).every(k=>k in v) && Object.entries(v).every(([k,x])=>!!s.properties![k] && check(s.properties![k],x));
  if (s.type==='array') return Array.isArray(v) && v.length<=s.maxItems! && v.every(x=>check(s.items!,x));
  if (s.type==='integer') return Number.isInteger(v) && (v as number)>=s.minimum! && (v as number)<=s.maximum!;
  if (s.type==='number') return typeof v==='number' && Number.isFinite(v) && v>=s.minimum! && v<=s.maximum!;
  return typeof v==='string' && v.length<=(s.maxLength??1000) && (!s.enum || s.enum.includes(v)) && (!s.format || (s.format==='date'?validDate(v):s.format==='draftTime' && v===''?true:validTime(v)));
}
export function validateTool(name:string,args:unknown):ValidTool {
  if (!(name in TOOL_SCHEMAS) || !check(TOOL_SCHEMAS[name as ToolName].parameters,args)) throw new Error('invalid_tool');
  return {name:name as ToolName,args:args as Record<string,any>};
}
export function validateImages(images:ImageInput[]):void {
  if (!Array.isArray(images)||images.length>MAX_IMAGES) throw new Error('image_limit');
  let total=0;
  for (const image of images) {
    if (!image || typeof image.name!=='string' || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(image.url)) throw new Error('image_type');
    const base64=image.url.split(',')[1]; total+=base64.length*3/4-(base64.endsWith('==')?2:base64.endsWith('=')?1:0);
  }
  if (total>MAX_IMAGE_BYTES) throw new Error('image_limit');
}
/** Works for both upstream OpenAI SSE and our browser SSE, including split UTF-8/chunks. */
export async function readSSE(stream:ReadableStream<Uint8Array>,onData:(value:string)=>void,signal?:AbortSignal):Promise<void> {
  const reader=stream.getReader(),decoder=new TextDecoder();let buffer='';
  try { while(true) {
    if(signal?.aborted) throw new DOMException('Aborted','AbortError');
    const {done,value}=await reader.read();buffer+=decoder.decode(value,{stream:!done}).replace(/\r\n/g,'\n');
    let end:number;
    while((end=buffer.indexOf('\n\n'))>=0) {const block=buffer.slice(0,end);buffer=buffer.slice(end+2);const data=block.split('\n').filter(x=>x.startsWith('data:')).map(x=>x.slice(5).trimStart()).join('\n');if(data)onData(data);}
    if(done)break;
  }} finally {reader.releaseLock();}
}
