const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time=(d,opt)=>new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',...opt}).format(d);
function clock(){const now=new Date();$('clock').textContent=time(now,{hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'})+' KST';$('day').textContent=time(now,{year:'numeric',month:'long',day:'numeric',weekday:'short'})}
clock();setInterval(clock,1000);
function candle(rows){
 if(!rows?.length)return '<small>일봉 미수신</small>';
 const lo=Math.min(...rows.map(r=>r[3])),hi=Math.max(...rows.map(r=>r[2])),y=v=>5+57*(hi-v)/(hi-lo||1);
 return '<svg class="mini" viewBox="0 0 240 68" preserveAspectRatio="none" role="img" aria-label="최근 '+rows.length+'거래일 캔들차트">'+[16,36,56].map(n=>'<path d="M0 '+n+'h240" stroke="#314457"/>').join('')+rows.map((r,i)=>{const x=(i+.5)*240/rows.length,c=r[4]>=r[1]?'#ff929e':'#80baff';return '<g fill="'+c+'" stroke="'+c+'"><title>'+esc(r[0])+' · '+r.slice(1).join(' / ')+'</title><path d="M'+x+' '+y(r[2])+'V'+y(r[3])+'"/><rect x="'+(x-2.4)+'" y="'+Math.min(y(r[1]),y(r[4]))+'" width="4.8" height="'+Math.max(1,Math.abs(y(r[1])-y(r[4])))+'"/></g>'}).join('')+'</svg>';
}
function price(r){return r.price==null?'—':r.price.toLocaleString('ko-KR',{maximumFractionDigits:2})+(r.unit?' '+esc(r.unit):'')}
function pct(r){return '<span class="pct '+(r.pct>0?'up':r.pct<0?'down':'')+'">'+(r.pct==null?'미수신':(r.pct>0?'+':'')+r.pct.toFixed(2)+'%')+'</span>'}
function render(s){
 for(const region of ['kr','us']){
 const rows=s.rows.filter(r=>r.section===region);
 $(region+'-index').innerHTML=rows.filter(r=>r.group==='지수').map(r=>'<article class="index" title="'+esc(r.date)+'"><h3>'+esc(r.name)+'</h3><div class="tick num"><span class="big">'+price(r)+'</span>'+pct(r)+'</div>'+candle(r.candles)+'</article>').join('');
 const groups=[...new Set(rows.filter(r=>r.group!=='지수').map(r=>r.group))];if(region==='us')groups.unshift(groups.pop());
 $(region+'-groups').innerHTML=groups.map(g=>'<article><h3>'+esc(g)+'</h3>'+rows.filter(r=>r.group===g).map(r=>{const meta=[r.source,r.date,r.stale?'이전 수집값':''].filter(Boolean).join(' · ')||'제공처에서 수신 대기';return '<details><summary class="row num"><b>'+esc(r.name)+'</b><span>'+price(r)+'</span>'+pct(r)+'</summary><small class="meta">'+esc(meta)+(r.name==='공포·탐욕지수'?' · <a href="https://www.cnn.com/markets/fear-and-greed" target="_blank" rel="noopener">CNN 원문 ↗</a>':'')+'</small></details>'}).join('')+'</article>').join('');
 }
 $('articles').innerHTML=['kr','us'].map(k=>'<article><h3>'+(k==='kr'?'국내 주요뉴스':'해외 주요뉴스 · 한글 요약')+'</h3>'+s.news[k].map(n=>'<a target="_blank" rel="noopener" href="'+esc(n.url)+'"><small>'+esc(n.source)+' · '+esc(/^\d{14}$/.test(n.date)?n.date.slice(4,6)+'.'+n.date.slice(6,8)+' '+n.date.slice(8,10)+':'+n.date.slice(10,12):time(new Date(n.date),{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}))+'</small><p>'+esc(n.title||n.summary)+'</p>'+(n.title?'<small>'+esc(n.summary)+'</small>':'')+'</a>').join('')+'</article>').join('');
 $('asof').textContent='수집 '+time(new Date(s.at),{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})+' KST · 지연 가능';
}
async function update(){try{const response=await fetch('./market.json',{cache:'no-store'});if(!response.ok)throw Error();render(await response.json())}catch{if(!window.initialMarket)$('asof').textContent='시세 수집본을 열 수 없습니다'}}
if(window.initialMarket)render(window.initialMarket);
if(location.protocol!=='file:'){update();setInterval(update,60000)}
$('refresh').onclick=()=>location.protocol==='file:'?window.open('https://fntlvj8733-dot.github.io/market-terminal/','_blank','noopener'):update();
if(location.protocol==='https:'&&'serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
