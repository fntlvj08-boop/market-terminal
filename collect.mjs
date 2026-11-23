import {sectors,overseas} from './catalog.mjs';
import fs from 'node:fs/promises';
const api='https://api.stock.naver.com', mobile='https://m.stock.naver.com/api';
async function get(url, raw=false){
  const response=await fetch(url,{signal:AbortSignal.timeout(11500),headers:{'User-Agent':'Mozilla/5.0'}});
  if(!response.ok) throw Error(String(response.status));
  return raw?response.text():response.json();
}
const num=x=>x==null||String(x).trim()===''?NaN:Number(String(x).replace(/,/g,''));
const jobs=[];
function add(section,group,name,url,yahoo,history='',unit=''){
  jobs.push({section,group,name,url,yahoo,history,unit});
}
for(const [name,code,y] of [['코스피','KOSPI','^KS11'],['코스닥','KOSDAQ','^KQ11']])
  add('kr','지수',name,mobile+'/index/'+code+'/basic',y,mobile+'/index/'+code+'/price?pageSize=24&page=1');
for(const [name,code,y] of [['나스닥','.IXIC','^IXIC'],['다우','.DJI','^DJI'],['S&P 500','.SPX','^GSPC'],['나스닥 100 선물','','NQ=F']])
  add('us','지수',name,code&&api+'/index/'+code+'/basic',y,code?api+'/index/'+code+'/price?pageSize=24&page=1':'yahoo');
for(const [section,map] of [['kr',sectors],['us',overseas]]){
  for(const [group,list] of Object.entries(map)) for(const entry of list.split('|')){
    const i=entry.indexOf(' '),code=entry.slice(0,i),name=entry.slice(i+1);
    add(section,group,name,(section==='kr'?mobile:api)+'/stock/'+code+'/basic',section==='kr'?null:code.split('.')[0],'',section==='kr'?'원':'$');
  }
}
for(const [name,path,y,unit] of [
  ['원/달러','exchange/FX_USDKRW','KRW=X','원'],['원/유로','exchange/FX_EURKRW','EURKRW=X','원'],
  ['미국 10년물 수익률','','^TNX','%'],['미국 30년물 수익률','','^TYX','%'],
  ['금','metals/GCcv1','GC=F','$/oz'],['은','metals/SIcv1','SI=F','$/oz'],['리튬 · 수산화물 선물','','LTH=F','$/kg'],
  ['WTI','energy/CLcv1','CL=F','$/bbl'],['니켈','metals/CMNI0',null,'$/t'],['VIX',null,'^VIX',''],['공포·탐욕지수',null,null,'']
]) add('us','환율 · 금리 · 원자재 · 심리',name,path&&api+'/marketindex/'+path,y,'',unit);
async function yahoo(symbol){
 const result=(await get('https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(symbol)+'?range=3mo&interval=1d')).chart.result[0];
 const q=result.indicators.quote[0], dates=result.timestamp||[];
 const candles=dates.map((t,i)=>[new Date(t*1000).toISOString().slice(0,10),q.open[i],q.high[i],q.low[i],q.close[i]]).filter(r=>r.slice(1).every(Number.isFinite));
 const recent=(await get('https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(symbol)+'?range=1d&interval=5m')).chart.result[0].meta;
 const price=recent.regularMarketPrice,previous=recent.previousClose??recent.chartPreviousClose;
 if(!Number.isFinite(price)||!previous)throw Error('no quote');
 return {price,pct:(price/previous-1)*100,date:new Date(recent.regularMarketTime*1000).toISOString(),source:'Yahoo Finance',candles:candles.slice(-24)};
}
async function quote(j){
 let data={};
 try{
   if(!j.url)throw Error();
   const raw=await get(j.url),r=raw.exchangeInfo||raw;
   const price=num(r.closePrice),pct=num(r.fluctuationsRatio);
   if(!Number.isFinite(price)||!Number.isFinite(pct))throw Error();
   data={price,pct,date:r.localTradedAt,source:'네이버 증권'};
   if(j.section==='us' && j.url.includes('/stock/')) {
     const extra=r.overMarketPriceInfo;
     const session={PRE_MARKET:'장전',AFTER_MARKET:'장후',POST_MARKET:'장후'}[extra?.tradingSessionType];
     const extendedPrice=num(extra?.overPrice), extendedRatio=num(extra?.fluctuationsRatio);
     if(session && Date.parse(extra.localTradedAt)>Date.parse(r.localTradedAt)
         && Number.isFinite(extendedPrice) && extendedPrice>0 && Number.isFinite(extendedRatio)){
       data={price:extendedPrice,pct:extendedRatio,date:extra.localTradedAt,source:'네이버 증권 · '+session};
     }else{
       data.source='네이버 증권 · 정규장';
     }
   }
   if(j.history)try{data.candles=(await get(j.history)).map(x=>[x.localTradedAt,...['openPrice','highPrice','lowPrice','closePrice'].map(k=>num(x[k]))]).filter(x=>x.slice(1).every(Number.isFinite)).reverse().slice(-24)}catch{}
 }catch{}
 if((data.price==null||j.history&&!data.candles?.length)&&j.yahoo)try{const y=await yahoo(j.yahoo); data=data.price==null?y:{...data,candles:y.candles}}catch{}
 if(data.price==null&&j.section==='kr'&&!j.history){
   const code=j.url.split('/').at(-2);
   for(const suffix of ['.KS','.KQ'])try{data=await yahoo(code+suffix);break}catch{}
 }
 if(j.name==='공포·탐욕지수')try{const r=(await get('https://production.dataviz.cnn.io/index/fearandgreed/graphdata')).fear_and_greed;
   if(Number.isFinite(r.score)&&r.previous_close>0)data={price:r.score,pct:(r.score/r.previous_close-1)*100,date:r.timestamp,source:'CNN'};
 }catch{}
 if(!j.history)delete data.candles;
 return {name:j.name,section:j.section,group:j.group,unit:j.unit,...data};
}
const clean=s=>String(s||'').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&nbsp;/g,' ').trim();
async function news(){
 const kr=await get(api+'/news/mainnews').then(a=>a.map(x=>({title:clean(x.tit),summary:clean(x.subcontent),url:'https://n.news.naver.com/mnews/article/'+x.oid+'/'+x.aid,source:x.ohnm,date:x.dt}))).catch(()=>[]);
 const feeds=await Promise.all(['https://feeds.marketwatch.com/marketwatch/topstories/','https://feeds.bbci.co.uk/news/business/rss.xml'].map(async(url,i)=>{
   try{return [...(await get(url,true)).matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m=>{
     const tag=k=>clean(m[1].match(new RegExp('<'+k+'[^>]*>([\\s\\S]*?)</'+k+'>'))?.[1]);
     return {txt:tag('description')||tag('title'),url:tag('link'),date:tag('pubDate'),source:i?'BBC':'MarketWatch'};
   })}catch{return []}
 }));
 const latest=feeds.flat().filter(x=>x.txt&&x.url.startsWith('https://')).sort((a,b)=>Date.parse(b.date)-Date.parse(a.date));
 const unique=[...new Map(latest.map(x=>[x.url,x])).values()].slice(0,14);
 const world=await Promise.all(unique.map(async x=>{
   try{const t=await get('https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ko&dt=t&q='+encodeURIComponent(x.txt.slice(0,650)));return {...x,txt:undefined,summary:t[0].map(y=>y[0]).join('')}}catch{return null}
 }));
 return {kr,us:world.filter(Boolean)};
}
const path=new URL('./market.json',import.meta.url);
let old={};try{old=JSON.parse(await fs.readFile(path))}catch{}
const newsTask=news(),rows=[];
for(let i=0;i<jobs.length;i+=8)rows.push(...await Promise.all(jobs.slice(i,i+8).map(quote)));
const articles=await newsTask;
for(const k of ['kr','us']) if(articles[k].length<10)articles[k]=[...new Map([...articles[k],...(old.news?.[k]||[])].map(x=>[x.url,x])).values()].slice(0,15);
for(let i=0;i<rows.length;i++)if(rows[i].price==null){const previous=old.rows?.find(x=>x.name===rows[i].name&&x.section===rows[i].section);if(previous?.price!=null)rows[i]={...previous,stale:true}}
if(rows.filter(x=>x.price!=null&&!x.stale).length<rows.length/2)throw Error('시세 수집 실패');
const snapshot={at:new Date().toISOString(),rows,news:articles};
await fs.writeFile(path,JSON.stringify(snapshot));
console.log('시세',rows.length,'미수신',rows.filter(x=>x.price==null).map(x=>x.name),'차트',rows.filter(x=>x.group==='지수').map(x=>x.candles?.length),'뉴스',articles.kr.length,articles.us.length);

