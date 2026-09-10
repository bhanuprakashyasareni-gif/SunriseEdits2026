const cfg=window.SUNRISE_CONFIG;
const client=supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
let templates=[], currentCat="All", selected=null, selectedPlan="free";
const $=id=>document.getElementById(id);
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}

const GOOGLE_ORDERS_API="https://script.google.com/macros/s/AKfycbyKO-QEMcJ3ji3cX4WMoxfvDSlP9ljZijCCIAWKUK5rlcysGr6G8oaeY2GNIDKafVYB/exec";
const GOOGLE_UPLOAD_FORM="https://docs.google.com/forms/d/e/1FAIpQLSfaYHfDHedAgOYEK6fRBfCxOSbHSTzM8zDraG8NEjGgsweBrg/viewform?usp=pp_url&entry.1397652216=";

function previewUrl(value,type){
  if(!value) return "";
  let u=String(value).trim();
  if(/^https?:\/\//i.test(u)) return u;
  // Allow an admin to enter only the storage path.
  if(u.startsWith("template-previews/")) u=u.slice("template-previews/".length);
  return `${cfg.SUPABASE_URL}/storage/v1/object/public/template-previews/${u.split('/').map(encodeURIComponent).join('/')}`;
}

function previewMarkup(t, extra=""){
  const u=previewUrl(t.preview_url,t.preview_type);
  if(!u) return `<div class="demo-play">${t.preview_type==="video"?"▶":"✦"}</div>`;
  if(t.preview_type==="video") return `<video src="${esc(u)}" controls playsinline preload="metadata" ${extra} onerror="this.outerHTML='<div class=&quot;demo-play&quot;>▶</div>'"></video>`;
  return `<img src="${esc(u)}" alt="${esc(t.title)}" loading="lazy" onerror="this.outerHTML='<div class=&quot;demo-play&quot;>✦</div>'">`;
}

async function load(){
  try{
    if(!window.supabase || !cfg?.SUPABASE_URL || !cfg?.SUPABASE_ANON_KEY){
      throw new Error("Supabase client/config did not load.");
    }
    const {data,error}=await client.from("templates").select("*").eq("is_active",true).order("created_at",{ascending:false});
    if(error) throw error;
    templates=Array.isArray(data)?data:[];
    render();
  }catch(error){
    $("catalog").innerHTML =
  `<p style="color:#ff6b6b">
    Template loading error:<br>
    ${error?.message || error}
  </p>`;
  }
}
function render(){
  const q=$("search").value.toLowerCase().trim();
  const list=templates.filter(t=>(currentCat==="All"||t.category===currentCat)&&`${t.title} ${t.description}`.toLowerCase().includes(q));
  $("catalog").innerHTML=list.length?list.map(t=>`<article class="card"><div class="media">${previewMarkup(t)}</div><div class="card-body"><div class="tag">${esc(t.category.toUpperCase())}</div><h3>${esc(t.title)}</h3><p class="muted">${esc(t.description)}</p><div class="meta"><span>📸 ${t.required_photos} photo${t.required_photos===1?"":"s"}</span>${t.required_videos?`<span>🎬 ${t.required_videos} video${t.required_videos===1?"":"s"}</span>`:""}${t.song_required?`<span>🎵 Song</span>`:""}${t.premium_price!=null?`<span>💎 From ₹${Number(t.premium_price).toFixed(0)}</span>`:""}</div><button class="order-btn" data-id="${t.id}">Order This Edit →</button></div></article>`).join(""):"<p>No templates found.</p>";
  document.querySelectorAll(".order-btn").forEach(b=>b.onclick=()=>openOrder(b.dataset.id));
}
document.querySelectorAll(".filter").forEach(b=>b.onclick=()=>{currentCat=b.dataset.cat;document.querySelectorAll(".filter").forEach(x=>x.classList.remove("active"));b.classList.add("active");render()});
$("search").oninput=render;

function selectPlan(plan){
  selectedPlan=plan==="premium"?"premium":"free";
  $("freePlan").classList.toggle("selected",selectedPlan==="free");
  $("premiumPlan").classList.toggle("selected",selectedPlan==="premium");
  $("collabNote").hidden=selectedPlan!=="free";
  $("paymentNote").hidden=selectedPlan!=="premium";
  if(selected) $("premiumPrice").textContent=selected.premium_price!=null?`₹${Number(selected.premium_price).toFixed(0)}`:"₹—";
  $("submitOrderBtn").textContent=selectedPlan==="premium"?"Continue to Premium Payment →":"Create Order & Upload Photos →";
}
function openOrder(id){
  selected=templates.find(t=>t.id===id); if(!selected)return;
  $("modalTitle").textContent=selected.title;
  $("modalDesc").textContent=selected.description;
  $("templateId").value=selected.id;
  $("requirements").innerHTML=`<span>📸 ${selected.required_photos} photo${selected.required_photos===1?"":"s"} required</span>${selected.required_videos?`<span>🎬 ${selected.required_videos} video${selected.required_videos===1?"":"s"} required</span>`:""}${selected.song_required?`<span>🎵 Song required</span>`:""}`;
  $("preview").innerHTML=previewMarkup(selected);
  $("premiumPrice").textContent=selected.premium_price!=null?`₹${Number(selected.premium_price).toFixed(0)}`:"₹—";
  $("orderForm").reset();
  $("templateId").value=selected.id;
  $("orderSuccess").hidden=true;$("orderSuccess").textContent="";
  document.querySelector('input[name="plan"][value="free"]').checked=true;
  selectPlan("free");
  $("modal").hidden=false;
}
$("close").onclick=()=>$("modal").hidden=true;
$("modal").onclick=e=>{if(e.target===$("modal"))$("modal").hidden=true};
document.querySelectorAll('input[name="plan"]').forEach(r=>r.addEventListener("change",()=>selectPlan(r.value)));
function showResult(message){$("orderSuccess").hidden=false;$("orderSuccess").textContent=message;}

async function saveOrderToGoogleSheet(orderPayload){
  await fetch(GOOGLE_ORDERS_API,{method:"POST",mode:"no-cors",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({
    order_id:orderPayload.order_code,date:new Date().toISOString(),name:orderPayload.name,mobile:orderPayload.mobile,email:orderPayload.email,
    instagram:orderPayload.instagram_username,template:orderPayload.template_title,plan:orderPayload.plan,song:orderPayload.song,requirements:orderPayload.requirements
  })});
}
function openGoogleUploadForm(orderCode){window.location.href=GOOGLE_UPLOAD_FORM+encodeURIComponent(orderCode);}

async function createSupabasePaymentOrder(orderPayload){
  // Uses the validated SECURITY DEFINER RPC so Premium payment setup does not depend on browser INSERT/RLS quirks.
  const {data,error}=await client.rpc("create_customer_order",{
    p_order_code:orderPayload.order_code,
    p_template_id:orderPayload.template_id,
    p_name:orderPayload.name,
    p_mobile:orderPayload.mobile,
    p_email:orderPayload.email,
    p_instagram_username:orderPayload.instagram_username,
    p_song:orderPayload.song,
    p_requirements:orderPayload.requirements,
    p_plan:"premium",
    p_payment_status:"pending",
    p_revision_limit:selected?.premium_revisions??2,
    p_watermark:false,
    p_duration_limit_seconds:selected?.premium_duration_seconds??60
  });
  if(error) throw new Error(error.message||"Could not create the Premium payment order.");
  const row=Array.isArray(data)?data[0]:data;
  if(!row?.id) throw new Error("Premium payment order was not created.");
  return {id:row.id,order_code:row.order_code||orderPayload.order_code};
}

async function startPremiumPayment(order,customer){
  if(typeof Razorpay!=="function") throw new Error("Razorpay Checkout did not load. Please refresh the page and try again.");
  const {data,error}=await client.functions.invoke("create-razorpay-order",{body:{order_id:order.id}});
  if(error) throw new Error(error.message||"Could not start Razorpay payment.");
  if(!data?.razorpay_order_id) throw new Error(data?.error||"Razorpay order was not created.");
  const options={
    key:data.key_id,amount:data.amount,currency:data.currency||"INR",name:"SunriseEdits2026",
    description:`Premium Edit — ${data.template_title||selected.title}`,order_id:data.razorpay_order_id,
    prefill:{name:customer.name,email:customer.email,contact:customer.mobile},notes:{sunrise_order_id:String(order.id),order_code:String(order.order_code)},
    theme:{color:"#111111"},
    handler:async function(response){
      try{
        $("submitOrderBtn").disabled=true;$("submitOrderBtn").textContent="Verifying payment…";
        const verification=await client.functions.invoke("verify-razorpay-payment",{body:{order_id:order.id,razorpay_order_id:response.razorpay_order_id,razorpay_payment_id:response.razorpay_payment_id,razorpay_signature:response.razorpay_signature}});
        if(verification.error) throw new Error(verification.error.message||"Payment verification failed.");
        if(!verification.data?.success||verification.data?.payment_status!=="paid") throw new Error(verification.data?.message||verification.data?.error||"Payment could not be verified.");
        showResult(`✅ Payment successful for ${order.order_code}. Opening the photo upload form…`);
        setTimeout(()=>openGoogleUploadForm(order.order_code),800);
      }catch(err){
        console.error(err);showResult(`⚠️ Payment was received by Razorpay, but verification needs attention. Please contact SunriseEdits2026 with order ${order.order_code}.`);
      }finally{
        $("submitOrderBtn").disabled=false;$("submitOrderBtn").textContent="Continue to Premium Payment →";
      }
    },
    modal:{ondismiss:function(){showResult(`ℹ️ Payment window closed. Premium order ${order.order_code} is still pending. You can try payment again.`);$("submitOrderBtn").disabled=false;$("submitOrderBtn").textContent="Continue to Premium Payment →";}}
  };
  const rzp=new Razorpay(options);
  rzp.on("payment.failed",function(response){console.error("Razorpay payment failed",response);showResult(`❌ Payment failed or was cancelled. Premium order ${order.order_code} remains pending.`);$("submitOrderBtn").disabled=false;$("submitOrderBtn").textContent="Continue to Premium Payment →";});
  rzp.open();
}

$("orderForm").onsubmit=async e=>{
  e.preventDefault();
  if(!selected)return;
  // Read the actual checked radio directly; this prevents a stale/default free value.
  const checked=document.querySelector('input[name="plan"]:checked');
  const plan=checked?.value||selectedPlan||"free";
  selectedPlan=plan;
  const fd=new FormData(e.target);
  const code="SE-"+Date.now().toString().slice(-8);
  if(plan==="premium" && selected.premium_price==null){showResult("❌ Premium price is not configured for this template. Please contact SunriseEdits2026.");return;}
  const submit=$("submitOrderBtn");submit.disabled=true;submit.textContent=plan==="premium"?"Creating secure payment…":"Saving your order…";
  const orderPayload={order_code:code,template_id:selected.id,template_title:selected.title,name:String(fd.get("name")||"").trim(),mobile:String(fd.get("mobile")||"").trim(),email:String(fd.get("email")||"").trim(),instagram_username:String(fd.get("instagram")||"").trim(),song:String(fd.get("song")||"").trim(),requirements:String(fd.get("requirementsText")||"").trim(),plan};
  try{
    if(plan==="premium"){
      // Create the payment-tracking order first. Only after payment succeeds do we send the customer to uploads.
      const order=await createSupabasePaymentOrder(orderPayload);
      showResult(`Order ${code} created. Opening secure Razorpay Test Mode…`);
      await startPremiumPayment(order,{name:orderPayload.name,email:orderPayload.email,mobile:orderPayload.mobile});
      // Google Sheet gets the Premium order as soon as payment flow starts.
      await saveOrderToGoogleSheet(orderPayload);
    }else{
      await saveOrderToGoogleSheet(orderPayload);
      showResult(`✅ Order ${code} created! Opening the photo upload form…`);
      setTimeout(()=>openGoogleUploadForm(code),500);
    }
  }catch(err){
    console.error(err);showResult(`❌ ${err.message||"Could not create your order."}`);submit.disabled=false;submit.textContent=plan==="premium"?"Continue to Premium Payment →":"Create Order & Upload Photos →";
  }
};

load();
