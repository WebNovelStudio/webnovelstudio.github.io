import {api,element,count,stamp} from './common.js';
const form=document.querySelector('#post-form'),feed=document.querySelector('#guest-feed'),status=document.querySelector('#post-status'),more=document.querySelector('#feed-more');
const body=form.elements.body,counter=document.querySelector('#post-count');let cursor=null,busy=false,draftId=crypto.randomUUID();
function message(target,text,error=false){target.textContent=text;target.classList.toggle('error',error);}
function updateCounter(input,output){const n=count(input.value);output.textContent=`${n} / 300`;input.setCustomValidity(n>300?'300자 이내로 입력해 주세요.':'');}
body.addEventListener('input',()=>updateCounter(body,counter));
function note(post){
 const article=element('article',undefined,'note'),heading=element('div',undefined,'note-heading');heading.append(element('strong',post.nickname));const date=element('time',stamp(post.created_at));date.dateTime=post.created_at;heading.append(date);article.append(heading,element('p',post.body));
 const actions=element('div',undefined,'note-actions');for(const label of ['수정','삭제']){const b=element('button',label,'text-button');b.type='button';b.addEventListener('click',()=>edit(post,label==='삭제'));actions.append(b);}article.append(actions);return article;
}
async function load(append=false){
 if(busy)return;busy=true;feed.setAttribute('aria-busy','true');more.disabled=true;
 try{const data=await api('/posts'+(append&&cursor?'?cursor='+encodeURIComponent(cursor):''));if(!append)feed.replaceChildren();for(const post of data.posts)feed.append(note(post));if(!feed.children.length)feed.append(element('p','첫 이야기를 남겨주세요.','muted'));cursor=data.next;more.hidden=!cursor;}
 catch(e){if(!append)feed.replaceChildren(element('p',e.message,'muted'));}
 finally{busy=false;feed.setAttribute('aria-busy','false');more.disabled=false;}
}
document.querySelector('#feed-refresh').addEventListener('click',()=>load());more.addEventListener('click',()=>load(true));
form.addEventListener('submit',async e=>{
 e.preventDefault();if(!form.reportValidity())return;if(count(body.value)>300)return;
 const controls=[...form.elements];controls.forEach(control=>control.disabled=true);message(status,'글을 남기는 중이에요…');
 try{await api('/posts',{method:'POST',body:{id:draftId,nickname:form.elements.nickname.value,body:body.value,password:form.elements.password.value}});body.value='';form.elements.password.value='';draftId=crypto.randomUUID();updateCounter(body,counter);message(status,'이야기를 남겼어요. 고맙습니다.');await load();}
 catch(error){message(status,error.message,true);}finally{controls.forEach(control=>control.disabled=false);}
});
const dialog=document.querySelector('#edit-dialog'),editForm=document.querySelector('#edit-form'),editStatus=document.querySelector('#edit-status'),editCounter=document.querySelector('#edit-count');let active=null,editing=false;
editForm.elements.body.addEventListener('input',()=>updateCounter(editForm.elements.body,editCounter));
function edit(post,deleting){if(editing)return;active=post;editForm.elements.nickname.value=post.nickname;editForm.elements.body.value=post.body;editForm.elements.password.value='';message(editStatus,deleting?'삭제할 글을 확인하고 아래 비밀번호를 입력해 주세요.':'');updateCounter(editForm.elements.body,editCounter);dialog.showModal();editForm.elements.password.focus();}
document.querySelector('#edit-close').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>{editForm.elements.password.value='';active=null;});
dialog.addEventListener('cancel',event=>{if(editing)event.preventDefault();});
async function change(deleting){
 if(editing||!active||!editForm.reportValidity())return;
 if(deleting&&!confirm('이 글을 완전히 삭제할까요? 삭제한 글은 되돌릴 수 없습니다.'))return;
 editing=true;const controls=[...editForm.elements];controls.forEach(control=>control.disabled=true);message(editStatus,deleting?'삭제하는 중이에요…':'수정 내용을 저장하는 중이에요…');
 try{await api('/posts/'+active.id,{method:deleting?'DELETE':'PATCH',body:{password:editForm.elements.password.value,nickname:editForm.elements.nickname.value,body:editForm.elements.body.value,revision:active.revision}});dialog.close();message(status,deleting?'내 글을 삭제했습니다.':'수정한 글을 저장했습니다.');await load();}
 catch(error){message(editStatus,error.message,true);}finally{editing=false;controls.forEach(control=>control.disabled=false);}
}
editForm.addEventListener('submit',e=>{e.preventDefault();change(false);});document.querySelector('#post-delete').addEventListener('click',()=>change(true));
load();
