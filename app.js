const cfg=window.SUNRISE_CONFIG;
const client=supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
let templates=[], currentCat="All", selected=null, selectedPlan="free";
const $=id=>document.getElementById(id);
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
async function load(){
 const {data,error}=await client.from("templates").select("*").eq("is_active",true).order("created_at",{ascending:false});
 if(error){$("catalog").innerHTML="<p>Could not load templates. Check config.js and your Supabase setup.</p>";console.error(error);return}
 templates=data||[]; render();
}
function render(){
 const q=$("search").value.toLowerCase().trim();
 const list=templates.filter(t=>(currentCat==="All"||t.category===currentCat)&&`${t.title} ${t.description}`.toLowerCase().includes(q));
 $("catalog").innerHTML=list.length?list.map(t=>`<article class="card"><div class="media">${t.preview_url?(t.preview_type==="video"?`<video src="${esc(t.preview_url)}" controls preload="metadata"></video>`:`<img src="${esc(t.preview_url)}" alt="">`):`<div class="demo-play">${t.preview_type==="video"?"▶":"✦"}</div>`}</div><div class="card-body"><div class="tag">${esc(t.category.toUpperCase())}</div><h3>${esc(t.title)}</h3><p class="muted">${esc(t.description)}</p><div class="meta"><span>📸 ${t.required_photos} photo${t.required_photos===1?"":"s"}</span>${t.required_videos?`<span>🎬 ${t.required_videos} video${t.required_videos===1?"":"s"}</span>`:""}${t.song_required?`<span>🎵 Song</span>`:""}${t.premium_price!=null?`<span>💎 From ₹${Number(t.premium_price).toFixed(0)}</span>`:""}</div><button class="order-btn" data-id="${t.id}">Order This Edit →</button></div></article>`).join(""):"<p>No templates found.</p>";
 document.querySelectorAll(".order-btn").forEach(b=>b.onclick=()=>openOrder(b.dataset.id));
}
document.querySelectorAll(".filter").forEach(b=>b.onclick=()=>{currentCat=b.dataset.cat;document.querySelectorAll(".filter").forEach(x=>x.classList.remove("active"));b.classList.add("active");render()});
$("search").oninput=render;
function selectPlan(plan){
 selectedPlan=plan;
 $("freePlan").classList.toggle("selected",plan==="free");
 $("premiumPlan").classList.toggle("selected",plan==="premium");
 $("collabNote").hidden=plan!=="free";
 $("paymentNote").hidden=plan!=="premium";
 if(selected) $("premiumPrice").textContent=selected.premium_price!=null?`₹${Number(selected.premium_price).toFixed(0)}`:"₹—";
 $("submitOrderBtn").textContent="Create Order & Upload Photos →";
}
function openOrder(id){
 selected=templates.find(t=>t.id===id); if(!selected)return;
 $("modalTitle").textContent=selected.title;$("modalDesc").textContent=selected.description;$("templateId").value=selected.id;
 $("requirements").innerHTML=`<span>📸 ${selected.required_photos} photo${selected.required_photos===1?"":"s"} required</span>${selected.required_videos?`<span>🎬 ${selected.required_videos} video${selected.required_videos===1?"":"s"} required</span>`:""}${selected.song_required?`<span>🎵 Song required</span>`:""}`;
 $("preview").innerHTML=selected.preview_url?(selected.preview_type==="video"?`<video src="${esc(selected.preview_url)}" controls playsinline></video>`:`<img src="${esc(selected.preview_url)}" alt="">`):`<div class="demo-play">${selected.preview_type==="video"?"▶":"✦"}</div>`;
 $("premiumPrice").textContent=selected.premium_price!=null?`₹${Number(selected.premium_price).toFixed(0)}`:"₹—";
 $("orderSuccess").hidden=true;$("orderSuccess").textContent="";$("orderForm").reset();$("templateId").value=selected.id;selectPlan("free");modal.hidden=false;
}
$("close").onclick=()=>modal.hidden=true;modal.onclick=e=>{if(e.target===modal)modal.hidden=true};
document.querySelectorAll('input[name="plan"]').forEach(r=>r.onchange=()=>selectPlan(r.value));
function showResult(message){$("orderSuccess").hidden=false;$("orderSuccess").textContent=message;}
const GOOGLE_ORDERS_API="https://script.google.com/macros/s/AKfycbyKO-QEMcJ3ji3cX4WMoxfvDSlP9ljZijCCIAWKUK5rlcysGr6G8oaeY2GNIDKafVYB/exec";
const GOOGLE_UPLOAD_FORM="https://docs.google.com/forms/d/e/1FAIpQLSfaYHfDHedAgOYEK6fRBfCxOSbHSTzM8zDraG8NEjGgsweBrg/viewform?usp=pp_url&entry.1397652216=";

async function saveOrderToGoogleSheet(orderPayload){
  await fetch(GOOGLE_ORDERS_API,{
    method:"POST",
    mode:"no-cors",
    headers:{"Content-Type":"text/plain;charset=utf-8"},
    body:JSON.stringify({
      order_id:orderPayload.order_code,
      date:new Date().toISOString(),
      name:orderPayload.name,
      mobile:orderPayload.mobile,
      email:orderPayload.email,
      instagram:orderPayload.instagram_username,
      template:orderPayload.template_title,
      plan:orderPayload.plan,
      song:orderPayload.song,
      requirements:orderPayload.requirements
    })
  });
}

function openGoogleUploadForm(orderCode){
  const url=GOOGLE_UPLOAD_FORM+encodeURIComponent(orderCode);
  window.location.href=url;
}

$("orderForm").onsubmit=async e=>{
 e.preventDefault();if(!selected)return;
 const fd=new FormData(e.target);const plan=selectedPlan;const code="SE-"+Date.now().toString().slice(-8);
 if(plan==="premium" && selected.premium_price==null){alert("Premium price is not configured for this template.");return;}
 const submit=$("submitOrderBtn");submit.disabled=true;submit.textContent="Saving your order…";
 const orderPayload={
   order_code:code,
   template_id:selected.id,
   template_title:selected.title,
   name:String(fd.get("name")||"").trim(),
   mobile:String(fd.get("mobile")||"").trim(),
   email:String(fd.get("email")||"").trim(),
   instagram_username:String(fd.get("instagram")||"").trim(),
   song:String(fd.get("song")||"").trim(),
   requirements:String(fd.get("requirementsText")||"").trim(),
   plan
 };
 try{
   await saveOrderToGoogleSheet(orderPayload);
   showResult(`✅ Order ${code} created! Opening the photo upload form…`);
   setTimeout(()=>openGoogleUploadForm(code),500);
 }catch(err){
   console.error(err);
   showResult("❌ Could not save your order. Please try again.");
   submit.disabled=false;
   submit.textContent="Create Order & Upload Photos →";
 }
};
load();
