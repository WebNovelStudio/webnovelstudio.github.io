import {scenes} from './showcase.js';
const presentation=document.querySelector('.hero-presentation');
const shot=presentation.querySelector('.hero-shot'),frames=[...shot.querySelectorAll('.hero-frame')];
const caption=document.querySelector('#hero-caption'),toggle=document.querySelector('#hero-pause');
const labels=presentation.querySelector('.hero-scene-label'),tag=document.querySelector('#hero-scene-tag'),slogan=document.querySelector('#hero-slogan'),detail=document.querySelector('#hero-detail');
const controlRoot=presentation.querySelector('.hero-scenes'),controls=[],zoom=document.querySelector('#image-dialog');
const reduced=matchMedia('(prefers-reduced-motion: reduce)'),connection=navigator.connection;
let current=0,front=0,timer=null,userPaused=false,visible=true,focused=false,sequence=0;
const permitted=()=>!reduced.matches&&!connection?.saveData;
const canPlay=()=>permitted()&&!userPaused&&visible&&!document.hidden&&!focused&&!zoom.open;
function schedule(){clearTimeout(timer);timer=null;if(canPlay())timer=setTimeout(()=>show((current+1)%scenes.length,true),6500);}
function sync(){
 toggle.disabled=!permitted();toggle.setAttribute('aria-pressed',String(userPaused||!permitted()));
 toggle.textContent=!permitted()?'자동 전환 꺼짐':userPaused?'화면 전환 재생':'화면 전환 멈춤';
 presentation.dataset.playing=String(canPlay());schedule();
}
function describe(index){
 const scene=scenes[index],number=String(index+1).padStart(2,'0');
 shot.dataset.shot=scene.id;shot.dataset.image=`assets/showcase/${scene.id}.webp`;
 shot.setAttribute('aria-label',`${scene.format} · ${scene.title} 화면 크게 보기`);
 caption.textContent=`${scene.format} · ${number} / 12 · ${scene.title}`;
 tag.textContent=`${scene.format} / ${scene.tag}`;slogan.textContent=scene.slogan;detail.textContent=scene.detail;
 for(const [i,button] of controls.entries())button.setAttribute('aria-pressed',String(i===index));
}
async function show(index,automatic=false){
 clearTimeout(timer);timer=null;const ticket=++sequence;
 if(index===current){schedule();return;}
 const frame=frames[1-front],image=frame.querySelector('img'),scene=scenes[index];
 image.classList.remove('moving');frame.dataset.effect=scene.effect;frame.dataset.drift=scene.drift;
 image.src=`assets/showcase/${scene.id}.webp`;image.alt=`${scene.format} · ${scene.title} — 실제 WebNovelStudio 화면`;
 try{await image.decode();}catch{if(ticket===sequence)schedule();return;}
 if(ticket!==sequence||(automatic&&!canPlay()))return;
 frames[front].classList.remove('is-current');frames[front].setAttribute('aria-hidden','true');
 frame.classList.add('is-current');frame.removeAttribute('aria-hidden');image.classList.add('moving');
 front=1-front;current=index;describe(index);
 if(!reduced.matches){for(const animation of labels.getAnimations())animation.cancel();labels.animate([{opacity:.25,transform:'translateY(calc(-50% + 9px))'},{opacity:1,transform:'translateY(-50%)'}],{duration:650,easing:'cubic-bezier(.2,.7,.2,1)'});}
 schedule();
}
for(const [index,scene] of scenes.entries()){
 const button=document.createElement('button');button.type='button';button.dataset.scene=String(index);
 button.textContent=String(index+1).padStart(2,'0');button.setAttribute('aria-label',`${index+1}번째 · ${scene.format} · ${scene.title}`);
 button.addEventListener('click',()=>show(index));controlRoot.append(button);controls.push(button);
}
describe(0);frames[0].dataset.effect=scenes[0].effect;frames[0].dataset.drift=scenes[0].drift;frames[0].querySelector('img').classList.add('moving');
toggle.addEventListener('click',()=>{userPaused=!userPaused;if(!userPaused)focused=false;sync();});
presentation.addEventListener('focusin',()=>{focused=document.activeElement.matches(':focus-visible');sync();});
presentation.addEventListener('focusout',()=>queueMicrotask(()=>{focused=presentation.contains(document.activeElement)&&document.activeElement.matches(':focus-visible');sync();}));
document.addEventListener('visibilitychange',sync);reduced.addEventListener('change',sync);
connection?.addEventListener?.('change',sync);zoom.addEventListener('close',sync);zoom.addEventListener('beforetoggle',()=>queueMicrotask(sync));
if('IntersectionObserver'in window){visible=false;const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;sync();},{threshold:.05});observer.observe(shot);}
sync();
