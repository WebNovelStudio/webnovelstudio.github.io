// Public guestbook endpoint. Database credentials stay on the server.
export const config=Object.freeze({
    api:'https://tqhlrxwpmywqotfwrafu.supabase.co/functions/v1/guestbook',
});
export function element(tag,text,className){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e;}
export function count(text){return [...new Intl.Segmenter('ko',{granularity:'grapheme'}).segment(text.normalize('NFC').replace(/\r\n?/g,'\n').trim())].length;}
export async function api(path,{method='GET',body}={}){
  let response;
  try{response=await fetch(config.api+path,{method,cache:'no-store',headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(12000)});}
  catch{throw new Error('연결하지 못했습니다. 입력한 글은 유지됩니다. 잠시 후 다시 시도해 주세요.');}
  const data=await response.json().catch(()=>({message:'서버 응답을 확인하지 못했습니다.'}));
  if(!response.ok){const error=new Error(data.message||'요청을 처리하지 못했습니다.');error.status=response.status;throw error;}
  return data;
}
export function stamp(value){return new Intl.DateTimeFormat('ko-KR',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value));}
