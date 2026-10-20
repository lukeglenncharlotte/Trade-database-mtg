const $=s=>document.querySelector(s);let cards=[];
const usd=n=>n==null?"—":"$"+n.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const fin=c=>c.foilType||"Non-foil";
fetch("cards.json",{cache:"no-store"}).then(r=>r.json()).then(d=>{cards=d.cards;$("#upd").textContent=(d.updated||"").replace("T"," ");
 const fill=(sel,vals)=>[...new Set(vals)].sort().forEach(v=>sel.add(new Option(v,v)));
 fill($("#fFoil"),cards.map(fin));fill($("#fSet"),cards.map(c=>c.set));fill($("#fColl"),cards.map(c=>c.collection));render();});
["#q","#fFoil","#fSet","#fColl","#sort"].forEach(s=>$(s).addEventListener("input",render));
function render(){const q=$("#q").value.toLowerCase().trim(),ff=$("#fFoil").value,fs=$("#fSet").value,fc=$("#fColl").value;
 let l=cards.filter(c=>(!q||[c.name,c.set,c.setCode,fin(c),c.treatment].join(" ").toLowerCase().includes(q))&&(!ff||fin(c)==ff)&&(!fs||c.set==fs)&&(!fc||c.collection==fc));
 const s=$("#sort").value;l.sort(s=="name"?(a,b)=>a.name.localeCompare(b.name):s=="set"?(a,b)=>a.set.localeCompare(b.set)||a.name.localeCompare(b.name):s=="price-asc"?(a,b)=>a.priceUsd-b.priceUsd:(a,b)=>b.priceUsd-a.priceUsd);
 $("#count").textContent=l.reduce((n,c)=>n+c.quantity,0);$("#total").textContent=usd(l.reduce((n,c)=>n+(c.priceUsd||0)*c.quantity,0));
 $("#empty").hidden=l.length>0;
 $("#grid").innerHTML=l.map(c=>`<article class="card ${c.foilType?"foil":""}" data-id="${esc(c.id)}"><div class="art"><img loading="lazy" src="${esc(c.imageUrl)}" alt="${esc(c.name)}"></div>
 <div class="meta"><div class="name">${esc(c.name)}</div><div class="set">${esc(c.set)} · #${esc(c.collectorNumber)}</div>
 <div class="row"><span class="badge ${c.foilType?"f":""}">${esc(fin(c))}</span><span class="price" title="${esc(c.priceSource)}">${usd(c.priceUsd)}<small class="src">${c.priceSource&&c.priceSource.startsWith("TCG")?"TCG market":"Scryfall"}</small></span></div></div></article>`).join("");}
$("#grid").addEventListener("click",e=>{const el=e.target.closest(".card");if(el)open(cards.find(c=>c.id==el.dataset.id));});
function open(c){const fs=c.faceImages||[c.imageLarge||c.imageUrl];$(".mimg").innerHTML=fs.map(u=>`<div class="art"><img loading="lazy" src="${esc(u)}" alt="${esc(c.name)}"></div>`).join("")+(fs.length>1?"<small>Double-faced: front &amp; back</small>":"");$(".mimg").className="mimg "+(c.foilType?"foil":"");
 const r=[["Set",`${esc(c.set)} (${esc(c.setCode)})`],["Collector #",esc(c.collectorNumber)],["Rarity",esc(c.rarity)],["Treatment",esc(c.treatment)],["Finish",esc(fin(c))],["Condition",esc(c.condition)],["Quantity",c.quantity],["Price",usd(c.priceUsd)+(c.priceEstimated?" <small>(est.)</small>":"")+`<br><small>${esc(c.priceSource)}</small>`],["Artist",esc(c.artist)],["Collection",esc(c.collection)]];
 $(".minfo").innerHTML=`<h2>${esc(c.name)}</h2><dl>${r.map(([k,v])=>`<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl><p><a href="${esc(c.scryfallUri)}" target="_blank" rel="noopener">Scryfall</a></p>${c.tcgplayerUri?`<a class="btn" href="${esc(c.tcgplayerUri)}" target="_blank" rel="noopener">View on TCGplayer ↗</a>`:""}
 <details class="sales"><summary>Recent sales</summary>${salesHtml(c)}</details>`;
 $("#modal").hidden=false;}
$("#close").onclick=()=>$("#modal").hidden=true;$("#modal").onclick=e=>{if(e.target.id=="modal")$("#modal").hidden=true};
document.addEventListener("keydown",e=>{if(e.key=="Escape")$("#modal").hidden=true});

function salesHtml(c){if(!c.recentSales)return"<p class=mut>No sales data available.</p>";if(!c.recentSales.length)return"<p class=mut>No recent sales found.</p>";
 return `<table><tr><th>Date</th><th>Condition</th><th>Variant</th><th>Price</th></tr>${c.recentSales.map(s=>`<tr><td>${esc(s.date)}</td><td>${esc(s.condition)}</td><td>${esc(s.variant)}</td><td>${usd(s.price)}</td></tr>`).join("")}</table>
 <p class=mut>Last 5 TCGplayer sales${c.salesMatchedVariant===false?" (all variants — none matched this finish)":""}, fetched ${esc((c.salesFetched||"").replace("T"," "))}. Snapshot, not live.</p>`;}
document.addEventListener("keydown",e=>{if(e.key=="/"&&document.activeElement!==$("#q")){e.preventDefault();$("#q").focus();}});
