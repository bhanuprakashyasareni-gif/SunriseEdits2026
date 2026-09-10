const cfg=window.SUNRISE_CONFIG;
const client=supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
const $=id=>document.getElementById(id);
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
let templates=[],orders=[];
async function boot(){
  const {data:{session}}=await client.auth.getSession();
  if(session){showDash()}else{$("loginBox").hidden=false;$('logout').hidden=true}
}
async function showDash(){
  $('loginBox').hidden=true;$('dashboard').hidden=false;$('logout').hidden=false;
  await Promise.all([loadTemplates(),loadOrders()]);
}
$('loginForm').onsubmit=async e=>{e.preventDefault();$('loginMsg').textContent='Signing in…';const {error}=await client.auth.signInWithPassword({email:$('loginEmail').value.trim(),password:$('loginPassword').value});if(error){$('loginMsg').textContent=error.message;return}$('loginMsg').textContent='';await showDash()};
$('logout').onclick=async()=>{await client.auth.signOut();location.reload()};
async function loadTemplates(){
  $('templatesAdmin').textContent='Loading…';
  const {data,error}=await client.from('templates').select('*').order('created_at',{ascending:false});
  if(error){$('templatesAdmin').innerHTML=`<div class="empty danger">${esc(error.message)}</div>`;return}
  templates=data||[];renderTemplates();updateStats();
}
function renderTemplates(){
  const q=$('templateSearch').value.trim().toLowerCase(), f=$('templateFilter').value;
  const rows=templates.filter(t=>(f==='all'||(f==='active'?t.is_active:!t.is_active)) && (!q||`${t.title} ${t.category}`.toLowerCase().includes(q)));
  $('templatesAdmin').innerHTML=rows.map(t=>`<div class="admin-item"><div class="admin-item-main"><div class="admin-item-title">${esc(t.title)} ${t.is_active?'<span class="badge">LIVE</span>':'<span class="badge">HIDDEN</span>'}</div><div class="admin-meta">${esc(t.category)} · 📸 ${t.required_photos||0} photos · 🎬 ${t.required_videos||0} videos · 💎 ₹${Number(t.premium_price||0)} · ${t.preview_type||'preview'}</div></div><div class="admin-actions"><button onclick="editTemplate('${t.id}')">Edit</button><button onclick="toggleTemplate('${t.id}',${!t.is_active})">${t.is_active?'Hide':'Show'}</button></div></div>`).join('')||'<div class="empty">No templates match your search.</div>';
}
window.editTemplate=id=>{const t=templates.find(x=>x.id===id);if(!t)return;$('tmId').value=t.id;$('tmHeading').textContent='Edit Template';$('tmTitle').value=t.title||'';$('tmCategory').value=t.category||'Reels';$('tmDescription').value=t.description||'';$('tmType').value=t.preview_type||'video';$('tmPreview').value=t.preview_url||'';$('tmPhotos').value=t.required_photos??0;$('tmVideos').value=t.required_videos??0;$('tmSong').checked=!!t.song_required;$('tmPrice').value=t.price??'';$('tmPremiumPrice').value=t.premium_price??'';$('tmRevisions').value=t.premium_revisions??2;$('tmDuration').value=t.premium_duration_seconds??60;$('tmActive').checked=!!t.is_active;$('tmMsg').textContent='';$('templateModal').hidden=false};
window.toggleTemplate=async(id,active)=>{const {error}=await client.from('templates').update({is_active:active}).eq('id',id);if(error){alert(error.message);return}await loadTemplates()};
$('newTemplate').onclick=()=>{$('templateForm').reset();$('tmId').value='';$('tmHeading').textContent='Add Template';$('tmActive').checked=true;$('tmRevisions').value=2;$('tmDuration').value=60;$('tmMsg').textContent='';$('templateModal').hidden=false};
$('tmClose').onclick=()=>$('templateModal').hidden=true;$('templateModal').onclick=e=>{if(e.target===$('templateModal'))$('templateModal').hidden=true};
$('templateForm').onsubmit=async e=>{e.preventDefault();$('tmMsg').textContent='Saving…';const obj={title:$('tmTitle').value.trim(),category:$('tmCategory').value,description:$('tmDescription').value.trim(),preview_type:$('tmType').value,preview_url:$('tmPreview').value.trim(),required_photos:+$('tmPhotos').value,required_videos:+$('tmVideos').value,song_required:$('tmSong').checked,price:$('tmPrice').value?+$('tmPrice').value:null,premium_price:$('tmPremiumPrice').value?+$('tmPremiumPrice').value:null,premium_revisions:+$('tmRevisions').value,premium_duration_seconds:+$('tmDuration').value,is_active:$('tmActive').checked};const id=$('tmId').value;const res=id?await client.from('templates').update(obj).eq('id',id):await client.from('templates').insert(obj);if(res.error){$('tmMsg').textContent=res.error.message;return}$('tmMsg').textContent='Saved ✓';setTimeout(()=>{$('templateModal').hidden=true;loadTemplates()},400)};
async function loadOrders(){
  $('ordersAdmin').textContent='Loading…';
  const {data,error}=await client.from('orders').select('*, templates(title), order_files(*)').order('created_at',{ascending:false});
  if(error){$('ordersAdmin').innerHTML=`<div class="empty danger">${esc(error.message)}</div>`;return}
  orders=data||[];renderOrders();updateStats();
}
function renderOrders(){
  const q=$('orderSearch').value.trim().toLowerCase(), pf=$('orderFilter').value, sf=$('statusFilter').value;
  const rows=orders.filter(o=>{const hay=`${o.order_code} ${o.name} ${o.mobile} ${o.email} ${o.instagram_username} ${o.templates?.title||''}`.toLowerCase();const planOk=pf==='all'||o.plan===pf||(pf==='paid'&&o.payment_status==='paid');return planOk&&(sf==='all'||o.status===sf)&&(!q||hay.includes(q))});
  $('ordersAdmin').innerHTML=rows.map(o=>`<div class="admin-item"><div class="admin-item-main"><div class="admin-item-title">${esc(o.order_code)} <span class="badge">${o.plan==='premium'?'💎 PREMIUM':'🆓 FREE'}</span></div><div class="admin-meta"><b>${esc(o.templates?.title||'Deleted template')}</b><br>${esc(o.name)} · ${esc(o.mobile)} · ${esc(o.instagram_username||'No Instagram')}<br>Payment: ${esc(o.payment_status||'—')} · Watermark: ${o.watermark?'Yes':'No'} · Revisions: ${o.revision_limit??0} · Files: ${o.order_files?.length||0}<br>${new Date(o.created_at).toLocaleString()}</div></div><div class="admin-actions"><select onchange="setStatus('${o.id}',this.value)"><option ${o.status==='New'?'selected':''}>New</option><option ${o.status==='Processing'?'selected':''}>Processing</option><option ${o.status==='Completed'?'selected':''}>Completed</option><option ${o.status==='Cancelled'?'selected':''}>Cancelled</option></select>${(o.order_files||[]).map(f=>`<button onclick="downloadFile('${esc(f.file_path)}')">⬇ ${esc(f.file_name||'File')}</button>`).join('')}</div></div>`).join('')||'<div class="empty">No orders match your filters.</div>';
}
window.setStatus=async(id,status)=>{const {error}=await client.from('orders').update({status}).eq('id',id);if(error){alert(error.message);return}const o=orders.find(x=>x.id===id);if(o)o.status=status;renderOrders()};
window.downloadFile=async path=>{const {data,error}=await client.storage.from('customer-orders').createSignedUrl(path,300);if(error){alert(error.message);return}window.open(data.signedUrl,'_blank','noopener')};
function updateStats(){$('statTemplates').textContent=templates.length;$('statOrders').textContent=orders.length;$('statPremium').textContent=orders.filter(o=>o.plan==='premium').length;$('statPaid').textContent=orders.filter(o=>o.payment_status==='paid').length}
$('templateSearch').oninput=renderTemplates;$('templateFilter').onchange=renderTemplates;$('orderSearch').oninput=renderOrders;$('orderFilter').onchange=renderOrders;$('statusFilter').onchange=renderOrders;
client.auth.onAuthStateChange((_event,session)=>{if(!session){$('dashboard').hidden=true;$('loginBox').hidden=false;$('logout').hidden=true}});
boot();
