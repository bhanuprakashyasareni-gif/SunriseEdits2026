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
 $("submitOrderBtn").textContent=plan==="premium"?"Continue to Premium Payment →":"Submit Free Collab Order →";
}
function openOrder(id){
 selected=templates.find(t=>t.id===id); if(!selected)return;
 $("modalTitle").textContent=selected.title;$("modalDesc").textContent=selected.description;$("templateId").value=selected.id;
 $("requirements").innerHTML=`<span>📸 ${selected.required_photos} photo${selected.required_photos===1?"":"s"} required</span>${selected.required_videos?`<span>🎬 ${selected.required_videos} video${selected.required_videos===1?"":"s"} required</span>`:""}${selected.song_required?`<span>🎵 Song required</span>`:""}`;
 $("preview").innerHTML=selected.preview_url?(selected.preview_type==="video"?`<video src="${esc(selected.preview_url)}" controls playsinline></video>`:`<img src="${esc(selected.preview_url)}" alt="">`):`<div class="demo-play">${selected.preview_type==="video"?"▶":"✦"}</div>`;
 $("photos").required=selected.required_photos>0;$("videos").required=selected.required_videos>0;
 $("photoHelp").textContent=selected.required_photos?`Select exactly ${selected.required_photos} photo${selected.required_photos===1?"":"s"}.`:"No photos required.";
 $("videoLabel").hidden=!selected.required_videos;$("videos").hidden=!selected.required_videos;
 $("videoHelp").textContent=selected.required_videos?`Select exactly ${selected.required_videos} video${selected.required_videos===1?"":"s"}.`:"";
 $("premiumPrice").textContent=selected.premium_price!=null?`₹${Number(selected.premium_price).toFixed(0)}`:"₹—";
 $("orderSuccess").hidden=true;$("orderSuccess").textContent="";$("orderForm").reset();$("templateId").value=selected.id;selectPlan("free");modal.hidden=false;
}
$("close").onclick=()=>modal.hidden=true;modal.onclick=e=>{if(e.target===modal)modal.hidden=true};
document.querySelectorAll('input[name="plan"]').forEach(r=>r.onchange=()=>selectPlan(r.value));
function validateFiles(input,count,label){if(input.files.length!==count){input.setCustomValidity(`Please select exactly ${count} ${label}.`);return false}input.setCustomValidity("");return true}
$("photos").onchange=()=>validateFiles($("photos"),selected.required_photos||0,"photos");
$("videos").onchange=()=>validateFiles($("videos"),selected.required_videos||0,"videos");
function showResult(message){$("orderSuccess").hidden=false;$("orderSuccess").textContent=message;}
async function uploadFiles(orderId, code){
 const allFiles=[...$("photos").files.map(f=>({f,kind:"photo"})),...$("videos").files.map(f=>({f,kind:"video"}))];
 for(const {f,kind} of allFiles){
   const safe=f.name.replace(/[^a-zA-Z0-9._-]/g,"_");
   const path=`orders/${orderId}/${crypto.randomUUID()}-${safe}`;
   const up=await client.storage.from("customer-orders").upload(path,f,{upsert:false,contentType:f.type});
   if(up.error)throw up.error;
   const meta=await client.from("order_files").insert({order_id:orderId,file_path:path,file_name:f.name,file_kind:kind});
   if(meta.error)throw meta.error;
 }
 return allFiles.length;
}
async function startPremiumPayment(order, customer){
 const {data, error}=await client.functions.invoke("create-razorpay-order",{body:{order_id:order.id}});
 if(error)throw new Error(error.message||"Could not start Razorpay payment.");
 if(!data?.razorpay_order_id)throw new Error(data?.error||"Razorpay order was not created.");
 const options={
   key:data.key_id,
   amount:data.amount,
   currency:data.currency||"INR",
   name:"SunriseEdits2026",
   description:`Premium Edit — ${data.template_title||selected.title}`,
   order_id:data.razorpay_order_id,
   prefill:{name:customer.name,email:customer.email,contact:customer.mobile},
   notes:{sunrise_order_id:String(order.id)},
   theme:{color:"#111111"},
   handler:async function(response){
     try{
       $("submitOrderBtn").disabled=true;$("submitOrderBtn").textContent="Verifying payment…";
       const verification=await client.functions.invoke("verify-razorpay-payment",{body:{order_id:order.id,razorpay_order_id:response.razorpay_order_id,razorpay_payment_id:response.razorpay_payment_id,razorpay_signature:response.razorpay_signature}});
       if(verification.error)throw new Error(verification.error.message||"Payment verification failed.");
       if(!verification.data?.success||verification.data?.payment_status!=="paid")throw new Error(verification.data?.message||verification.data?.error||"Payment could not be verified yet.");
       showResult(`✅ Premium order ${order.order_code} is paid successfully! Your files are received. We will process the edit and contact you through WhatsApp/Instagram.`);
       $("orderForm").reset();$("templateId").value=selected.id;selectPlan("free");
     }catch(err){
       console.error(err);showResult(`⚠️ Payment was received by Razorpay, but verification needs attention. Please contact SunriseEdits2026 with order ${order.order_code}.`);
     }finally{$("submitOrderBtn").disabled=false;$("submitOrderBtn").textContent="Submit Free Collab Order →";}
   },
   modal:{ondismiss:function(){showResult(`ℹ️ Payment window closed. Your Premium order ${order.order_code} is still pending. You can contact us to retry payment.`);$("submitOrderBtn").disabled=false;$("submitOrderBtn").textContent="Continue to Premium Payment →";}},
   callback_url:undefined
 };
 const rzp=new Razorpay(options);
 rzp.on("payment.failed",function(response){console.error("Razorpay payment failed",response);showResult(`❌ Payment failed or was cancelled. Your Premium order ${order.order_code} remains pending; no Premium delivery will be released until payment is verified.`);$("submitOrderBtn").disabled=false;$("submitOrderBtn").textContent="Continue to Premium Payment →";});
 rzp.open();
}
$("orderForm").onsubmit=async e=>{
 e.preventDefault();if(!selected)return;
 if(!validateFiles($("photos"),selected.required_photos,"photos")||!validateFiles($("videos"),selected.required_videos,"videos")){e.target.reportValidity();return}
 const fd=new FormData(e.target);const plan=fd.get("plan");const code="SE-"+Date.now().toString().slice(-8);
 if(plan==="premium" && selected.premium_price==null){alert("Premium price is not configured for this template.");return;}
 const submit=$("submitOrderBtn");submit.disabled=true;submit.textContent=plan==="premium"?"Uploading & preparing payment…":"Submitting order…";
 const orderPayload={order_code:code,template_id:selected.id,name:fd.get("name").trim(),mobile:fd.get("mobile").trim(),email:fd.get("email").trim(),instagram_username:fd.get("instagram").trim(),song:fd.get("song")?.trim()||"",requirements:fd.get("requirementsText")?.trim()||"",plan,payment_status:plan==="premium"?"pending":"not_required",revision_limit:plan==="premium"?Math.min(Math.max(selected.premium_revisions??2,0),2):0,watermark:plan!=="premium",duration_limit_seconds:plan==="premium"?(selected.premium_duration_seconds||60):15};
 const {data:createdOrder,error}=await client.rpc("create_customer_order",{p_order_code:code,p_template_id:selected.id,p_name:orderPayload.name,p_mobile:orderPayload.mobile,p_email:orderPayload.email,p_instagram_username:orderPayload.instagram_username,p_song:orderPayload.song,p_requirements:orderPayload.requirements,p_plan:orderPayload.plan,p_payment_status:orderPayload.payment_status,p_revision_limit:orderPayload.revision_limit,p_watermark:orderPayload.watermark,p_duration_limit_seconds:orderPayload.duration_limit_seconds});const order=createdOrder?.[0]||createdOrder;
 if(error){showResult("❌ Could not create the order. Please try again.");console.error(error);submit.disabled=false;submit.textContent=plan==="premium"?"Continue to Premium Payment →":"Submit Free Collab Order →";return}
 try{
   const count=await uploadFiles(order.id,code);
   if(plan==="premium"){
     showResult(`✅ Order ${code} created and ${count} file${count===1?"":"s"} uploaded. Opening secure Razorpay Test Mode…`);
     await startPremiumPayment(order,{name:orderPayload.name,email:orderPayload.email,mobile:orderPayload.mobile});
   }else{
     showResult(`✅ Free Collab order ${code} submitted successfully! We received ${count} file${count===1?"":"s"}.`);
     e.target.reset();$("templateId").value=selected.id;selectPlan("free");
   }
 }catch(err){
   showResult(`⚠️ Order ${code} was created, but one or more files failed to upload. Please contact SunriseEdits2026 with this order number.`);console.error(err);
 }finally{
   if(plan!=="premium"||$("submitOrderBtn").textContent!=="Verifying payment…"){$("submitOrderBtn").disabled=false;$("submitOrderBtn").textContent=plan==="premium"?"Continue to Premium Payment →":"Submit Free Collab Order →";}
 }
};
load();
