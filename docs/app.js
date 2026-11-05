import {element} from './common.js';
document.querySelector('#download-button').addEventListener('click',event=>{if(event.currentTarget.getAttribute('aria-disabled')==='true')event.preventDefault();});
const groups=[
 {name:'독서·탐색',items:[['reader','한 화면에, 나만의 독서 흐름.','TXT·EPUB·PDF를 열고 한 페이지·두 페이지 보기로 편하게 읽으세요. 읽던 위치와 책별 표시 설정을 이어갑니다.'],['search','찾은 문장으로, 정확하게.','검색어·정규식과 결과 목록으로 원하는 곳을 찾습니다. 결과를 골랐을 때 그 위치로 이동합니다.'],['reader-chapters','이야기의 길을 한눈에.','회차 목록을 보고 원하는 곳으로 이동하세요. 본문과 연결된 회차 위치를 사용합니다.'],['pdf','원본 페이지를 그대로.','PDF는 페이지 이미지로 읽습니다. 원본의 그림과 지면을 유지하며 보기 설정을 조절합니다.']]},
 {name:'글 정리·광고',items:[['cleanup','흐트러진 문장을, 읽기 편하게.','인용부호·문장 연결·공백·빈 줄·문단 정리를 비교 화면에서 확인합니다. 저장할 결과를 먼저 살펴보세요.'],['ads','의심 문구를 살펴보고 결정하세요.','광고의 판정 근거와 원문 구간을 검토합니다. 확정과 모호한 항목을 구분해 정상 본문을 보호합니다.']]},
 {name:'단어 치환',items:[['replace','바꿀 단어도, 남길 문장도 꼼꼼히.','단어와 조사·어미를 함께 검토하고 제외할 위치를 선택하세요. 독서 표시 치환과 파일 치환의 역할을 구분합니다.']]},
 {name:'회차·파일 도구',items:[['chapters','회차를 정리하는 공통 기준.','스마트 회차에서 제목 후보와 구성 정보를 확인합니다. 같은 회차 판단을 분할·병합·변환에 연결합니다.'],['split','필요한 분량으로 나누세요.','회차나 목표 글자 수에 맞춰 파일을 나눕니다. 제목·파일 이름과 결과를 검토한 뒤 새 파일로 저장합니다.'],['merge','흩어진 파일을 한 이야기로.','파일을 모아 회차 구성을 확인하고 병합합니다. 원본 파일은 남기고 새 결과를 만듭니다.'],['epub_convert','TXT와 EPUB 사이를 편하게.','변환 전후 본문과 목차를 비교하고 새 결과를 저장합니다. EPUB 본문·삽화와 원본 목차를 독서에 사용합니다.'],['encoding','깨진 글자도, 결과부터 확인.','인코딩 복구 결과를 비교하고 저장합니다. Base64 도구로 선택한 텍스트를 인코딩·디코딩할 수 있습니다.'],['base64','짧은 텍스트를 간단하게 변환.','Base64 인코딩과 디코딩, 저장 문구를 사용하는 도구입니다. 변환 내용을 확인한 뒤 활용하세요.']]},
 {name:'TTS·메모',items:[['tts','눈으로 읽던 문장을, 귀로도.','동봉 로컬 TTS로 재생하고 문장을 이동합니다. 음성·속도·피치와 예약 종료를 설정할 수 있습니다.'],['notes','잠깐 떠오른 생각도 책 곁에.','포스트잇 메모와 색상, 책갈피·최근 독서 기록으로 읽던 흐름을 남깁니다.']]},
 {name:'화면·설정',items:[['quick-settings','가장 편한 읽기 모양을 찾으세요.','글꼴·크기·줄 간격·들여쓰기와 읽기 모양을 조절하세요. 앱의 밝은·어두운 테마와 독서 종이 설정은 독립적입니다.']]}
];
let selected='cleanup';
const groupRoot=document.querySelector('#feature-groups'),options=document.querySelector('#feature-options');
function showFeature(item){
 selected=item[0];document.querySelector('#feature-title').textContent=item[1];document.querySelector('#feature-copy').textContent=item[2];
 document.querySelector('#feature-dark').srcset=`assets/screens/${selected}-dark.webp`;
 const img=document.querySelector('#feature-image');img.src=`assets/screens/${selected}-light.webp`;img.alt=item[1]+' — 실제 프로그램 화면';
 document.querySelector('#feature-shot').dataset.shot=selected;
 for(const button of options.children)button.setAttribute('aria-pressed',String(button.dataset.id===selected));
}
function showGroup(index){
 const group=groups[index];options.replaceChildren();document.querySelector('#feature-overline').textContent=group.name;
 [...groupRoot.children].forEach((b,i)=>b.setAttribute('aria-selected',String(i===index)));
 for(const item of group.items){const b=element('button',({reader:'독서 화면',search:'검색','reader-chapters':'회차 목록',pdf:'PDF',cleanup:'글 정리',ads:'광고 탐지',replace:'단어 치환',chapters:'스마트 회차',split:'분할',merge:'병합',epub_convert:'TXT ↔ EPUB',encoding:'인코딩',base64:'Base64',tts:'TTS',notes:'메모','quick-settings':'빠른 설정'})[item[0]]);b.type='button';b.dataset.id=item[0];b.addEventListener('click',()=>showFeature(item));options.append(b);}
 showFeature(group.items[0]);
}
for(const [index,group] of groups.entries()){const b=element('button',group.name);b.type='button';b.setAttribute('role','tab');b.addEventListener('click',()=>showGroup(index));groupRoot.append(b);}groupRoot.setAttribute('role','tablist');showGroup(0);
const zoom=document.querySelector('#image-dialog');
for(const button of document.querySelectorAll('.screenshot-button'))button.addEventListener('click',()=>{
 const id=button.dataset.shot||selected,custom=button.dataset.image;document.querySelector('#zoom-dark').srcset=custom||`assets/screens/${id}-dark.webp`;const image=document.querySelector('#zoom-image');image.src=custom||`assets/screens/${id}-light.webp`;image.alt=button.getAttribute('aria-label')||'실제 프로그램 화면';zoom.showModal();
});
zoom.querySelector('.dialog-close').addEventListener('click',()=>zoom.close());zoom.addEventListener('click',e=>{if(e.target===zoom)zoom.close();});
if(!matchMedia('(prefers-reduced-motion: reduce)').matches&&'IntersectionObserver'in window){
 const observer=new IntersectionObserver(items=>{for(const item of items)if(item.isIntersecting){item.target.classList.remove('pending');observer.unobserve(item.target);}},{threshold:.15});
 for(const section of document.querySelectorAll('.reveal')){section.classList.add('pending');observer.observe(section);}
}
try{
 const response=await fetch('release-status.json',{cache:'no-cache'});if(!response.ok)throw Error();const status=await response.json();
 if(status.download&&status.latest){
  const target=new URL(status.download);if(target.origin!=='https://github.com'||!/^\/WebNovelStudio\/webnovelstudio\.github\.io\/releases\/(?:download\/|latest\/download\/)/i.test(target.pathname))throw Error();
  const button=document.querySelector('#download-button');button.href=target.href;button.removeAttribute('aria-disabled');button.textContent='Windows 배포본 받기 ↓';
  document.querySelector('#release-label').textContent=`Windows x64 · 기본 배포판 ${status.baseline} · 최신 공개판 ${status.latest}`;
 }
 const history=document.querySelector('#release-history');
 if(Array.isArray(status.releases)&&status.releases.length){history.replaceChildren();for(const release of status.releases){const article=element('article',undefined,'release-entry');article.append(element('h3',release.version));const list=element('ul');for(const line of release.changes||[])list.append(element('li',line));article.append(list);history.append(article);}}
}catch{/* A release metadata outage must never block the page. */}
