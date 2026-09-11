
const DEMO = {
  products: [
    {id:'p1',name:'라탄 트레이',material:'Mahoni',finish:'Natural Oil',w:400,d:300,h:50,cbm:0.006,cost:8000,branch_price:11000,wholesale_price:14000,sale_price:18000,group:'트레이',image:'',
     detail_ko:'손잡이는 흔들림 없이 고정하고 모서리를 부드럽게 마감합니다.',detail_id:'Pegangan harus terpasang kuat dan sudut harus dihaluskan.',detail_en:'Secure the handle firmly and finish all edges smoothly.',
     detail_sections:[{type:'text',title:'제품 특징',ko:'천연 원목의 질감이 잘 드러나는 제품입니다.',id:'Produk ini menampilkan tekstur alami kayu.',en:'This product highlights the natural texture of wood.'}]},
    {id:'p2',name:'레더 박스',material:'Mahoni',finish:'Oil',w:250,d:180,h:100,cbm:0.0045,cost:12000,branch_price:16000,wholesale_price:19000,sale_price:25000,group:'박스',image:'',detail_ko:'',detail_id:'',detail_en:'',detail_sections:[]},
    {id:'p3',name:'우드 시계',material:'Teak',finish:'Wax',w:200,d:40,h:200,cbm:0.0016,cost:9000,branch_price:13000,wholesale_price:16000,sale_price:23000,group:'시계',image:'',detail_ko:'',detail_id:'',detail_en:'',detail_sections:[]}
  ],
  locations:[{id:'l1',name:'창고'},{id:'l2',name:'매장 1F'},{id:'l3',name:'매장 2F'}],
  inventory:[
    {product_id:'p1',l1:50,l2:5,l3:3,updated_at:'2026-09-04 09:20'},
    {product_id:'p2',l1:20,l2:8,l3:4,updated_at:'2026-09-03 18:10'},
    {product_id:'p3',l1:7,l2:2,l3:1,updated_at:'2026-09-02 16:22'}
  ],
  customers:[
    {id:'c1',type:'지점',name:'아산점',contact:'김OO',phone:'010-1234-5678',address:'충남 아산시',business_no:'123-45-67890',price_level:'branch_price',business_doc_name:'',business_doc_data:''},
    {id:'c2',type:'지점',name:'천안점',contact:'박OO',phone:'010-2222-3333',address:'충남 천안시',business_no:'',price_level:'branch_price',business_doc_name:'',business_doc_data:''},
    {id:'c3',type:'고객',name:'OO초등학교',contact:'이OO',phone:'041-000-0000',address:'충남',business_no:'',price_level:'wholesale_price',business_doc_name:'',business_doc_data:''}
  ],
  invoices:[],
  stock_logs:[],
  invoice_templates:[
    {id:'t1',name:'기본 거래명세서',title:'거래명세서',vat_rate:10,show_vat:true,bank_info:'농협 302-1333-3780-11 한태희',show_business_no:true}
  ]
};

const S = {
  data:null, page:'dashboard', productView:'deck', pageSize:20,
  supabase:null, cloud:false, selectedInvoiceItems:[], currentTemplateId:'t1',
  detailEdit:false, currentDetailLang:'ko',
  selectedProducts:new Set(), selectedCustomers:new Set()
};

function clone(v){return JSON.parse(JSON.stringify(v))}
function normalizeData(){
  S.data.products.forEach(p=>{ if(!Array.isArray(p.detail_sections)) p.detail_sections=[]; if(!Array.isArray(p.detail_notes)) p.detail_notes=[]; p.weight_g=Number(p.weight_g||0); delete p.code; delete p.status; delete p.drawing_url; });
  S.data.customers.forEach(c=>{c.business_no=c.business_no||'';c.business_doc_name=c.business_doc_name||'';c.business_doc_data=c.business_doc_data||''});
  if(!Array.isArray(S.data.invoice_templates)||!S.data.invoice_templates.length)S.data.invoice_templates=clone(DEMO.invoice_templates);
}
function loadLocal(){S.data=JSON.parse(localStorage.getItem('nayeso_data_v2')||localStorage.getItem('nayeso_data')||'null')||clone(DEMO);normalizeData()}
function saveLocal(){localStorage.setItem('nayeso_data_v2',JSON.stringify(S.data))}
function money(n){return Number(n||0).toLocaleString('ko-KR')}
function uid(prefix='id'){return prefix+Date.now()+Math.random().toString(16).slice(2)}
function imgTag(p,cls=''){return p.image?`<img class="${cls}" src="${p.image}">`:`<div class="img-placeholder ${cls}">NO IMAGE</div>`}
function invFor(pid){return S.data.inventory.find(x=>x.product_id===pid)||{product_id:pid}}
function totalQty(pid){let i=invFor(pid);return S.data.locations.reduce((a,l)=>a+Number(i[l.id]||0),0)}
function now(){return new Date().toLocaleString('sv-SE').slice(0,16)}
function currentTemplate(){return S.data.invoice_templates.find(x=>x.id===S.currentTemplateId)||S.data.invoice_templates[0]}

function toggleSetItem(setName,id,checked){
  const set=S[setName]; if(!set)return;
  if(checked)set.add(id); else set.delete(id);
}
function selectAllVisibleProducts(checked){
  S.data.products.slice(0,S.pageSize).forEach(p=>checked?S.selectedProducts.add(p.id):S.selectedProducts.delete(p.id));
  renderProducts();
}
function selectAllInventoryProducts(checked){
  S.data.products.forEach(p=>checked?S.selectedProducts.add(p.id):S.selectedProducts.delete(p.id));
  renderInventory();
}
function selectAllCustomers(checked){
  S.data.customers.forEach(c=>checked?S.selectedCustomers.add(c.id):S.selectedCustomers.delete(c.id));
  renderCustomers();
}
function moveIdsInArray(arr,ids,dir){
  if(!ids.size)return false;
  if(dir<0){
    for(let i=1;i<arr.length;i++){
      if(ids.has(arr[i].id)&&!ids.has(arr[i-1].id)){[arr[i-1],arr[i]]=[arr[i],arr[i-1]]}
    }
  }else{
    for(let i=arr.length-2;i>=0;i--){
      if(ids.has(arr[i].id)&&!ids.has(arr[i+1].id)){[arr[i],arr[i+1]]=[arr[i+1],arr[i]]}
    }
  }
  return true;
}
async function moveSelectedProducts(dir){
  if(!S.selectedProducts.size)return alert('이동할 제품을 선택하세요.');
  moveIdsInArray(S.data.products,S.selectedProducts,dir);await persist();render();
}
async function deleteSelectedProducts(){
  if(!S.selectedProducts.size)return alert('삭제할 제품을 선택하세요.');
  if(!confirm(`선택한 제품 ${S.selectedProducts.size}개를 삭제할까요?\n제품 DB와 해당 재고정보도 함께 삭제됩니다.`))return;
  const ids=new Set(S.selectedProducts);
  S.data.products=S.data.products.filter(p=>!ids.has(p.id));
  S.data.inventory=S.data.inventory.filter(x=>!ids.has(x.product_id));
  S.data.stock_logs=S.data.stock_logs.filter(x=>!ids.has(x.product_id));
  S.selectedProducts.clear();await persist();render();
}
async function moveSelectedCustomers(dir){
  if(!S.selectedCustomers.size)return alert('이동할 지점/고객을 선택하세요.');
  moveIdsInArray(S.data.customers,S.selectedCustomers,dir);await persist();renderCustomers();
}
async function deleteSelectedCustomers(){
  if(!S.selectedCustomers.size)return alert('삭제할 지점/고객을 선택하세요.');
  if(!confirm(`선택한 지점/고객 ${S.selectedCustomers.size}개를 삭제할까요?`))return;
  const ids=new Set(S.selectedCustomers);
  S.data.customers=S.data.customers.filter(c=>!ids.has(c.id));
  S.selectedCustomers.clear();await persist();renderCustomers();
}
function productSelectBox(id){return `<input class="row-check" type="checkbox" ${S.selectedProducts.has(id)?'checked':''} onclick="event.stopPropagation()" onchange="toggleSetItem('selectedProducts','${id}',this.checked)">`}
function customerSelectBox(id){return `<input class="row-check" type="checkbox" ${S.selectedCustomers.has(id)?'checked':''} onchange="toggleSetItem('selectedCustomers','${id}',this.checked)">`}

async function initCloud(){
  const cfg=JSON.parse(localStorage.getItem('nayeso_supabase')||'null');
  if(!cfg?.url||!cfg?.key)return;
  try{
    S.supabase=supabase.createClient(cfg.url,cfg.key);
    const {data,error}=await S.supabase.from('app_state').select('payload').eq('id',1).single();
    if(error)throw error;
    if(data?.payload && Object.keys(data.payload).length){S.data=data.payload;normalizeData();S.cloud=true;document.getElementById('syncState').textContent='클라우드 실시간 동기화';render()}
    else {S.cloud=true;await persist()}
    S.supabase.channel('nayeso-state').on('postgres_changes',{event:'UPDATE',schema:'public',table:'app_state',filter:'id=eq.1'},payload=>{if(payload.new?.payload){S.data=payload.new.payload;normalizeData();render()}}).subscribe();
  }catch(e){console.warn(e);document.getElementById('syncState').textContent='클라우드 연결 실패 / 로컬 모드'}
}
async function persist(){saveLocal();if(S.cloud&&S.supabase)await S.supabase.from('app_state').upsert({id:1,payload:S.data,updated_at:new Date().toISOString()})}

document.getElementById('nav').addEventListener('click',e=>{if(e.target.dataset.page){S.page=e.target.dataset.page;render()}});
document.getElementById('globalSearch').addEventListener('keydown',e=>{if(e.key==='Enter'){S.page='search';render();renderSearch(e.target.value)}});

function setPageMeta(title,sub){document.getElementById('pageTitle').textContent=title;document.getElementById('pageSub').textContent=sub;document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));document.getElementById('page-'+S.page).classList.add('active');document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('active',b.dataset.page===S.page));const newBtn=document.getElementById('topNewProductBtn');if(newBtn)newBtn.classList.toggle('hidden',S.page!=='products')}
function go(p){S.page=p;render()}
function render(){
  if(!S.data)return;
  renderDashboard();renderProducts();renderInventory();renderCustomers();renderInvoice();renderSearch('');renderSettings();
  const meta={dashboard:['메인 대시보드','제품·재고·거래를 한곳에서 관리합니다.'],products:['제품 DB','Deck / Table / Gallery 보기와 Excel 대량 업로드'],inventory:['재고관리','제품 이미지와 위치별 재고를 함께 확인합니다.'],customers:['지점 / 고객 정보','사업자정보와 관련 문서까지 함께 보관합니다.'],invoice:['거래명세표','기본 양식 또는 저장한 양식으로 작성합니다.'],search:['통합검색','제품·고객·거래명세표를 한 번에 검색합니다.'],settings:['설정 / 백업','클라우드 동기화와 백업을 설정합니다.']};setPageMeta(...meta[S.page]);
}

function renderDashboard(){
  document.getElementById('page-dashboard').innerHTML=`<div class="grid cols-4">
    <div class="card metric"><span class="muted">등록 제품</span><strong>${S.data.products.length}개</strong></div>
    <div class="card metric"><span class="muted">전체 재고</span><strong>${S.data.products.reduce((a,p)=>a+totalQty(p.id),0)}개</strong></div>
    <div class="card metric"><span class="muted">지점/고객</span><strong>${S.data.customers.length}곳</strong></div>
    <div class="card metric"><span class="muted">거래명세표</span><strong>${S.data.invoices.length}건</strong></div></div>
    <div class="grid cols-2" style="margin-top:16px">
      <div class="card"><h3>최근 제품</h3><div class="product-grid dashboard-products">${S.data.products.slice(0,3).map(p=>`<div class="product-card dashboard-product-card" onclick="openProduct('${p.id}')">${imgTag(p)}<div class="body"><b>${p.name}</b><div class="muted">${p.material||''} · 총수량 ${totalQty(p.id)}</div></div></div>`).join('')}</div></div>
      <div class="card"><h3>빠른 실행</h3><div class="quick-grid"><button class="secondary" onclick="openProduct()">+ 새 제품 등록</button><button class="secondary" onclick="triggerExcel()">Excel + 이미지 대량등록</button><button class="secondary" onclick="go('inventory')">재고 수량 변경</button><button class="secondary" onclick="go('customers')">지점 / 고객 정보</button><button class="secondary" onclick="go('invoice')">거래명세표 작성</button></div></div>
    </div>`;
}

function renderProducts(){
  const ps=S.data.products;let body='';
  if(S.productView==='gallery') body=`<div class="product-grid folder-grid">${ps.slice(0,S.pageSize).map(p=>`<div class="product-card folder-card" onclick="openProduct('${p.id}')"><div class="card-select">${productSelectBox(p.id)}</div><div class="folder-image">${imgTag(p)}</div><div class="body"><b>${p.name}</b><div class="muted">${p.material||''}${p.group?' · '+p.group:''}</div><div class="folder-stock">총수량 <b>${totalQty(p.id)}</b></div></div></div>`).join('')}</div>`;
  else body=`<div class="deck-list">${ps.slice(0,S.pageSize).map(p=>`<div class="deck-row" onclick="openProduct('${p.id}')"><div class="deck-select">${productSelectBox(p.id)}</div>${imgTag(p)}<div><b>${p.name}</b><div class="muted">${p.material||''} · ${p.group||''}</div></div><div></div><div>총수량 <b>${totalQty(p.id)}</b></div></div>`).join('')}</div>`;
  document.getElementById('page-products').innerHTML=`<div class="toolbar tabs">
    <button class="active">전체</button><button>소재별</button><button>그룹별</button>
    <span class="spacer"></span>
    <button class="secondary" onclick="selectAllVisibleProducts(true)">전체선택</button>
    <button class="secondary" onclick="S.selectedProducts.clear();renderProducts()">선택해제</button>
    <button class="secondary" onclick="moveSelectedProducts(-1)">↑ 위로</button>
    <button class="secondary" onclick="moveSelectedProducts(1)">↓ 아래로</button>
    <button class="danger" onclick="deleteSelectedProducts()">선택삭제</button>
    ${['deck','gallery'].map(v=>`<button class="${S.productView===v?'active':''}" onclick="S.productView='${v}';renderProducts()">${v==='gallery'?'큰 아이콘':'Deck'}</button>`).join('')}
    <select onchange="S.pageSize=+this.value;renderProducts()">${[10,20,50,100].map(n=>`<option ${S.pageSize===n?'selected':''}>${n}</option>`).join('')}</select>
    <button class="primary" onclick="triggerExcel()">Excel + 이미지 업로드</button>
  </div>${body}`;
}
function openProduct(id){
  S.detailEdit=!id;
  const p=id?S.data.products.find(x=>x.id===id):{id:'',name:'',material:'',finish:'',weight_g:'',w:'',d:'',h:'',cbm:'',cost:'',branch_price:'',wholesale_price:'',sale_price:'',group:'',image:'',detail_notes:[]};
  window._detailId=id||'';window._pendingImage='';window._newProductDraft=id?null:clone(p);drawProductModal(p);
}
function drawProductModal(p){
  const edit=S.detailEdit;
  const readonlyRows=[['제품명',p.name],['그룹',p.group],['수종/소재',p.material],['마감',p.finish],['무게(g)',p.weight_g?money(p.weight_g)+' g':''],['CBM',p.cbm?`${p.cbm} m³`:''],['원가',p.cost?money(p.cost)+'원':''],['지점가',p.branch_price?money(p.branch_price)+'원':''],['1차 도매가',p.wholesale_price?money(p.wholesale_price)+'원':''],['판매가',p.sale_price?money(p.sale_price)+'원':'']];
  document.getElementById('modalBody').innerHTML=`<div class="${edit?'':'readonly-view'} product-modal-inner">
    <div class="toolbar"><h2 style="margin:0">${p.id?'제품 상세':'새 제품 등록'}</h2><span class="spacer"></span>${p.id&&!edit?`<button class="primary" onclick="enableDetailEdit()">수정 / Edit</button>`:''}</div>
    <div class="detail-view-grid product-register-grid">
      <div class="product-image-panel">${p.image?`<img class="detail-img" src="${p.image}">`:`<div class="detail-img img-placeholder">NO IMAGE</div>`}<button class="secondary edit-only" onclick="chooseImage()" style="margin-top:8px">이미지 선택</button><div class="muted" style="margin-top:7px">큰 사진도 전체가 자동으로 보이도록 맞춰집니다.</div></div>
      <div class="product-form-panel">
        ${!edit?`<div class="size-row compact-size-row"><div class="size-box"><span class="muted">W</span><b>${p.w||'-'} mm</b></div><div class="size-box"><span class="muted">D</span><b>${p.d||'-'} mm</b></div><div class="size-box"><span class="muted">H</span><b>${p.h||'-'} mm</b></div><div class="size-box"><span class="muted">CBM</span><b>${p.cbm||'-'}</b></div></div><div class="detail-basic-list compact-basic-list">${readonlyRows.map(r=>`<div class="detail-basic-row"><div class="label">${r[0]}</div><div class="value">${r[1]||'-'}</div></div>`).join('')}</div>`:
        `<div class="size-row compact-size-row">${field('W(mm)','w',p.w,'number')}${field('D(mm)','d',p.d,'number')}${field('H(mm)','h',p.h,'number')}<label>CBM<input id="f-cbm" value="${p.cbm||''}" readonly><button class="secondary cbm-btn" onclick="calcCBM()">자동계산</button></label></div>
         <div class="form-grid product-form-stack">${field('제품명','name',p.name)}${field('그룹','group',p.group)}${field('수종/소재','material',p.material)}${field('마감','finish',p.finish)}${field('무게(g)','weight_g',p.weight_g,'number')}${field('원가','cost',p.cost,'number')}${field('지점가','branch_price',p.branch_price,'number')}${field('1차 도매가','wholesale_price',p.wholesale_price,'number')}${field('판매가','sale_price',p.sale_price,'number')}</div>`}
      </div>
    </div>

    <div class="note-detail-wrap">
      <div class="toolbar note-toolbar"><div><h3 style="margin:0">제품 상세 내역 노트</h3><div class="muted">이미지와 글을 원하는 위치에 놓고, 드래그해서 이동하거나 크기를 조절할 수 있습니다.</div></div><span class="spacer"></span>${edit?`<button class="secondary" onclick="addNoteText()">+ 글 추가</button><button class="secondary" onclick="addNoteImage()">+ 이미지 추가</button><button class="secondary" onclick="addNoteSpace()">+ 노트 공간 늘리기</button>`:''}</div>
      <div id="noteBoard" class="note-board ${edit?'editing':''}" style="height:${Math.max(620,p.note_height||620)}px">${renderNoteItems(p,edit)}</div>
    </div>

    <div class="row-actions" style="margin-top:16px">${edit?`<button class="primary" onclick="saveProduct('${p.id||''}')">저장</button><button class="secondary" onclick="cancelDetailEdit()">취소</button>`:''}${p.id&&!edit?`<button class="secondary" onclick="printProductDetail()">제품 상세 출력</button>`:''}${p.id?`<button class="danger edit-only" onclick="deleteProduct('${p.id}')">삭제</button>`:''}</div>
  </div>`;
  document.getElementById('modal').classList.remove('hidden');
  if(edit)setTimeout(initNoteInteractions,0);
}
function escapeHtml(s){return String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function enableDetailEdit(){S.detailEdit=true;const p=S.data.products.find(x=>x.id===window._detailId);window._newProductDraft=null;drawProductModal(p)}
function cancelDetailEdit(){if(window._detailId){S.detailEdit=false;drawProductModal(S.data.products.find(x=>x.id===window._detailId))}else closeModal()}
function field(label,id,val,type='text'){return `<label>${label}<input id="f-${id}" type="${type}" value="${val??''}"></label>`}
function v(id){return document.getElementById('f-'+id)?.value??''}
function calcCBM(){const w=+v('w'),d=+v('d'),h=+v('h');document.getElementById('f-cbm').value=w&&d&&h?((w*d*h)/1e9).toFixed(6):''}
function getDraftProduct(){
  if(window._detailId)return S.data.products.find(x=>x.id===window._detailId);
  if(!window._newProductDraft)window._newProductDraft={id:'',name:'',material:'',finish:'',weight_g:'',w:'',d:'',h:'',cbm:'',cost:'',branch_price:'',wholesale_price:'',sale_price:'',group:'',image:'',detail_notes:[],note_height:620};
  return window._newProductDraft;
}
function renderNoteItems(p,edit){
  const items=p.detail_notes||[];
  if(!items.length&&!edit)return `<div class="note-empty">등록된 상세 노트가 없습니다.</div>`;
  return items.map((n,i)=>`<div class="note-item ${n.type}" data-i="${i}" style="left:${n.x||20}px;top:${n.y||20}px;width:${n.w||220}px;height:${n.h||120}px">${edit?`<div class="note-handle">이동 <button onclick="removeNoteItem(${i});event.stopPropagation()">×</button></div>`:''}${n.type==='image'?`<img src="${n.data||''}">`:`<div class="note-text" ${edit?'contenteditable="true"':''} data-note-text="${i}">${escapeHtml(n.text||'').replace(/\n/g,'<br>')}</div>`}${edit?`<div class="note-resize" title="크기 조절"></div>`:''}</div>`).join('');
}
function syncNoteText(){const p=getDraftProduct();document.querySelectorAll('[data-note-text]').forEach(el=>{const i=+el.dataset.noteText;if(p.detail_notes[i])p.detail_notes[i].text=el.innerText})}
function addNoteText(){syncNoteText();const p=getDraftProduct(),y=nextNoteY(p);p.detail_notes.push({type:'text',text:'여기에 내용을 입력하세요.',x:24,y,w:300,h:120});drawProductModal(p)}
function addNoteImage(){syncNoteText();document.getElementById('noteImageInput').click()}
function addNoteSpace(){syncNoteText();const p=getDraftProduct();p.note_height=Math.max(620,p.note_height||620)+400;drawProductModal(p)}
function nextNoteY(p){return (p.detail_notes||[]).reduce((m,n)=>Math.max(m,(n.y||0)+(n.h||0)+20),20)}
function removeNoteItem(i){syncNoteText();const p=getDraftProduct();p.detail_notes.splice(i,1);drawProductModal(p)}
function chooseImage(){document.getElementById('imageInput').click()}
document.getElementById('imageInput').addEventListener('change',e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{window._pendingImage=r.result;let p=getDraftProduct();p.image=r.result;drawProductModal(p)};r.readAsDataURL(f);e.target.value=''})
document.getElementById('noteImageInput').addEventListener('change',e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{syncNoteText();let p=getDraftProduct(),y=nextNoteY(p);p.detail_notes.push({type:'image',data:r.result,x:24,y,w:320,h:220});p.note_height=Math.max(p.note_height||620,y+280);drawProductModal(p)};r.readAsDataURL(f);e.target.value=''})
function initNoteInteractions(){
  const board=document.getElementById('noteBoard');if(!board)return;
  board.querySelectorAll('.note-item').forEach(el=>{
    const handle=el.querySelector('.note-handle'),resize=el.querySelector('.note-resize');
    if(handle)handle.onpointerdown=e=>startMove(e,el,board);
    if(resize)resize.onpointerdown=e=>startResize(e,el,board);
  })
}
function startMove(e,el,board){e.preventDefault();syncNoteText();const p=getDraftProduct(),n=p.detail_notes[+el.dataset.i],sx=e.clientX,sy=e.clientY,ox=n.x||0,oy=n.y||0;el.setPointerCapture?.(e.pointerId);const move=ev=>{n.x=Math.max(0,Math.min(board.clientWidth-el.offsetWidth,ox+ev.clientX-sx));n.y=Math.max(0,oy+ev.clientY-sy);el.style.left=n.x+'px';el.style.top=n.y+'px'};const up=()=>{document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up)};document.addEventListener('pointermove',move);document.addEventListener('pointerup',up)}
function startResize(e,el,board){e.preventDefault();e.stopPropagation();syncNoteText();const p=getDraftProduct(),n=p.detail_notes[+el.dataset.i],sx=e.clientX,sy=e.clientY,ow=el.offsetWidth,oh=el.offsetHeight;const move=ev=>{n.w=Math.max(120,Math.min(board.clientWidth-(n.x||0),ow+ev.clientX-sx));n.h=Math.max(70,oh+ev.clientY-sy);el.style.width=n.w+'px';el.style.height=n.h+'px'};const up=()=>{document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up)};document.addEventListener('pointermove',move);document.addEventListener('pointerup',up)}

async function saveProduct(id){
  syncNoteText();const draft=getDraftProduct();
  const obj={id:id||uid('p'),name:v('name'),group:v('group'),w:+v('w')||0,d:+v('d')||0,h:+v('h')||0,cbm:+v('cbm')||0,material:v('material'),finish:v('finish'),weight_g:+v('weight_g')||0,cost:+v('cost')||0,branch_price:+v('branch_price')||0,wholesale_price:+v('wholesale_price')||0,sale_price:+v('sale_price')||0,image:window._pendingImage||draft.image||'',detail_notes:clone(draft.detail_notes||[]),note_height:draft.note_height||620,detail_sections:draft.detail_sections||[],detail_ko:draft.detail_ko||'',detail_id:draft.detail_id||'',detail_en:draft.detail_en||''};
  if(id)Object.assign(S.data.products.find(x=>x.id===id),obj);else{S.data.products.push(obj);S.data.inventory.push({product_id:obj.id,updated_at:now()})}
  window._newProductDraft=null;window._pendingImage='';await persist();S.detailEdit=false;window._detailId=obj.id;drawProductModal(obj);render();
}
async function deleteProduct(id){if(!confirm('제품을 삭제할까요?'))return;S.data.products=S.data.products.filter(x=>x.id!==id);S.data.inventory=S.data.inventory.filter(x=>x.product_id!==id);await persist();closeModal();render()}
function closeModal(){document.getElementById('modal').classList.add('hidden')}
function printProductDetail(){window.print()}

function renderInventory(){
  const locs=S.data.locations;
  document.getElementById('page-inventory').innerHTML=`<div class="toolbar">
    <button class="primary" onclick="stockMove()">+ 입고 / 출고 / 이동</button><button class="secondary" onclick="manageLocations()">위치 관리</button>
    <span class="spacer"></span>
    <button class="secondary" onclick="selectAllInventoryProducts(true)">전체선택</button>
    <button class="secondary" onclick="S.selectedProducts.clear();renderInventory()">선택해제</button>
    <button class="secondary" onclick="moveSelectedProducts(-1)">↑ 위로</button>
    <button class="secondary" onclick="moveSelectedProducts(1)">↓ 아래로</button>
    <button class="danger" onclick="deleteSelectedProducts()">선택삭제</button>
  </div>
  <div class="table-wrap"><table><thead><tr><th class="select-col">선택</th><th>이미지</th><th>제품명</th>${locs.map(l=>`<th>${l.name}</th>`).join('')}<th>총수량</th><th>변경날짜</th></tr></thead><tbody>
  ${S.data.products.map(p=>{let inv=invFor(p.id);return `<tr><td class="select-col">${productSelectBox(p.id)}</td><td class="image-cell">${p.image?`<img class="inv-img" src="${p.image}">`:`<div class="img-placeholder inv-img">NO</div>`}</td><td>${p.name}</td>${locs.map(l=>`<td><input type="number" value="${inv[l.id]||0}" onchange="updateStock('${p.id}','${l.id}',this.value)"></td>`).join('')}<td><b>${totalQty(p.id)}</b></td><td>${inv.updated_at||''}</td></tr>`}).join('')}</tbody></table></div>
  <div class="card" style="margin-top:16px"><h3>최근 재고 이력</h3>${S.data.stock_logs.slice(-10).reverse().map(x=>`<div class="search-result">${x.at} · ${x.product} · ${x.note}</div>`).join('')||'<span class="muted">아직 이력이 없습니다.</span>'}</div>`;
}
async function updateStock(pid,lid,val){let inv=invFor(pid);if(!S.data.inventory.includes(inv))S.data.inventory.push(inv);inv[lid]=+val||0;inv.updated_at=now();S.data.stock_logs.push({at:now(),product:S.data.products.find(p=>p.id===pid)?.name,note:'직접 수량 조정'});await persist();renderInventory()}
function manageLocations(){document.getElementById('modalBody').innerHTML=`<h2>재고 위치 관리</h2>${S.data.locations.map((l,i)=>`<div class="toolbar"><input id="loc-${i}" value="${l.name}"><button onclick="renameLoc(${i})">이름변경</button><button class="danger" onclick="removeLoc(${i})">삭제</button></div>`).join('')}<div class="toolbar"><input id="newLoc" placeholder="새 위치명"><button class="primary" onclick="addLoc()">+ 위치 추가</button></div>`;document.getElementById('modal').classList.remove('hidden')}
async function renameLoc(i){S.data.locations[i].name=document.getElementById('loc-'+i).value;await persist();manageLocations();renderInventory()}
async function addLoc(){const name=document.getElementById('newLoc').value.trim();if(!name)return;S.data.locations.push({id:uid('l'),name});await persist();manageLocations();renderInventory()}
async function removeLoc(i){if(!confirm('위치를 삭제할까요?'))return;const id=S.data.locations[i].id;S.data.locations.splice(i,1);S.data.inventory.forEach(x=>delete x[id]);await persist();manageLocations();renderInventory()}
function stockMove(){const optsP=S.data.products.map(p=>`<option value="${p.id}">${p.name}</option>`).join(''),optsL=S.data.locations.map(l=>`<option value="${l.id}">${l.name}</option>`).join('');document.getElementById('modalBody').innerHTML=`<h2>입고 / 출고 / 이동</h2><div class="form-grid"><label>제품<select id="sm-p">${optsP}</select></label><label>구분<select id="sm-type"><option>입고</option><option>출고</option><option>이동</option></select></label><label>출발 위치<select id="sm-from">${optsL}</select></label><label>도착 위치<select id="sm-to">${optsL}</select></label><label>수량<input id="sm-q" type="number"></label><label>메모<input id="sm-note"></label></div><button class="primary" onclick="applyStockMove()">반영</button>`;document.getElementById('modal').classList.remove('hidden')}
async function applyStockMove(){const pid=document.getElementById('sm-p').value,type=document.getElementById('sm-type').value,from=document.getElementById('sm-from').value,to=document.getElementById('sm-to').value,q=+document.getElementById('sm-q').value||0,note=document.getElementById('sm-note').value;let inv=invFor(pid);if(!S.data.inventory.includes(inv))S.data.inventory.push(inv);if(type==='입고')inv[to]=(inv[to]||0)+q;if(type==='출고')inv[from]=(inv[from]||0)-q;if(type==='이동'){inv[from]=(inv[from]||0)-q;inv[to]=(inv[to]||0)+q}inv.updated_at=now();S.data.stock_logs.push({at:now(),product:S.data.products.find(p=>p.id===pid)?.name,note:`${type} ${q}개 ${note}`});await persist();closeModal();render()}

function renderCustomers(){
  document.getElementById('page-customers').innerHTML=`<div class="toolbar">
    <button class="secondary" onclick="selectAllCustomers(true)">전체선택</button>
    <button class="secondary" onclick="S.selectedCustomers.clear();renderCustomers()">선택해제</button>
    <button class="secondary" onclick="moveSelectedCustomers(-1)">↑ 위로</button>
    <button class="secondary" onclick="moveSelectedCustomers(1)">↓ 아래로</button>
    <button class="danger" onclick="deleteSelectedCustomers()">선택삭제</button>
    <span class="spacer"></span><button class="primary" onclick="editCustomer()">+ 신규 등록</button>
  </div><div class="table-wrap"><table><thead><tr><th class="select-col">선택</th><th>구분</th><th>지점/고객명</th><th>사업자등록번호</th><th>담당자</th><th>연락처</th><th>주소</th><th>기본 가격</th><th>사업자등록증</th><th></th></tr></thead><tbody>${S.data.customers.map(c=>`<tr><td class="select-col">${customerSelectBox(c.id)}</td><td>${c.type}</td><td>${c.name}</td><td>${c.business_no||''}</td><td>${c.contact||''}</td><td>${c.phone||''}</td><td>${c.address||''}</td><td>${priceLabel(c.price_level)}</td><td>${c.business_doc_data?`<span class="customer-doc-link" onclick="downloadBusinessDoc('${c.id}')">${c.business_doc_name||'다운로드'}</span>`:'-'}</td><td><button onclick="editCustomer('${c.id}')">수정</button></td></tr>`).join('')}</tbody></table></div>`;
}
function priceLabel(k){return {branch_price:'지점가',wholesale_price:'1차 도매가',sale_price:'판매가',cost:'원가'}[k]||k}
function editCustomer(id){
  const c=id?S.data.customers.find(x=>x.id===id):{type:'지점',name:'',contact:'',phone:'',address:'',business_no:'',price_level:'branch_price',business_doc_name:'',business_doc_data:''};
  window._customerDoc={name:c.business_doc_name,data:c.business_doc_data};
  document.getElementById('modalBody').innerHTML=`<h2>${id?'지점/고객 수정':'신규 지점/고객'}</h2><div class="form-grid"><label>구분<select id="c-type"><option ${c.type==='지점'?'selected':''}>지점</option><option ${c.type==='고객'?'selected':''}>고객</option></select></label>${field2('이름','name',c.name)}${field2('사업자등록번호','business_no',c.business_no)}${field2('담당자','contact',c.contact)}${field2('연락처','phone',c.phone)}${field2('주소','address',c.address)}<label>기본 가격<select id="c-price_level"><option value="branch_price" ${c.price_level==='branch_price'?'selected':''}>지점가</option><option value="wholesale_price" ${c.price_level==='wholesale_price'?'selected':''}>1차 도매가</option><option value="sale_price" ${c.price_level==='sale_price'?'selected':''}>판매가</option></select></label><label>사업자등록증 / 관련서류<input type="file" id="c-doc" onchange="customerDocPicked(this)"><div class="muted">${c.business_doc_name||'등록된 파일 없음'}</div></label></div><button class="primary" onclick="saveCustomer('${id||''}')">저장</button>`;document.getElementById('modal').classList.remove('hidden')
}
function field2(l,id,val){return `<label>${l}<input id="c-${id}" value="${val||''}"></label>`}
function customerDocPicked(input){const f=input.files[0];if(!f)return;const r=new FileReader();r.onload=()=>window._customerDoc={name:f.name,data:r.result};r.readAsDataURL(f)}
async function saveCustomer(id){const o={id:id||uid('c'),type:document.getElementById('c-type').value,name:document.getElementById('c-name').value,business_no:document.getElementById('c-business_no').value,contact:document.getElementById('c-contact').value,phone:document.getElementById('c-phone').value,address:document.getElementById('c-address').value,price_level:document.getElementById('c-price_level').value,business_doc_name:window._customerDoc?.name||'',business_doc_data:window._customerDoc?.data||''};if(id)Object.assign(S.data.customers.find(x=>x.id===id),o);else S.data.customers.push(o);await persist();closeModal();render()}
function downloadBusinessDoc(id){const c=S.data.customers.find(x=>x.id===id);if(!c?.business_doc_data)return;const a=document.createElement('a');a.href=c.business_doc_data;a.download=c.business_doc_name||'사업자등록증';a.click()}

function getInvoiceOptions(){
  return S.invoiceOptions||(S.invoiceOptions={show_branch:true,show_contact:false,show_phone:false,show_business_no:false,vat_mode:'included'});
}
function renderInvoice(){
  const t=currentTemplate(),o=getInvoiceOptions();
  document.getElementById('page-invoice').innerHTML=`<div class="toolbar no-print template-bar">
    <label>양식 <select id="templateSelect" onchange="S.currentTemplateId=this.value;renderInvoice()">${S.data.invoice_templates.map(x=>`<option value="${x.id}" ${x.id===t.id?'selected':''}>${x.name}</option>`).join('')}</select></label>
    <button class="secondary" onclick="manageInvoiceTemplates()">양식 관리</button>
    <label><input type="checkbox" ${o.show_branch?'checked':''} onchange="setInvoiceOpt('show_branch',this.checked)"> 지점명</label>
    <label><input type="checkbox" ${o.show_contact?'checked':''} onchange="setInvoiceOpt('show_contact',this.checked)"> 이름</label>
    <label><input type="checkbox" ${o.show_phone?'checked':''} onchange="setInvoiceOpt('show_phone',this.checked)"> 전화번호</label>
    <label><input type="checkbox" ${o.show_business_no?'checked':''} onchange="setInvoiceOpt('show_business_no',this.checked)"> 사업자번호</label>
    <label>VAT <select onchange="setInvoiceOpt('vat_mode',this.value)"><option value="included" ${o.vat_mode==='included'?'selected':''}>포함</option><option value="excluded" ${o.vat_mode==='excluded'?'selected':''}>미포함</option></select></label>
    <span class="spacer"></span><button class="secondary" onclick="exportInvoiceExcel()">Excel 저장</button><button class="secondary" onclick="saveInvoicePdf()">PDF 저장</button><button class="primary" onclick="printInvoice()">프린트</button>
  </div>
  <div class="invoice-sheet" id="invoiceCapture">
    <div class="invoice-title">${t.title||'거래명세서'}</div>
    <div class="invoice-topline"><div id="invoiceCustomerLine">지점: <select id="inv-customer" onchange="invoiceCustomerChanged()"><option value="">선택</option>${S.data.customers.map(c=>`<option value="${c.id}">${c.name}</option>`).join('')}</select></div><div>주문일자: <input id="inv-date" type="date" value="${new Date().toISOString().slice(0,10)}"></div></div>
    <div class="no-print invoice-item-tools" style="margin:10px 0"><button class="primary" onclick="addInvoiceProduct()">+ 제품 선택</button><button class="secondary" onclick="selectAllInvoiceItems(true)">전체선택</button><button class="secondary" onclick="selectAllInvoiceItems(false)">선택해제</button><button class="secondary" onclick="moveSelectedInvoiceItems(-1)">↑ 위로</button><button class="secondary" onclick="moveSelectedInvoiceItems(1)">↓ 아래로</button><button class="danger" onclick="deleteSelectedInvoiceItems()">선택삭제</button></div>
    <table><thead><tr><th class="no-print select-col">선택</th><th>순번</th><th>이미지</th><th>제품명/규격</th><th>수종</th><th>공급가</th><th>수량</th><th>금액</th><th>비고</th></tr></thead><tbody id="invoiceRows"></tbody></table>
    <table class="invoice-summary"><tbody><tr><td>TOTAL</td><td id="invoiceSubtotal">0</td></tr><tr id="vatRow"><td>VAT (10%)</td><td id="invoiceVat">0</td></tr><tr><td><b>GRAND TOTAL</b></td><td><b id="invoiceGrand">0</b></td></tr></tbody></table>
    <div class="invoice-bank">${t.bank_info||''}</div>
    <div class="no-print" style="margin-top:12px"><button class="primary" onclick="saveInvoice()">명세표 저장</button></div>
  </div>`;
  drawInvoiceRows();invoiceCustomerChanged();
}
function setInvoiceOpt(k,v){getInvoiceOptions()[k]=v;renderInvoice()}
function invoiceCustomerChanged(){
  drawInvoiceRows();const cid=document.getElementById('inv-customer')?.value,c=S.data.customers.find(x=>x.id===cid),o=getInvoiceOptions();
  const parts=[];if(o.show_branch)parts.push(`지점명: ${c?.name||''}`);if(o.show_contact)parts.push(`이름: ${c?.contact||''}`);if(o.show_phone)parts.push(`전화번호: ${c?.phone||''}`);if(o.show_business_no)parts.push(`사업자번호: ${c?.business_no||''}`);
  const el=document.getElementById('invoiceCustomerLine');if(el){el.innerHTML=`<span class="invoice-customer-print">${parts.join(' &nbsp;&nbsp; ')||'지점: '}</span><span class="invoice-customer-edit">지점: <select id="inv-customer" onchange="invoiceCustomerChanged()"><option value="">선택</option>${S.data.customers.map(x=>`<option value="${x.id}" ${x.id===cid?'selected':''}>${x.name}</option>`).join('')}</select></span>`;}
}
function addInvoiceProduct(){document.getElementById('modalBody').innerHTML=`<h2>제품 선택</h2><div class="product-grid invoice-picker-grid">${S.data.products.map(p=>`<div class="product-card invoice-picker-card" onclick="selectInvoiceProduct('${p.id}')"><div class="invoice-picker-image">${imgTag(p)}</div><div class="body"><b>${p.name}</b><div class="muted">${p.material||''}</div></div></div>`).join('')}</div>`;document.getElementById('modal').classList.remove('hidden')}
function selectInvoiceProduct(pid){if(!S.selectedInvoiceItems.some(x=>x.product_id===pid))S.selectedInvoiceItems.push({product_id:pid,qty:1,price:null,note:'',selected:false});closeModal();drawInvoiceRows()}

function moveSelectedInvoiceItems(dir){
  const a=S.selectedInvoiceItems;
  if(dir<0){for(let i=1;i<a.length;i++)if(a[i].selected&&!a[i-1].selected)[a[i-1],a[i]]=[a[i],a[i-1]]}
  else{for(let i=a.length-2;i>=0;i--)if(a[i].selected&&!a[i+1].selected)[a[i],a[i+1]]=[a[i+1],a[i]]}
  drawInvoiceRows();
}
function deleteSelectedInvoiceItems(){
  S.selectedInvoiceItems=S.selectedInvoiceItems.filter(x=>!x.selected);drawInvoiceRows();
}
function selectAllInvoiceItems(v){S.selectedInvoiceItems.forEach(x=>x.selected=v);drawInvoiceRows()}
function currentPrice(p){const cid=document.getElementById('inv-customer')?.value,c=S.data.customers.find(x=>x.id===cid);return Number(p?.[c?.price_level||'sale_price']||0)}
function invoiceTotals(){const sub=S.selectedInvoiceItems.reduce((a,x)=>a+(Number(x.price)||0)*(Number(x.qty)||0),0),o=getInvoiceOptions();const vat=o.vat_mode==='included'?Math.round(sub*0.10):0;return {sub,vat,grand:sub+vat}}
function drawInvoiceRows(){
  const tbody=document.getElementById('invoiceRows');if(!tbody)return;
  tbody.innerHTML=S.selectedInvoiceItems.map((it,i)=>{const p=S.data.products.find(x=>x.id===it.product_id);if(it.price==null)it.price=currentPrice(p);return `<tr><td class="no-print select-col"><input class="row-check" type="checkbox" ${it.selected?'checked':''} onchange="S.selectedInvoiceItems[${i}].selected=this.checked"></td><td>${i+1}</td><td class="invoice-image-cell">${p.image?`<img class="invoice-img" src="${p.image}">`:''}</td><td><div class="invoice-name">${p.name}</div><div class="invoice-size">${p.w||0}×${p.d||0}×${p.h||0}</div></td><td>${p.material||''}</td><td><span class="print-value">₩ ${money(it.price)}</span><input class="edit-value" type="number" value="${it.price}" onchange="S.selectedInvoiceItems[${i}].price=+this.value;drawInvoiceRows()"></td><td><span class="print-value">${it.qty}</span><input class="edit-value" type="number" value="${it.qty}" onchange="S.selectedInvoiceItems[${i}].qty=+this.value;drawInvoiceRows()"></td><td>₩ ${money(it.price*it.qty)}</td><td><span class="print-value">${escapeHtml(it.note||'')}</span><input class="edit-value" value="${escapeHtml(it.note||'')}" onchange="S.selectedInvoiceItems[${i}].note=this.value"></td></tr>`}).join('');
  const {sub,vat,grand}=invoiceTotals();document.getElementById('invoiceSubtotal').textContent='₩ '+money(sub);document.getElementById('invoiceVat').textContent='₩ '+money(vat);document.getElementById('invoiceGrand').textContent='₩ '+money(grand);document.getElementById('vatRow').style.display=getInvoiceOptions().vat_mode==='included'?'table-row':'none';
}
function manageInvoiceTemplates(){
  document.getElementById('modalBody').innerHTML=`<h2>거래명세서 양식 관리</h2><p class="muted">기본 디자인을 저장해 두고 반복 사용할 수 있습니다.</p>${S.data.invoice_templates.map((t,i)=>`<div class="detail-section-card"><label>양식명<input id="t-name-${i}" value="${t.name}"></label><label>제목<input id="t-title-${i}" value="${t.title||'거래명세서'}"></label><label>입금계좌/하단문구<input id="t-bank-${i}" value="${t.bank_info||''}"></label><button class="secondary" onclick="saveTemplate(${i})">저장</button>${i?` <button class="danger" onclick="deleteTemplate(${i})">삭제</button>`:''}</div>`).join('')}<button class="primary" onclick="addTemplate()">+ 새 양식 추가</button>`;document.getElementById('modal').classList.remove('hidden')
}
async function saveTemplate(i){const t=S.data.invoice_templates[i];t.name=document.getElementById('t-name-'+i).value;t.title=document.getElementById('t-title-'+i).value;t.bank_info=document.getElementById('t-bank-'+i).value;await persist();renderInvoice();manageInvoiceTemplates()}
async function addTemplate(){S.data.invoice_templates.push({id:uid('t'),name:'새 거래명세서',title:'거래명세서',bank_info:''});await persist();manageInvoiceTemplates()}
async function deleteTemplate(i){if(!confirm('이 양식을 삭제할까요?'))return;S.data.invoice_templates.splice(i,1);S.currentTemplateId=S.data.invoice_templates[0].id;await persist();manageInvoiceTemplates()}
async function saveInvoice(){const cid=document.getElementById('inv-customer').value;if(!cid)return alert('지점/고객을 선택하세요.');const t=currentTemplate(),tt=invoiceTotals();S.data.invoices.push({id:uid('inv'),customer_id:cid,date:document.getElementById('inv-date').value,template_id:t.id,items:clone(S.selectedInvoiceItems),subtotal:tt.sub,vat:tt.vat,total:tt.grand,invoice_options:clone(getInvoiceOptions())});await persist();alert('저장되었습니다.')}
function newInvoice(){S.selectedInvoiceItems=[];renderInvoice()}
function copyLastInvoice(){const last=S.data.invoices.at(-1);if(!last)return alert('저장된 명세표가 없습니다.');S.selectedInvoiceItems=clone(last.items);if(last.template_id)S.currentTemplateId=last.template_id;if(last.invoice_options)S.invoiceOptions=clone(last.invoice_options);renderInvoice();setTimeout(()=>{document.getElementById('inv-customer').value=last.customer_id;drawInvoiceRows();invoiceCustomerChanged()},0)}
function setInvoiceOutputMode(on){document.body.classList.toggle('invoice-output-mode',on)}
function printInvoice(){setInvoiceOutputMode(true);document.getElementById('page-invoice').classList.add('print-target');setTimeout(()=>{window.print();setTimeout(()=>{document.getElementById('page-invoice').classList.remove('print-target');setInvoiceOutputMode(false)},300)},80)}
async function saveInvoicePdf(){
  const el=document.getElementById('invoiceCapture');setInvoiceOutputMode(true);await new Promise(r=>setTimeout(r,80));
  try{const canvas=await html2canvas(el,{scale:2,backgroundColor:'#ffffff',useCORS:true});const img=canvas.toDataURL('image/png');const {jsPDF}=window.jspdf;const pdf=new jsPDF('p','mm','a4');const pw=210,ph=297,margin=10;const ratio=Math.min((pw-margin*2)/canvas.width,(ph-margin*2)/canvas.height);const w=canvas.width*ratio,h=canvas.height*ratio;pdf.addImage(img,'PNG',margin,margin,w,h);pdf.save('거래명세서.pdf')}finally{setInvoiceOutputMode(false)}
}
function dataUrlParts(data){const m=String(data||'').match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);if(!m)return null;return {ext:m[1]==='jpg'?'jpeg':m[1],base64:m[2]}}
async function exportInvoiceExcel(){
  if(!window.ExcelJS)return alert('Excel 모듈을 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.');
  const wb=new ExcelJS.Workbook(),ws=wb.addWorksheet('거래명세서',{pageSetup:{paperSize:9,orientation:'portrait',fitToPage:true,fitToWidth:1,fitToHeight:0,margins:{left:0.25,right:0.25,top:0.35,bottom:0.35,header:0,footer:0}}});
  const t=currentTemplate(),cid=document.getElementById('inv-customer')?.value,c=S.data.customers.find(x=>x.id===cid),date=document.getElementById('inv-date')?.value||'',o=getInvoiceOptions(),tt=invoiceTotals();
  const widths=[6,16,28,13,15,10,17,28];ws.columns=widths.map(width=>({width}));
  ws.mergeCells('A1:H2');let cell=ws.getCell('A1');cell.value=t.title||'거래명세서';cell.font={size:22,bold:true,underline:true};cell.alignment={horizontal:'center',vertical:'middle'};ws.getRow(1).height=25;ws.getRow(2).height=18;
  ws.mergeCells('A3:D3');ws.mergeCells('E3:H3');const cp=[];if(o.show_branch)cp.push(`지점명: ${c?.name||''}`);if(o.show_contact)cp.push(`이름: ${c?.contact||''}`);if(o.show_phone)cp.push(`전화번호: ${c?.phone||''}`);if(o.show_business_no)cp.push(`사업자번호: ${c?.business_no||''}`);ws.getCell('A3').value=cp.join('   ');ws.getCell('E3').value=`주문일자: ${date}`;ws.getCell('A3').alignment=ws.getCell('E3').alignment={vertical:'middle'};ws.getRow(3).height=24;
  const headers=['순번','이미지','제품명/규격','수종','공급가','수량','금액','비고'];headers.forEach((h,i)=>{const c=ws.getCell(4,i+1);c.value=h;c.font={bold:true};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFD9D9D9'}};c.alignment={horizontal:'center',vertical:'middle'};});ws.getRow(4).height=23;
  const start=5,minRows=Math.max(3,S.selectedInvoiceItems.length);
  for(let r=0;r<minRows;r++){
    const rowNum=start+r,row=ws.getRow(rowNum);row.height=78;const it=S.selectedInvoiceItems[r];
    if(it){const p=S.data.products.find(x=>x.id===it.product_id);row.getCell(1).value=r+1;row.getCell(3).value=`${p.name}\n${p.w||0}×${p.d||0}×${p.h||0}`;row.getCell(4).value=p.material||'';row.getCell(5).value=Number(it.price)||0;row.getCell(6).value=Number(it.qty)||0;row.getCell(7).value=(Number(it.price)||0)*(Number(it.qty)||0);row.getCell(8).value=it.note||'';row.getCell(5).numFmt='₩ #,##0';row.getCell(7).numFmt='₩ #,##0';
      const dp=dataUrlParts(p.image);if(dp){try{const imageId=wb.addImage({base64:dp.base64,extension:dp.ext});ws.addImage(imageId,{tl:{col:1.15,row:rowNum-0.85},ext:{width:78,height:65}})}catch(e){}}
    }
    row.eachCell({includeEmpty:true},cc=>{cc.alignment={horizontal:'center',vertical:'middle',wrapText:true}})
  }
  const sumStart=start+minRows;ws.mergeCells(`A${sumStart}:D${sumStart+2}`);ws.getCell(`A${sumStart}`).value='합계';ws.getCell(`A${sumStart}`).alignment={horizontal:'center',vertical:'middle'};ws.getCell(`A${sumStart}`).font={bold:true};
  ws.mergeCells(`E${sumStart}:F${sumStart}`);ws.mergeCells(`G${sumStart}:H${sumStart}`);ws.getCell(`E${sumStart}`).value='TOTAL';ws.getCell(`G${sumStart}`).value=tt.sub;ws.getCell(`G${sumStart}`).numFmt='₩ #,##0';
  let last=sumStart;
  if(o.vat_mode==='included'){ws.mergeCells(`E${sumStart+1}:F${sumStart+1}`);ws.mergeCells(`G${sumStart+1}:H${sumStart+1}`);ws.getCell(`E${sumStart+1}`).value='VAT (10%)';ws.getCell(`G${sumStart+1}`).value=tt.vat;ws.getCell(`G${sumStart+1}`).numFmt='₩ #,##0';last=sumStart+1;}
  const gRow=o.vat_mode==='included'?sumStart+2:sumStart+1;ws.mergeCells(`E${gRow}:F${gRow}`);ws.mergeCells(`G${gRow}:H${gRow}`);ws.getCell(`E${gRow}`).value='GRAND TOTAL';ws.getCell(`G${gRow}`).value=tt.grand;ws.getCell(`G${gRow}`).numFmt='₩ #,##0';ws.getCell(`E${gRow}`).font=ws.getCell(`G${gRow}`).font={bold:true};last=gRow;
  ws.mergeCells(`A${last+2}:H${last+2}`);ws.getCell(`A${last+2}`).value=t.bank_info||'';ws.getCell(`A${last+2}`).alignment={horizontal:'center',vertical:'middle'};ws.getCell(`A${last+2}`).font={bold:true};ws.getCell(`A${last+2}`).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFD9D9D9'}};ws.getRow(last+2).height=24;
  const thin={style:'thin',color:{argb:'FF000000'}},medium={style:'medium',color:{argb:'FF000000'}};for(let r=3;r<=last+2;r++){for(let col=1;col<=8;col++){const cc=ws.getCell(r,col);cc.border={top:thin,left:thin,bottom:thin,right:thin}}}
  for(let r=4;r<=start+minRows-1;r++){for(let col=1;col<=8;col++){ws.getCell(r,col).border={top:thin,left:thin,bottom:thin,right:thin}}}
  ws.pageSetup.printArea=`A1:H${last+2}`;ws.views=[{showGridLines:false}];
  const buf=await wb.xlsx.writeBuffer(),blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='거래명세서.xlsx';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

function renderSearch(q=''){document.getElementById('page-search').innerHTML=`<div class="card"><input id="searchBox" style="width:100%;padding:12px" placeholder="제품명 / 소재 / 지점 / 고객 / 거래명세표" value="${q}" oninput="renderSearch(this.value)"></div><div id="searchResults" class="card" style="margin-top:12px"></div>`;const r=document.getElementById('searchResults');if(!q){r.innerHTML='<span class="muted">검색어를 입력하세요.</span>';return}const t=q.toLowerCase(),res=[];S.data.products.filter(p=>JSON.stringify(p).toLowerCase().includes(t)).forEach(p=>res.push(`<div class="search-result"><b>제품</b> · ${p.name}</div>`));S.data.customers.filter(c=>JSON.stringify(c).toLowerCase().includes(t)).forEach(c=>res.push(`<div class="search-result"><b>${c.type}</b> · ${c.name} · ${c.contact||''}</div>`));S.data.invoices.filter(i=>JSON.stringify(i).toLowerCase().includes(t)).forEach(i=>res.push(`<div class="search-result"><b>거래명세표</b> · ${i.date} · ${money(i.total)}원</div>`));r.innerHTML=res.join('')||'<span class="muted">검색 결과가 없습니다.</span>'}
function renderSettings(){const cfg=JSON.parse(localStorage.getItem('nayeso_supabase')||'{}');document.getElementById('page-settings').innerHTML=`<div class="grid cols-2"><div class="card"><h3>클라우드 자동 동기화</h3><p class="muted">Supabase를 연결하면 여러 PC/태블릿에서 같은 데이터를 실시간으로 볼 수 있습니다.</p><label>Supabase URL<input id="sb-url" style="width:100%;padding:9px" value="${cfg.url||''}"></label><br><br><label>Anon Key<input id="sb-key" style="width:100%;padding:9px" value="${cfg.key||''}"></label><br><br><button class="primary" onclick="saveCloudConfig()">연결 설정 저장</button></div><div class="card"><h3>백업</h3><button class="secondary" onclick="downloadBackup()">전체 백업 다운로드</button><button class="secondary" onclick="downloadProductsExcel()">제품 DB Excel 다운로드</button></div></div>`}
function saveCloudConfig(){localStorage.setItem('nayeso_supabase',JSON.stringify({url:document.getElementById('sb-url').value.trim(),key:document.getElementById('sb-key').value.trim()}));alert('저장했습니다. 새로고침하면 연결합니다.')}
function downloadBackup(){const blob=new Blob([JSON.stringify(S.data,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='NAYESO_BACKUP_'+new Date().toISOString().slice(0,10)+'.json';a.click()}
function downloadProductsExcel(){
  const rows=S.data.products.map(p=>({제품명:p.name,그룹:p.group,W:p.w,D:p.d,H:p.h,CBM:p.cbm,'무게(g)':p.weight_g||0,수종:p.material,마감:p.finish,원가:p.cost,지점가:p.branch_price,'1차 도매가':p.wholesale_price,판매가:p.sale_price,대표이미지:'',상세이미지1:'',상세텍스트1:''}));
  const ws=XLSX.utils.json_to_sheet(rows),wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'제품DB');XLSX.writeFile(wb,'NAYESO_제품DB.xlsx')
}
function downloadProductTemplate(){
  const rows=[{제품명:'예시 트레이',그룹:'Tray',W:300,D:200,H:25,'무게(g)':650,수종:'Mahoni',마감:'Oil',원가:8000,지점가:11000,'1차 도매가':14000,판매가:18000,대표이미지:'tray001.jpg',상세이미지1:'tray001_detail1.jpg',상세텍스트1:'손잡이 부분 마감 확인'}];
  const ws=XLSX.utils.json_to_sheet(rows),wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'제품DB');XLSX.writeFile(wb,'NAYESO_제품DB_등록양식.xlsx')
}
function triggerExcel(){
  document.getElementById('modalBody').innerHTML=`<h2>Excel + 이미지 대량등록</h2><div class="card bulk-import-card"><p><b>1.</b> Excel 파일을 선택하고 <b>2.</b> Excel에 적은 이미지 파일들을 한 번에 선택하세요.</p><p class="muted">대표이미지는 Excel의 <b>대표이미지</b> 열 파일명과 자동 연결됩니다. 상세이미지는 상세이미지1, 상세이미지2... 형식으로 추가할 수 있습니다. 파일명은 정확히 같아야 합니다.</p><div class="toolbar"><button class="secondary" onclick="downloadProductTemplate()">등록용 Excel 양식 다운로드</button></div><label>Excel 파일<input id="bulkExcel" type="file" accept=".xlsx,.xls,.csv"></label><label>이미지 파일들<input id="bulkImages" type="file" accept="image/*" multiple></label><div class="muted">예: tray001.jpg, tray001_detail1.jpg 등 필요한 이미지를 모두 한 번에 선택</div><div class="toolbar" style="margin-top:16px"><button class="primary" onclick="runBulkImport()">대량등록 실행</button><button class="secondary" onclick="closeModal()">취소</button></div></div>`;document.getElementById('modal').classList.remove('hidden')
}
async function runBulkImport(){
  const xf=document.getElementById('bulkExcel')?.files?.[0];if(!xf)return alert('Excel 파일을 선택하세요.');
  const imgs=[...(document.getElementById('bulkImages')?.files||[])],imageMap=new Map(imgs.map(f=>[f.name.trim().toLowerCase(),f]));
  const arr=await xf.arrayBuffer(),wb=XLSX.read(arr,{type:'array'}),rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''});
  const readImg=f=>new Promise(res=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>res('');r.readAsDataURL(f)});
  let add=0,upd=0,imgLinked=0;
  for(const row of rows){
    const name=String(row['제품명']||row.name||'').trim();if(!name)continue;
    let p=S.data.products.find(x=>x.name===name),isNew=!p;
    if(!p)p={id:uid('p'),image:'',detail_notes:[],note_height:620,detail_sections:[],detail_ko:'',detail_id:'',detail_en:''};
    Object.assign(p,{name,group:row['그룹']||row.group||'',material:row['수종']||row['소재']||row.material||'',finish:row['마감']||row.finish||'',weight_g:+(row['무게(g)']||row.weight_g||0),w:+(row.W||row.w||0),d:+(row.D||row.d||0),h:+(row.H||row.h||0),cost:+(row['원가']||row.cost||0),branch_price:+(row['지점가']||row.branch_price||0),wholesale_price:+(row['1차 도매가']||row.wholesale_price||0),sale_price:+(row['판매가']||row.sale_price||0)});
    p.cbm=+(row.CBM||row.cbm||0)||((p.w*p.d*p.h)/1e9);
    const mainName=String(row['대표이미지']||row['이미지']||row.image||'').trim().toLowerCase();
    if(mainName&&imageMap.has(mainName)){p.image=await readImg(imageMap.get(mainName));imgLinked++}
    const notes=[];let y=20;
    for(let i=1;i<=20;i++){
      const txt=String(row['상세텍스트'+i]||'').trim();if(txt){notes.push({type:'text',text:txt,x:360,y,w:300,h:120});y+=140}
      const nm=String(row['상세이미지'+i]||'').trim().toLowerCase();if(nm&&imageMap.has(nm)){const data=await readImg(imageMap.get(nm));notes.push({type:'image',data,x:20,y:Math.max(20,y-140),w:300,h:220});imgLinked++;y+=240}
    }
    if(notes.length){p.detail_notes=notes;p.note_height=Math.max(620,y+40)}
    if(isNew){S.data.products.push(p);S.data.inventory.push({product_id:p.id,updated_at:now()});add++}else upd++;
  }
  await persist();render();closeModal();alert(`대량등록 완료\n신규 ${add}개 / 업데이트 ${upd}개 / 이미지 연결 ${imgLinked}개`)
}
document.addEventListener('DOMContentLoaded',()=>{loadLocal();render();initCloud()});

/* ===== v5 Korea operations upgrade ===== */
S.productSort = S.productSort || 'registered';
S.productFilter = S.productFilter || 'all';
S.inventoryEditSet = S.inventoryEditSet || new Set();
S.sessionUser = null;

function ensureV5Data(){
  if(!S.data) return;
  if(!Array.isArray(S.data.change_logs)) S.data.change_logs=[];
  if(!Array.isArray(S.data.app_users)) S.data.app_users=[];
  S.data.products.forEach((p,i)=>{
    if(typeof p.discontinued!=='boolean') p.discontinued=false;
    if(!p.created_at) p.created_at=`2000-01-01 00:${String(i).padStart(2,'0')}`;
  });
  S.data.invoice_templates.forEach(t=>{
    if(t.show_image==null)t.show_image=true;
    if(t.show_material==null)t.show_material=true;
    if(t.show_price==null)t.show_price=true;
    if(t.show_note==null)t.show_note=true;
    if(t.show_vat==null)t.show_vat=true;
    if(t.show_size==null)t.show_size=true;
  });
}
function loginActor(){return S.sessionUser?.name||'알 수 없음'}
function pruneHistory(){
  if(!S.data)return;
  const cutoff=Date.now()-1000*60*60*24*183;
  const keep=x=>{const t=new Date(String(x.at||x.updated_at||'').replace(' ','T')).getTime();return !t||t>=cutoff};
  if(Array.isArray(S.data.change_logs))S.data.change_logs=S.data.change_logs.filter(keep);
  if(Array.isArray(S.data.stock_logs))S.data.stock_logs=S.data.stock_logs.filter(keep);
}
function addChangeLog(type,note,entity=''){
  ensureV5Data();
  S.data.change_logs.push({id:uid('log'),at:now(),type,note,entity,user:loginActor()});
  pruneHistory();
}
const _v5Persist=persist;
persist=async function(){ensureV5Data();pruneHistory();return _v5Persist()}

function sortedProducts(){
  ensureV5Data();
  let a=[...S.data.products];
  if(S.productFilter==='active')a=a.filter(p=>!p.discontinued);
  if(S.productFilter==='discontinued')a=a.filter(p=>p.discontinued);
  if(S.productSort==='name')a.sort((a,b)=>(a.name||'').localeCompare(b.name||'','ko'));
  else if(S.productSort==='groupname')a.sort((a,b)=>((a.group||'')+' '+(a.name||'')).localeCompare((b.group||'')+' '+(b.name||''),'ko'));
  return a;
}
function productNameHtml(p){return `<span class="${p.discontinued?'discontinued-name':''}">${escapeHtml(p.name||'')}</span>${p.discontinued?' <span class="disc-badge">단종</span>':''}`}

const _v5DrawProductModal=drawProductModal;
drawProductModal=function(p){
  _v5DrawProductModal(p);
  if(S.detailEdit){
    const form=document.querySelector('.product-form-stack');
    if(form&&!document.getElementById('f-discontinued'))form.insertAdjacentHTML('beforeend',`<label class="disc-check"><span>판매 상태</span><span><input id="f-discontinued" type="checkbox" ${p.discontinued?'checked':''}> 단종 제품</span></label>`);
  }
}
const _v5SaveProduct=saveProduct;
saveProduct=async function(id){
  const disc=!!document.getElementById('f-discontinued')?.checked;
  const nm=document.getElementById('f-name')?.value||'';
  const isNew=!id;
  await _v5SaveProduct(id);
  const p=S.data.products.find(x=>x.id===window._detailId);
  if(p){p.discontinued=disc;if(isNew&&!p.created_at)p.created_at=now();}
  addChangeLog(isNew?'제품 등록':'제품 수정',`${nm||p?.name||'제품'} ${isNew?'등록':'정보 수정'}`,p?.id||'');
  await persist();render();
}
const _v5DeleteProduct=deleteProduct;
deleteProduct=async function(id){const p=S.data.products.find(x=>x.id===id);addChangeLog('제품 삭제',`${p?.name||'제품'} 삭제`,id);return _v5DeleteProduct(id)}

renderProducts=function(){
  const ps=sortedProducts(),shown=ps.slice(0,S.pageSize);let body='';
  if(S.productView==='gallery') body=`<div class="product-grid folder-grid">${shown.map(p=>`<div class="product-card folder-card ${p.discontinued?'discontinued-card':''}" onclick="openProduct('${p.id}')"><div class="card-select">${productSelectBox(p.id)}</div><div class="folder-image">${imgTag(p)}</div><div class="body"><b>${productNameHtml(p)}</b><div class="muted">${p.material||''}${p.group?' · '+p.group:''}</div><div class="folder-stock">총수량 <b>${totalQty(p.id)}</b></div></div></div>`).join('')}</div>`;
  else body=`<div class="deck-list">${shown.map(p=>`<div class="deck-row ${p.discontinued?'discontinued-card':''}" onclick="openProduct('${p.id}')"><div class="deck-select">${productSelectBox(p.id)}</div>${imgTag(p)}<div><b>${productNameHtml(p)}</b><div class="muted">${p.material||''} · ${p.group||''}</div></div><div></div><div>총수량 <b>${totalQty(p.id)}</b></div></div>`).join('')}</div>`;
  document.getElementById('page-products').innerHTML=`<div class="toolbar tabs">
    <button class="${S.productFilter==='all'?'active':''}" onclick="S.productFilter='all';renderProducts()">전체</button>
    <button class="${S.productFilter==='active'?'active':''}" onclick="S.productFilter='active';renderProducts()">판매 제품</button>
    <button class="${S.productFilter==='discontinued'?'active':''}" onclick="S.productFilter='discontinued';renderProducts()">단종 제품</button>
    <label>정렬 <select onchange="S.productSort=this.value;renderProducts()"><option value="registered" ${S.productSort==='registered'?'selected':''}>등록순</option><option value="name" ${S.productSort==='name'?'selected':''}>이름순</option><option value="groupname" ${S.productSort==='groupname'?'selected':''}>그룹 + 이름순</option></select></label>
    <span class="spacer"></span>
    <button class="secondary" onclick="selectAllVisibleProducts(true)">전체선택</button><button class="secondary" onclick="S.selectedProducts.clear();renderProducts()">선택해제</button><button class="secondary" onclick="moveSelectedProducts(-1)">↑ 위로</button><button class="secondary" onclick="moveSelectedProducts(1)">↓ 아래로</button><button class="danger" onclick="deleteSelectedProducts()">선택삭제</button>
    ${['deck','gallery'].map(v=>`<button class="${S.productView===v?'active':''}" onclick="S.productView='${v}';renderProducts()">${v==='gallery'?'큰 아이콘':'Deck'}</button>`).join('')}
    <select onchange="S.pageSize=+this.value;renderProducts()">${[10,20,50,100].map(n=>`<option ${S.pageSize===n?'selected':''}>${n}</option>`).join('')}</select><button class="primary" onclick="triggerExcel()">Excel + 이미지 업로드</button>
  </div>${body}`;
}

function toggleInventoryEdit(id){
  if(S.inventoryEditSet.has(id))S.inventoryEditSet.delete(id);else S.inventoryEditSet.add(id);
  renderInventory();
}
renderInventory=function(){
  ensureV5Data();const locs=S.data.locations,ps=sortedProducts();
  document.getElementById('page-inventory').innerHTML=`<div class="toolbar">
    <button class="primary" onclick="stockMove()">+ 입고 / 출고 / 이동</button><button class="secondary" onclick="manageLocations()">위치 관리</button>
    <label>제품 <select onchange="S.productFilter=this.value;renderInventory()"><option value="all" ${S.productFilter==='all'?'selected':''}>전체</option><option value="active" ${S.productFilter==='active'?'selected':''}>판매 제품</option><option value="discontinued" ${S.productFilter==='discontinued'?'selected':''}>단종 제품</option></select></label>
    <label>정렬 <select onchange="S.productSort=this.value;renderInventory()"><option value="registered" ${S.productSort==='registered'?'selected':''}>등록순</option><option value="name" ${S.productSort==='name'?'selected':''}>이름순</option><option value="groupname" ${S.productSort==='groupname'?'selected':''}>그룹 + 이름순</option></select></label>
    <span class="spacer"></span><button class="secondary" onclick="selectAllInventoryProducts(true)">전체선택</button><button class="secondary" onclick="S.selectedProducts.clear();renderInventory()">선택해제</button><button class="secondary" onclick="moveSelectedProducts(-1)">↑ 위로</button><button class="secondary" onclick="moveSelectedProducts(1)">↓ 아래로</button><button class="danger" onclick="deleteSelectedProducts()">선택삭제</button>
  </div><div class="table-wrap"><table><thead><tr><th class="select-col">선택</th><th>이미지</th><th>제품명</th>${locs.map(l=>`<th>${l.name}</th>`).join('')}<th>총수량</th><th>변경날짜</th><th>수정</th></tr></thead><tbody>
  ${ps.map(p=>{let inv=invFor(p.id),editing=S.inventoryEditSet.has(p.id);return `<tr><td class="select-col">${productSelectBox(p.id)}</td><td class="image-cell">${p.image?`<img class="inv-img" src="${p.image}">`:`<div class="img-placeholder inv-img">NO</div>`}</td><td>${productNameHtml(p)}</td>${locs.map(l=>`<td><input type="number" value="${inv[l.id]||0}" ${editing?'':'disabled'} onchange="updateStock('${p.id}','${l.id}',this.value)"></td>`).join('')}<td><b>${totalQty(p.id)}</b></td><td>${inv.updated_at||''}</td><td><button class="${editing?'primary':'secondary'}" onclick="toggleInventoryEdit('${p.id}')">${editing?'완료':'Edit'}</button></td></tr>`}).join('')}</tbody></table></div>
  <div class="card history-card" style="margin-top:16px"><div class="toolbar"><h3 style="margin:0">최근 재고 이력</h3><span class="spacer"></span><button class="secondary" onclick="openStockHistory()">전체 이력 보기</button></div>${S.data.stock_logs.slice(-10).reverse().map(x=>`<div class="search-result">${x.at} · ${x.product} · ${x.note}${x.user?' · '+x.user:''}</div>`).join('')||'<span class="muted">아직 이력이 없습니다.</span>'}</div>`;
  appendChangePanels();
}
const _v5UpdateStock=updateStock;
updateStock=async function(pid,lid,val){const p=S.data.products.find(x=>x.id===pid),inv=invFor(pid),old=Number(inv[lid]||0);addChangeLog('재고 수정',`${p?.name||''} · ${S.data.locations.find(x=>x.id===lid)?.name||''} ${old} → ${Number(val)||0}`,pid);const before=S.data.stock_logs.length;await _v5UpdateStock(pid,lid,val);if(S.data.stock_logs[before])S.data.stock_logs[before].user=loginActor()}
const _v5ApplyStockMove=applyStockMove;
applyStockMove=async function(){const pid=document.getElementById('sm-p')?.value,p=S.data.products.find(x=>x.id===pid),type=document.getElementById('sm-type')?.value,q=+document.getElementById('sm-q')?.value||0;addChangeLog('재고 이동',`${p?.name||''} · ${type||''} ${q}개`,pid);const before=S.data.stock_logs.length;await _v5ApplyStockMove();if(S.data.stock_logs[before]){S.data.stock_logs[before].user=loginActor();await persist()}}
function openStockHistory(){openHistoryModal('재고 이력',S.data.stock_logs,true)}

function parseHistoryPeriod(mode,value){
  const end=new Date();let start=new Date(0);
  if(mode==='day'&&value){start=new Date(value+'T00:00:00');const e=new Date(value+'T23:59:59');return [start,e]}
  if(mode==='month'&&value){start=new Date(value+'-01T00:00:00');const e=new Date(start);e.setMonth(e.getMonth()+1);e.setMilliseconds(-1);return [start,e]}
  if(mode==='months'){start=new Date();start.setMonth(start.getMonth()-Number(value||6));}
  return [start,end]
}
function openHistoryModal(title,logs,isStock=false){
  window._histSource=isStock?'stock':'change';
  document.getElementById('modalBody').innerHTML=`<h2>${title}</h2><div class="toolbar history-filters"><label>보기 <select id="hist-mode" onchange="drawHistoryModal()"><option value="months">최근 개월</option><option value="month">월별</option><option value="day">일별</option></select></label><label id="hist-months-wrap">기간 <select id="hist-months" onchange="drawHistoryModal()"><option>1</option><option>3</option><option selected>6</option></select>개월</label><label id="hist-month-wrap" class="hidden">월 <input id="hist-month" type="month" onchange="drawHistoryModal()"></label><label id="hist-day-wrap" class="hidden">날짜 <input id="hist-day" type="date" onchange="drawHistoryModal()"></label></div><div id="historyModalList"></div>`;
  document.getElementById('modal').classList.remove('hidden');drawHistoryModal();
}
function drawHistoryModal(){
  const mode=document.getElementById('hist-mode')?.value||'months';
  document.getElementById('hist-months-wrap')?.classList.toggle('hidden',mode!=='months');document.getElementById('hist-month-wrap')?.classList.toggle('hidden',mode!=='month');document.getElementById('hist-day-wrap')?.classList.toggle('hidden',mode!=='day');
  const value=mode==='months'?document.getElementById('hist-months')?.value:mode==='month'?document.getElementById('hist-month')?.value:document.getElementById('hist-day')?.value;
  const [s,e]=parseHistoryPeriod(mode,value),arr=(window._histSource==='stock'?S.data.stock_logs:S.data.change_logs).filter(x=>{const d=new Date(String(x.at||'').replace(' ','T'));return d>=s&&d<=e}).slice().reverse();
  document.getElementById('historyModalList').innerHTML=`<div class="table-wrap"><table><thead><tr><th>날짜</th><th>구분</th><th>내용</th><th>작업자</th></tr></thead><tbody>${arr.map(x=>`<tr><td>${x.at||''}</td><td>${x.type||(window._histSource==='stock'?'재고':'')}</td><td>${escapeHtml(x.note||'')}</td><td>${escapeHtml(x.user||'')}</td></tr>`).join('')}</tbody></table></div>${arr.length?'':'<p class="muted">해당 기간의 이력이 없습니다.</p>'}`;
}

function recentChangePanelHtml(){
  ensureV5Data();const rows=S.data.change_logs.slice(-10).reverse();
  return `<div class="card global-change-panel" style="margin-top:16px"><div class="toolbar"><h3 style="margin:0">최근 변경 이력</h3><span class="muted">6개월 보관 · 최근 10건 표시</span><span class="spacer"></span><button class="secondary" onclick="openHistoryModal('전체 변경 이력',S.data.change_logs,false)">전체 이력 보기</button></div>${rows.map(x=>`<div class="search-result">${x.at} · <b>${x.type}</b> · ${escapeHtml(x.note||'')} · ${escapeHtml(x.user||'')}</div>`).join('')||'<span class="muted">아직 변경 이력이 없습니다.</span>'}</div>`
}
function appendChangePanels(){document.querySelectorAll('.page').forEach(pg=>{if(pg.querySelector('.global-change-panel'))return;pg.insertAdjacentHTML('beforeend',recentChangePanelHtml())})}

renderDashboard=function(){
  ensureV5Data();const recent=[...S.data.products].slice(-10).reverse(),stock=[...S.data.stock_logs].slice(-10).reverse();
  document.getElementById('page-dashboard').innerHTML=`<div class="grid cols-3 dashboard-metrics">
    <div class="card metric clickable-metric" onclick="go('products')"><span class="muted">등록 제품</span><strong>${S.data.products.length}개</strong></div>
    <div class="card metric clickable-metric" onclick="go('customers')"><span class="muted">지점/고객</span><strong>${S.data.customers.length}곳</strong></div>
    <div class="card metric clickable-metric" onclick="go('invoice')"><span class="muted">거래명세표</span><strong>${S.data.invoices.length}건</strong></div></div>
    <div class="dashboard-main-grid" style="margin-top:16px">
      <div class="card"><h3>최근 제품</h3><div class="product-grid dashboard-products compact-recent-products">${recent.map(p=>`<div class="product-card dashboard-product-card" onclick="openProduct('${p.id}')">${imgTag(p)}<div class="body"><b>${productNameHtml(p)}</b><div class="muted">${p.material||''}</div></div></div>`).join('')}</div></div>
      <div class="card"><h3>최근 재고 변경</h3><div class="table-wrap"><table class="dashboard-stock-table"><thead><tr><th>제품명</th>${S.data.locations.map(l=>`<th>${l.name}</th>`).join('')}</tr></thead><tbody>${stock.map(x=>{const p=S.data.products.find(p=>p.name===x.product),inv=p?invFor(p.id):{};return `<tr><td>${escapeHtml(x.product||'')}</td>${S.data.locations.map(l=>`<td>${Number(inv[l.id]||0)}</td>`).join('')}</tr>`}).join('')}</tbody></table></div></div>
      <div class="card quick-compact"><h3>빠른 실행</h3><div class="quick-grid one-column"><button class="secondary" onclick="openProduct()">+ 새 제품 등록</button><button class="secondary" onclick="triggerExcel()">Excel + 이미지 대량등록</button><button class="secondary" onclick="go('inventory')">재고 수량 변경</button><button class="secondary" onclick="go('customers')">지점 / 고객 정보</button><button class="secondary" onclick="go('invoice')">거래명세표 작성</button></div></div>
    </div>`;
  appendChangePanels();
}

function customerInvoiceRows(cid){return S.data.invoices.filter(i=>i.customer_id===cid).sort((a,b)=>(b.date||'').localeCompare(a.date||''))}
function openCustomerDetail(id){
  const c=S.data.customers.find(x=>x.id===id);if(!c)return;
  document.getElementById('modalBody').innerHTML=`<div class="toolbar"><h2 style="margin:0">${escapeHtml(c.name)} 상세</h2><span class="spacer"></span><button class="primary" onclick="editCustomer('${id}')">수정</button></div>
  <div class="detail-basic-list compact-basic-list customer-basic">${[['구분',c.type],['담당자',c.contact],['연락처',c.phone],['주소',c.address],['사업자등록번호',c.business_no],['기본 가격',priceLabel(c.price_level)]].map(r=>`<div class="detail-basic-row"><div class="label">${r[0]}</div><div class="value">${escapeHtml(r[1]||'-')}</div></div>`).join('')}</div>
  <div class="customer-history-tabs"><h3>거래명세표 이력</h3>${customerInvoiceRows(id).map(inv=>`<div class="invoice-history-row" onclick="viewSavedInvoice('${inv.id}')"><span>${inv.date||''}</span><span>${inv.items?.length||0}개 품목</span><b>₩ ${money(inv.total)}</b><button class="secondary">보기</button></div>`).join('')||'<p class="muted">저장된 거래명세표가 없습니다.</p>'}</div>
  <div class="card customer-summary-card"><div class="toolbar"><h3 style="margin:0">제품 구매 통합 보기</h3><span class="spacer"></span><label>시작 <input id="cs-from" type="date"></label><label>종료 <input id="cs-to" type="date"></label><button class="secondary" onclick="setCustomerSummaryPeriod('month')">이번달</button><button class="secondary" onclick="setCustomerSummaryPeriod('year')">올해</button><button class="primary" onclick="drawCustomerSummary('${id}')">조회</button></div><div id="customerSummaryResult"></div></div>`;
  document.getElementById('modal').classList.remove('hidden');setCustomerSummaryPeriod('year');drawCustomerSummary(id);
}
function setCustomerSummaryPeriod(kind){const d=new Date(),to=d.toISOString().slice(0,10);let from;if(kind==='month')from=`${to.slice(0,7)}-01`;else from=`${d.getFullYear()}-01-01`;if(document.getElementById('cs-from'))document.getElementById('cs-from').value=from;if(document.getElementById('cs-to'))document.getElementById('cs-to').value=to}
function drawCustomerSummary(cid){
  const from=document.getElementById('cs-from')?.value||'0000-01-01',to=document.getElementById('cs-to')?.value||'9999-12-31',map=new Map();
  customerInvoiceRows(cid).filter(i=>(i.date||'')>=from&&(i.date||'')<=to).forEach(inv=>(inv.items||[]).forEach(it=>{const p=S.data.products.find(x=>x.id===it.product_id),k=it.product_id,v=map.get(k)||{name:p?.name||'삭제된 제품',qty:0,amount:0};v.qty+=Number(it.qty||0);v.amount+=Number(it.qty||0)*Number(it.price||0);map.set(k,v)}));
  const arr=[...map.values()].sort((a,b)=>b.qty-a.qty);document.getElementById('customerSummaryResult').innerHTML=`<div class="table-wrap"><table><thead><tr><th>제품명</th><th>총 수량</th><th>총 금액</th></tr></thead><tbody>${arr.map(x=>`<tr><td>${escapeHtml(x.name)}</td><td>${x.qty}</td><td>₩ ${money(x.amount)}</td></tr>`).join('')}</tbody></table></div>${arr.length?'':'<p class="muted">해당 기간 거래가 없습니다.</p>'}`;
}
function viewSavedInvoice(id){const inv=S.data.invoices.find(x=>x.id===id);if(!inv)return;const c=S.data.customers.find(x=>x.id===inv.customer_id);document.getElementById('modalBody').innerHTML=`<h2>저장 거래명세표</h2><p><b>${escapeHtml(c?.name||'')}</b> · ${inv.date||''} · 총액 ₩ ${money(inv.total)}</p><div class="table-wrap"><table><thead><tr><th>제품</th><th>수량</th><th>단가</th><th>금액</th></tr></thead><tbody>${(inv.items||[]).map(it=>{const p=S.data.products.find(x=>x.id===it.product_id);return `<tr><td>${escapeHtml(p?.name||'삭제된 제품')}</td><td>${it.qty||0}</td><td>₩ ${money(it.price)}</td><td>₩ ${money((it.qty||0)*(it.price||0))}</td></tr>`}).join('')}</tbody></table></div><div class="invoice-total">총액 ₩ ${money(inv.total)}</div>`}

renderCustomers=function(){
  document.getElementById('page-customers').innerHTML=`<div class="toolbar"><button class="secondary" onclick="selectAllCustomers(true)">전체선택</button><button class="secondary" onclick="S.selectedCustomers.clear();renderCustomers()">선택해제</button><button class="secondary" onclick="moveSelectedCustomers(-1)">↑ 위로</button><button class="secondary" onclick="moveSelectedCustomers(1)">↓ 아래로</button><button class="danger" onclick="deleteSelectedCustomers()">선택삭제</button><span class="spacer"></span><button class="primary" onclick="editCustomer()">+ 신규 등록</button></div><div class="table-wrap"><table><thead><tr><th class="select-col">선택</th><th>구분</th><th>지점/고객명</th><th>사업자등록번호</th><th>담당자</th><th>연락처</th><th>주소</th><th>기본 가격</th><th>사업자등록증</th><th></th></tr></thead><tbody>${S.data.customers.map(c=>`<tr><td class="select-col">${customerSelectBox(c.id)}</td><td>${c.type}</td><td><button class="text-link" onclick="openCustomerDetail('${c.id}')">${escapeHtml(c.name)}</button></td><td>${c.business_no||''}</td><td>${c.contact||''}</td><td>${c.phone||''}</td><td>${c.address||''}</td><td>${priceLabel(c.price_level)}</td><td>${c.business_doc_data?`<span class="customer-doc-link" onclick="downloadBusinessDoc('${c.id}')">${c.business_doc_name||'다운로드'}</span>`:'-'}</td><td><button onclick="openCustomerDetail('${c.id}')">상세</button></td></tr>`).join('')}</tbody></table></div>`;appendChangePanels();
}
const _v5SaveCustomer=saveCustomer;saveCustomer=async function(id){const n=document.getElementById('c-name')?.value||'';addChangeLog(id?'고객/지점 수정':'고객/지점 등록',`${n} ${id?'정보 수정':'등록'}`,id||'');return _v5SaveCustomer(id)}
const _v5DeleteSelectedCustomers=deleteSelectedCustomers;deleteSelectedCustomers=async function(){if(S.selectedCustomers.size)addChangeLog('고객/지점 삭제',`${S.selectedCustomers.size}건 선택 삭제`);return _v5DeleteSelectedCustomers()}

const _v5SaveInvoice=saveInvoice;
saveInvoice=async function(){const cid=document.getElementById('inv-customer')?.value,c=S.data.customers.find(x=>x.id===cid),tt=invoiceTotals();addChangeLog('거래명세표 저장',`${c?.name||''} · ${S.selectedInvoiceItems.length}개 품목 · ₩ ${money(tt.grand)}`,cid||'');return _v5SaveInvoice()}

manageInvoiceTemplates=function(){
  document.getElementById('modalBody').innerHTML=`<h2>거래명세서 양식 관리</h2><p class="muted">양식 이름과 표시 항목을 저장해 두고 반복 사용할 수 있습니다. 필요 항목은 이후 계속 추가할 수 있습니다.</p>${S.data.invoice_templates.map((t,i)=>`<div class="detail-section-card template-editor"><div class="form-grid"><label>양식명<input id="t-name-${i}" value="${escapeHtml(t.name)}"></label><label>제목<input id="t-title-${i}" value="${escapeHtml(t.title||'거래명세서')}"></label><label class="wide-field">입금계좌/하단문구<input id="t-bank-${i}" value="${escapeHtml(t.bank_info||'')}"></label></div><div class="template-checks"><label><input id="t-img-${i}" type="checkbox" ${t.show_image!==false?'checked':''}> 이미지</label><label><input id="t-size-${i}" type="checkbox" ${t.show_size!==false?'checked':''}> 규격</label><label><input id="t-mat-${i}" type="checkbox" ${t.show_material!==false?'checked':''}> 수종</label><label><input id="t-price-${i}" type="checkbox" ${t.show_price!==false?'checked':''}> 공급가/금액</label><label><input id="t-note-${i}" type="checkbox" ${t.show_note!==false?'checked':''}> 비고</label><label><input id="t-vat-${i}" type="checkbox" ${t.show_vat!==false?'checked':''}> VAT 선택 사용</label></div><button class="secondary" onclick="saveTemplate(${i})">저장</button>${i?` <button class="danger" onclick="deleteTemplate(${i})">삭제</button>`:''}</div>`).join('')}<button class="primary" onclick="addTemplate()">+ 새 양식 추가</button>`;document.getElementById('modal').classList.remove('hidden')
}
saveTemplate=async function(i){const t=S.data.invoice_templates[i];t.name=document.getElementById('t-name-'+i).value;t.title=document.getElementById('t-title-'+i).value;t.bank_info=document.getElementById('t-bank-'+i).value;t.show_image=document.getElementById('t-img-'+i).checked;t.show_size=document.getElementById('t-size-'+i).checked;t.show_material=document.getElementById('t-mat-'+i).checked;t.show_price=document.getElementById('t-price-'+i).checked;t.show_note=document.getElementById('t-note-'+i).checked;t.show_vat=document.getElementById('t-vat-'+i).checked;addChangeLog('거래명세표 양식 수정',`${t.name} 저장`,t.id);await persist();renderInvoice();manageInvoiceTemplates()}
const _v5AddTemplate=addTemplate;addTemplate=async function(){addChangeLog('거래명세표 양식 추가','새 양식 추가');return _v5AddTemplate()}

function renderUserManager(){return `<div class="card admin-user-card"><h3>일반 로그인 작업자 관리</h3><div id="appUserList">${S.data.app_users.map((u,i)=>`<div class="toolbar"><input id="usr-${i}" value="${escapeHtml(u.name)}"><button class="secondary" onclick="renameAppUser(${i})">저장</button><button class="danger" onclick="deleteAppUser(${i})">삭제</button></div>`).join('')||'<p class="muted">등록된 일반 작업자가 없습니다.</p>'}</div><div class="toolbar"><input id="newAppUser" placeholder="작업자 이름"><button class="primary" onclick="addAppUser()">+ 작업자 추가</button></div></div>`}
async function addAppUser(){const name=document.getElementById('newAppUser')?.value.trim();if(!name)return;S.data.app_users.push({id:uid('u'),name});addChangeLog('사용자 등록',`${name} 일반 작업자 등록`);await persist();renderSettings()}
async function renameAppUser(i){const old=S.data.app_users[i].name,n=document.getElementById('usr-'+i).value.trim();if(!n)return;S.data.app_users[i].name=n;addChangeLog('사용자 수정',`${old} → ${n}`);await persist();renderSettings()}
async function deleteAppUser(i){const n=S.data.app_users[i]?.name;if(!confirm(`${n} 작업자를 삭제할까요?`))return;S.data.app_users.splice(i,1);addChangeLog('사용자 삭제',`${n} 일반 작업자 삭제`);await persist();renderSettings()}

const _v5RenderSettings=renderSettings;
renderSettings=function(){
  if(S.sessionUser?.role!=='admin'){document.getElementById('page-settings').innerHTML=`<div class="card"><h3>접근 제한</h3><p>설정은 관리자만 사용할 수 있습니다.</p></div>`;return}
  _v5RenderSettings();document.getElementById('page-settings').insertAdjacentHTML('beforeend',`<div style="margin-top:16px">${renderUserManager()}</div>`);appendChangePanels();
}
const _v5Go=go;go=function(p){if(p==='settings'&&S.sessionUser?.role!=='admin')return alert('관리자만 설정을 사용할 수 있습니다.');return _v5Go(p)}

function buildLoginOverlay(){
  if(document.getElementById('loginOverlay'))return;
  document.body.insertAdjacentHTML('beforeend',`<div id="loginOverlay" class="login-overlay"><div class="login-box"><div class="login-brand">NAYESO</div><h2>로그인</h2><p class="muted">사용 방식을 선택하세요.</p><div id="loginStep"><button class="primary login-main-btn" onclick="showGeneralLogin()">일반 로그인</button><button class="secondary login-main-btn" onclick="showAdminLogin()">관리자 로그인</button></div></div></div>`);
}
function showGeneralLogin(){ensureV5Data();document.getElementById('loginStep').innerHTML=`<h3>일반 로그인</h3>${S.data.app_users.length?`<label>작업자<select id="generalUserSelect">${S.data.app_users.map(u=>`<option value="${u.id}">${escapeHtml(u.name)}</option>`).join('')}</select></label><button class="primary login-main-btn" onclick="doGeneralLogin()">로그인</button>`:'<p class="muted">등록된 일반 작업자가 없습니다. 관리자 로그인 후 설정에서 작업자를 등록하세요.</p>'}<button class="secondary login-main-btn" onclick="resetLoginChoice()">← 돌아가기</button>`}
function showAdminLogin(){document.getElementById('loginStep').innerHTML=`<h3>관리자 로그인</h3><label>비밀번호<input id="adminPw" type="password" autocomplete="current-password" onkeydown="if(event.key==='Enter')doAdminLogin()"></label><button class="primary login-main-btn" onclick="doAdminLogin()">로그인</button><button class="secondary login-main-btn" onclick="resetLoginChoice()">← 돌아가기</button>`;setTimeout(()=>document.getElementById('adminPw')?.focus(),50)}
function resetLoginChoice(){document.getElementById('loginStep').innerHTML=`<button class="primary login-main-btn" onclick="showGeneralLogin()">일반 로그인</button><button class="secondary login-main-btn" onclick="showAdminLogin()">관리자 로그인</button>`}
function finishLogin(user){S.sessionUser=user;sessionStorage.setItem('nayeso_session',JSON.stringify(user));document.getElementById('loginOverlay').classList.add('hidden');applyRoleUI();render();}
function doGeneralLogin(){const id=document.getElementById('generalUserSelect')?.value,u=S.data.app_users.find(x=>x.id===id);if(!u)return;finishLogin({role:'general',id:u.id,name:u.name})}
function doAdminLogin(){const pw=document.getElementById('adminPw')?.value||'';const stored=localStorage.getItem('nayeso_admin_pw')||'1082';if(pw!==stored)return alert('비밀번호가 맞지 않습니다.');finishLogin({role:'admin',id:'admin',name:'관리자'})}
function applyRoleUI(){const b=document.querySelector('#nav button[data-page="settings"]');if(b)b.style.display=S.sessionUser?.role==='admin'?'':'none';}
function addMobileMenu(){if(document.getElementById('mobileMenuBtn'))return;document.querySelector('.topbar')?.insertAdjacentHTML('afterbegin','<button id="mobileMenuBtn" class="mobile-menu-btn" onclick="document.body.classList.toggle(\'sidebar-open\')">☰</button>');document.querySelectorAll('#nav button').forEach(b=>b.addEventListener('click',()=>document.body.classList.remove('sidebar-open')))}

const _v5Render=render;
render=function(){ensureV5Data();_v5Render();applyRoleUI();appendChangePanels()}

// modal wheel chaining: inner modal first, then page
function installWheelChain(){document.addEventListener('wheel',e=>{const card=e.target.closest?.('.modal-card');if(!card)return;const down=e.deltaY>0,atBottom=card.scrollTop+card.clientHeight>=card.scrollHeight-2,atTop=card.scrollTop<=2;if((down&&atBottom)||(!down&&atTop)){window.scrollBy({top:e.deltaY,left:0,behavior:'auto'})}}, {passive:true,capture:true})}

document.addEventListener('DOMContentLoaded',()=>{
  setTimeout(()=>{ensureV5Data();buildLoginOverlay();addMobileMenu();installWheelChain();const s=JSON.parse(sessionStorage.getItem('nayeso_session')||'null');if(s){S.sessionUser=s;document.getElementById('loginOverlay')?.classList.add('hidden');applyRoleUI();render()}},80);
});

/* ===== v6 admin password reset/fix ===== */
const NAYESO_ADMIN_DEFAULT_PASSWORD='1082';
function getAdminPassword(){
  const saved=localStorage.getItem('nayeso_admin_pw_v6');
  return saved || NAYESO_ADMIN_DEFAULT_PASSWORD;
}
doAdminLogin=function(){
  const pw=document.getElementById('adminPw')?.value||'';
  if(pw!==getAdminPassword())return alert('비밀번호가 맞지 않습니다.');
  finishLogin({role:'admin',id:'admin',name:'관리자'});
}
function renderAdminPasswordManager(){
  return `<div class="card admin-password-card"><h3>관리자 비밀번호 변경</h3><p class="muted">현재 비밀번호 확인 후 새 비밀번호로 변경합니다.</p><div class="form-grid admin-password-grid"><label>현재 비밀번호<input id="admin-current-pw" type="password" autocomplete="current-password"></label><label>새 비밀번호<input id="admin-new-pw" type="password" autocomplete="new-password"></label><label>새 비밀번호 확인<input id="admin-new-pw2" type="password" autocomplete="new-password"></label></div><div style="margin-top:12px"><button class="primary" onclick="changeAdminPassword()">비밀번호 변경</button></div></div>`;
}
async function changeAdminPassword(){
  const current=document.getElementById('admin-current-pw')?.value||'';
  const next=document.getElementById('admin-new-pw')?.value||'';
  const next2=document.getElementById('admin-new-pw2')?.value||'';
  if(current!==getAdminPassword())return alert('현재 비밀번호가 맞지 않습니다.');
  if(next.length<4)return alert('새 비밀번호는 4자리 이상 입력하세요.');
  if(next!==next2)return alert('새 비밀번호 확인이 일치하지 않습니다.');
  localStorage.setItem('nayeso_admin_pw_v6',next);
  localStorage.removeItem('nayeso_admin_pw');
  addChangeLog?.('관리자 설정','관리자 비밀번호 변경');
  await persist();
  alert('관리자 비밀번호가 변경되었습니다.');
  renderSettings();
}
const _v6RenderSettings=renderSettings;
renderSettings=function(){
  _v6RenderSettings();
  if(S.sessionUser?.role==='admin'){
    const page=document.getElementById('page-settings');
    if(page && !page.querySelector('.admin-password-card'))page.insertAdjacentHTML('beforeend',`<div style="margin-top:16px">${renderAdminPasswordManager()}</div>`);
  }
}


/* ===== v7 admin login hard reset + cache migration ===== */
const NAYESO_AUTH_VERSION='v7';
function migrateAuthV7(){
  const migrated=localStorage.getItem('nayeso_auth_version');
  if(migrated!==NAYESO_AUTH_VERSION){
    localStorage.removeItem('nayeso_admin_pw');
    localStorage.removeItem('nayeso_admin_pw_v6');
    localStorage.removeItem('nayeso_admin_pw_v7');
    sessionStorage.removeItem('nayeso_session');
    localStorage.setItem('nayeso_auth_version',NAYESO_AUTH_VERSION);
  }
}
function getAdminPassword(){
  return localStorage.getItem('nayeso_admin_pw_v7') || '1082';
}
doAdminLogin=function(){
  const input=document.getElementById('adminPw');
  const pw=String(input?.value||'').trim();
  if(pw!==getAdminPassword()){
    if(input){input.value='';input.focus();}
    return alert('비밀번호가 맞지 않습니다.');
  }
  finishLogin({role:'admin',id:'admin',name:'관리자'});
}
changeAdminPassword=async function(){
  const current=String(document.getElementById('admin-current-pw')?.value||'').trim();
  const next=String(document.getElementById('admin-new-pw')?.value||'').trim();
  const next2=String(document.getElementById('admin-new-pw2')?.value||'').trim();
  if(current!==getAdminPassword())return alert('현재 비밀번호가 맞지 않습니다.');
  if(next.length<4)return alert('새 비밀번호는 4자리 이상 입력하세요.');
  if(next!==next2)return alert('새 비밀번호 확인이 일치하지 않습니다.');
  localStorage.setItem('nayeso_admin_pw_v7',next);
  addChangeLog?.('관리자 설정','관리자 비밀번호 변경');
  await persist();
  alert('관리자 비밀번호가 변경되었습니다.');
  renderSettings();
}
document.addEventListener('DOMContentLoaded',()=>{migrateAuthV7();setTimeout(()=>{buildLoginOverlay();const overlay=document.getElementById('loginOverlay');if(overlay){overlay.classList.remove('hidden');resetLoginChoice();}S.sessionUser=null;applyRoleUI();},120)});

/* ===== v8 local-file-safe login fix ===== */
function safeSessionSet(key,value){
  try{ sessionStorage.setItem(key,value); return true; }catch(e){ console.warn('sessionStorage unavailable:',e); return false; }
}
function safeSessionRemove(key){ try{ sessionStorage.removeItem(key); }catch(e){} }

// Local file (file://) execution can block sessionStorage in some browser/security settings.
// Login must succeed even when browser storage is unavailable.
finishLogin=function(user){
  S.sessionUser=user;
  safeSessionSet('nayeso_session',JSON.stringify(user));
  const overlay=document.getElementById('loginOverlay');
  if(overlay) overlay.classList.add('hidden');
  try{ applyRoleUI(); }catch(e){ console.error(e); }
  try{ render(); }catch(e){ console.error('render after login:',e); }
};

doAdminLogin=function(){
  const input=document.getElementById('adminPw');
  const pw=String(input?.value||'').trim();
  let expected='1082';
  try{ expected=localStorage.getItem('nayeso_admin_pw_v7') || '1082'; }catch(e){}
  if(pw!==expected){
    if(input){input.value='';input.focus();}
    return alert('비밀번호가 맞지 않습니다.');
  }
  finishLogin({role:'admin',id:'admin',name:'관리자'});
};

// Do not let a blocked sessionStorage call break the login screen on file:// URLs.
document.addEventListener('DOMContentLoaded',()=>{
  setTimeout(()=>{
    try{
      buildLoginOverlay();
      const overlay=document.getElementById('loginOverlay');
      if(overlay && !S.sessionUser) overlay.classList.remove('hidden');
    }catch(e){ console.error('login init:',e); }
  },160);
});

/* ===== v10 separated histories + 30-day trash ===== */
S.productHistoryPage = S.productHistoryPage || 0;

function ensureV10Data(){
  ensureV5Data();
  if(!Array.isArray(S.data.trash_products))S.data.trash_products=[];
  if(!Array.isArray(S.data.trash_invoices))S.data.trash_invoices=[];
  pruneTrashV10();
}
function parseAppDateV10(v){const t=new Date(String(v||'').replace(' ','T')).getTime();return Number.isFinite(t)?t:0}
function pruneTrashV10(){
  if(!S.data)return;
  const cutoff=Date.now()-30*24*60*60*1000;
  if(Array.isArray(S.data.trash_products))S.data.trash_products=S.data.trash_products.filter(x=>parseAppDateV10(x.deleted_at)>=cutoff);
  if(Array.isArray(S.data.trash_invoices))S.data.trash_invoices=S.data.trash_invoices.filter(x=>parseAppDateV10(x.deleted_at)>=cutoff);
}
const _v10PersistBase=persist;
persist=async function(){ensureV10Data();return _v10PersistBase()}

// v10: the old global change panel is disabled. Each screen owns its own history.
appendChangePanels=function(){};
function isProductHistoryLogV10(x){return /^제품/.test(String(x?.type||'')) || /제품 DB/.test(String(x?.type||''))}
function productHistoryLogsV10(){ensureV10Data();return S.data.change_logs.filter(isProductHistoryLogV10)}
function productHistoryHtmlV10(){
  const rows=productHistoryLogsV10().slice(-10).reverse();
  return `<div class="card product-change-panel" style="margin-top:16px"><div class="toolbar"><h3 style="margin:0">변경사항</h3><span class="muted">제품 DB 변경만 표시 · 6개월 보관 · 최근 10건</span><span class="spacer"></span><button class="secondary" onclick="openProductHistoryV10()">전체 이력 보기</button></div>${rows.map(x=>`<div class="search-result">${x.at||''} · <b>${escapeHtml(x.type||'')}</b> · ${escapeHtml(x.note||'')} · ${escapeHtml(x.user||'')}</div>`).join('')||'<span class="muted">아직 제품 DB 변경 이력이 없습니다.</span>'}</div>`
}
function openProductHistoryV10(){
  window._histSource='product-v10';
  document.getElementById('modalBody').innerHTML=`<h2>제품 DB 변경 이력</h2><div class="toolbar history-filters"><label>보기 <select id="hist-mode" onchange="drawHistoryModal()"><option value="months">최근 개월</option><option value="month">월별</option><option value="day">일별</option></select></label><label id="hist-months-wrap">기간 <select id="hist-months" onchange="drawHistoryModal()"><option>1</option><option>3</option><option selected>6</option></select>개월</label><label id="hist-month-wrap" class="hidden">월 <input id="hist-month" type="month" onchange="drawHistoryModal()"></label><label id="hist-day-wrap" class="hidden">날짜 <input id="hist-day" type="date" onchange="drawHistoryModal()"></label></div><div id="historyModalList"></div>`;
  document.getElementById('modal').classList.remove('hidden');drawHistoryModal();
}
const _v10DrawHistoryModalBase=drawHistoryModal;
drawHistoryModal=function(){
  if(window._histSource!=='product-v10')return _v10DrawHistoryModalBase();
  const mode=document.getElementById('hist-mode')?.value||'months';
  document.getElementById('hist-months-wrap')?.classList.toggle('hidden',mode!=='months');document.getElementById('hist-month-wrap')?.classList.toggle('hidden',mode!=='month');document.getElementById('hist-day-wrap')?.classList.toggle('hidden',mode!=='day');
  const value=mode==='months'?document.getElementById('hist-months')?.value:mode==='month'?document.getElementById('hist-month')?.value:document.getElementById('hist-day')?.value;
  const [s,e]=parseHistoryPeriod(mode,value),arr=productHistoryLogsV10().filter(x=>{const d=new Date(String(x.at||'').replace(' ','T'));return d>=s&&d<=e}).slice().reverse();
  document.getElementById('historyModalList').innerHTML=`<div class="table-wrap"><table><thead><tr><th>날짜</th><th>구분</th><th>내용</th><th>작업자</th></tr></thead><tbody>${arr.map(x=>`<tr><td>${x.at||''}</td><td>${escapeHtml(x.type||'')}</td><td>${escapeHtml(x.note||'')}</td><td>${escapeHtml(x.user||'')}</td></tr>`).join('')}</tbody></table></div>${arr.length?'':'<p class="muted">해당 기간의 이력이 없습니다.</p>'}`;
}

// Dashboard: no change-history panel.
renderDashboard=function(){
  ensureV10Data();const recent=[...S.data.products].slice(-10).reverse(),stock=[...S.data.stock_logs].slice(-10).reverse();
  document.getElementById('page-dashboard').innerHTML=`<div class="grid cols-3 dashboard-metrics">
    <div class="card metric clickable-metric" onclick="go('products')"><span class="muted">등록 제품</span><strong>${S.data.products.length}개</strong></div>
    <div class="card metric clickable-metric" onclick="go('customers')"><span class="muted">지점/고객</span><strong>${S.data.customers.length}곳</strong></div>
    <div class="card metric clickable-metric" onclick="go('invoice')"><span class="muted">거래명세표</span><strong>${S.data.invoices.length}건</strong></div></div>
    <div class="dashboard-main-grid" style="margin-top:16px">
      <div class="card"><h3>최근 제품</h3><div class="product-grid dashboard-products compact-recent-products">${recent.map(p=>`<div class="product-card dashboard-product-card" onclick="openProduct('${p.id}')">${imgTag(p)}<div class="body"><b>${productNameHtml(p)}</b><div class="muted">${p.material||''}</div></div></div>`).join('')}</div></div>
      <div class="card"><h3>최근 재고 변경</h3><div class="table-wrap"><table class="dashboard-stock-table"><thead><tr><th>제품명</th>${S.data.locations.map(l=>`<th>${l.name}</th>`).join('')}</tr></thead><tbody>${stock.map(x=>{const p=S.data.products.find(p=>p.name===x.product),inv=p?invFor(p.id):{};return `<tr><td>${escapeHtml(x.product||'')}</td>${S.data.locations.map(l=>`<td>${Number(inv[l.id]||0)}</td>`).join('')}</tr>`}).join('')}</tbody></table></div></div>
      <div class="card quick-compact"><h3>빠른 실행</h3><div class="quick-grid one-column"><button class="secondary" onclick="openProduct()">+ 새 제품 등록</button><button class="secondary" onclick="triggerExcel()">Excel + 이미지 대량등록</button><button class="secondary" onclick="go('inventory')">재고 수량 변경</button><button class="secondary" onclick="go('customers')">지점 / 고객 정보</button><button class="secondary" onclick="go('invoice')">거래명세표 작성</button></div></div>
    </div>`;
}

// Product DB: bulk import removed here; dashboard quick action remains. History is always rendered after product list, even after sorting/filtering.
renderProducts=function(){
  ensureV10Data();const ps=sortedProducts(),shown=ps.slice(0,S.pageSize);let body='';
  if(S.productView==='gallery') body=`<div class="product-grid folder-grid">${shown.map(p=>`<div class="product-card folder-card ${p.discontinued?'discontinued-card':''}" onclick="openProduct('${p.id}')"><div class="card-select">${productSelectBox(p.id)}</div><div class="folder-image">${imgTag(p)}</div><div class="body"><b>${productNameHtml(p)}</b><div class="muted">${p.material||''}${p.group?' · '+p.group:''}</div><div class="folder-stock">총수량 <b>${totalQty(p.id)}</b></div></div></div>`).join('')}</div>`;
  else body=`<div class="deck-list">${shown.map(p=>`<div class="deck-row ${p.discontinued?'discontinued-card':''}" onclick="openProduct('${p.id}')"><div class="deck-select">${productSelectBox(p.id)}</div>${imgTag(p)}<div><b>${productNameHtml(p)}</b><div class="muted">${p.material||''} · ${p.group||''}</div></div><div></div><div>총수량 <b>${totalQty(p.id)}</b></div></div>`).join('')}</div>`;
  document.getElementById('page-products').innerHTML=`<div class="toolbar tabs">
    <button class="${S.productFilter==='all'?'active':''}" onclick="S.productFilter='all';renderProducts()">전체</button><button class="${S.productFilter==='active'?'active':''}" onclick="S.productFilter='active';renderProducts()">판매 제품</button><button class="${S.productFilter==='discontinued'?'active':''}" onclick="S.productFilter='discontinued';renderProducts()">단종 제품</button>
    <label>정렬 <select onchange="S.productSort=this.value;renderProducts()"><option value="registered" ${S.productSort==='registered'?'selected':''}>등록순</option><option value="name" ${S.productSort==='name'?'selected':''}>이름순</option><option value="groupname" ${S.productSort==='groupname'?'selected':''}>그룹 + 이름순</option></select></label><span class="spacer"></span>
    <button class="secondary" onclick="selectAllVisibleProducts(true)">전체선택</button><button class="secondary" onclick="S.selectedProducts.clear();renderProducts()">선택해제</button><button class="secondary" onclick="moveSelectedProducts(-1)">↑ 위로</button><button class="secondary" onclick="moveSelectedProducts(1)">↓ 아래로</button><button class="danger" onclick="deleteSelectedProducts()">선택삭제</button>
    ${['deck','gallery'].map(v=>`<button class="${S.productView===v?'active':''}" onclick="S.productView='${v}';renderProducts()">${v==='gallery'?'큰 아이콘':'Deck'}</button>`).join('')}<select onchange="S.pageSize=+this.value;renderProducts()">${[10,20,50,100].map(n=>`<option ${S.pageSize===n?'selected':''}>${n}</option>`).join('')}</select>
  </div>${body}${productHistoryHtmlV10()}`;
}

// Inventory: stock history only, exactly one history panel.
renderInventory=function(){
  ensureV10Data();const locs=S.data.locations,ps=sortedProducts();
  document.getElementById('page-inventory').innerHTML=`<div class="toolbar"><button class="primary" onclick="stockMove()">+ 입고 / 출고 / 이동</button><button class="secondary" onclick="manageLocations()">위치 관리</button><label>제품 <select onchange="S.productFilter=this.value;renderInventory()"><option value="all" ${S.productFilter==='all'?'selected':''}>전체</option><option value="active" ${S.productFilter==='active'?'selected':''}>판매 제품</option><option value="discontinued" ${S.productFilter==='discontinued'?'selected':''}>단종 제품</option></select></label><label>정렬 <select onchange="S.productSort=this.value;renderInventory()"><option value="registered" ${S.productSort==='registered'?'selected':''}>등록순</option><option value="name" ${S.productSort==='name'?'selected':''}>이름순</option><option value="groupname" ${S.productSort==='groupname'?'selected':''}>그룹 + 이름순</option></select></label><span class="spacer"></span><button class="secondary" onclick="selectAllInventoryProducts(true)">전체선택</button><button class="secondary" onclick="S.selectedProducts.clear();renderInventory()">선택해제</button><button class="secondary" onclick="moveSelectedProducts(-1)">↑ 위로</button><button class="secondary" onclick="moveSelectedProducts(1)">↓ 아래로</button><button class="danger" onclick="deleteSelectedProducts()">선택삭제</button></div>
  <div class="table-wrap"><table><thead><tr><th class="select-col">선택</th><th>이미지</th><th>제품명</th>${locs.map(l=>`<th>${l.name}</th>`).join('')}<th>총수량</th><th>변경날짜</th><th>수정</th></tr></thead><tbody>${ps.map(p=>{let inv=invFor(p.id),editing=S.inventoryEditSet.has(p.id);return `<tr><td class="select-col">${productSelectBox(p.id)}</td><td class="image-cell">${p.image?`<img class="inv-img" src="${p.image}">`:`<div class="img-placeholder inv-img">NO</div>`}</td><td>${productNameHtml(p)}</td>${locs.map(l=>`<td><input type="number" value="${inv[l.id]||0}" ${editing?'':'disabled'} onchange="updateStock('${p.id}','${l.id}',this.value)"></td>`).join('')}<td><b>${totalQty(p.id)}</b></td><td>${inv.updated_at||''}</td><td><button class="${editing?'primary':'secondary'}" onclick="toggleInventoryEdit('${p.id}')">${editing?'완료':'Edit'}</button></td></tr>`}).join('')}</tbody></table></div>
  <div class="card history-card" style="margin-top:16px"><div class="toolbar"><h3 style="margin:0">재고 이력</h3><span class="muted">최근 10건 표시</span><span class="spacer"></span><button class="secondary" onclick="openStockHistory()">전체 이력 보기</button></div>${S.data.stock_logs.slice(-10).reverse().map(x=>`<div class="search-result">${x.at||''} · ${escapeHtml(x.product||'')} · ${escapeHtml(x.note||'')}${x.user?' · '+escapeHtml(x.user):''}</div>`).join('')||'<span class="muted">아직 이력이 없습니다.</span>'}</div>`;
}

// Soft-delete products to 30-day trash.
async function trashOneProductV10(id){
  ensureV10Data();const idx=S.data.products.findIndex(x=>x.id===id);if(idx<0)return;
  const p=S.data.products[idx],inv=S.data.inventory.find(x=>x.product_id===id)||null;
  S.data.trash_products.push({id:uid('tp'),deleted_at:now(),deleted_by:loginActor(),product:clone(p),inventory:inv?clone(inv):null});
  S.data.products.splice(idx,1);S.data.inventory=S.data.inventory.filter(x=>x.product_id!==id);S.selectedProducts.delete(id);addChangeLog('제품 삭제',`${p.name||'제품'} 임시보관함 이동`,id);
}
deleteProduct=async function(id){const p=S.data.products.find(x=>x.id===id);if(!p)return;if(!confirm(`${p.name} 제품을 삭제할까요?\n30일 동안 임시보관함에 보관됩니다.`))return;await trashOneProductV10(id);await persist();closeModal();render()}
deleteSelectedProducts=async function(){
  const ids=[...S.selectedProducts].filter(id=>S.data.products.some(p=>p.id===id));if(!ids.length)return alert('삭제할 제품을 선택하세요.');
  if(!confirm(`선택한 제품 ${ids.length}개를 삭제할까요?\n30일 동안 임시보관함에 보관됩니다.`))return;
  for(const id of ids)await trashOneProductV10(id);await persist();render();
}

// Deleted invoices are removed from all active lists immediately and kept only in trash.
async function deleteInvoiceV10(id){
  ensureV10Data();const idx=S.data.invoices.findIndex(x=>x.id===id);if(idx<0)return;const inv=S.data.invoices[idx],c=S.data.customers.find(x=>x.id===inv.customer_id);
  if(!confirm(`이 거래명세표를 삭제할까요?\n${c?.name||''} · ${inv.date||''}\n30일 동안 임시보관함에 보관됩니다.`))return;
  S.data.trash_invoices.push({id:uid('ti'),deleted_at:now(),deleted_by:loginActor(),invoice:clone(inv)});S.data.invoices.splice(idx,1);addChangeLog('거래명세표 삭제',`${c?.name||''} · ${inv.date||''} 임시보관함 이동`,id);await persist();closeModal();render();
}
customerInvoiceRows=function(cid){return S.data.invoices.filter(i=>i.customer_id===cid).sort((a,b)=>(b.date||'').localeCompare(a.date||''))}
viewSavedInvoice=function(id){const inv=S.data.invoices.find(x=>x.id===id);if(!inv)return;const c=S.data.customers.find(x=>x.id===inv.customer_id);document.getElementById('modalBody').innerHTML=`<div class="toolbar"><h2 style="margin:0">저장 거래명세표</h2><span class="spacer"></span><button class="danger" onclick="deleteInvoiceV10('${id}')">거래명세표 삭제</button></div><p><b>${escapeHtml(c?.name||'')}</b> · ${inv.date||''} · 총액 ₩ ${money(inv.total)}</p><div class="table-wrap"><table><thead><tr><th>제품</th><th>수량</th><th>단가</th><th>금액</th></tr></thead><tbody>${(inv.items||[]).map(it=>{const p=S.data.products.find(x=>x.id===it.product_id);return `<tr><td>${escapeHtml(p?.name||'삭제된 제품')}</td><td>${it.qty||0}</td><td>₩ ${money(it.price)}</td><td>₩ ${money((it.qty||0)*(it.price||0))}</td></tr>`}).join('')}</tbody></table></div><div class="invoice-total">총액 ₩ ${money(inv.total)}</div>`}

function trashPanelV10(){
  ensureV10Data();const ps=[...S.data.trash_products].reverse(),ins=[...S.data.trash_invoices].reverse();
  return `<div class="card trash-card" style="margin-top:16px"><div class="toolbar"><div><h3 style="margin:0">임시 보관함</h3><div class="muted">제품 DB와 거래명세표 삭제 항목을 30일 보관합니다. 30일 후 자동 삭제됩니다.</div></div><span class="spacer"></span><button class="danger" onclick="emptyTrashV10()">전체 영구삭제</button></div><h4>제품 DB (${ps.length})</h4><div class="table-wrap"><table><thead><tr><th>삭제일</th><th>제품명</th><th>삭제자</th><th>처리</th></tr></thead><tbody>${ps.map(x=>`<tr><td>${x.deleted_at||''}</td><td>${escapeHtml(x.product?.name||'')}</td><td>${escapeHtml(x.deleted_by||'')}</td><td><button class="secondary" onclick="restoreTrashProductV10('${x.id}')">복원</button> <button class="danger" onclick="purgeTrashProductV10('${x.id}')">영구삭제</button></td></tr>`).join('')}</tbody></table></div>${ps.length?'':'<p class="muted">보관 중인 제품이 없습니다.</p>'}<h4 style="margin-top:18px">거래명세표 (${ins.length})</h4><div class="table-wrap"><table><thead><tr><th>삭제일</th><th>거래일</th><th>금액</th><th>삭제자</th><th>처리</th></tr></thead><tbody>${ins.map(x=>`<tr><td>${x.deleted_at||''}</td><td>${x.invoice?.date||''}</td><td>₩ ${money(x.invoice?.total)}</td><td>${escapeHtml(x.deleted_by||'')}</td><td><button class="secondary" onclick="restoreTrashInvoiceV10('${x.id}')">복원</button> <button class="danger" onclick="purgeTrashInvoiceV10('${x.id}')">영구삭제</button></td></tr>`).join('')}</tbody></table></div>${ins.length?'':'<p class="muted">보관 중인 거래명세표가 없습니다.</p>'}</div>`
}
async function restoreTrashProductV10(tid){const i=S.data.trash_products.findIndex(x=>x.id===tid);if(i<0)return;const x=S.data.trash_products[i];if(S.data.products.some(p=>p.id===x.product.id))return alert('같은 ID의 제품이 이미 있어 복원할 수 없습니다.');S.data.products.push(clone(x.product));if(x.inventory)S.data.inventory.push(clone(x.inventory));S.data.trash_products.splice(i,1);addChangeLog('제품 복원',`${x.product.name||'제품'} 임시보관함에서 복원`,x.product.id);await persist();renderSettings();render()}
async function restoreTrashInvoiceV10(tid){const i=S.data.trash_invoices.findIndex(x=>x.id===tid);if(i<0)return;const x=S.data.trash_invoices[i];if(S.data.invoices.some(v=>v.id===x.invoice.id))return alert('같은 ID의 거래명세표가 이미 있어 복원할 수 없습니다.');S.data.invoices.push(clone(x.invoice));S.data.trash_invoices.splice(i,1);addChangeLog('거래명세표 복원',`${x.invoice.date||''} 임시보관함에서 복원`,x.invoice.id);await persist();renderSettings();render()}
async function purgeTrashProductV10(tid){if(!confirm('이 제품을 영구 삭제할까요? 복구할 수 없습니다.'))return;S.data.trash_products=S.data.trash_products.filter(x=>x.id!==tid);await persist();renderSettings()}
async function purgeTrashInvoiceV10(tid){if(!confirm('이 거래명세표를 영구 삭제할까요? 복구할 수 없습니다.'))return;S.data.trash_invoices=S.data.trash_invoices.filter(x=>x.id!==tid);await persist();renderSettings()}
async function emptyTrashV10(){if(!confirm('임시 보관함의 모든 항목을 영구 삭제할까요? 복구할 수 없습니다.'))return;S.data.trash_products=[];S.data.trash_invoices=[];await persist();renderSettings()}

const _v10RenderSettingsBase=renderSettings;
renderSettings=function(){
  _v10RenderSettingsBase();
  if(S.sessionUser?.role==='admin'){
    const page=document.getElementById('page-settings');if(page&&!page.querySelector('.trash-card'))page.insertAdjacentHTML('beforeend',trashPanelV10());
  }
}

// No history panel on customer/invoice/settings/dashboard. Product DB and inventory render their own dedicated history only.
const _v10RenderBase=render;
render=function(){ensureV10Data();_v10RenderBase();document.querySelectorAll('#page-dashboard .global-change-panel,#page-customers .global-change-panel,#page-invoice .global-change-panel,#page-settings .global-change-panel,#page-inventory .global-change-panel').forEach(x=>x.remove());}


/* ===== v11 customer/invoice/mobile refinements ===== */
function ensureV11Data(){
  ensureV10Data();
  S.data.customers.forEach(c=>{
    if(c.branch_name==null){
      c.branch_name=(c.type==='지점' ? (c.contact||'') : '');
    }
    if(c.person_name==null)c.person_name=c.name||'';
    // Keep legacy fields mirrored so older code remains compatible.
    c.name=c.person_name||c.name||'';
  });
  if(!S.customerSort)S.customerSort='name';
}

function customerDisplayName(c){return (c?.person_name||c?.name||'').trim()}
function customerBranchName(c){return (c?.branch_name||'').trim()}
function customerPrimaryLabel(c){return customerBranchName(c)||customerDisplayName(c)}
function customerSecondaryLabel(c){return customerBranchName(c)?customerDisplayName(c):''}
function customerFilePrefix(c,date){
  const parts=[];if(customerBranchName(c))parts.push(customerBranchName(c));if(customerDisplayName(c))parts.push(customerDisplayName(c));if(date)parts.push(date);
  return (parts.join('_')||'거래명세서').replace(/[\\/:*?"<>|]+/g,'_').replace(/\s+/g,' ').trim();
}
function sortedCustomersV11(){
  ensureV11Data();const a=[...S.data.customers];
  if(S.customerSort==='region')a.sort((x,y)=>String(x.address||'').localeCompare(String(y.address||''),'ko')||customerDisplayName(x).localeCompare(customerDisplayName(y),'ko'));
  else if(S.customerSort==='type')a.sort((x,y)=>String(x.type||'').localeCompare(String(y.type||''),'ko')||customerDisplayName(x).localeCompare(customerDisplayName(y),'ko'));
  else a.sort((x,y)=>customerDisplayName(x).localeCompare(customerDisplayName(y),'ko'));
  return a;
}

renderCustomers=function(){
  ensureV11Data();const cs=sortedCustomersV11();
  document.getElementById('page-customers').innerHTML=`<div class="toolbar">
    <button class="secondary" onclick="selectAllCustomers(true)">전체선택</button><button class="secondary" onclick="S.selectedCustomers.clear();renderCustomers()">선택해제</button>
    <button class="secondary" onclick="moveSelectedCustomers(-1)">↑ 위로</button><button class="secondary" onclick="moveSelectedCustomers(1)">↓ 아래로</button><button class="danger" onclick="deleteSelectedCustomers()">선택삭제</button>
    <label>정렬 <select onchange="S.customerSort=this.value;renderCustomers()"><option value="name" ${S.customerSort==='name'?'selected':''}>이름순</option><option value="region" ${S.customerSort==='region'?'selected':''}>지역 + 이름순</option><option value="type" ${S.customerSort==='type'?'selected':''}>지점/고객 + 이름순</option></select></label>
    <span class="spacer"></span><button class="primary" onclick="editCustomer()">+ 신규 등록</button>
  </div><div class="table-wrap"><table><thead><tr><th class="select-col">선택</th><th>구분</th><th>지점명</th><th>이름</th><th>사업자등록번호</th><th>연락처</th><th>주소</th><th>기본 가격</th><th>사업자등록증</th><th></th></tr></thead><tbody>${cs.map(c=>`<tr><td class="select-col">${customerSelectBox(c.id)}</td><td>${escapeHtml(c.type||'')}</td><td>${escapeHtml(customerBranchName(c)||'-')}</td><td><a href="javascript:void(0)" onclick="openCustomerDetail('${c.id}')">${escapeHtml(customerDisplayName(c)||'-')}</a></td><td>${escapeHtml(c.business_no||'')}</td><td>${escapeHtml(c.phone||'')}</td><td>${escapeHtml(c.address||'')}</td><td>${priceLabel(c.price_level)}</td><td>${c.business_doc_data?`<span class="customer-doc-link" onclick="downloadBusinessDoc('${c.id}')">${escapeHtml(c.business_doc_name||'보기/다운로드')}</span>`:'-'}</td><td><button onclick="editCustomer('${c.id}')">수정</button></td></tr>`).join('')}</tbody></table></div>`;
}

editCustomer=function(id){
  ensureV11Data();const c=id?S.data.customers.find(x=>x.id===id):{type:'지점',branch_name:'',person_name:'',business_no:'',phone:'',address:'',price_level:'branch_price',business_doc_name:'',business_doc_data:''};
  window._customerDoc={name:c.business_doc_name||'',data:c.business_doc_data||''};
  document.getElementById('modalBody').innerHTML=`<div class="modal-sticky-head"><h2>${id?'지점/고객 수정':'신규 지점/고객'}</h2></div><div class="customer-form-vertical">
    <label>구분<select id="c-type"><option ${c.type==='지점'?'selected':''}>지점</option><option ${c.type==='고객'?'selected':''}>고객</option></select></label>
    <label>지점명<input id="c-branch_name" value="${escapeHtml(customerBranchName(c))}" placeholder="지점이 아닌 경우 비워도 됩니다."></label>
    <label>이름<input id="c-person_name" value="${escapeHtml(customerDisplayName(c))}"></label>
    <label>사업자등록번호<input id="c-business_no" value="${escapeHtml(c.business_no||'')}"></label>
    <label>연락처<input id="c-phone" value="${escapeHtml(c.phone||'')}"></label>
    <label>주소<input id="c-address" value="${escapeHtml(c.address||'')}"></label>
    <label>기본 가격<select id="c-price_level"><option value="branch_price" ${c.price_level==='branch_price'?'selected':''}>지점가</option><option value="wholesale_price" ${c.price_level==='wholesale_price'?'selected':''}>1차 도매가</option><option value="sale_price" ${c.price_level==='sale_price'?'selected':''}>판매가</option></select></label>
    <label>사업자등록증 / 관련서류<input type="file" id="c-doc" onchange="customerDocPicked(this)"><div class="muted">${escapeHtml(c.business_doc_name||'등록된 파일 없음')}</div>${c.business_doc_data?`<button type="button" class="secondary" onclick="downloadBusinessDoc('${id}')">현재 파일 보기/다운로드</button>`:''}</label>
  </div><div class="modal-bottom-actions"><button class="primary" onclick="saveCustomerV11('${id||''}')">저장</button></div>`;
  document.getElementById('modal').classList.remove('hidden');
}
async function saveCustomerV11(id){
  const old=id?S.data.customers.find(x=>x.id===id):null,person=(document.getElementById('c-person_name')?.value||'').trim(),branch=(document.getElementById('c-branch_name')?.value||'').trim();if(!person)return alert('이름을 입력하세요.');
  const o={id:id||uid('c'),type:document.getElementById('c-type').value,branch_name:branch,person_name:person,name:person,contact:'',business_no:document.getElementById('c-business_no').value.trim(),phone:document.getElementById('c-phone').value.trim(),address:document.getElementById('c-address').value.trim(),price_level:document.getElementById('c-price_level').value,business_doc_name:window._customerDoc?.name||old?.business_doc_name||'',business_doc_data:window._customerDoc?.data||old?.business_doc_data||''};
  if(old)Object.assign(old,o);else S.data.customers.push(o);addChangeLog(id?'고객/지점 수정':'고객/지점 등록',`${customerPrimaryLabel(o)} · ${person}`,o.id);await persist();closeModal();render();
}

function invoiceCustomerOptionsV11(selected=''){
  return sortedCustomersV11().map(c=>`<option value="${c.id}" ${c.id===selected?'selected':''}>${escapeHtml(customerDisplayName(c))}${customerBranchName(c)?' · '+escapeHtml(customerBranchName(c)):''}</option>`).join('');
}

invoiceCustomerChanged=function(){
  drawInvoiceRows();const cid=document.getElementById('inv-customer')?.value,c=S.data.customers.find(x=>x.id===cid),o=getInvoiceOptions(),el=document.getElementById('invoiceCustomerLine');if(!el)return;
  const branch=customerBranchName(c),name=customerDisplayName(c),top=[];if(o.show_branch&&branch)top.push(`지점명: ${escapeHtml(branch)}`);if(o.show_contact&&name)top.push(`이름: ${escapeHtml(name)}`);if(!branch&&name&&o.show_branch&&!o.show_contact)top.push(`이름: ${escapeHtml(name)}`);
  const low=[];if(o.show_phone&&c?.phone)low.push(`전화번호: ${escapeHtml(c.phone)}`);if(o.show_business_no&&c?.business_no)low.push(`사업자번호: ${escapeHtml(c.business_no)}`);
  el.innerHTML=`<div class="invoice-customer-print"><div class="customer-print-top">${top.join(' &nbsp;&nbsp; ')||'이름: '}</div>${low.length?`<div class="customer-print-sub">${low.join(' &nbsp;&nbsp; ')}</div>`:''}</div><span class="invoice-customer-edit">이름: <select id="inv-customer" onchange="invoiceCustomerChanged()"><option value="">선택</option>${invoiceCustomerOptionsV11(cid)}</select></span>`;
}

const _v11RenderInvoiceBase=renderInvoice;
renderInvoice=function(){
  ensureV11Data();_v11RenderInvoiceBase();
  const sel=document.getElementById('inv-customer');if(sel){const v=sel.value;sel.innerHTML=`<option value="">선택</option>${invoiceCustomerOptionsV11(v)}`;}
  const lab=document.querySelector('#invoiceCustomerLine .invoice-customer-edit');if(lab&&lab.firstChild)lab.firstChild.textContent='이름: ';
  const dateBox=document.querySelector('.invoice-topline>div:last-child');if(dateBox)dateBox.classList.add('invoice-date-cell');
  invoiceCustomerChanged();
}

// Compact searchable multi-select picker used for invoice product selection.
addInvoiceProduct=function(){
  window._invoicePickSet=new Set();
  document.getElementById('modalBody').innerHTML=`<div class="modal-sticky-head"><h2>제품 선택</h2><button class="primary" onclick="addPickedInvoiceProductsV11()">선택 제품 추가</button></div><div class="picker-toolbar"><input id="productPickerSearch" placeholder="제품명 또는 소재 검색" oninput="drawProductPickerV11()"><span id="pickerCount" class="muted"></span></div><div id="productPickerList" class="compact-product-picker"></div>`;
  document.getElementById('modal').classList.remove('hidden');drawProductPickerV11();
}
function drawProductPickerV11(){
  const q=(document.getElementById('productPickerSearch')?.value||'').trim().toLowerCase(),list=S.data.products.filter(p=>!p.discontinued&&(!q||String(p.name||'').toLowerCase().includes(q)||String(p.material||'').toLowerCase().includes(q)));
  document.getElementById('productPickerList').innerHTML=list.map(p=>`<label class="compact-product-row"><input type="checkbox" ${window._invoicePickSet?.has(p.id)?'checked':''} onchange="this.checked?window._invoicePickSet.add('${p.id}'):window._invoicePickSet.delete('${p.id}');document.getElementById('pickerCount').textContent=window._invoicePickSet.size+'개 선택'">${p.image?`<img src="${p.image}">`:`<span class="img-placeholder compact-picker-img">NO</span>`}<span><b>${escapeHtml(p.name)}</b><small>${escapeHtml(p.material||'')}${p.group?' · '+escapeHtml(p.group):''}</small></span><span class="picker-stock">재고 ${totalQty(p.id)}</span></label>`).join('')||'<p class="muted">검색 결과가 없습니다.</p>';
  document.getElementById('pickerCount').textContent=(window._invoicePickSet?.size||0)+'개 선택';
}
function addPickedInvoiceProductsV11(){
  for(const pid of (window._invoicePickSet||[]))if(!S.selectedInvoiceItems.some(x=>x.product_id===pid))S.selectedInvoiceItems.push({product_id:pid,qty:1,price:null,note:'',selected:false});closeModal();drawInvoiceRows();
}

// Searchable product selector for stock movement.
stockMove=function(){
  window._stockPick='';const optsL=S.data.locations.map(l=>`<option value="${l.id}">${escapeHtml(l.name)}</option>`).join('');document.getElementById('modalBody').innerHTML=`<div class="modal-sticky-head"><h2>입고 / 출고 / 이동</h2></div><div class="picker-toolbar"><input id="stockProductSearch" placeholder="제품명 또는 소재 검색" oninput="drawStockPickerV11()"></div><div id="stockProductPicker" class="compact-product-picker stock-picker"></div><input type="hidden" id="sm-p"><div class="customer-form-vertical compact-form"><label>구분<select id="sm-type"><option>입고</option><option>출고</option><option>이동</option></select></label><label>출발 위치<select id="sm-from">${optsL}</select></label><label>도착 위치<select id="sm-to">${optsL}</select></label><label>수량<input id="sm-q" type="number"></label><label>메모<input id="sm-note"></label></div><button class="primary" onclick="applyStockMove()">반영</button>`;document.getElementById('modal').classList.remove('hidden');drawStockPickerV11();
}
function drawStockPickerV11(){const q=(document.getElementById('stockProductSearch')?.value||'').toLowerCase(),list=S.data.products.filter(p=>!p.discontinued&&(!q||String(p.name||'').toLowerCase().includes(q)||String(p.material||'').toLowerCase().includes(q)));document.getElementById('stockProductPicker').innerHTML=list.slice(0,50).map(p=>`<button type="button" class="compact-product-row stock-pick ${window._stockPick===p.id?'selected':''}" onclick="window._stockPick='${p.id}';document.getElementById('sm-p').value='${p.id}';drawStockPickerV11()">${p.image?`<img src="${p.image}">`:`<span class="img-placeholder compact-picker-img">NO</span>`}<span><b>${escapeHtml(p.name)}</b><small>${escapeHtml(p.material||'')}</small></span><span class="picker-stock">재고 ${totalQty(p.id)}</span></button>`).join('')};

// Customer detail: two compact 10-row views + period total + full view.
openCustomerDetail=function(id){
  ensureV11Data();const c=S.data.customers.find(x=>x.id===id);if(!c)return;window._customerDetailId=id;window._customerDetailMode='history';
  document.getElementById('modalBody').innerHTML=`<div class="modal-sticky-head customer-detail-head"><div><h2>${escapeHtml(customerPrimaryLabel(c))} 상세</h2><div class="muted">${customerBranchName(c)?escapeHtml(customerDisplayName(c)):''}</div></div><button class="primary" onclick="editCustomer('${id}')">수정</button></div>
  <div class="detail-basic-list compact-basic-list customer-basic">${[['구분',c.type],['지점명',customerBranchName(c)],['이름',customerDisplayName(c)],['연락처',c.phone],['주소',c.address],['사업자등록번호',c.business_no],['기본 가격',priceLabel(c.price_level)]].map(r=>`<div class="detail-basic-row"><div class="label">${r[0]}</div><div class="value">${escapeHtml(r[1]||'-')}</div></div>`).join('')}</div>
  <div class="card customer-purchase-card"><div class="toolbar"><button id="cd-tab-history" class="primary" onclick="setCustomerDetailModeV11('history')">거래별 보기</button><button id="cd-tab-product" class="secondary" onclick="setCustomerDetailModeV11('product')">제품별 통합</button><span class="spacer"></span><button class="secondary" onclick="setCustomerDetailPeriodV11('month')">이번달</button><button class="secondary" onclick="setCustomerDetailPeriodV11('year')">올해</button></div><div class="customer-period-row"><label>시작 <input id="cd-from" type="date" onchange="drawCustomerDetailV11()"></label><label>종료 <input id="cd-to" type="date" onchange="drawCustomerDetailV11()"></label></div><div id="customerDetailSummary"></div></div>`;
  document.getElementById('modal').classList.remove('hidden');setCustomerDetailPeriodV11('year');
}
function setCustomerDetailModeV11(mode){window._customerDetailMode=mode;document.getElementById('cd-tab-history')?.classList.toggle('primary',mode==='history');document.getElementById('cd-tab-history')?.classList.toggle('secondary',mode!=='history');document.getElementById('cd-tab-product')?.classList.toggle('primary',mode==='product');document.getElementById('cd-tab-product')?.classList.toggle('secondary',mode!=='product');drawCustomerDetailV11()}
function setCustomerDetailPeriodV11(kind){const d=new Date(),to=d.toISOString().slice(0,10);let from=kind==='month'?`${to.slice(0,7)}-01`:`${d.getFullYear()}-01-01`;if(document.getElementById('cd-from'))document.getElementById('cd-from').value=from;if(document.getElementById('cd-to'))document.getElementById('cd-to').value=to;drawCustomerDetailV11()}
function customerInvoicesInPeriodV11(cid){const from=document.getElementById('cd-from')?.value||'0000-01-01',to=document.getElementById('cd-to')?.value||'9999-12-31';return customerInvoiceRows(cid).filter(i=>(i.date||'')>=from&&(i.date||'')<=to)}
function drawCustomerDetailV11(showAll=false){
  const cid=window._customerDetailId,mode=window._customerDetailMode||'history',invs=customerInvoicesInPeriodV11(cid),periodTotal=invs.reduce((s,i)=>s+Number(i.total||0),0),el=document.getElementById('customerDetailSummary');if(!el)return;
  if(mode==='history'){
    const rows=showAll?invs:invs.slice(0,10);el.innerHTML=`<div class="period-total">기간 총 거래금액 <b>₩ ${money(periodTotal)}</b></div><div class="table-wrap"><table><thead><tr><th>날짜</th><th>품목 수</th><th>수량</th><th>총금액</th><th></th></tr></thead><tbody>${rows.map(inv=>`<tr><td>${inv.date||''}</td><td>${inv.items?.length||0}</td><td>${(inv.items||[]).reduce((s,x)=>s+Number(x.qty||0),0)}</td><td>₩ ${money(inv.total)}</td><td><button class="secondary" onclick="viewSavedInvoice('${inv.id}')">보기</button></td></tr>`).join('')}</tbody></table></div>${invs.length>10&&!showAll?`<button class="secondary full-view-btn" onclick="drawCustomerDetailV11(true)">전체보기 (${invs.length}건)</button>`:''}${!invs.length?'<p class="muted">해당 기간 거래가 없습니다.</p>':''}`;
  }else{
    const map=new Map();invs.forEach(inv=>(inv.items||[]).forEach(it=>{const p=S.data.products.find(x=>x.id===it.product_id),k=it.product_id,v=map.get(k)||{name:p?.name||'삭제된 제품',qty:0,amount:0};v.qty+=Number(it.qty||0);v.amount+=Number(it.qty||0)*Number(it.price||0);map.set(k,v)}));const all=[...map.values()].sort((a,b)=>b.qty-a.qty),rows=showAll?all:all.slice(0,10);el.innerHTML=`<div class="period-total">기간 총 거래금액 <b>₩ ${money(periodTotal)}</b></div><div class="table-wrap"><table><thead><tr><th>제품명</th><th>총 수량</th><th>총 금액</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${escapeHtml(x.name)}</td><td>${x.qty}</td><td>₩ ${money(x.amount)}</td></tr>`).join('')}</tbody></table></div>${all.length>10&&!showAll?`<button class="secondary full-view-btn" onclick="drawCustomerDetailV11(true)">전체보기 (${all.length}개 제품)</button>`:''}${!all.length?'<p class="muted">해당 기간 거래가 없습니다.</p>':''}`;
  }
}

async function getImageSizeV11(src){return await new Promise(res=>{if(!src)return res(null);const im=new Image();im.onload=()=>res({w:im.naturalWidth||im.width,h:im.naturalHeight||im.height});im.onerror=()=>res(null);im.src=src})}
function fitBoxV11(w,h,maxW,maxH){if(!w||!h)return {w:maxW,h:maxH};const r=Math.min(maxW/w,maxH/h);return {w:Math.max(1,w*r),h:Math.max(1,h*r)}}
function positionExcelImageV11(ws,imageId,col,row,iw,ih,cellW=78,cellH=70){const fit=fitBoxV11(iw,ih,cellW-8,cellH-8),xoff=(cellW-fit.w)/2,yoff=(cellH-fit.h)/2;ws.addImage(imageId,{tl:{col:col+(xoff/cellW),row:row+(yoff/cellH)},ext:{width:fit.w,height:fit.h}})}

saveInvoicePdf=async function(){
  const el=document.getElementById('invoiceCapture'),cid=document.getElementById('inv-customer')?.value,c=S.data.customers.find(x=>x.id===cid),date=document.getElementById('inv-date')?.value||new Date().toISOString().slice(0,10),filename=customerFilePrefix(c,date)+'_거래명세서.pdf';setInvoiceOutputMode(true);await new Promise(r=>setTimeout(r,80));
  try{const canvas=await html2canvas(el,{scale:2,backgroundColor:'#ffffff',useCORS:true});const img=canvas.toDataURL('image/png');const {jsPDF}=window.jspdf,pdf=new jsPDF('p','mm','a4'),pw=210,ph=297,margin=8,ratio=Math.min((pw-margin*2)/canvas.width,(ph-margin*2)/canvas.height),w=canvas.width*ratio,h=canvas.height*ratio;pdf.addImage(img,'PNG',margin,margin,w,h);pdf.save(filename)}finally{setInvoiceOutputMode(false)}
}

exportInvoiceExcel=async function(){
  if(!window.ExcelJS)return alert('Excel 모듈을 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.');
  const wb=new ExcelJS.Workbook(),ws=wb.addWorksheet('거래명세서',{pageSetup:{paperSize:9,orientation:'portrait',fitToPage:true,fitToWidth:1,fitToHeight:1,margins:{left:0.18,right:0.18,top:0.25,bottom:0.25,header:0,footer:0},horizontalCentered:true,verticalCentered:false}}),t=currentTemplate(),cid=document.getElementById('inv-customer')?.value,c=S.data.customers.find(x=>x.id===cid),date=document.getElementById('inv-date')?.value||'',o=getInvoiceOptions(),tt=invoiceTotals();
  ws.columns=[5,12,23,10,12,8,14,18].map(width=>({width}));
  ws.mergeCells('A1:H2');let ce=ws.getCell('A1');ce.value=t.title||'거래명세서';ce.font={size:20,bold:true,underline:true};ce.alignment={horizontal:'center',vertical:'middle'};ws.getRow(1).height=22;ws.getRow(2).height=16;
  ws.mergeCells('A3:E3');ws.mergeCells('F3:H3');const info=[];if(o.show_branch&&customerBranchName(c))info.push(`지점명: ${customerBranchName(c)}`);if(o.show_contact&&customerDisplayName(c))info.push(`이름: ${customerDisplayName(c)}`);if(!customerBranchName(c)&&customerDisplayName(c)&&o.show_branch&&!o.show_contact)info.push(`이름: ${customerDisplayName(c)}`);if(o.show_phone&&c?.phone)info.push(`전화번호: ${c.phone}`);if(o.show_business_no&&c?.business_no)info.push(`사업자번호: ${c.business_no}`);ws.getCell('A3').value=info.join('   ');ws.getCell('F3').value=`주문일자: ${date}`;ws.getCell('F3').alignment={horizontal:'right',vertical:'middle'};ws.getCell('A3').alignment={vertical:'middle',wrapText:true};ws.getRow(3).height=25;
  const headers=['순번','이미지','제품명/규격','수종','공급가','수량','금액','비고'];headers.forEach((h,i)=>{const cc=ws.getCell(4,i+1);cc.value=h;cc.font={bold:true};cc.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFD9D9D9'}};cc.alignment={horizontal:'center',vertical:'middle'}});ws.getRow(4).height=21;
  const start=5,minRows=Math.max(3,S.selectedInvoiceItems.length);
  for(let r=0;r<minRows;r++){const rowNum=start+r,row=ws.getRow(rowNum);row.height=70;const it=S.selectedInvoiceItems[r];if(it){const p=S.data.products.find(x=>x.id===it.product_id);row.getCell(1).value=r+1;row.getCell(3).value=`${p.name}\n${p.w||0}×${p.d||0}×${p.h||0}`;row.getCell(4).value=p.material||'';row.getCell(5).value=Number(it.price)||0;row.getCell(6).value=Number(it.qty)||0;row.getCell(7).value=(Number(it.price)||0)*(Number(it.qty)||0);row.getCell(8).value=it.note||'';row.getCell(5).numFmt='₩ #,##0';row.getCell(7).numFmt='₩ #,##0';const dp=dataUrlParts(p.image);if(dp){try{const sz=await getImageSizeV11(p.image),imageId=wb.addImage({base64:dp.base64,extension:dp.ext});positionExcelImageV11(ws,imageId,1,rowNum-1,sz?.w||1,sz?.h||1,78,70)}catch(e){console.warn(e)}}}row.eachCell({includeEmpty:true},cc=>cc.alignment={horizontal:'center',vertical:'middle',wrapText:true})}
  const sumStart=start+minRows;ws.mergeCells(`A${sumStart}:D${sumStart+2}`);ws.getCell(`A${sumStart}`).value='합계';ws.getCell(`A${sumStart}`).alignment={horizontal:'center',vertical:'middle'};ws.getCell(`A${sumStart}`).font={bold:true};ws.mergeCells(`E${sumStart}:F${sumStart}`);ws.mergeCells(`G${sumStart}:H${sumStart}`);ws.getCell(`E${sumStart}`).value='TOTAL';ws.getCell(`G${sumStart}`).value=tt.sub;ws.getCell(`G${sumStart}`).numFmt='₩ #,##0';let last=sumStart;if(o.vat_mode==='included'){ws.mergeCells(`E${sumStart+1}:F${sumStart+1}`);ws.mergeCells(`G${sumStart+1}:H${sumStart+1}`);ws.getCell(`E${sumStart+1}`).value='VAT (10%)';ws.getCell(`G${sumStart+1}`).value=tt.vat;ws.getCell(`G${sumStart+1}`).numFmt='₩ #,##0';last=sumStart+1}const gRow=o.vat_mode==='included'?sumStart+2:sumStart+1;ws.mergeCells(`E${gRow}:F${gRow}`);ws.mergeCells(`G${gRow}:H${gRow}`);ws.getCell(`E${gRow}`).value='GRAND TOTAL';ws.getCell(`G${gRow}`).value=tt.grand;ws.getCell(`G${gRow}`).numFmt='₩ #,##0';ws.getCell(`E${gRow}`).font=ws.getCell(`G${gRow}`).font={bold:true};last=gRow;ws.mergeCells(`A${last+2}:H${last+2}`);ws.getCell(`A${last+2}`).value=t.bank_info||'';ws.getCell(`A${last+2}`).alignment={horizontal:'center',vertical:'middle'};ws.getCell(`A${last+2}`).font={bold:true};ws.getCell(`A${last+2}`).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFD9D9D9'}};ws.getRow(last+2).height=22;
  const thin={style:'thin',color:{argb:'FF000000'}};for(let r=3;r<=last+2;r++)for(let col=1;col<=8;col++)ws.getCell(r,col).border={top:thin,left:thin,bottom:thin,right:thin};ws.pageSetup.printArea=`A1:H${last+2}`;ws.views=[{showGridLines:false}];
  const buf=await wb.xlsx.writeBuffer(),blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=customerFilePrefix(c,date)+'_거래명세서.xlsx';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

// Keep invoice screen image ratios intact and customer/date layout compact.
const _v11DrawInvoiceRowsBase=drawInvoiceRows;
drawInvoiceRows=function(){_v11DrawInvoiceRowsBase();document.querySelectorAll('#invoiceRows .invoice-img').forEach(img=>{img.style.objectFit='contain';img.style.objectPosition='center';img.style.width='72px';img.style.height='72px'})}

const _v11RenderBase=render;
render=function(){ensureV11Data();_v11RenderBase();}
const _v11ApplyStockMove=applyStockMove;
applyStockMove=async function(){if(!document.getElementById('sm-p')?.value)return alert('제품을 먼저 검색해서 선택하세요.');return _v11ApplyStockMove();}

/* ===== v12 workflow / export / stock-allocation refinements ===== */
function ensureV12Data(){
  ensureV11Data();
  if(!Array.isArray(S.data.stock_allocations))S.data.stock_allocations=[];
  if(!Array.isArray(S.data.allocation_history))S.data.allocation_history=[];
  if(!S.data.invoice_templates?.length)S.data.invoice_templates=clone(DEMO.invoice_templates);
  S.data.invoice_templates.forEach(t=>{
    if(!t.bank_info)t.bank_info='농협 302-1333-3780-11 한태희';
  });
}
const V12_BANKS=['농협 302-1333-3780-11 한태희','농협 302-7657-7427-41 한지희'];

async function setSelectedDiscontinuedV12(flag){
  const ids=[...S.selectedProducts].filter(id=>S.data.products.some(p=>p.id===id));
  if(!ids.length)return alert('제품을 먼저 선택하세요.');
  ids.forEach(id=>{const p=S.data.products.find(x=>x.id===id);if(p){p.discontinued=!!flag;addChangeLog(flag?'단종 설정':'단종 해제',`${p.name} · ${flag?'단종':'판매 제품'}`,p.id)}});
  await persist();renderProducts();
}
const _v12RenderProductsBase=renderProducts;
renderProducts=function(){
  _v12RenderProductsBase();
  const tb=document.querySelector('#page-products .toolbar');
  if(tb&&!document.getElementById('bulkDiscV12')){
    const wrap=document.createElement('span');wrap.id='bulkDiscV12';wrap.className='inline-actions-v12';wrap.innerHTML=`<button class="secondary" onclick="setSelectedDiscontinuedV12(true)">선택 단종</button><button class="secondary" onclick="setSelectedDiscontinuedV12(false)">단종 해제</button>`;
    const spacer=tb.querySelector('.spacer'); spacer?tb.insertBefore(wrap,spacer):tb.appendChild(wrap);
  }
}

// Keep product editing actions visible at the top while scrolling.
const _v12DrawProductModalBase=drawProductModal;
drawProductModal=function(p){
  _v12DrawProductModalBase(p);
  const root=document.querySelector('.product-modal-inner');if(!root)return;
  const top=root.querySelector(':scope > .toolbar');if(top){top.classList.add('modal-action-sticky-v12');
    if(S.detailEdit&&!top.querySelector('.v12-top-save')){
      const sp=top.querySelector('.spacer')||document.createElement('span');if(!sp.parentNode){sp.className='spacer';top.appendChild(sp)}
      top.insertAdjacentHTML('beforeend',`<button class="primary v12-top-save" onclick="saveProduct('${p.id||''}')">저장</button><button class="secondary" onclick="cancelDetailEdit()">취소</button>${p.id?`<button class="danger" onclick="deleteProduct('${p.id}')">삭제</button>`:''}`);
    }
  }
  root.querySelector('.row-actions')?.classList.add('v12-bottom-actions-hidden');
}

// Customer edit: top save action, no need to scroll to bottom.
const _v12EditCustomerBase=editCustomer;
editCustomer=function(id){
  _v12EditCustomerBase(id);
  const head=document.querySelector('#modalBody .modal-sticky-head');
  if(head&&!head.querySelector('.v12-c-save'))head.insertAdjacentHTML('beforeend',`<div class="sticky-action-buttons"><button class="primary v12-c-save" onclick="saveCustomerV11('${id||''}')">저장</button></div>`);
  document.querySelector('#modalBody .modal-bottom-actions')?.remove();
}

// Invoice template manager with two selectable bank accounts.
manageInvoiceTemplates=function(){
  ensureV12Data();
  document.getElementById('modalBody').innerHTML=`<div class="modal-sticky-head"><h2>거래명세서 양식 관리</h2><button class="primary" onclick="addTemplate()">+ 새 양식</button></div><p class="muted">양식별 표시 항목과 계좌를 저장해서 반복 사용할 수 있습니다.</p>${S.data.invoice_templates.map((t,i)=>`<div class="detail-section-card template-card-v12"><label>양식명<input id="t-name-${i}" value="${escapeHtml(t.name||'')}"></label><label>제목<input id="t-title-${i}" value="${escapeHtml(t.title||'거래명세서')}"></label><label>계좌번호<select id="t-bank-${i}">${V12_BANKS.map(b=>`<option value="${escapeHtml(b)}" ${t.bank_info===b?'selected':''}>${escapeHtml(b)}</option>`).join('')}<option value="custom" ${!V12_BANKS.includes(t.bank_info)?'selected':''}>직접 입력</option></select></label><label>직접 입력<input id="t-bank-custom-${i}" value="${escapeHtml(V12_BANKS.includes(t.bank_info)?'':(t.bank_info||''))}" placeholder="직접 입력할 때 사용"></label><div class="template-checks-v12"><label><input type="checkbox" id="t-image-${i}" ${t.show_image!==false?'checked':''}> 이미지</label><label><input type="checkbox" id="t-size-${i}" ${t.show_size!==false?'checked':''}> 규격</label><label><input type="checkbox" id="t-material-${i}" ${t.show_material!==false?'checked':''}> 수종</label><label><input type="checkbox" id="t-price-${i}" ${t.show_price!==false?'checked':''}> 가격</label><label><input type="checkbox" id="t-note-${i}" ${t.show_note!==false?'checked':''}> 비고</label></div><div class="row-actions"><button class="secondary" onclick="saveTemplateV12(${i})">이 양식 저장</button>${i?`<button class="danger" onclick="deleteTemplate(${i})">삭제</button>`:''}</div></div>`).join('')}`;
  document.getElementById('modal').classList.remove('hidden');
}
async function saveTemplateV12(i){
  const t=S.data.invoice_templates[i],sel=document.getElementById('t-bank-'+i)?.value,custom=document.getElementById('t-bank-custom-'+i)?.value.trim();
  t.name=document.getElementById('t-name-'+i)?.value||t.name;t.title=document.getElementById('t-title-'+i)?.value||'거래명세서';t.bank_info=sel==='custom'?(custom||V12_BANKS[0]):sel;
  t.show_image=!!document.getElementById('t-image-'+i)?.checked;t.show_size=!!document.getElementById('t-size-'+i)?.checked;t.show_material=!!document.getElementById('t-material-'+i)?.checked;t.show_price=!!document.getElementById('t-price-'+i)?.checked;t.show_note=!!document.getElementById('t-note-'+i)?.checked;
  await persist();renderInvoice();manageInvoiceTemplates();
}

// Customer report export (both modes).
function customerReportDataV12(){
  const cid=window._customerDetailId,c=S.data.customers.find(x=>x.id===cid),mode=window._customerDetailMode||'history',from=document.getElementById('cd-from')?.value||'',to=document.getElementById('cd-to')?.value||'',invs=customerInvoicesInPeriodV11(cid),total=invs.reduce((s,i)=>s+Number(i.total||0),0);
  if(mode==='history')return {c,mode,from,to,total,rows:invs.map(inv=>({date:inv.date||'',types:inv.items?.length||0,qty:(inv.items||[]).reduce((s,x)=>s+Number(x.qty||0),0),amount:Number(inv.total||0)}))};
  const map=new Map();invs.forEach(inv=>(inv.items||[]).forEach(it=>{const p=S.data.products.find(x=>x.id===it.product_id),k=it.product_id,v=map.get(k)||{name:p?.name||'삭제된 제품',qty:0,amount:0};v.qty+=Number(it.qty||0);v.amount+=Number(it.qty||0)*Number(it.price||0);map.set(k,v)}));
  return {c,mode,from,to,total,rows:[...map.values()].sort((a,b)=>b.qty-a.qty)};
}
function customerReportTitleV12(c){return [customerBranchName(c),customerDisplayName(c)].filter(Boolean).join(' · ')||'거래 내역'}
function customerReportFilenameV12(d,ext){return (customerFilePrefix(d.c,d.to||new Date().toISOString().slice(0,10))+'_'+(d.mode==='history'?'거래별내역':'제품별통합')+'.'+ext).replace(/\s+/g,'_')}
async function exportCustomerReportPdfV12(){
  const d=customerReportDataV12(),wrap=document.createElement('div');wrap.className='customer-report-print-v12';wrap.innerHTML=`<h1>${escapeHtml(customerReportTitleV12(d.c))}</h1><div class="report-period-v12">기간: ${d.from||'-'} ~ ${d.to||'-'}</div><h2>${d.mode==='history'?'거래별 내역':'제품별 통합'}</h2><table><thead><tr>${d.mode==='history'?'<th>날짜</th><th>품목 수</th><th>수량</th><th>총금액</th>':'<th>제품명</th><th>총수량</th><th>총금액</th>'}</tr></thead><tbody>${d.rows.map(r=>d.mode==='history'?`<tr><td>${r.date}</td><td>${r.types}</td><td>${r.qty}</td><td>₩ ${money(r.amount)}</td></tr>`:`<tr><td>${escapeHtml(r.name)}</td><td>${r.qty}</td><td>₩ ${money(r.amount)}</td></tr>`).join('')}</tbody></table><div class="report-grand-v12">전체 총금액 <b>₩ ${money(d.total)}</b></div>`;document.body.appendChild(wrap);
  try{const canvas=await html2canvas(wrap,{scale:2,backgroundColor:'#fff'}),img=canvas.toDataURL('image/png'),{jsPDF}=window.jspdf,pdf=new jsPDF('p','mm','a4'),margin=10,pw=210,ph=297,ratio=Math.min((pw-margin*2)/canvas.width,(ph-margin*2)/canvas.height),w=canvas.width*ratio,h=canvas.height*ratio;pdf.addImage(img,'PNG',margin,margin,w,h);pdf.save(customerReportFilenameV12(d,'pdf'))}finally{wrap.remove()}
}
async function exportCustomerReportExcelV12(){
  if(!window.ExcelJS)return alert('Excel 모듈을 불러오지 못했습니다.');const d=customerReportDataV12(),wb=new ExcelJS.Workbook(),ws=wb.addWorksheet('거래내역',{pageSetup:{paperSize:9,orientation:'portrait',fitToPage:true,fitToWidth:1,fitToHeight:0,margins:{left:.25,right:.25,top:.35,bottom:.35,header:0,footer:0},horizontalCentered:true}});
  const cols=d.mode==='history'?[18,14,14,22]:[34,16,24];ws.columns=cols.map(width=>({width}));const lastCol=cols.length;
  ws.mergeCells(1,1,2,lastCol);let c=ws.getCell(1,1);c.value=customerReportTitleV12(d.c);c.font={size:20,bold:true};c.alignment={horizontal:'center',vertical:'middle'};ws.mergeCells(3,1,3,lastCol);ws.getCell(3,1).value=`기간: ${d.from||'-'} ~ ${d.to||'-'}`;ws.getCell(3,1).alignment={horizontal:'left'};
  const headers=d.mode==='history'?['날짜','품목 수','수량','총금액']:['제품명','총수량','총금액'];headers.forEach((h,i)=>{const x=ws.getCell(5,i+1);x.value=h;x.font={bold:true};x.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFD9D9D9'}};x.alignment={horizontal:'center'}});
  d.rows.forEach((r,ri)=>{const row=ws.getRow(6+ri),vals=d.mode==='history'?[r.date,r.types,r.qty,r.amount]:[r.name,r.qty,r.amount];vals.forEach((v,i)=>row.getCell(i+1).value=v);row.getCell(lastCol).numFmt='₩ #,##0';row.eachCell(cc=>cc.alignment={horizontal:'center',vertical:'middle'})});
  const tr=6+d.rows.length;ws.mergeCells(tr,1,tr,lastCol-1);ws.getCell(tr,1).value='전체 총금액';ws.getCell(tr,1).font={bold:true};ws.getCell(tr,lastCol).value=d.total;ws.getCell(tr,lastCol).numFmt='₩ #,##0';ws.getCell(tr,lastCol).font={bold:true};const thin={style:'thin',color:{argb:'FF000000'}};for(let r=5;r<=tr;r++)for(let col=1;col<=lastCol;col++)ws.getCell(r,col).border={top:thin,left:thin,bottom:thin,right:thin};ws.pageSetup.printArea=`A1:${String.fromCharCode(64+lastCol)}${tr}`;ws.views=[{showGridLines:false}];
  const buf=await wb.xlsx.writeBuffer(),a=document.createElement('a');a.href=URL.createObjectURL(new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));a.download=customerReportFilenameV12(d,'xlsx');a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
const _v12OpenCustomerDetailBase=openCustomerDetail;
openCustomerDetail=function(id){_v12OpenCustomerDetailBase(id);const bar=document.querySelector('#modalBody .customer-purchase-card > .toolbar');if(bar&&!bar.querySelector('.report-export-v12'))bar.insertAdjacentHTML('beforeend',`<span class="report-export-v12"><button class="secondary" onclick="exportCustomerReportExcelV12()">Excel</button><button class="secondary" onclick="exportCustomerReportPdfV12()">PDF</button></span>`)}

// Improved Excel invoice image centering and remove the blank row before account info.
function excelColPxV12(width){return Math.max(24,Math.floor((Number(width)||10)*7+5))}
function excelRowPxV12(points){return Math.max(20,(Number(points)||15)*96/72)}
function positionExcelImageV12(ws,imageId,colIndexZero,rowIndexZero,iw,ih){const cw=excelColPxV12(ws.getColumn(colIndexZero+1).width),rh=excelRowPxV12(ws.getRow(rowIndexZero+1).height),fit=fitBoxV11(iw,ih,cw-10,rh-10),x=(cw-fit.w)/2,y=(rh-fit.h)/2;ws.addImage(imageId,{tl:{col:colIndexZero+x/cw,row:rowIndexZero+y/rh},ext:{width:fit.w,height:fit.h},editAs:'oneCell'})}

// Rebuild invoice Excel output for A4 portrait, centered proportional images, account directly after totals.
exportInvoiceExcel=async function(){
  if(!window.ExcelJS)return alert('Excel 모듈을 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.');ensureV12Data();
  const wb=new ExcelJS.Workbook(),ws=wb.addWorksheet('거래명세서',{pageSetup:{paperSize:9,orientation:'portrait',fitToPage:true,fitToWidth:1,fitToHeight:0,margins:{left:.18,right:.18,top:.25,bottom:.25,header:0,footer:0},horizontalCentered:true}}),t=currentTemplate(),cid=document.getElementById('inv-customer')?.value,cust=S.data.customers.find(x=>x.id===cid),date=document.getElementById('inv-date')?.value||'',o=getInvoiceOptions(),tt=invoiceTotals();
  ws.columns=[5.5,13,24,10,12,8,14,18].map(width=>({width}));ws.mergeCells('A1:H2');let ce=ws.getCell('A1');ce.value=t.title||'거래명세서';ce.font={size:20,bold:true,underline:true};ce.alignment={horizontal:'center',vertical:'middle'};ws.getRow(1).height=22;ws.getRow(2).height=16;
  ws.mergeCells('A3:E3');ws.mergeCells('F3:H3');const info=[];if(o.show_branch&&customerBranchName(cust))info.push(`지점명: ${customerBranchName(cust)}`);if(o.show_contact&&customerDisplayName(cust))info.push(`이름: ${customerDisplayName(cust)}`);if(!customerBranchName(cust)&&customerDisplayName(cust)&&o.show_branch&&!o.show_contact)info.push(`이름: ${customerDisplayName(cust)}`);if(o.show_phone&&cust?.phone)info.push(`전화번호: ${cust.phone}`);if(o.show_business_no&&cust?.business_no)info.push(`사업자번호: ${cust.business_no}`);ws.getCell('A3').value=info.join('   ');ws.getCell('A3').alignment={vertical:'middle',wrapText:true};ws.getCell('F3').value=`주문일자: ${date}`;ws.getCell('F3').alignment={horizontal:'right',vertical:'middle'};ws.getRow(3).height=25;
  const headers=['순번','이미지','제품명/규격','수종','공급가','수량','금액','비고'];headers.forEach((h,i)=>{const x=ws.getCell(4,i+1);x.value=h;x.font={bold:true};x.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFD9D9D9'}};x.alignment={horizontal:'center',vertical:'middle'}});ws.getRow(4).height=21;
  const start=5,minRows=Math.max(3,S.selectedInvoiceItems.length);for(let r=0;r<minRows;r++){const rn=start+r,row=ws.getRow(rn);row.height=72;const it=S.selectedInvoiceItems[r];if(it){const p=S.data.products.find(x=>x.id===it.product_id);row.getCell(1).value=r+1;row.getCell(3).value=`${p?.name||''}\n${p?.w||0}×${p?.d||0}×${p?.h||0}`;row.getCell(4).value=p?.material||'';row.getCell(5).value=Number(it.price)||0;row.getCell(6).value=Number(it.qty)||0;row.getCell(7).value=(Number(it.price)||0)*(Number(it.qty)||0);row.getCell(8).value=it.note||'';row.getCell(5).numFmt='₩ #,##0';row.getCell(7).numFmt='₩ #,##0';const dp=dataUrlParts(p?.image);if(dp){try{const sz=await getImageSizeV11(p.image),iid=wb.addImage({base64:dp.base64,extension:dp.ext});positionExcelImageV12(ws,iid,1,rn-1,sz?.w||1,sz?.h||1)}catch(e){console.warn(e)}}}row.eachCell({includeEmpty:true},cc=>cc.alignment={horizontal:'center',vertical:'middle',wrapText:true})}
  const sum=start+minRows;ws.mergeCells(`A${sum}:D${sum+2}`);ws.getCell(`A${sum}`).value='합계';ws.getCell(`A${sum}`).font={bold:true};ws.getCell(`A${sum}`).alignment={horizontal:'center',vertical:'middle'};ws.mergeCells(`E${sum}:F${sum}`);ws.mergeCells(`G${sum}:H${sum}`);ws.getCell(`E${sum}`).value='TOTAL';ws.getCell(`G${sum}`).value=tt.sub;ws.getCell(`G${sum}`).numFmt='₩ #,##0';let g=sum+1;if(o.vat_mode==='included'){ws.mergeCells(`E${sum+1}:F${sum+1}`);ws.mergeCells(`G${sum+1}:H${sum+1}`);ws.getCell(`E${sum+1}`).value='VAT (10%)';ws.getCell(`G${sum+1}`).value=tt.vat;ws.getCell(`G${sum+1}`).numFmt='₩ #,##0';g=sum+2}ws.mergeCells(`E${g}:F${g}`);ws.mergeCells(`G${g}:H${g}`);ws.getCell(`E${g}`).value='GRAND TOTAL';ws.getCell(`G${g}`).value=tt.grand;ws.getCell(`G${g}`).numFmt='₩ #,##0';ws.getCell(`E${g}`).font=ws.getCell(`G${g}`).font={bold:true};const bankRow=g+1;ws.mergeCells(`A${bankRow}:H${bankRow}`);ws.getCell(`A${bankRow}`).value=t.bank_info||V12_BANKS[0];ws.getCell(`A${bankRow}`).alignment={horizontal:'center',vertical:'middle'};ws.getCell(`A${bankRow}`).font={bold:true};ws.getCell(`A${bankRow}`).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFD9D9D9'}};ws.getRow(bankRow).height=22;
  const thin={style:'thin',color:{argb:'FF000000'}};for(let r=3;r<=bankRow;r++)for(let col=1;col<=8;col++)ws.getCell(r,col).border={top:thin,left:thin,bottom:thin,right:thin};ws.pageSetup.printArea=`A1:H${bankRow}`;ws.views=[{showGridLines:false}];const buf=await wb.xlsx.writeBuffer(),a=document.createElement('a');a.href=URL.createObjectURL(new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));a.download=customerFilePrefix(cust,date)+'_거래명세서.xlsx';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

// New touch-first stock movement dialog.
function stockMove(){
  ensureV12Data();window._stockPick='';window._stockMoveMode='입고';window._stockFrom={};window._stockTo={};
  document.getElementById('modalBody').innerHTML=`<div class="modal-sticky-head"><h2>입고 / 출고 / 이동</h2><button class="primary" onclick="applyStockMoveV12()">반영</button></div><div class="stock-move-layout-v12"><aside><input id="stockProductSearch" placeholder="제품명 또는 소재 검색" oninput="drawStockPickerV12()"><div id="stockProductPicker" class="stock-product-left-v12"></div></aside><section><div id="stockSelectedSummaryV12" class="stock-current-v12">제품을 선택하세요.</div><h4>구분</h4><div class="touch-options-v12">${['입고','출고','이동'].map(x=>`<button data-sm-mode="${x}" class="${x==='입고'?'active':''}" onclick="setStockModeV12('${x}')">${x}</button>`).join('')}</div><div id="stockFromWrapV12"><h4>출발 위치 <small>여러 곳 선택 가능</small></h4><div id="stockFromV12" class="location-touch-grid-v12"></div></div><div id="stockToWrapV12"><h4>도착 위치 <small>여러 곳 선택 가능</small></h4><div id="stockToV12" class="location-touch-grid-v12"></div></div><label class="memo-v12">메모<textarea id="sm-note" rows="3"></textarea></label></section></div>`;
  document.getElementById('modal').classList.remove('hidden');drawStockPickerV12();drawStockMoveControlsV12();
}
function drawStockPickerV12(){const q=(document.getElementById('stockProductSearch')?.value||'').trim().toLowerCase(),list=S.data.products.filter(p=>!p.discontinued&&(!q||String(p.name||'').toLowerCase().includes(q)||String(p.material||'').toLowerCase().includes(q)));document.getElementById('stockProductPicker').innerHTML=list.map(p=>`<button class="stock-product-button-v12 ${window._stockPick===p.id?'active':''}" onclick="pickStockProductV12('${p.id}')">${p.image?`<img src="${p.image}">`:'<span class="img-placeholder">NO</span>'}<span><b>${escapeHtml(p.name)}</b><small>${escapeHtml(p.material||'')}</small></span><em>재고 ${totalQty(p.id)}</em></button>`).join('')||'<p class="muted">검색 결과가 없습니다.</p>'}
function pickStockProductV12(id){window._stockPick=id;drawStockPickerV12();drawStockSelectedV12()}
function drawStockSelectedV12(){const p=S.data.products.find(x=>x.id===window._stockPick),el=document.getElementById('stockSelectedSummaryV12');if(!p||!el)return;const inv=invFor(p.id);el.innerHTML=`<div class="stock-selected-title-v12">${p.image?`<img src="${p.image}">`:''}<div><b>${escapeHtml(p.name)}</b><small>${escapeHtml(p.material||'')}</small></div></div><div class="current-stock-grid-v12">${S.data.locations.map(l=>`<span><small>${escapeHtml(l.name)}</small><b>${Number(inv[l.id]||0)}</b></span>`).join('')}<span class="total"><small>총수량</small><b>${totalQty(p.id)}</b></span></div>`}
function setStockModeV12(mode){window._stockMoveMode=mode;document.querySelectorAll('[data-sm-mode]').forEach(b=>b.classList.toggle('active',b.dataset.smMode===mode));window._stockFrom={};window._stockTo={};drawStockMoveControlsV12()}
function locationCardV12(l,side){const obj=side==='from'?window._stockFrom:window._stockTo,selected=Object.prototype.hasOwnProperty.call(obj,l.id);return `<div class="location-card-v12 ${selected?'active':''}"><button onclick="toggleLocationV12('${side}','${l.id}')">${escapeHtml(l.name)}</button>${selected?`<input type="number" value="${obj[l.id]||''}" placeholder="수량" oninput="setLocationQtyV12('${side}','${l.id}',this.value)">`:''}</div>`}
function drawStockMoveControlsV12(){const mode=window._stockMoveMode||'입고',from=document.getElementById('stockFromV12'),to=document.getElementById('stockToV12');if(from)from.innerHTML=S.data.locations.map(l=>locationCardV12(l,'from')).join('');if(to)to.innerHTML=S.data.locations.map(l=>locationCardV12(l,'to')).join('')+(mode!=='입고'?`<div class="location-card-v12 external ${Object.prototype.hasOwnProperty.call(window._stockTo,'OUT')?'active':''}"><button onclick="toggleLocationV12('to','OUT')">외부 출고</button>${Object.prototype.hasOwnProperty.call(window._stockTo,'OUT')?`<input type="number" value="${window._stockTo.OUT||''}" placeholder="수량" oninput="setLocationQtyV12('to','OUT',this.value)">`:''}</div>`:'');document.getElementById('stockFromWrapV12').style.display=mode==='입고'?'none':'block';document.getElementById('stockToWrapV12').style.display=mode==='출고'?'block':'block';drawStockSelectedV12()}
function toggleLocationV12(side,id){const obj=side==='from'?window._stockFrom:window._stockTo;if(Object.prototype.hasOwnProperty.call(obj,id))delete obj[id];else obj[id]='';drawStockMoveControlsV12()}
function setLocationQtyV12(side,id,val){const obj=side==='from'?window._stockFrom:window._stockTo;obj[id]=val}
async function applyStockMoveV12(){const pid=window._stockPick;if(!pid)return alert('제품을 선택하세요.');const p=S.data.products.find(x=>x.id===pid),inv=invFor(pid);if(!S.data.inventory.includes(inv))S.data.inventory.push(inv);const mode=window._stockMoveMode||'입고',from=window._stockFrom||{},to=window._stockTo||{};let changed=false,notes=[];
  if(mode!=='입고'){for(const [lid,v] of Object.entries(from)){const q=Math.abs(Number(v)||0);if(!q)continue;inv[lid]=Number(inv[lid]||0)-q;changed=true;notes.push(`${S.data.locations.find(l=>l.id===lid)?.name||lid} -${q}`)}}
  for(const [lid,v] of Object.entries(to)){const q=Math.abs(Number(v)||0);if(!q)continue;if(lid!=='OUT'){inv[lid]=Number(inv[lid]||0)+q;notes.push(`${S.data.locations.find(l=>l.id===lid)?.name||lid} +${q}`)}else notes.push(`외부 출고 ${q}`);changed=true}
  if(!changed)return alert('수량을 입력하세요.');inv.updated_at=now();const memo=document.getElementById('sm-note')?.value||'';S.data.stock_logs.push({at:now(),product:p?.name||'',note:`${mode} · ${notes.join(' / ')}${memo?' · '+memo:''}`,user:loginActor()});addChangeLog('재고 이동',`${p?.name||''} · ${mode} · ${notes.join(' / ')}`,pid);await persist();closeModal();render();
}

// Create pending stock-allocation only after a document is actually saved.
const _v12SaveInvoiceBase=saveInvoice;
saveInvoice=async function(){const before=S.data.invoices.length;await _v12SaveInvoiceBase();if(S.data.invoices.length<=before)return;ensureV12Data();const inv=S.data.invoices[S.data.invoices.length-1];if(!S.data.stock_allocations.some(x=>x.invoice_id===inv.id)){S.data.stock_allocations.push({id:uid('alloc'),invoice_id:inv.id,customer_id:inv.customer_id,date:inv.date,created_at:now(),items:(inv.items||[]).map(it=>({product_id:it.product_id,qty:Number(it.qty||0),deductions:{}})),completed:false});await persist();renderAllocationV12()}}
function pendingAllocationsV12(){ensureV12Data();return S.data.stock_allocations.filter(x=>!x.completed&&S.data.invoices.some(i=>i.id===x.invoice_id))}
function renderAllocationV12(){const page=document.getElementById('page-allocation');if(!page)return;const a=pendingAllocationsV12();page.innerHTML=`<div class="allocation-help-v12 card"><b>저장된 거래명세표의 출고 제품만 표시됩니다.</b><div class="muted">각 위치의 현재 재고를 확인하고, 아래 입력칸에 실제로 뺄 수량을 적은 뒤 반영하세요. 모두 정리된 건은 이 목록에서 사라지고 이력에 남습니다.</div></div>${a.map(x=>allocationCardV12(x)).join('')||'<div class="card"><span class="muted">정리할 출고가 없습니다.</span></div>'}<div class="card history-card"><h3>최근 출고 정리 이력</h3>${S.data.allocation_history.slice(-10).reverse().map(h=>`<div class="search-result">${h.at} · ${escapeHtml(h.customer||'')} · ${escapeHtml(h.note||'')} · ${escapeHtml(h.user||'')}</div>`).join('')||'<span class="muted">아직 이력이 없습니다.</span>'}</div>`}
function allocationCardV12(a){const inv=S.data.invoices.find(i=>i.id===a.invoice_id),c=S.data.customers.find(x=>x.id===a.customer_id);return `<div class="card allocation-card-v12"><div class="toolbar"><div><h3 style="margin:0">${escapeHtml(customerPrimaryLabel(c))} · ${a.date||''}</h3><div class="muted">명세표 총액 ₩ ${money(inv?.total||0)}</div></div><span class="spacer"></span><button class="primary" onclick="applyAllocationV12('${a.id}')">재고 반영</button></div><div class="table-wrap"><table><thead><tr><th>이미지</th><th>제품명</th><th>나간수량</th>${S.data.locations.map(l=>`<th>${escapeHtml(l.name)}<br><small>현재 / 차감</small></th>`).join('')}<th>변경날짜</th></tr></thead><tbody>${a.items.map((it,ii)=>{const p=S.data.products.find(x=>x.id===it.product_id),iv=invFor(it.product_id);return `<tr><td>${p?.image?`<img class="alloc-img-v12" src="${p.image}">`:''}</td><td>${escapeHtml(p?.name||'삭제된 제품')}</td><td><b>${it.qty}</b></td>${S.data.locations.map(l=>`<td><div class="alloc-stock-v12"><span>${Number(iv[l.id]||0)}</span><input type="number" min="0" value="${Number(it.deductions?.[l.id]||0)||''}" onchange="setAllocQtyV12('${a.id}',${ii},'${l.id}',this.value)"></div></td>`).join('')}<td>${a.date||''}</td></tr>`}).join('')}</tbody></table></div></div>`}
function setAllocQtyV12(aid,ii,lid,val){const a=S.data.stock_allocations.find(x=>x.id===aid),it=a?.items?.[ii];if(!it)return;if(!it.deductions)it.deductions={};it.deductions[lid]=Math.max(0,Number(val)||0)}
async function applyAllocationV12(aid){const a=S.data.stock_allocations.find(x=>x.id===aid);if(!a)return;for(const it of a.items){const sum=Object.values(it.deductions||{}).reduce((s,v)=>s+Number(v||0),0);if(sum!==Number(it.qty||0))return alert(`${S.data.products.find(p=>p.id===it.product_id)?.name||'제품'}의 차감 합계가 나간수량 ${it.qty}개와 같아야 합니다.`);for(const [lid,qv] of Object.entries(it.deductions||{})){const q=Number(qv||0),iv=invFor(it.product_id);if(q>Number(iv[lid]||0))return alert(`${S.data.locations.find(l=>l.id===lid)?.name||'위치'} 재고보다 차감수량이 많습니다.`)}}
  const notes=[];for(const it of a.items){const p=S.data.products.find(x=>x.id===it.product_id),iv=invFor(it.product_id);for(const [lid,qv] of Object.entries(it.deductions||{})){const q=Number(qv||0);if(!q)continue;iv[lid]=Number(iv[lid]||0)-q;notes.push(`${p?.name||''} ${S.data.locations.find(l=>l.id===lid)?.name||''} -${q}`);S.data.stock_logs.push({at:now(),product:p?.name||'',note:`거래명세표 출고 정리 · ${S.data.locations.find(l=>l.id===lid)?.name||''} -${q}`,user:loginActor()})}iv.updated_at=now()}a.completed=true;a.completed_at=now();a.completed_by=loginActor();const c=S.data.customers.find(x=>x.id===a.customer_id);S.data.allocation_history.push({id:uid('ah'),at:now(),customer:customerPrimaryLabel(c),invoice_id:a.invoice_id,note:notes.join(' / '),user:loginActor()});addChangeLog('출고 정리',`${customerPrimaryLabel(c)} · ${notes.join(' / ')}`,a.invoice_id);await persist();render();}

// Hide pending allocation automatically when its invoice is deleted.
const _v12DeleteInvoiceBase=deleteInvoiceV10;
deleteInvoiceV10=async function(id){await _v12DeleteInvoiceBase(id);if(S.data){S.data.stock_allocations=(S.data.stock_allocations||[]).filter(x=>x.invoice_id!==id);await persist()}}

// App render/meta integration for new page.
const _v12RenderBase2=render;
render=function(){ensureV12Data();_v12RenderBase2();renderAllocationV12();if(S.page==='allocation')setPageMeta('출고 정리','저장된 거래명세표 제품을 어느 재고 위치에서 차감할지 정리합니다.')}

/* ===== v13 stock workflow refinements ===== */
function ensureV13Data(){ensureV12Data();}

function stockModeHelpV13(mode){
  if(mode==='이동')return '위치별 변경수량의 합계가 0이 되도록 입력하세요. 예: 창고 -10 / 매장 1F +10';
  if(mode==='출고')return '빠지는 위치에 음수(-) 수량을 입력하세요. 예: 창고 -10';
  return '들어오는 위치에 양수(+) 수량을 입력하세요. 예: 창고 +10';
}
function stockMove(){
  ensureV13Data();
  window._stockPick=window._stockPick&&S.data.products.some(p=>p.id===window._stockPick)?window._stockPick:'';
  window._stockMoveMode='입고';
  window._stockAdjustV13={};
  window._stockVisibleV13=20;
  document.getElementById('modalBody').innerHTML=`<div class="modal-sticky-head stock-head-v13"><div><h2>입고 / 출고 / 이동</h2><div class="muted">제품을 고르고 위치별 변경수량을 입력하면 최종 재고를 미리 확인할 수 있습니다.</div></div><button class="primary" onclick="applyStockMoveV13()">재고 반영</button></div>
  <div class="stock-workspace-v13">
    <section class="stock-left-v13">
      <input id="stockProductSearchV13" class="stock-search-v13" placeholder="제품명 또는 소재 검색" oninput="stockSearchV13()">
      <div id="stockProductPickerV13" class="stock-product-list-v13"></div>
      <button id="stockMoreV13" class="secondary stock-more-v13" onclick="stockMoreV13()">20개 더 보기</button>
    </section>
    <section class="stock-right-v13">
      <div id="stockSelectedV13" class="stock-selected-v13"><div class="muted">왼쪽에서 제품을 선택하세요.</div></div>
      <div class="stock-block-v13"><div class="stock-label-v13">구분</div><div class="touch-tabs-v13">${['입고','출고','이동'].map(m=>`<button data-v13-mode="${m}" class="${m==='입고'?'active':''}" onclick="setStockModeV13('${m}')">${m}</button>`).join('')}</div><div id="stockModeHelpV13" class="muted stock-help-v13">${stockModeHelpV13('입고')}</div></div>
      <div class="stock-block-v13"><div class="stock-location-title-v13"><b>위치별 재고 변경</b><span class="muted">현재수량과 최종수량은 자동계산되어 수정할 수 없습니다.</span></div><div id="stockLocationTableV13"></div></div>
      <label class="memo-v13">메모<textarea id="sm-note" rows="3" placeholder="필요한 내용을 적어주세요."></textarea></label>
    </section>
  </div>`;
  document.getElementById('modal').classList.remove('hidden');
  drawStockPickerV13();drawStockLocationTableV13();
}
function stockFilteredV13(){
  const q=(document.getElementById('stockProductSearchV13')?.value||'').trim().toLowerCase();
  return S.data.products.filter(p=>!p.discontinued&&(!q||String(p.name||'').toLowerCase().includes(q)||String(p.material||'').toLowerCase().includes(q)));
}
function stockSearchV13(){window._stockVisibleV13=20;drawStockPickerV13()}
function stockMoreV13(){window._stockVisibleV13=(window._stockVisibleV13||20)+20;drawStockPickerV13()}
function drawStockPickerV13(){
  const all=stockFilteredV13(),limit=window._stockVisibleV13||20,list=all.slice(0,limit),el=document.getElementById('stockProductPickerV13');if(!el)return;
  el.innerHTML=list.map(p=>`<button class="stock-product-button-v13 ${window._stockPick===p.id?'active':''}" onclick="pickStockProductV13('${p.id}')">${p.image?`<img src="${p.image}">`:'<span class="img-placeholder">NO</span>'}<span class="stock-p-main-v13"><b>${escapeHtml(p.name)}</b><small>${escapeHtml(p.material||'')}</small></span><em>재고 ${totalQty(p.id)}</em></button>`).join('')||'<div class="muted">검색 결과가 없습니다.</div>';
  const more=document.getElementById('stockMoreV13');if(more){more.style.display=all.length>limit?'block':'none';more.textContent=`20개 더 보기 (${Math.min(limit,all.length)}/${all.length})`}
}
function pickStockProductV13(id){window._stockPick=id;window._stockAdjustV13={};drawStockPickerV13();drawStockLocationTableV13()}
function setStockModeV13(mode){window._stockMoveMode=mode;window._stockAdjustV13={};document.querySelectorAll('[data-v13-mode]').forEach(b=>b.classList.toggle('active',b.dataset.v13Mode===mode));const h=document.getElementById('stockModeHelpV13');if(h)h.textContent=stockModeHelpV13(mode);drawStockLocationTableV13()}
function adjustStockV13(lid,delta){const obj=window._stockAdjustV13||(window._stockAdjustV13={});obj[lid]=Number(obj[lid]||0)+delta;drawStockLocationTableV13()}
function setStockAdjustV13(lid,val){const obj=window._stockAdjustV13||(window._stockAdjustV13={});obj[lid]=Number(val)||0;drawStockLocationTableV13(false)}
function drawStockLocationTableV13(redrawInput=true){
  const p=S.data.products.find(x=>x.id===window._stockPick),sumEl=document.getElementById('stockSelectedV13'),table=document.getElementById('stockLocationTableV13');if(!sumEl||!table)return;
  if(!p){sumEl.innerHTML='<div class="muted">왼쪽에서 제품을 선택하세요.</div>';table.innerHTML='<div class="muted">제품을 선택하면 위치별 재고가 표시됩니다.</div>';return}
  const inv=invFor(p.id),adj=window._stockAdjustV13||(window._stockAdjustV13={}),current=totalQty(p.id),change=S.data.locations.reduce((s,l)=>s+Number(adj[l.id]||0),0),final=current+change;
  sumEl.innerHTML=`<div class="stock-selected-title-v13">${p.image?`<img src="${p.image}">`:''}<div><b>${escapeHtml(p.name)}</b><small>${escapeHtml(p.material||'')}</small></div><div class="stock-total-v13"><span>현재 총수량 <b>${current}</b></span><span>변경 <b>${change>0?'+':''}${change}</b></span><span>최종 총수량 <b>${final}</b></span></div></div>`;
  table.innerHTML=`<div class="stock-table-v13"><div class="stock-tr-v13 stock-th-v13"><span>위치</span><span>현재수량</span><span>이동/변경수량</span><span>최종수량</span></div>${S.data.locations.map(l=>{const cur=Number(inv[l.id]||0),d=Number(adj[l.id]||0),fin=cur+d;return `<div class="stock-tr-v13"><span class="stock-location-name-v13">${escapeHtml(l.name)}</span><span><input class="readonly-stock-v13" value="${cur}" readonly></span><span class="stepper-v13"><button onclick="adjustStockV13('${l.id}',-1)">−</button><input type="number" value="${d||''}" placeholder="0" oninput="setStockAdjustV13('${l.id}',this.value)"><button onclick="adjustStockV13('${l.id}',1)">＋</button></span><span><input class="readonly-stock-v13 ${fin<0?'invalid':''}" value="${fin}" readonly></span></div>`}).join('')}</div>`;
}
async function applyStockMoveV13(){
  const p=S.data.products.find(x=>x.id===window._stockPick);if(!p)return alert('제품을 선택하세요.');const mode=window._stockMoveMode||'입고',adj=window._stockAdjustV13||{},inv=invFor(p.id);if(!S.data.inventory.includes(inv))S.data.inventory.push(inv);
  const entries=S.data.locations.map(l=>[l,Number(adj[l.id]||0)]).filter(x=>x[1]!==0);if(!entries.length)return alert('변경수량을 입력하세요.');
  for(const [l,d] of entries){if(Number(inv[l.id]||0)+d<0)return alert(`${l.name}의 최종수량이 0보다 작아질 수 없습니다.`)}
  const sum=entries.reduce((s,x)=>s+x[1],0);if(mode==='입고'&&sum<=0)return alert('입고는 전체 변경수량 합계가 +수량이어야 합니다.');if(mode==='출고'&&sum>=0)return alert('출고는 전체 변경수량 합계가 -수량이어야 합니다.');if(mode==='이동'&&sum!==0)return alert('이동은 빠지는 수량과 들어가는 수량의 합계가 0이 되어야 합니다.');
  const notes=[];for(const [l,d] of entries){inv[l.id]=Number(inv[l.id]||0)+d;notes.push(`${l.name} ${d>0?'+':''}${d}`)}inv.updated_at=now();const memo=document.getElementById('sm-note')?.value.trim()||'';S.data.stock_logs.push({at:now(),product:p.name,note:`${mode} · ${notes.join(' / ')}${memo?' · '+memo:''}`,user:loginActor()});addChangeLog('재고 이동',`${p.name} · ${mode} · ${notes.join(' / ')}`,p.id);await persist();closeModal();render();
}

// Saved invoice stock allocation: compact list -> click -> detailed stock deduction modal.
function renderAllocationV13(){
  const page=document.getElementById('page-allocation');if(!page)return;const list=pendingAllocationsV12();
  page.innerHTML=`<div class="card allocation-help-v13"><b>저장된 거래명세표 중 아직 재고 차감이 끝나지 않은 건만 표시됩니다.</b><div class="muted">거래를 클릭해서 제품별로 어느 위치에서 몇 개를 뺄지 정리하세요. 완료하면 대기목록에서 사라지고 아래 이력에 남습니다.</div></div><div class="allocation-list-v13">${list.slice(0,20).map(a=>allocationListItemV13(a)).join('')||'<div class="card"><span class="muted">정리할 출고가 없습니다.</span></div>'}</div>${list.length>20?`<div class="muted" style="margin:8px 0">대기 ${list.length}건 중 최근 20건 표시</div>`:''}<div class="card history-card"><h3>최근 출고 정리 이력</h3>${S.data.allocation_history.slice(-10).reverse().map(h=>`<div class="search-result">${h.at} · ${escapeHtml(h.customer||'')} · ${escapeHtml(h.note||'')} · ${escapeHtml(h.user||'')}</div>`).join('')||'<span class="muted">아직 이력이 없습니다.</span>'}</div>`;
}
function allocationListItemV13(a){const inv=S.data.invoices.find(i=>i.id===a.invoice_id),c=S.data.customers.find(x=>x.id===a.customer_id),items=(a.items||[]);return `<button class="allocation-item-v13" onclick="openAllocationV13('${a.id}')"><div class="allocation-customer-v13"><b>${escapeHtml(customerPrimaryLabel(c))}</b><small>${a.date||''}</small></div><div class="allocation-thumbs-v13">${items.slice(0,4).map(it=>{const p=S.data.products.find(x=>x.id===it.product_id);return p?.image?`<img src="${p.image}" title="${escapeHtml(p.name)}">`:''}).join('')}</div><div class="allocation-desc-v13"><span>제품 ${items.length}종</span><span>총수량 ${items.reduce((s,x)=>s+Number(x.qty||0),0)}</span><span>₩ ${money(inv?.total||0)}</span></div><strong>정리하기 ›</strong></button>`}
function openAllocationV13(aid){const a=S.data.stock_allocations.find(x=>x.id===aid);if(!a)return;window._allocV13=aid;document.getElementById('modalBody').innerHTML=`<div class="modal-sticky-head"><div><h2>출고 재고 정리</h2><div id="allocHeaderV13" class="muted"></div></div><button class="primary" onclick="applyAllocationV13('${aid}')">재고 반영</button></div><div id="allocBodyV13"></div>`;document.getElementById('modal').classList.remove('hidden');drawAllocationModalV13(aid)}
function drawAllocationModalV13(aid){const a=S.data.stock_allocations.find(x=>x.id===aid),inv=S.data.invoices.find(i=>i.id===a?.invoice_id),c=S.data.customers.find(x=>x.id===a?.customer_id);if(!a)return;const h=document.getElementById('allocHeaderV13');if(h)h.textContent=`${customerPrimaryLabel(c)} · ${a.date||''} · 명세표 총액 ₩ ${money(inv?.total||0)}`;document.getElementById('allocBodyV13').innerHTML=`<div class="alloc-modal-list-v13">${a.items.map((it,ii)=>allocationProductRowV13(a,it,ii)).join('')}</div>`}
function allocationProductRowV13(a,it,ii){const p=S.data.products.find(x=>x.id===it.product_id),iv=invFor(it.product_id),ded=it.deductions||(it.deductions={}),sum=Object.values(ded).reduce((s,v)=>s+Number(v||0),0);return `<div class="alloc-product-v13"><div class="alloc-product-head-v13">${p?.image?`<img src="${p.image}">`:''}<div><b>${escapeHtml(p?.name||'삭제된 제품')}</b><small>${escapeHtml(p?.material||'')}</small></div><div class="alloc-needed-v13">나간수량 <b>${it.qty}</b><br><span class="${sum===Number(it.qty||0)?'ok':'warn'}">입력합계 ${sum}</span></div></div><div class="alloc-location-grid-v13">${S.data.locations.map(l=>{const cur=Number(iv[l.id]||0),q=Number(ded[l.id]||0);return `<div class="alloc-location-v13"><b>${escapeHtml(l.name)}</b><small>현재 ${cur}</small><div class="stepper-v13"><button onclick="adjustAllocV13('${a.id}',${ii},'${l.id}',-1)">−</button><input type="number" min="0" value="${q||''}" placeholder="0" oninput="setAllocV13('${a.id}',${ii},'${l.id}',this.value)"><button onclick="adjustAllocV13('${a.id}',${ii},'${l.id}',1)">＋</button></div><small>차감 후 ${cur-q}</small></div>`}).join('')}</div></div>`}
function setAllocV13(aid,ii,lid,val){const a=S.data.stock_allocations.find(x=>x.id===aid),it=a?.items?.[ii];if(!it)return;if(!it.deductions)it.deductions={};it.deductions[lid]=Math.max(0,Number(val)||0);drawAllocationModalV13(aid)}
function adjustAllocV13(aid,ii,lid,delta){const a=S.data.stock_allocations.find(x=>x.id===aid),it=a?.items?.[ii];if(!it)return;if(!it.deductions)it.deductions={};it.deductions[lid]=Math.max(0,Number(it.deductions[lid]||0)+delta);drawAllocationModalV13(aid)}
async function applyAllocationV13(aid){await applyAllocationV12(aid);if(S.data.stock_allocations.find(x=>x.id===aid)?.completed)closeModal()}

// Dashboard batch Excel stock adjustment.
function openStockExcelV13(){document.getElementById('modalBody').innerHTML=`<div class="modal-sticky-head"><div><h2>Excel + 입출고 정리</h2><div class="muted">현재 재고가 포함된 Excel을 내려받아 위치별 변경수량만 입력한 뒤 다시 업로드하세요.</div></div></div><div class="card stock-excel-v13"><button class="secondary" onclick="downloadStockExcelTemplateV13()">현재 재고 Excel 다운로드</button><label>수정한 Excel 업로드<input id="stockExcelInputV13" type="file" accept=".xlsx,.xls"></label><div class="muted">변경수량에는 +10, -10처럼 입력합니다. 현재재고 칸은 참고용이며 업로드 시 변경수량만 반영합니다.</div><button class="primary" onclick="importStockExcelV13()">Excel 재고 반영</button></div>`;document.getElementById('modal').classList.remove('hidden')}
async function downloadStockExcelTemplateV13(){if(!window.ExcelJS)return alert('Excel 모듈을 불러오지 못했습니다.');const wb=new ExcelJS.Workbook(),ws=wb.addWorksheet('입출고정리');const headers=['제품명','소재',...S.data.locations.flatMap(l=>[`${l.name}_현재재고`,`${l.name}_변경수량`]),'메모'];ws.addRow(headers);S.data.products.filter(p=>!p.discontinued).forEach(p=>{const iv=invFor(p.id);ws.addRow([p.name,p.material||'',...S.data.locations.flatMap(l=>[Number(iv[l.id]||0),'']),''])});ws.getRow(1).font={bold:true};ws.columns=headers.map((h,i)=>({width:i===0?28:i===1?18:16}));ws.views=[{state:'frozen',ySplit:1}];const buf=await wb.xlsx.writeBuffer(),blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`NAYESO_입출고정리_${new Date().toISOString().slice(0,10)}.xlsx`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
async function importStockExcelV13(){const f=document.getElementById('stockExcelInputV13')?.files?.[0];if(!f)return alert('Excel 파일을 선택하세요.');const arr=await f.arrayBuffer(),wb=XLSX.read(arr,{type:'array'}),rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''});let changedRows=0;const plans=[];for(const row of rows){const name=String(row['제품명']||'').trim();if(!name)continue;const p=S.data.products.find(x=>x.name===name);if(!p)continue;const iv=invFor(p.id),changes=[];for(const l of S.data.locations){const d=Number(row[`${l.name}_변경수량`]||0);if(!d)continue;if(Number(iv[l.id]||0)+d<0)return alert(`${p.name} / ${l.name}: 변경 후 재고가 0보다 작습니다.`);changes.push([l,d])}if(changes.length)plans.push({p,iv,changes,memo:String(row['메모']||'').trim()})}
  if(!plans.length)return alert('반영할 변경수량이 없습니다.');if(!confirm(`${plans.length}개 제품의 재고 변경을 반영할까요?`))return;for(const plan of plans){if(!S.data.inventory.includes(plan.iv))S.data.inventory.push(plan.iv);const notes=[];for(const [l,d] of plan.changes){plan.iv[l.id]=Number(plan.iv[l.id]||0)+d;notes.push(`${l.name} ${d>0?'+':''}${d}`)}plan.iv.updated_at=now();S.data.stock_logs.push({at:now(),product:plan.p.name,note:`Excel 입출고 정리 · ${notes.join(' / ')}${plan.memo?' · '+plan.memo:''}`,user:loginActor()});addChangeLog('Excel 입출고 정리',`${plan.p.name} · ${notes.join(' / ')}`,plan.p.id);changedRows++}await persist();closeModal();render();alert(`${changedRows}개 제품의 재고를 반영했습니다.`)}

// Dashboard: add Excel stock cleanup directly under product bulk import.
const _v13RenderDashboardBase=renderDashboard;
renderDashboard=function(){_v13RenderDashboardBase();const quick=document.querySelector('#page-dashboard .quick-grid');if(quick&&!quick.querySelector('.stock-excel-btn-v13')){const productImport=[...quick.querySelectorAll('button')].find(b=>b.textContent.includes('Excel + 이미지'));const btn=document.createElement('button');btn.className='secondary stock-excel-btn-v13';btn.textContent='Excel + 입출고 정리';btn.onclick=openStockExcelV13;if(productImport)productImport.insertAdjacentElement('afterend',btn);else quick.prepend(btn)}}

// Render allocation safely: older render metadata did not know the new page and could throw before drawing it.
const _v13RenderBase=render;
render=function(){ensureV13Data();if(S.page==='allocation'){
  renderDashboard();renderProducts();renderInventory();renderCustomers();renderInvoice();renderSearch('');renderSettings();renderAllocationV13();setPageMeta('출고 정리','저장된 거래명세표의 제품을 실제 재고 위치에서 차감합니다.');return;
} _v13RenderBase();renderAllocationV13();}

/* ===== v14 Streamlit + Supabase direct REST sync ===== */
const KOREA_CFG = window.NAYESO_CONFIG || {};
S.cloudReadyV14=false;
S.cloudBusyV14=false;
S.remoteUpdatedAtV14='';
S.localDirtyV14=false;
S.pendingSyncV14=0;
S.cloudPollV14=null;

function ensureV14Auth(){
  ensureV13Data?.();
  if(!S.data.auth || typeof S.data.auth!=='object') S.data.auth={};
  if(!S.data.auth.admin_password) S.data.auth.admin_password='1082';
}
getAdminPassword=function(){ ensureV14Auth(); return String(S.data.auth.admin_password||'1082'); }
doAdminLogin=function(){
  ensureV14Auth();
  const pw=String(document.getElementById('adminPw')?.value||'').trim();
  if(pw!==getAdminPassword()) return alert('비밀번호가 맞지 않습니다.');
  finishLogin({role:'admin',id:'admin',name:'관리자'});
}
changeAdminPassword=async function(){
  ensureV14Auth();
  const current=String(document.getElementById('admin-current-pw')?.value||'');
  const next=String(document.getElementById('admin-new-pw')?.value||'');
  const next2=String(document.getElementById('admin-new-pw2')?.value||'');
  if(current!==getAdminPassword())return alert('현재 비밀번호가 맞지 않습니다.');
  if(next.length<4)return alert('새 비밀번호는 4자리 이상 입력하세요.');
  if(next!==next2)return alert('새 비밀번호 확인이 일치하지 않습니다.');
  S.data.auth.admin_password=next;
  try{localStorage.removeItem('nayeso_admin_pw');localStorage.removeItem('nayeso_admin_pw_v6');localStorage.removeItem('nayeso_admin_pw_v7')}catch(e){}
  addChangeLog?.('관리자 설정','관리자 비밀번호 변경');
  await persist();
  alert('관리자 비밀번호가 변경되었습니다.');
  renderSettings();
}

function v14BaseUrl(){
  let u=String(KOREA_CFG.SUPABASE_URL||'').trim().replace(/\/+$/,'');
  u=u.replace(/\/rest\/v1.*$/,'');
  return u;
}
function v14Key(){return String(KOREA_CFG.SUPABASE_ANON_KEY||'').trim()}
function v14Headers(extra={}){
  const key=v14Key();
  return Object.assign({'apikey':key,'Authorization':'Bearer '+key,'Content-Type':'application/json'},extra);
}
function v14SetSync(text,state=''){
  const el=document.getElementById('syncState');
  if(el){el.textContent=text;el.dataset.state=state}
}
function v14ValidConfig(){return /^https:\/\/[^/]+\.supabase\.co$/i.test(v14BaseUrl()) && v14Key().length>20}
function v14ServerDataLooksValid(d){return d && typeof d==='object' && Array.isArray(d.products) && Array.isArray(d.inventory)}
async function v14RestRead(){
  const r=await fetch(v14BaseUrl()+'/rest/v1/app_state?id=eq.main&select=data,updated_at',{method:'GET',headers:v14Headers({'Accept':'application/json'}),cache:'no-store'});
  if(!r.ok)throw new Error('DB 읽기 실패 '+r.status+' '+await r.text());
  const a=await r.json(); return Array.isArray(a)?a[0]:null;
}
async function v14RestWrite(){
  const payload={id:'main',data:S.data,updated_at:new Date().toISOString()};
  const r=await fetch(v14BaseUrl()+'/rest/v1/app_state?on_conflict=id',{method:'POST',headers:v14Headers({'Prefer':'resolution=merge-duplicates,return=representation'}),body:JSON.stringify(payload)});
  if(!r.ok)throw new Error('DB 저장 실패 '+r.status+' '+await r.text());
  const a=await r.json(); return Array.isArray(a)?a[0]:null;
}
async function v14SyncNow(){
  if(!S.cloudReadyV14||S.cloudBusyV14||!navigator.onLine)return false;
  S.cloudBusyV14=true;
  try{
    v14SetSync(`동기화 중${S.pendingSyncV14?` · ${S.pendingSyncV14}`:''}`,'syncing');
    const saved=await v14RestWrite();
    S.remoteUpdatedAtV14=saved?.updated_at||new Date().toISOString();
    S.localDirtyV14=false;S.pendingSyncV14=0;
    saveLocal();v14SetSync('자동 동기화 완료','ok');return true;
  }catch(e){console.error(e);v14SetSync('동기화 실패 · 재시도 예정','error');return false}
  finally{S.cloudBusyV14=false}
}
async function v14Refresh(){
  if(!S.cloudReadyV14||S.cloudBusyV14||S.localDirtyV14||!navigator.onLine)return;
  S.cloudBusyV14=true;
  try{
    const row=await v14RestRead();
    if(row?.data && v14ServerDataLooksValid(row.data)){
      if(!S.remoteUpdatedAtV14 || row.updated_at!==S.remoteUpdatedAtV14){
        S.data=row.data;normalizeData();ensureV13Data?.();ensureV14Auth();pruneHistory?.();
        S.remoteUpdatedAtV14=row.updated_at||'';saveLocal();
        try{render();applyRoleUI?.()}catch(e){console.error('render after cloud refresh',e)}
      }
    }
    v14SetSync('자동 동기화','ok');
  }catch(e){console.error(e);v14SetSync('클라우드 확인 실패','error')}
  finally{S.cloudBusyV14=false}
}

// Final persist override: local recovery cache + immediate verified server save.
persist=async function(){
  ensureV13Data?.();ensureV14Auth();pruneHistory?.();
  saveLocal();S.localDirtyV14=true;S.pendingSyncV14=(S.pendingSyncV14||0)+1;
  if(S.cloudReadyV14) await v14SyncNow();
  else v14SetSync('서버 연결 대기','syncing');
}

async function v14ConnectCloud(){
  if(!v14ValidConfig()){
    v14SetSync('클라우드 설정 필요','error');
    if(KOREA_CFG.REQUIRE_CLOUD) console.error('Streamlit Secrets의 SUPABASE_URL / SUPABASE_KEY를 확인하세요.');
    return;
  }
  try{
    v14SetSync('클라우드 연결 중…','syncing');
    const row=await v14RestRead();
    S.cloudReadyV14=true;S.cloud=true;
    if(row?.data && v14ServerDataLooksValid(row.data)){
      S.data=row.data;normalizeData();ensureV13Data?.();ensureV14Auth();pruneHistory?.();
      S.remoteUpdatedAtV14=row.updated_at||'';saveLocal();render();applyRoleUI?.();
    }else{
      // First deployment: seed cloud with the current local/default data.
      ensureV13Data?.();ensureV14Auth();await v14SyncNow();
    }
    v14SetSync('자동 동기화','ok');
    clearInterval(S.cloudPollV14);S.cloudPollV14=setInterval(()=>{if(S.localDirtyV14)v14SyncNow();else v14Refresh()},1500);
  }catch(e){console.error(e);v14SetSync('클라우드 연결 실패','error')}
}

window.addEventListener('online',()=>{v14SetSync('온라인 · 동기화 중','syncing');if(S.cloudReadyV14){if(S.localDirtyV14)v14SyncNow();else v14Refresh()}else v14ConnectCloud()});
window.addEventListener('offline',()=>v14SetSync('오프라인 · 기기에 임시 저장','error'));
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&S.cloudReadyV14){if(S.localDirtyV14)v14SyncNow();else v14Refresh()}});

document.addEventListener('DOMContentLoaded',()=>setTimeout(v14ConnectCloud,180));

/* ===== v15 partial returns + return stock allocation + Excel return marker ===== */
function ensureV15Data(){
  ensureV13Data?.();
  if(!Array.isArray(S.data.return_allocations))S.data.return_allocations=[];
  if(!Array.isArray(S.data.return_history))S.data.return_history=[];
}
function completedReturnQtyV15(invoiceId,productId){
  ensureV15Data();return S.data.return_history.filter(r=>r.invoice_id===invoiceId&&r.product_id===productId).reduce((s,r)=>s+Number(r.qty||0),0);
}
function pendingReturnQtyV15(invoiceId,productId){
  ensureV15Data();return S.data.return_allocations.filter(r=>r.invoice_id===invoiceId&&!r.completed).reduce((s,r)=>s+(r.items||[]).filter(i=>i.product_id===productId).reduce((a,i)=>a+Number(i.qty||0),0),0);
}
function returnableItemsV15(inv){
  return (inv?.items||[]).map(it=>{const sold=Number(it.qty||0),done=completedReturnQtyV15(inv.id,it.product_id),pending=pendingReturnQtyV15(inv.id,it.product_id);return {...it,sold,done,pending,remain:Math.max(0,sold-done-pending)}}).filter(x=>x.remain>0);
}
function openReturnEditV15(invoiceId){
  ensureV15Data();const inv=S.data.invoices.find(x=>x.id===invoiceId);if(!inv)return alert('거래명세표를 찾을 수 없습니다.');const c=S.data.customers.find(x=>x.id===inv.customer_id),items=returnableItemsV15(inv);
  if(!items.length)return alert('추가로 반품 처리할 수량이 없습니다.');
  window._returnInvoiceV15=invoiceId;
  document.getElementById('modalBody').innerHTML=`<div class="modal-sticky-head"><div><h2>반품수정</h2><div class="muted">${escapeHtml(customerPrimaryLabel(c))} · ${inv.date||''}</div></div><button class="primary" onclick="createReturnAllocationV15('${invoiceId}')">반품 저장</button></div><div class="card return-help-v15"><b>실제로 반품 받은 수량만 입력하세요.</b><div class="muted">저장하면 바로 재고가 늘어나는 것이 아니라, 출고 정리 메뉴의 <b>반품 입고</b> 목록으로 이동합니다. 그곳에서 어느 위치로 받을지 정하면 재고에 추가됩니다.</div></div><div class="table-wrap"><table><thead><tr><th>이미지</th><th>제품명</th><th>판매수량</th><th>기반품</th><th>반품대기</th><th>반품가능</th><th>이번 반품</th></tr></thead><tbody>${items.map((it,i)=>{const p=S.data.products.find(x=>x.id===it.product_id);return `<tr><td>${p?.image?`<img class="return-img-v15" src="${p.image}">`:''}</td><td>${escapeHtml(p?.name||'삭제된 제품')}</td><td>${it.sold}</td><td>${it.done}</td><td>${it.pending}</td><td>${it.remain}</td><td><input id="retqty-v15-${i}" type="number" min="0" max="${it.remain}" value="0" style="width:90px"></td></tr>`}).join('')}</tbody></table></div><input type="hidden" id="returnItemsV15" value='${escapeHtml(JSON.stringify(items.map(x=>({product_id:x.product_id,price:x.price,remain:x.remain}))))}'>`;
  document.getElementById('modal').classList.remove('hidden');
}
async function createReturnAllocationV15(invoiceId){
  ensureV15Data();const inv=S.data.invoices.find(x=>x.id===invoiceId);if(!inv)return;const source=returnableItemsV15(inv),items=[];
  source.forEach((it,i)=>{const q=Math.max(0,Number(document.getElementById(`retqty-v15-${i}`)?.value||0));if(q>it.remain)throw new Error(`${S.data.products.find(p=>p.id===it.product_id)?.name||'제품'} 반품수량이 가능수량을 초과했습니다.`);if(q)items.push({product_id:it.product_id,qty:q,price:Number(it.price||0),additions:{}})});
  if(!items.length)return alert('반품 수량을 입력하세요.');
  const c=S.data.customers.find(x=>x.id===inv.customer_id);S.data.return_allocations.push({id:uid('ret'),invoice_id:inv.id,customer_id:inv.customer_id,customer_label:customerPrimaryLabel(c),invoice_date:inv.date,date:new Date().toISOString().slice(0,10),created_at:now(),created_by:loginActor(),items,completed:false});addChangeLog('반품 등록',`${customerPrimaryLabel(c)} · ${items.length}개 품목 반품 대기`,inv.id);await persist();closeModal();S.page='allocation';render();
}

// Saved invoice detail: add return edit and returned quantities.
viewSavedInvoice=function(id){
  ensureV15Data();const inv=S.data.invoices.find(x=>x.id===id);if(!inv)return;const c=S.data.customers.find(x=>x.id===inv.customer_id),retCount=S.data.return_history.filter(r=>r.invoice_id===id).reduce((s,r)=>s+Number(r.qty||0),0),pending=S.data.return_allocations.filter(r=>r.invoice_id===id&&!r.completed).reduce((s,a)=>s+(a.items||[]).reduce((q,i)=>q+Number(i.qty||0),0),0);
  document.getElementById('modalBody').innerHTML=`<div class="modal-sticky-head"><div><h2>저장 거래명세표</h2><div class="muted">${escapeHtml(customerPrimaryLabel(c))} · ${inv.date||''} · 총액 ₩ ${money(inv.total)}</div></div><div class="sticky-action-buttons"><button class="secondary" onclick="openReturnEditV15('${id}')">반품수정</button><button class="danger" onclick="deleteInvoiceV10('${id}')">거래명세표 삭제</button></div></div>${retCount||pending?`<div class="return-status-v15">반품 완료 <b>${retCount}</b>개 · 반품 입고 대기 <b>${pending}</b>개</div>`:''}<div class="table-wrap"><table><thead><tr><th>제품</th><th>판매수량</th><th>반품완료</th><th>반품대기</th><th>단가</th><th>금액</th></tr></thead><tbody>${(inv.items||[]).map(it=>{const p=S.data.products.find(x=>x.id===it.product_id),done=completedReturnQtyV15(id,it.product_id),pen=pendingReturnQtyV15(id,it.product_id);return `<tr><td>${escapeHtml(p?.name||'삭제된 제품')}</td><td>${it.qty||0}</td><td>${done}</td><td>${pen}</td><td>₩ ${money(it.price)}</td><td>₩ ${money((it.qty||0)*(it.price||0))}</td></tr>`}).join('')}</tbody></table></div><div class="invoice-total">총액 ₩ ${money(inv.total)}</div>`;document.getElementById('modal').classList.remove('hidden');
}

function pendingReturnsV15(){ensureV15Data();return S.data.return_allocations.filter(x=>!x.completed)}
function returnAllocationListItemV15(a){const items=a.items||[];return `<button class="allocation-item-v13 return-allocation-v15" onclick="openReturnAllocationV15('${a.id}')"><div class="allocation-customer-v13"><b>${escapeHtml(a.customer_label||'반품')}</b><small>${a.date||''} · 원거래 ${a.invoice_date||''}</small></div><div class="allocation-thumbs-v13">${items.slice(0,4).map(it=>{const p=S.data.products.find(x=>x.id===it.product_id);return p?.image?`<img src="${p.image}">`:''}).join('')}</div><div class="allocation-desc-v13"><span class="return-badge-v15">반품 입고</span><span>제품 ${items.length}종</span><span>총수량 ${items.reduce((s,x)=>s+Number(x.qty||0),0)}</span></div><strong>입고 위치 정리 ›</strong></button>`}
function renderAllocationV15(){
  const page=document.getElementById('page-allocation');if(!page)return;const outs=pendingAllocationsV12(),rets=pendingReturnsV15();
  page.innerHTML=`<div class="card allocation-help-v13"><b>출고와 반품을 같은 곳에서 정리합니다.</b><div class="muted">파란색은 거래 출고 차감, 초록색은 반품 입고입니다. 각각 실제 위치별 수량을 맞춘 뒤 재고 반영하세요.</div></div><h3>처리 대기</h3><div class="allocation-list-v13">${[...rets.map(returnAllocationListItemV15),...outs.map(allocationListItemV13)].slice(0,20).join('')||'<div class="card"><span class="muted">정리할 출고/반품이 없습니다.</span></div>'}</div>${rets.length+outs.length>20?`<div class="muted" style="margin:8px 0">대기 ${rets.length+outs.length}건 중 20건 표시</div>`:''}<div class="card history-card"><h3>최근 재고 정리 이력</h3>${[...(S.data.allocation_history||[]).map(x=>({...x,kind:'출고'})),...(S.data.return_history||[]).map(x=>({at:x.at,customer:x.customer,note:`${x.product} 반품 +${x.qty} · ${x.locations||''}`,user:x.user,kind:'반품'}))].sort((a,b)=>(b.at||'').localeCompare(a.at||'')).slice(0,10).map(h=>`<div class="search-result"><b>${h.kind}</b> · ${h.at} · ${escapeHtml(h.customer||'')} · ${escapeHtml(h.note||'')} · ${escapeHtml(h.user||'')}</div>`).join('')||'<span class="muted">아직 이력이 없습니다.</span>'}</div>`;
}
function openReturnAllocationV15(id){const a=S.data.return_allocations.find(x=>x.id===id);if(!a)return;document.getElementById('modalBody').innerHTML=`<div class="modal-sticky-head"><div><h2>반품 재고 입고</h2><div class="muted">${escapeHtml(a.customer_label||'')} · ${a.date||''}</div></div><button class="primary" onclick="applyReturnAllocationV15('${id}')">재고 반영</button></div><div class="return-alloc-list-v15">${a.items.map((it,ii)=>returnProductRowV15(a,it,ii)).join('')}</div>`;document.getElementById('modal').classList.remove('hidden')}
function returnProductRowV15(a,it,ii){const p=S.data.products.find(x=>x.id===it.product_id),iv=invFor(it.product_id),adds=it.additions||(it.additions={}),sum=Object.values(adds).reduce((s,v)=>s+Number(v||0),0);return `<div class="alloc-product-v13 return-product-v15"><div class="alloc-product-head-v13">${p?.image?`<img src="${p.image}">`:''}<div><b>${escapeHtml(p?.name||'삭제된 제품')}</b><small>${escapeHtml(p?.material||'')}</small></div><div class="alloc-needed-v13">반품수량 <b>${it.qty}</b><br><span class="${sum===Number(it.qty||0)?'ok':'warn'}">입력합계 ${sum}</span></div></div><div class="alloc-location-grid-v13">${S.data.locations.map(l=>{const cur=Number(iv[l.id]||0),q=Number(adds[l.id]||0);return `<div class="alloc-location-v13 return-location-v15"><b>${escapeHtml(l.name)}</b><small>현재 ${cur}</small><div class="stepper-v13"><button onclick="adjustReturnAllocV15('${a.id}',${ii},'${l.id}',-1)">−</button><input type="number" min="0" value="${q||''}" placeholder="0" oninput="setReturnAllocV15('${a.id}',${ii},'${l.id}',this.value)"><button onclick="adjustReturnAllocV15('${a.id}',${ii},'${l.id}',1)">＋</button></div><small>입고 후 ${cur+q}</small></div>`}).join('')}</div></div>`}
function setReturnAllocV15(aid,ii,lid,val){const a=S.data.return_allocations.find(x=>x.id===aid),it=a?.items?.[ii];if(!it)return;if(!it.additions)it.additions={};it.additions[lid]=Math.max(0,Number(val)||0);openReturnAllocationV15(aid)}
function adjustReturnAllocV15(aid,ii,lid,d){const a=S.data.return_allocations.find(x=>x.id===aid),it=a?.items?.[ii];if(!it)return;if(!it.additions)it.additions={};it.additions[lid]=Math.max(0,Number(it.additions[lid]||0)+d);openReturnAllocationV15(aid)}
async function applyReturnAllocationV15(id){
  ensureV15Data();const a=S.data.return_allocations.find(x=>x.id===id);if(!a)return;for(const it of a.items){const sum=Object.values(it.additions||{}).reduce((s,v)=>s+Number(v||0),0);if(sum!==Number(it.qty||0))return alert(`${S.data.products.find(p=>p.id===it.product_id)?.name||'제품'}: 반품수량 ${it.qty}개와 위치별 입력합계 ${sum}개가 같아야 합니다.`)}
  for(const it of a.items){const p=S.data.products.find(x=>x.id===it.product_id),iv=invFor(it.product_id);if(!S.data.inventory.includes(iv))S.data.inventory.push(iv);const notes=[];for(const [lid,qv] of Object.entries(it.additions||{})){const q=Number(qv||0);if(!q)continue;iv[lid]=Number(iv[lid]||0)+q;const ln=S.data.locations.find(l=>l.id===lid)?.name||'';notes.push(`${ln} +${q}`);S.data.stock_logs.push({at:now(),product:p?.name||'',note:`반품 입고 · ${ln} +${q}`,user:loginActor()})}iv.updated_at=now();S.data.return_history.push({id:uid('rh'),at:now(),invoice_id:a.invoice_id,customer_id:a.customer_id,customer:a.customer_label||'',product_id:it.product_id,product:p?.name||'',qty:Number(it.qty||0),price:Number(it.price||0),amount:Number(it.qty||0)*Number(it.price||0),locations:notes.join(' / '),user:loginActor()})}
  a.completed=true;a.completed_at=now();a.completed_by=loginActor();addChangeLog('반품 재고 반영',`${a.customer_label||''} · ${(a.items||[]).reduce((s,i)=>s+Number(i.qty||0),0)}개`,a.invoice_id||a.id);await persist();closeModal();render();
}

// If a shipped invoice is deleted, offer to send remaining stock to return queue before hiding the invoice.
const _v15DeleteInvoiceBase=deleteInvoiceV10;
deleteInvoiceV10=async function(id){
  ensureV15Data();const inv=S.data.invoices.find(x=>x.id===id),out=S.data.stock_allocations?.find(x=>x.invoice_id===id&&x.completed);if(inv&&out){const remain=returnableItemsV15(inv);if(remain.length&&confirm('이미 출고 재고가 반영된 거래입니다.\n삭제와 함께 아직 반품되지 않은 수량을 "반품 입고 대기"로 보낼까요?')){const c=S.data.customers.find(x=>x.id===inv.customer_id);S.data.return_allocations.push({id:uid('ret'),invoice_id:inv.id,customer_id:inv.customer_id,customer_label:customerPrimaryLabel(c),invoice_date:inv.date,date:new Date().toISOString().slice(0,10),created_at:now(),created_by:loginActor(),items:remain.map(it=>({product_id:it.product_id,qty:it.remain,price:Number(it.price||0),additions:{}})),completed:false,invoice_deleted:true})}}
  await _v15DeleteInvoiceBase(id);ensureV15Data();await persist();render();
}

// Customer purchase summaries become net of completed returns.
function completedReturnsForPeriodV15(cid,from,to){ensureV15Data();return S.data.return_history.filter(r=>r.customer_id===cid&&(r.at||'').slice(0,10)>=from&&(r.at||'').slice(0,10)<=to)}
const _v15DrawCustomerDetailBase=drawCustomerDetailV11;
drawCustomerDetailV11=function(showAll=false){
  const cid=window._customerDetailId,el=document.getElementById('customerDetailSummary');if(!cid||!el)return _v15DrawCustomerDetailBase(showAll);const mode=window._customerDetailMode||'history',invs=customerInvoicesInPeriodV11(cid),from=document.getElementById('cd-from')?.value||'0000-01-01',to=document.getElementById('cd-to')?.value||'9999-12-31',rets=completedReturnsForPeriodV15(cid,from,to),gross=invs.reduce((s,i)=>s+Number(i.total||0),0),refund=rets.reduce((s,r)=>s+Number(r.amount||0),0),net=gross-refund;
  if(mode==='history'){const rows=showAll?invs:invs.slice(0,10);el.innerHTML=`<div class="period-total">기간 거래금액 <b>₩ ${money(gross)}</b> · 반품금액 <b class="return-money-v15">- ₩ ${money(refund)}</b> · 순거래금액 <b>₩ ${money(net)}</b></div><div class="table-wrap"><table><thead><tr><th>날짜</th><th>품목 수</th><th>수량</th><th>총금액</th><th></th></tr></thead><tbody>${rows.map(inv=>`<tr><td>${inv.date||''}</td><td>${inv.items?.length||0}</td><td>${(inv.items||[]).reduce((s,x)=>s+Number(x.qty||0),0)}</td><td>₩ ${money(inv.total)}</td><td><button class="secondary" onclick="viewSavedInvoice('${inv.id}')">보기</button></td></tr>`).join('')}</tbody></table></div>${rets.length?`<div class="return-summary-v15"><b>기간 반품</b> · ${rets.reduce((s,r)=>s+Number(r.qty||0),0)}개 · ₩ ${money(refund)}</div>`:''}${invs.length>10&&!showAll?`<button class="secondary full-view-btn" onclick="drawCustomerDetailV11(true)">전체보기 (${invs.length}건)</button>`:''}`;return}
  const map=new Map();invs.forEach(inv=>(inv.items||[]).forEach(it=>{const p=S.data.products.find(x=>x.id===it.product_id),v=map.get(it.product_id)||{name:p?.name||'삭제된 제품',qty:0,amount:0};v.qty+=Number(it.qty||0);v.amount+=Number(it.qty||0)*Number(it.price||0);map.set(it.product_id,v)}));rets.forEach(r=>{const p=S.data.products.find(x=>x.id===r.product_id),v=map.get(r.product_id)||{name:p?.name||r.product||'삭제된 제품',qty:0,amount:0};v.qty-=Number(r.qty||0);v.amount-=Number(r.amount||0);map.set(r.product_id,v)});const all=[...map.values()].filter(x=>x.qty||x.amount).sort((a,b)=>b.qty-a.qty),rows=showAll?all:all.slice(0,10);el.innerHTML=`<div class="period-total">기간 거래금액 <b>₩ ${money(gross)}</b> · 반품금액 <b class="return-money-v15">- ₩ ${money(refund)}</b> · 순거래금액 <b>₩ ${money(net)}</b></div><div class="table-wrap"><table><thead><tr><th>제품명</th><th>순 수량</th><th>순 금액</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${escapeHtml(x.name)}</td><td>${x.qty}</td><td>₩ ${money(x.amount)}</td></tr>`).join('')}</tbody></table></div>${all.length>10&&!showAll?`<button class="secondary full-view-btn" onclick="drawCustomerDetailV11(true)">전체보기 (${all.length}개 제품)</button>`:''}`;
}

// Excel stock cleanup: explicit 작업구분 lets the program distinguish returns.
downloadStockExcelTemplateV13=async function(){
  if(!window.ExcelJS)return alert('Excel 모듈을 불러오지 못했습니다.');const wb=new ExcelJS.Workbook(),ws=wb.addWorksheet('입출고정리');const headers=['작업구분','제품명','소재',...S.data.locations.flatMap(l=>[`${l.name}_현재재고`,`${l.name}_변경수량`]),'거래명세표ID','거래처','메모'];ws.addRow(headers);S.data.products.filter(p=>!p.discontinued).forEach(p=>{const iv=invFor(p.id);ws.addRow(['',p.name,p.material||'',...S.data.locations.flatMap(l=>[Number(iv[l.id]||0),'']),'','',''])});ws.getRow(1).font={bold:true};ws.columns=headers.map((h,i)=>({width:i===0?14:i===1?28:i===2?18:16}));ws.views=[{state:'frozen',ySplit:1}];ws.getCell('A2').note='입고 / 출고 / 이동 / 반품 중 하나를 입력하세요. 반품은 위치별 변경수량을 +수량으로 입력합니다.';const buf=await wb.xlsx.writeBuffer(),a=document.createElement('a');a.href=URL.createObjectURL(new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));a.download=`NAYESO_입출고정리_${new Date().toISOString().slice(0,10)}.xlsx`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)
}
importStockExcelV13=async function(){
  const f=document.getElementById('stockExcelInputV13')?.files?.[0];if(!f)return alert('Excel 파일을 선택하세요.');const arr=await f.arrayBuffer(),wb=XLSX.read(arr,{type:'array'}),rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''});let changedRows=0;const plans=[];
  for(const row of rows){const name=String(row['제품명']||'').trim();if(!name)continue;const p=S.data.products.find(x=>x.name===name);if(!p)continue;const kind=String(row['작업구분']||'').trim()||'일반',iv=invFor(p.id),changes=[];for(const l of S.data.locations){const d=Number(row[`${l.name}_변경수량`]||0);if(!d)continue;if(Number(iv[l.id]||0)+d<0)return alert(`${p.name} / ${l.name}: 변경 후 재고가 0보다 작습니다.`);if(kind==='반품'&&d<0)return alert(`${p.name}: 반품은 +수량으로 입력하세요.`);changes.push([l,d])}if(changes.length)plans.push({p,iv,kind,changes,invoiceId:String(row['거래명세표ID']||'').trim(),customer:String(row['거래처']||'').trim(),memo:String(row['메모']||'').trim()})}
  if(!plans.length)return alert('반영할 변경수량이 없습니다.');if(!confirm(`${plans.length}개 제품의 재고 변경을 반영할까요?`))return;for(const plan of plans){if(!S.data.inventory.includes(plan.iv))S.data.inventory.push(plan.iv);const notes=[];let sum=0;for(const [l,d] of plan.changes){plan.iv[l.id]=Number(plan.iv[l.id]||0)+d;sum+=d;notes.push(`${l.name} ${d>0?'+':''}${d}`)}plan.iv.updated_at=now();const prefix=plan.kind==='반품'?'Excel 반품 입고':`Excel ${plan.kind==='일반'?'입출고 정리':plan.kind}`;S.data.stock_logs.push({at:now(),product:plan.p.name,note:`${prefix} · ${notes.join(' / ')}${plan.memo?' · '+plan.memo:''}`,user:loginActor()});if(plan.kind==='반품'){ensureV15Data();S.data.return_history.push({id:uid('rh'),at:now(),invoice_id:plan.invoiceId||'',customer_id:'',customer:plan.customer||'',product_id:plan.p.id,product:plan.p.name,qty:Math.max(0,sum),price:0,amount:0,locations:notes.join(' / '),user:loginActor(),excel:true})}addChangeLog(prefix,`${plan.p.name} · ${notes.join(' / ')}`,plan.p.id);changedRows++}await persist();closeModal();render();alert(`${changedRows}개 제품의 재고를 반영했습니다.`)
}

// Final render hook for return-aware allocation page.
const _v15RenderBase=render;
render=function(){ensureV15Data();_v15RenderBase();renderAllocationV15();if(S.page==='allocation')setPageMeta('출고 정리','거래 출고 차감과 반품 입고를 위치별로 정리합니다.')}

/* ===== v17 return completion adjusts saved invoice result ===== */
function ensureV17Data(){
  ensureV15Data();
  (S.data.invoices||[]).forEach(inv=>refreshInvoiceAdjustmentV17(inv,false));
}
function invoiceVatRateV17(inv){
  const opt=inv?.invoice_options||{};
  if(opt.vat_mode==='excluded')return 0;
  const t=(S.data.invoice_templates||[]).find(x=>x.id===inv?.template_id);
  return Number(t?.vat_rate ?? 10);
}
function refreshInvoiceAdjustmentV17(inv,stamp=true){
  if(!inv)return null;
  const adjusted=(inv.items||[]).map(it=>{
    const originalQty=Number(it.original_qty ?? it.qty ?? 0);
    const returned=completedReturnQtyV15(inv.id,it.product_id);
    const qty=Math.max(0,originalQty-returned);
    return {...clone(it),original_qty:originalQty,returned_qty:returned,qty};
  });
  const subtotal=adjusted.reduce((s,it)=>s+Number(it.qty||0)*Number(it.price||0),0);
  const rate=invoiceVatRateV17(inv);
  const vat=rate?Math.round(subtotal*rate/100):0;
  const total=subtotal+vat;
  inv.adjusted_items=adjusted;
  inv.adjusted_subtotal=subtotal;
  inv.adjusted_vat=vat;
  inv.adjusted_total=total;
  if(stamp)inv.adjusted_at=now();
  return {items:adjusted,subtotal,vat,total};
}
function effectiveInvoiceV17(inv){
  if(!inv)return {items:[],subtotal:0,vat:0,total:0};
  return refreshInvoiceAdjustmentV17(inv,false);
}
function returnableItemsV15(inv){
  return (inv?.items||[]).map(it=>{
    const done=completedReturnQtyV15(inv.id,it.product_id),pending=pendingReturnQtyV15(inv.id,it.product_id);
    const sold=Number(it.original_qty ?? it.qty ?? 0);
    return {...it,sold,done,pending,remain:Math.max(0,sold-done-pending)};
  }).filter(x=>x.remain>0);
}

// After return stock is actually received, also update the saved transaction result.
const _v17ApplyReturnAllocationBase=applyReturnAllocationV15;
applyReturnAllocationV15=async function(id){
  const a=S.data.return_allocations.find(x=>x.id===id);
  if(!a)return _v17ApplyReturnAllocationBase(id);
  // validate before base function closes/renders
  for(const it of a.items||[]){
    const sum=Object.values(it.additions||{}).reduce((s,v)=>s+Number(v||0),0);
    if(sum!==Number(it.qty||0))return alert(`${S.data.products.find(p=>p.id===it.product_id)?.name||'제품'}: 반품수량 ${it.qty}개와 위치별 입력합계 ${sum}개가 같아야 합니다.`);
  }
  await _v17ApplyReturnAllocationBase(id);
  const inv=S.data.invoices.find(x=>x.id===a.invoice_id);
  if(inv){
    refreshInvoiceAdjustmentV17(inv,true);
    addChangeLog('거래명세표 반품 정정',`${a.customer_label||''} · 최종 거래금액 ₩ ${money(inv.adjusted_total)}`,inv.id);
    await persist();
  }
  render();
}

// Saved invoice detail shows original, returned and FINAL transaction quantities/amounts.
viewSavedInvoice=function(id){
  ensureV17Data();const inv=S.data.invoices.find(x=>x.id===id);if(!inv)return;const c=S.data.customers.find(x=>x.id===inv.customer_id),eff=effectiveInvoiceV17(inv),retCount=S.data.return_history.filter(r=>r.invoice_id===id).reduce((s,r)=>s+Number(r.qty||0),0),pending=S.data.return_allocations.filter(r=>r.invoice_id===id&&!r.completed).reduce((s,a)=>s+(a.items||[]).reduce((q,i)=>q+Number(i.qty||0),0),0);
  document.getElementById('modalBody').innerHTML=`<div class="modal-sticky-head"><div><h2>저장 거래명세표</h2><div class="muted">${escapeHtml(customerPrimaryLabel(c))} · ${inv.date||''} · 최종 총액 ₩ ${money(eff.total)}</div></div><div class="sticky-action-buttons"><button class="secondary" onclick="openReturnEditV15('${id}')">반품수정</button><button class="danger" onclick="deleteInvoiceV10('${id}')">거래명세표 삭제</button></div></div>${retCount||pending?`<div class="return-status-v15">반품 완료 <b>${retCount}</b>개 · 반품 입고 대기 <b>${pending}</b>개</div>`:''}<div class="table-wrap"><table><thead><tr><th>제품</th><th>최초수량</th><th>반품완료</th><th>반품대기</th><th>최종 거래수량</th><th>단가</th><th>최종 금액</th></tr></thead><tbody>${eff.items.map(it=>{const p=S.data.products.find(x=>x.id===it.product_id),pen=pendingReturnQtyV15(id,it.product_id);return `<tr><td>${escapeHtml(p?.name||'삭제된 제품')}</td><td>${it.original_qty||0}</td><td>${it.returned_qty||0}</td><td>${pen}</td><td><b>${it.qty||0}</b></td><td>₩ ${money(it.price)}</td><td><b>₩ ${money((it.qty||0)*(it.price||0))}</b></td></tr>`}).join('')}</tbody></table></div><div class="invoice-summary-v17"><div>공급가 합계 <b>₩ ${money(eff.subtotal)}</b></div>${eff.vat?`<div>VAT <b>₩ ${money(eff.vat)}</b></div>`:''}<div class="invoice-total">최종 거래금액 ₩ ${money(eff.total)}</div></div>`;document.getElementById('modal').classList.remove('hidden');
}

// Customer history rows and exports use the corrected saved invoice result.
drawCustomerDetailV11=function(showAll=false){
  ensureV17Data();
  const cid=window._customerDetailId,el=document.getElementById('customerDetailSummary');if(!cid||!el)return;
  const mode=window._customerDetailMode||'history',invs=customerInvoicesInPeriodV11(cid),from=document.getElementById('cd-from')?.value||'0000-01-01',to=document.getElementById('cd-to')?.value||'9999-12-31';
  const gross=invs.reduce((s,i)=>s+Number(i.total||0),0),net=invs.reduce((s,i)=>s+effectiveInvoiceV17(i).total,0),refund=Math.max(0,gross-net);
  if(mode==='history'){
    const rows=showAll?invs:invs.slice(0,10);
    el.innerHTML=`<div class="period-total">최초 거래금액 <b>₩ ${money(gross)}</b> · 반품 정정 <b class="return-money-v15">- ₩ ${money(refund)}</b> · 최종 거래금액 <b>₩ ${money(net)}</b></div><div class="table-wrap"><table><thead><tr><th>날짜</th><th>품목 수</th><th>최종 수량</th><th>최종 총금액</th><th></th></tr></thead><tbody>${rows.map(inv=>{const e=effectiveInvoiceV17(inv),items=e.items.filter(x=>Number(x.qty||0)>0);return `<tr><td>${inv.date||''}</td><td>${items.length}</td><td>${items.reduce((s,x)=>s+Number(x.qty||0),0)}</td><td>₩ ${money(e.total)}</td><td><button class="secondary" onclick="viewSavedInvoice('${inv.id}')">보기</button></td></tr>`}).join('')}</tbody></table></div>${invs.length>10&&!showAll?`<button class="secondary full-view-btn" onclick="drawCustomerDetailV11(true)">전체보기 (${invs.length}건)</button>`:''}`;return;
  }
  const map=new Map();invs.forEach(inv=>effectiveInvoiceV17(inv).items.forEach(it=>{if(!Number(it.qty||0))return;const p=S.data.products.find(x=>x.id===it.product_id),v=map.get(it.product_id)||{name:p?.name||'삭제된 제품',qty:0,amount:0};v.qty+=Number(it.qty||0);v.amount+=Number(it.qty||0)*Number(it.price||0);map.set(it.product_id,v)}));
  const all=[...map.values()].filter(x=>x.qty||x.amount).sort((a,b)=>b.qty-a.qty),rows=showAll?all:all.slice(0,10);
  el.innerHTML=`<div class="period-total">최종 거래금액 <b>₩ ${money(net)}</b></div><div class="table-wrap"><table><thead><tr><th>제품명</th><th>최종 수량</th><th>최종 금액</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${escapeHtml(x.name)}</td><td>${x.qty}</td><td>₩ ${money(x.amount)}</td></tr>`).join('')}</tbody></table></div>${all.length>10&&!showAll?`<button class="secondary full-view-btn" onclick="drawCustomerDetailV11(true)">전체보기 (${all.length}개 제품)</button>`:''}`;
}

customerReportDataV12=function(){
  ensureV17Data();const cid=window._customerDetailId,c=S.data.customers.find(x=>x.id===cid),mode=window._customerDetailMode||'history',from=document.getElementById('cd-from')?.value||'',to=document.getElementById('cd-to')?.value||'',invs=customerInvoicesInPeriodV11(cid),total=invs.reduce((s,i)=>s+effectiveInvoiceV17(i).total,0);
  if(mode==='history')return {c,mode,from,to,total,rows:invs.map(inv=>{const e=effectiveInvoiceV17(inv),items=e.items.filter(x=>Number(x.qty||0)>0);return {date:inv.date||'',types:items.length,qty:items.reduce((s,x)=>s+Number(x.qty||0),0),amount:e.total}})};
  const map=new Map();invs.forEach(inv=>effectiveInvoiceV17(inv).items.forEach(it=>{if(!Number(it.qty||0))return;const p=S.data.products.find(x=>x.id===it.product_id),k=it.product_id,v=map.get(k)||{name:p?.name||'삭제된 제품',qty:0,amount:0};v.qty+=Number(it.qty||0);v.amount+=Number(it.qty||0)*Number(it.price||0);map.set(k,v)}));
  return {c,mode,from,to,total,rows:[...map.values()].sort((a,b)=>b.qty-a.qty)};
}

const _v17RenderBase=render;
render=function(){ensureV17Data();return _v17RenderBase();}


/* ===== v18 fixed toolbars + folder views + photo outbound OCR ===== */
function ensureV18Data(){
  ensureV17Data();
  if(!Array.isArray(S.data.photo_out_history))S.data.photo_out_history=[];
  if(!S.productSelectionFilter)S.productSelectionFilter='all';
  if(!['detail','name','image','deck'].includes(S.productView))S.productView='detail';
}
function v18SelectionFiltered(ps){return S.productSelectionFilter==='selected'?ps.filter(p=>S.selectedProducts.has(p.id)):ps}
function v18ProductSize(p){const a=[p.w||p.W,p.d||p.D,p.h||p.H].map(v=>String(v??'').trim());return a.some(Boolean)?a.map(v=>v||'-').join(' × '):''}
function v18ViewButton(mode,label,kind){return `<button class="view-folder-btn-v18 ${S.productView===mode?'active':''}" onclick="S.productView='${mode}';renderProducts()"><span class="view-folder-icon-v18 ${kind}"><i></i><i></i><i></i></span><span>${label}</span></button>`}
function v18ProductCard(p,mode){
  const selected=S.selectedProducts.has(p.id)?' selected-product-v18':'';
  if(mode==='image')return `<div class="product-card folder-card image-only-card-v18 ${p.discontinued?'discontinued-card':''}${selected}" onclick="openProduct('${p.id}')"><div class="card-select">${productSelectBox(p.id)}</div><div class="folder-image">${imgTag(p)}</div></div>`;
  if(mode==='name')return `<div class="product-card folder-card name-card-v18 ${p.discontinued?'discontinued-card':''}${selected}" onclick="openProduct('${p.id}')"><div class="card-select">${productSelectBox(p.id)}</div><div class="folder-image">${imgTag(p)}</div><div class="body"><b>${productNameHtml(p)}</b></div></div>`;
  const sz=v18ProductSize(p);return `<div class="product-card folder-card detail-card-v18 ${p.discontinued?'discontinued-card':''}${selected}" onclick="openProduct('${p.id}')"><div class="card-select">${productSelectBox(p.id)}</div><div class="folder-image">${imgTag(p)}</div><div class="body"><b>${productNameHtml(p)}</b><div class="muted">${escapeHtml(p.material||'')}${p.group?' · '+escapeHtml(p.group):''}</div>${sz?`<div class="muted product-size-v18">${escapeHtml(sz)}</div>`:''}<div class="folder-stock">총수량 <b>${totalQty(p.id)}</b></div></div></div>`}
renderProducts=function(){
  ensureV18Data();let ps=v18SelectionFiltered(sortedProducts()),shown=ps.slice(0,S.pageSize);const body=`<div class="product-grid folder-grid product-view-${S.productView}-v18">${shown.map(p=>v18ProductCard(p,S.productView)).join('')}</div>`;
  document.getElementById('page-products').innerHTML=`<div class="fixed-controls-v18">
    <div class="control-row-v18 primary-row-v18">
      <div class="tabs compact-tabs-v18"><button class="${S.productFilter==='all'?'active':''}" onclick="S.productFilter='all';renderProducts()">전체</button><button class="${S.productFilter==='active'?'active':''}" onclick="S.productFilter='active';renderProducts()">판매제품</button><button class="${S.productFilter==='discontinued'?'active':''}" onclick="S.productFilter='discontinued';renderProducts()">단종제품</button><button class="${S.productSelectionFilter==='selected'?'active':''}" onclick="S.productSelectionFilter=S.productSelectionFilter==='selected'?'all':'selected';renderProducts()">선택 ${S.selectedProducts.size?`(${S.selectedProducts.size})`:''}</button></div>
      <label class="control-select-v18">정렬 <select onchange="S.productSort=this.value;renderProducts()"><option value="registered" ${S.productSort==='registered'?'selected':''}>등록순</option><option value="name" ${S.productSort==='name'?'selected':''}>이름순</option><option value="groupname" ${S.productSort==='groupname'?'selected':''}>그룹 + 이름순</option></select></label>
      <span class="control-count-v18">표시 ${shown.length} / ${ps.length}</span>
    </div>
    <div class="control-row-v18 action-row-v18"><button class="secondary" onclick="selectAllVisibleProducts(true);renderProducts()">전체선택</button><button class="secondary" onclick="S.selectedProducts.clear();S.productSelectionFilter='all';renderProducts()">선택해제</button><button class="secondary" onclick="moveSelectedProducts(-1)">↑ 위로</button><button class="secondary" onclick="moveSelectedProducts(1)">↓ 아래로</button><button class="danger" onclick="deleteSelectedProducts()">선택삭제</button></div>
    <div class="control-row-v18 view-row-v18"><div class="view-folder-group-v18">${v18ViewButton('detail','이미지 + 상세','detail')}${v18ViewButton('name','이미지 + 이름','name')}${v18ViewButton('image','이미지만','image')}</div><label class="page-size-v18">표시수 <select onchange="S.pageSize=+this.value;renderProducts()">${[10,20,50,100].map(n=>`<option ${S.pageSize===n?'selected':''}>${n}</option>`).join('')}</select></label></div>
  </div>${body}${productHistoryHtmlV10()}`;
}
renderInventory=function(){
  ensureV18Data();const locs=S.data.locations;let ps=v18SelectionFiltered(sortedProducts());
  document.getElementById('page-inventory').innerHTML=`<div class="fixed-controls-v18 inventory-controls-v18">
    <div class="control-row-v18 primary-row-v18"><button class="primary" onclick="stockMove()">+ 입고 / 출고 / 이동</button><button class="secondary" onclick="manageLocations()">위치 관리</button><div class="tabs compact-tabs-v18"><button class="${S.productFilter==='all'?'active':''}" onclick="S.productFilter='all';renderInventory()">전체</button><button class="${S.productFilter==='active'?'active':''}" onclick="S.productFilter='active';renderInventory()">판매제품</button><button class="${S.productFilter==='discontinued'?'active':''}" onclick="S.productFilter='discontinued';renderInventory()">단종제품</button><button class="${S.productSelectionFilter==='selected'?'active':''}" onclick="S.productSelectionFilter=S.productSelectionFilter==='selected'?'all':'selected';renderInventory()">선택 ${S.selectedProducts.size?`(${S.selectedProducts.size})`:''}</button></div><label class="control-select-v18">정렬 <select onchange="S.productSort=this.value;renderInventory()"><option value="registered" ${S.productSort==='registered'?'selected':''}>등록순</option><option value="name" ${S.productSort==='name'?'selected':''}>이름순</option><option value="groupname" ${S.productSort==='groupname'?'selected':''}>그룹 + 이름순</option></select></label></div>
    <div class="control-row-v18 action-row-v18"><button class="secondary" onclick="selectAllInventoryProducts(true);renderInventory()">전체선택</button><button class="secondary" onclick="S.selectedProducts.clear();S.productSelectionFilter='all';renderInventory()">선택해제</button><button class="secondary" onclick="moveSelectedProducts(-1)">↑ 위로</button><button class="secondary" onclick="moveSelectedProducts(1)">↓ 아래로</button><button class="danger" onclick="deleteSelectedProducts()">선택삭제</button></div>
  </div><div class="table-wrap"><table><thead><tr><th class="select-col">선택</th><th>이미지</th><th>제품명</th>${locs.map(l=>`<th>${escapeHtml(l.name)}</th>`).join('')}<th>총수량</th><th>변경날짜</th><th>수정</th></tr></thead><tbody>${ps.map(p=>{let inv=invFor(p.id),editing=S.inventoryEditSet.has(p.id);return `<tr><td class="select-col">${productSelectBox(p.id)}</td><td class="image-cell">${p.image?`<img class="inv-img" src="${p.image}">`:`<div class="img-placeholder inv-img">NO</div>`}</td><td>${productNameHtml(p)}</td>${locs.map(l=>`<td><input type="number" value="${inv[l.id]||0}" ${editing?'':'disabled'} onchange="updateStock('${p.id}','${l.id}',this.value)"></td>`).join('')}<td><b>${totalQty(p.id)}</b></td><td>${inv.updated_at||''}</td><td><button class="${editing?'primary':'secondary'}" onclick="toggleInventoryEdit('${p.id}')">${editing?'완료':'Edit'}</button></td></tr>`}).join('')}</tbody></table></div>
  <div class="card history-card" style="margin-top:16px"><div class="toolbar"><h3 style="margin:0">재고 이력</h3><span class="muted">최근 10건 표시</span><span class="spacer"></span><button class="secondary" onclick="openStockHistory()">전체 이력 보기</button></div>${S.data.stock_logs.slice(-10).reverse().map(x=>`<div class="search-result">${x.at||''} · ${escapeHtml(x.product||'')} · ${escapeHtml(x.note||'')}${x.user?' · '+escapeHtml(x.user):''}</div>`).join('')||'<span class="muted">아직 이력이 없습니다.</span>'}</div>`;
}

function photoNormalizeV18(s){return String(s||'').toLowerCase().replace(/[\s\-_.·/\\()\[\]{}]/g,'').replace(/[^0-9a-z가-힣]/g,'')}
function photoLevenshteinV18(a,b){a=photoNormalizeV18(a);b=photoNormalizeV18(b);if(!a||!b)return Math.max(a.length,b.length);const d=Array(b.length+1).fill(0).map((_,i)=>i);for(let i=1;i<=a.length;i++){let prev=d[0];d[0]=i;for(let j=1;j<=b.length;j++){const old=d[j],cost=a[i-1]===b[j-1]?0:1;d[j]=Math.min(d[j]+1,d[j-1]+1,prev+cost);prev=old}}return d[b.length]}
function photoScoreV18(q,name){const a=photoNormalizeV18(q),b=photoNormalizeV18(name);if(!a||!b)return 0;if(a===b)return 1;if(a.includes(b)||b.includes(a))return .88+Math.min(a.length,b.length)/Math.max(a.length,b.length)*.1;return Math.max(0,1-photoLevenshteinV18(a,b)/Math.max(a.length,b.length))}
function photoBestMatchesV18(q){return S.data.products.map(p=>({p,score:photoScoreV18(q,p.name)})).sort((a,b)=>b.score-a.score).slice(0,5)}
function photoPickLocationV18(pid,qty){const iv=invFor(pid),locs=S.data.locations.map(l=>({l,qty:Number(iv[l.id]||0)})).sort((a,b)=>b.qty-a.qty);return (locs.find(x=>x.qty>=qty)||locs[0]||{}).l?.id||''}
function photoParseLineV18(line){let raw=String(line||'').trim();if(!raw)return null;raw=raw.replace(/[|]/g,' ').replace(/\s+/g,' ');let qty=0,query=raw;let m=raw.match(/(?:수량|qty|q'ty|x|×|\*)\s*[:=]?\s*(\d+)\s*(?:개|ea)?\s*$/i)||raw.match(/(\d+)\s*(?:개|ea)\s*$/i)||raw.match(/[\s,:-](\d+)\s*$/);if(m){qty=Number(m[1]||0);query=raw.slice(0,m.index).trim().replace(/[\-:]+$/,'').trim()}if(!qty)qty=1;const best=photoBestMatchesV18(query)[0];const pid=best&&best.score>=.28?best.p.id:'';return {raw,query,qty,product_id:pid,score:best?.score||0,location_id:pid?photoPickLocationV18(pid,qty):''}}
function photoParseTextV18(text){const rows=String(text||'').split(/\r?\n/).map(photoParseLineV18).filter(Boolean);window._photoOutV18.rows=rows;drawPhotoOutboundRowsV18()}
function openPhotoOutboundV18(){
  ensureV18Data();window._photoOutV18={rows:[],text:'',files:[],busy:false};document.getElementById('modalBody').innerHTML=`<div class="modal-sticky-head photo-head-v18"><div><h2>사진 출고 정리</h2><div class="muted">사진의 제품명과 수량을 읽어 제품을 자동 매칭합니다. 마지막 확인 전에는 재고가 바뀌지 않습니다.</div></div><button class="primary" id="photoApplyBtnV18" onclick="applyPhotoOutboundV18()" disabled>확인 후 재고 반영</button></div>
  <div class="photo-work-v18"><div class="photo-upload-v18"><label class="photo-drop-v18"><b>① 출고 메모 사진 선택</b><span>휴대폰 촬영 사진 또는 갤러리 이미지 · 여러 장 가능</span><input id="photoFilesV18" type="file" accept="image/*" multiple onchange="photoFilesChangedV18(this.files)"></label><div id="photoPreviewV18" class="photo-preview-v18"></div><div id="photoProgressV18" class="photo-progress-v18">사진을 선택하세요.</div></div>
  <div class="photo-text-v18"><div class="photo-section-title-v18"><b>② 인식된 글자</b><button class="secondary" onclick="photoParseTextV18(document.getElementById('photoOcrTextV18').value)">수정한 글자로 다시 정리</button></div><textarea id="photoOcrTextV18" placeholder="예: 곰맥주박스 3개\n원형트레이 2개"></textarea><div class="muted">글씨가 잘못 읽힌 부분은 여기서 직접 고친 뒤 ‘수정한 글자로 다시 정리’를 누르면 됩니다.</div></div>
  <div><div class="photo-section-title-v18"><b>③ 제품·수량 확인</b><button class="secondary" onclick="addPhotoOutboundRowV18()">+ 항목 추가</button></div><div id="photoRowsV18"></div></div></div>`;document.getElementById('modal').classList.remove('hidden');
}
function photoFilesChangedV18(files){window._photoOutV18.files=[...(files||[])];const prev=document.getElementById('photoPreviewV18');prev.innerHTML='';window._photoOutV18.files.forEach(f=>{const img=document.createElement('img');img.src=URL.createObjectURL(f);img.onload=()=>URL.revokeObjectURL(img.src);prev.appendChild(img)});runPhotoOcrV18()}
async function runPhotoOcrV18(){
  const st=window._photoOutV18,prog=document.getElementById('photoProgressV18');if(!st?.files?.length)return;if(!window.Tesseract){prog.innerHTML='<b>문자인식 모듈을 불러오지 못했습니다.</b><br>아래 글자칸에 직접 입력해서 사용할 수 있습니다.';return}st.busy=true;let all=[];
  for(let i=0;i<st.files.length;i++){const f=st.files[i];prog.innerHTML=`<b>사진 ${i+1}/${st.files.length} 분석 중...</b><div class="ocr-bar-v18"><i style="width:2%"></i></div><span>처음 사용 시 한국어 인식 모듈을 받느라 시간이 조금 걸릴 수 있습니다.</span>`;try{const r=await Tesseract.recognize(f,'kor+eng',{logger:m=>{if(m.status==='recognizing text'){const pct=Math.round((m.progress||0)*100);const bar=prog.querySelector('i');if(bar)bar.style.width=pct+'%';const sp=prog.querySelector('span');if(sp)sp.textContent=`글자 인식 ${pct}%`}}});all.push(r.data?.text||'')}catch(e){all.push('');console.error(e)}}
  st.text=all.filter(Boolean).join('\n');document.getElementById('photoOcrTextV18').value=st.text;photoParseTextV18(st.text);prog.innerHTML=`<b>분석 완료</b> · ${st.rows.length}개 줄 정리됨 <span class="muted">제품명/수량을 확인하고 필요하면 수정하세요.</span>`;st.busy=false;
}
function addPhotoOutboundRowV18(){window._photoOutV18.rows.push({raw:'직접 추가',query:'',qty:1,product_id:'',score:0,location_id:''});drawPhotoOutboundRowsV18()}
function removePhotoOutboundRowV18(i){window._photoOutV18.rows.splice(i,1);drawPhotoOutboundRowsV18()}
function setPhotoProductV18(i,pid){const r=window._photoOutV18.rows[i];r.product_id=pid;r.score=pid?1:0;r.location_id=pid?photoPickLocationV18(pid,r.qty):'';drawPhotoOutboundRowsV18()}
function setPhotoQtyV18(i,v){const r=window._photoOutV18.rows[i];r.qty=Math.max(0,Number(v)||0);if(r.product_id&&!r.location_id)r.location_id=photoPickLocationV18(r.product_id,r.qty);drawPhotoOutboundRowsV18()}
function setPhotoLocV18(i,lid){window._photoOutV18.rows[i].location_id=lid;drawPhotoOutboundRowsV18()}
function photoProductOptionsV18(sel){return `<option value="">제품 선택 필요</option>${[...S.data.products].sort((a,b)=>(a.name||'').localeCompare(b.name||'','ko')).map(p=>`<option value="${p.id}" ${p.id===sel?'selected':''}>${escapeHtml(p.name)}</option>`).join('')}`}
function drawPhotoOutboundRowsV18(){
  const box=document.getElementById('photoRowsV18');if(!box)return;const rows=window._photoOutV18.rows||[];box.innerHTML=rows.length?`<div class="photo-table-v18"><div class="photo-tr-v18 photo-th-v18"><span>사진에서 읽은 내용</span><span>제품 선택</span><span>출고수량</span><span>차감 위치</span><span>현재 → 최종</span><span></span></div>${rows.map((r,i)=>{const p=S.data.products.find(x=>x.id===r.product_id),iv=p?invFor(p.id):{},cur=r.location_id?Number(iv[r.location_id]||0):0,after=cur-Number(r.qty||0),amb=!p||r.score<.55;const matches=photoBestMatchesV18(r.query||r.raw);return `<div class="photo-tr-v18 ${amb?'needs-check-v18':''}"><span><b>${escapeHtml(r.raw||'')}</b><small>${amb?'확인 필요':'자동 매칭'}${r.score?` · ${Math.round(r.score*100)}%`:''}</small>${matches.length?`<small class="candidate-v18">후보: ${matches.slice(0,3).map(x=>escapeHtml(x.p.name)).join(' / ')}</small>`:''}</span><span><select onchange="setPhotoProductV18(${i},this.value)">${photoProductOptionsV18(r.product_id)}</select></span><span><input type="number" min="0" value="${r.qty}" onchange="setPhotoQtyV18(${i},this.value)"></span><span><select onchange="setPhotoLocV18(${i},this.value)"><option value="">위치 선택</option>${S.data.locations.map(l=>`<option value="${l.id}" ${l.id===r.location_id?'selected':''}>${escapeHtml(l.name)} (${Number(iv[l.id]||0)})</option>`).join('')}</select></span><span class="stock-after-v18 ${after<0?'bad':''}">${p&&r.location_id?`${cur} → <b>${after}</b>`:'-'}</span><span><button class="danger mini-v18" onclick="removePhotoOutboundRowV18(${i})">삭제</button></span></div>`}).join('')}</div>`:'<div class="card muted">아직 정리된 항목이 없습니다. 사진을 분석하거나 항목을 직접 추가하세요.</div>';
  const ok=rows.length&&rows.every(r=>{const p=S.data.products.find(x=>x.id===r.product_id),iv=p?invFor(p.id):{};return p&&r.location_id&&Number(r.qty||0)>0&&Number(iv[r.location_id]||0)>=Number(r.qty||0)});const btn=document.getElementById('photoApplyBtnV18');if(btn)btn.disabled=!ok;
}
async function applyPhotoOutboundV18(){
  ensureV18Data();const rows=window._photoOutV18?.rows||[];if(!rows.length)return alert('반영할 제품이 없습니다.');const plans=[];for(const r of rows){const p=S.data.products.find(x=>x.id===r.product_id),l=S.data.locations.find(x=>x.id===r.location_id),q=Number(r.qty||0);if(!p||!l||q<=0)return alert('제품, 수량, 차감 위치를 모두 확인하세요.');const iv=invFor(p.id),cur=Number(iv[l.id]||0);if(cur<q)return alert(`${p.name}: ${l.name} 재고가 부족합니다. 현재 ${cur}개 / 출고 ${q}개`);plans.push({r,p,l,iv,q,cur})}
  if(!confirm(`사진 출고 ${plans.length}개 항목을 실제 재고에서 차감할까요?\n확인 후 즉시 저장됩니다.`))return;const hist={id:uid('phout'),at:now(),user:loginActor(),ocr_text:document.getElementById('photoOcrTextV18')?.value||'',items:[]};for(const x of plans){x.iv[x.l.id]=x.cur-x.q;x.iv.updated_at=now();S.data.stock_logs.push({at:now(),product:x.p.name,note:`사진 출고 정리 · ${x.l.name} -${x.q} · ${x.cur}→${x.cur-x.q}`,user:loginActor()});hist.items.push({product_id:x.p.id,product:x.p.name,location_id:x.l.id,location:x.l.name,qty:x.q,before:x.cur,after:x.cur-x.q});addChangeLog('사진 출고 정리',`${x.p.name} · ${x.l.name} -${x.q} · ${x.cur}→${x.cur-x.q}`,x.p.id)}S.data.photo_out_history.push(hist);if(S.data.photo_out_history.length>200)S.data.photo_out_history=S.data.photo_out_history.slice(-200);await persist();closeModal();render();alert(`사진 출고 정리 완료\n${plans.length}개 항목의 재고를 반영했습니다.`)
}

const _v18AllocationBase=renderAllocationV15;
renderAllocationV15=function(){
  _v18AllocationBase();const page=document.getElementById('page-allocation');if(!page)return;let bar=page.querySelector('.photo-out-action-v18');if(!bar){bar=document.createElement('div');bar.className='photo-out-action-v18';bar.innerHTML=`<div><b>사진으로 출고 정리</b><span>제품명과 수량을 적은 메모 사진을 읽어 자동 매칭 → 수정 → 최종 확인 후 재고 차감</span></div><button class="primary" onclick="openPhotoOutboundV18()">📷 사진 출고 정리</button>`;page.prepend(bar)}
}

const _v18RenderBase=render;
render=function(){ensureV18Data();_v18RenderBase();if(S.page==='products')renderProducts();if(S.page==='inventory')renderInventory();if(S.page==='allocation'){renderAllocationV15();setPageMeta('출고 정리','거래 출고·반품 또는 사진 메모로 재고를 정리합니다.')}}

/* ===== v19 bulk import progress/result + compact product view selector ===== */
function v19FmtTime(sec){sec=Math.max(0,Math.round(Number(sec)||0));if(sec<60)return `${sec}초`;const m=Math.floor(sec/60),s=sec%60;return `${m}분 ${s}초`}
function v19SetImportProgress(done,total,start,label='등록 중'){
  const box=document.getElementById('bulkProgressV19');if(!box)return;const elapsed=Math.max(.1,(Date.now()-start)/1000),rate=done/elapsed,pct=total?Math.round(done/total*100):0,remain=rate>0?(total-done)/rate:0;
  box.classList.remove('hidden');box.innerHTML=`<div class="bulk-progress-head-v19"><b>${label}</b><strong>${done} / ${total} · ${pct}%</strong></div><div class="bulk-progress-bar-v19"><i style="width:${pct}%"></i></div><div class="bulk-progress-stats-v19"><span>경과 ${v19FmtTime(elapsed)}</span><span>${rate.toFixed(rate<10?1:0)}개/초</span><span>예상 남은시간 ${done>=total?'0초':v19FmtTime(remain)}</span></div>`;
}
triggerExcel=function(){
  document.getElementById('modalBody').innerHTML=`<h2>Excel + 이미지 대량등록</h2><div class="card bulk-import-card"><p><b>1.</b> Excel 파일을 선택하고 <b>2.</b> Excel에 적은 이미지 파일들을 한 번에 선택하세요.</p><p class="muted">대표이미지는 Excel의 <b>대표이미지</b> 열 파일명과 자동 연결됩니다. 파일명이 맞지 않으면 완료 결과에서 누락 제품을 확인할 수 있습니다.</p><div class="toolbar"><button class="secondary" onclick="downloadProductTemplate()">등록용 Excel 양식 다운로드</button></div><label>Excel 파일<input id="bulkExcel" type="file" accept=".xlsx,.xls,.csv"></label><label>이미지 파일들<input id="bulkImages" type="file" accept="image/*" multiple></label><div class="muted">필요한 대표/상세 이미지를 모두 한 번에 선택하세요.</div><div id="bulkProgressV19" class="bulk-progress-v19 hidden"></div><div id="bulkResultV19"></div><div class="toolbar" style="margin-top:16px"><button id="bulkRunV19" class="primary" onclick="runBulkImport()">대량등록 실행</button><button class="secondary" onclick="closeModal()">닫기</button></div></div>`;document.getElementById('modal').classList.remove('hidden')
}
runBulkImport=async function(){
  const xf=document.getElementById('bulkExcel')?.files?.[0];if(!xf)return alert('Excel 파일을 선택하세요.');
  const run=document.getElementById('bulkRunV19');if(run){run.disabled=true;run.textContent='등록 진행 중...'}
  const imgs=[...(document.getElementById('bulkImages')?.files||[])],imageMap=new Map(imgs.map(f=>[f.name.trim().toLowerCase(),f]));
  const arr=await xf.arrayBuffer(),wb=XLSX.read(arr,{type:'array'}),rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''}),total=rows.length,start=Date.now();
  const readImg=f=>new Promise(res=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>res('');r.readAsDataURL(f)});
  let add=0,upd=0,imgLinked=0,skipped=0,failed=0;const missing=[],errors=[];v19SetImportProgress(0,total,start,'등록 준비 중');
  for(let ri=0;ri<rows.length;ri++){
    const row=rows[ri];try{
      const name=String(row['제품명']||row.name||'').trim();if(!name){skipped++;errors.push(`${ri+2}행: 제품명 없음`);v19SetImportProgress(ri+1,total,start);continue}
      let p=S.data.products.find(x=>x.name===name),isNew=!p;if(!p)p={id:uid('p'),image:'',detail_notes:[],note_height:620,detail_sections:[],detail_ko:'',detail_id:'',detail_en:''};
      Object.assign(p,{name,group:row['그룹']||row.group||'',material:row['수종']||row['소재']||row.material||'',finish:row['마감']||row.finish||'',weight_g:+(row['무게(g)']||row.weight_g||0),w:+(row.W||row.w||0),d:+(row.D||row.d||0),h:+(row.H||row.h||0),cost:+(row['원가']||row.cost||0),branch_price:+(row['지점가']||row.branch_price||0),wholesale_price:+(row['1차 도매가']||row.wholesale_price||0),sale_price:+(row['판매가']||row.sale_price||0)});p.cbm=+(row.CBM||row.cbm||0)||((p.w*p.d*p.h)/1e9);
      const mainRaw=String(row['대표이미지']||row['이미지']||row.image||'').trim(),mainName=mainRaw.toLowerCase();if(mainName){if(imageMap.has(mainName)){p.image=await readImg(imageMap.get(mainName));imgLinked++}else missing.push(`${name} — ${mainRaw}`)}
      const notes=[];let y=20;for(let i=1;i<=20;i++){const txt=String(row['상세텍스트'+i]||'').trim();if(txt){notes.push({type:'text',text:txt,x:360,y,w:300,h:120});y+=140}const raw=String(row['상세이미지'+i]||'').trim(),nm=raw.toLowerCase();if(nm){if(imageMap.has(nm)){const data=await readImg(imageMap.get(nm));notes.push({type:'image',data,x:20,y:Math.max(20,y-140),w:300,h:220});imgLinked++;y+=240}else missing.push(`${name} — ${raw}`)}}
      if(notes.length){p.detail_notes=notes;p.note_height=Math.max(620,y+40)}if(isNew){S.data.products.push(p);S.data.inventory.push({product_id:p.id,updated_at:now()});add++}else upd++;
    }catch(e){failed++;errors.push(`${ri+2}행: ${String(e?.message||e)}`)}v19SetImportProgress(ri+1,total,start);await new Promise(r=>setTimeout(r,0));
  }
  v19SetImportProgress(total,total,start,'서버 저장 및 동기화 중');let syncOK=true;try{await persist()}catch(e){syncOK=false;errors.push(`서버 저장: ${String(e?.message||e)}`)}render();v19SetImportProgress(total,total,start,syncOK?'등록 및 저장 완료':'등록 완료 · 서버 동기화 확인 필요');
  const result=document.getElementById('bulkResultV19');if(result)result.innerHTML=`<div class="bulk-result-v19 ${syncOK?'ok':'warn'}"><h3>${syncOK?'✓ 대량등록 완료':'⚠ 등록 완료 · 동기화 확인 필요'}</h3><div class="bulk-result-grid-v19"><span>Excel 행 <b>${total}</b></span><span>신규 <b>${add}</b></span><span>업데이트 <b>${upd}</b></span><span>이미지 연결 <b>${imgLinked}</b></span><span>이미지 누락 <b>${missing.length}</b></span><span>건너뜀/실패 <b>${skipped+failed}</b></span></div>${missing.length?`<details><summary>이미지 누락 항목 보기 (${missing.length})</summary><div class="bulk-issue-list-v19">${missing.map(x=>`<div>${escapeHtml(x)}</div>`).join('')}</div></details>`:''}${errors.length?`<details><summary>건너뜀/오류 항목 보기 (${errors.length})</summary><div class="bulk-issue-list-v19">${errors.map(x=>`<div>${escapeHtml(x)}</div>`).join('')}</div></details>`:''}</div>`;
  if(run){run.disabled=false;run.textContent='다시 대량등록'}
}
function v19ViewSelect(){return `<label class="view-select-v19"><select onchange="S.productView=this.value;renderProducts()"><option value="detail" ${S.productView==='detail'?'selected':''}>큰 아이콘</option><option value="name" ${S.productView==='name'?'selected':''}>보통 아이콘</option><option value="image" ${S.productView==='image'?'selected':''}>작은 아이콘</option><option value="deck" ${S.productView==='deck'?'selected':''}>목록 (Deck)</option></select></label>`}
const _v19ProductCard=v18ProductCard;
v18ProductCard=function(p,mode){if(mode==='deck'){const selected=S.selectedProducts.has(p.id)?' selected-product-v18':'';return `<div class="product-deck-row-v19 ${p.discontinued?'discontinued-card':''}${selected}" onclick="openProduct('${p.id}')"><div>${productSelectBox(p.id)}</div><div class="deck-thumb-v19">${imgTag(p)}</div><div><b>${productNameHtml(p)}</b><small>${escapeHtml(p.group||'')} ${p.material?'· '+escapeHtml(p.material):''}</small></div><div>총수량 <b>${totalQty(p.id)}</b></div></div>`}return _v19ProductCard(p,mode)}
const _renderProductsV19=renderProducts;
renderProducts=function(){if(!['detail','name','image','deck'].includes(S.productView))S.productView='name';_renderProductsV19();const row=document.querySelector('#page-products .view-row-v18');if(row){const grp=row.querySelector('.view-folder-group-v18');if(grp)grp.outerHTML=v19ViewSelect()}const grid=document.querySelector('#page-products .product-grid');if(grid&&S.productView==='deck')grid.classList.add('deck-list-v19')}

/* ===== v20 product view exact layouts ===== */
function v20IdName(p){return p.name_id||p.name_idn||p.name_indonesia||p.indonesian_name||p.detail_id||''}
function v20Spec(p){const a=[p.w||p.W,p.d||p.D,p.h||p.H].map(v=>String(v??'').trim());return a.some(Boolean)?a.map(v=>v||'-').join('×'):''}
function v20Stop(e){e.stopPropagation()}
function v20EditBtn(p){return `<button class="product-edit-v20" onclick="event.stopPropagation();openProduct('${p.id}')">수정</button>`}
function v20Card(p,mode){
  const selected=S.selectedProducts.has(p.id)?' selected-product-v18':'';
  const name=productNameHtml(p), spec=v20Spec(p), mat=escapeHtml(p.material||''), fin=escapeHtml(p.finish||''), grp=escapeHtml(p.group||'');
  const info=`<div class="v20-card-name"><b>${name}</b></div><div class="v20-card-line">${grp?grp+' · ':''}${spec||'-'}</div><div class="v20-card-line">${mat||'-'}${fin?' / '+fin:''}</div>`;
  return `<div class="product-card folder-card product-card-v20 product-card-${mode}-v20 ${p.discontinued?'discontinued-card':''}${selected}" onclick="openProduct('${p.id}')"><div class="card-select" onclick="event.stopPropagation()">${productSelectBox(p.id)}</div><div class="folder-image">${imgTag(p)}</div><div class="body">${info}${v20EditBtn(p)}</div></div>`
}
function v20Deck(ps){
  return `<div class="table-wrap product-deck-table-v20"><table><thead><tr><th class="select-col"></th><th>이미지</th><th>한국명</th><th>인니명</th><th>그룹</th><th>규격</th><th>수종</th><th>마감</th><th></th></tr></thead><tbody>${ps.map(p=>`<tr class="${p.discontinued?'discontinued-card':''}" onclick="openProduct('${p.id}')"><td onclick="event.stopPropagation()">${productSelectBox(p.id)}</td><td class="deck-img-cell-v20">${imgTag(p)}</td><td><b>${productNameHtml(p)}</b></td><td>${escapeHtml(v20IdName(p)||'-')}</td><td>${escapeHtml(p.group||'-')}</td><td>${escapeHtml(v20Spec(p)||'-')}</td><td>${escapeHtml(p.material||'-')}</td><td>${escapeHtml(p.finish||'-')}</td><td>${v20EditBtn(p)}</td></tr>`).join('')}</tbody></table></div>`
}
renderProducts=function(){
  ensureV18Data();
  if(!['detail','name','image','deck'].includes(S.productView))S.productView='name';
  let ps=v18SelectionFiltered(sortedProducts()),shown=ps.slice(0,S.pageSize);
  const body=S.productView==='deck'?v20Deck(shown):`<div class="product-grid folder-grid product-view-${S.productView}-v20">${shown.map(p=>v20Card(p,S.productView)).join('')}</div>`;
  document.getElementById('page-products').innerHTML=`<div class="fixed-controls-v18">
    <div class="control-row-v18 primary-row-v18">
      <div class="tabs compact-tabs-v18"><button class="${S.productFilter==='all'?'active':''}" onclick="S.productFilter='all';renderProducts()">전체</button><button class="${S.productFilter==='active'?'active':''}" onclick="S.productFilter='active';renderProducts()">판매제품</button><button class="${S.productFilter==='discontinued'?'active':''}" onclick="S.productFilter='discontinued';renderProducts()">단종제품</button><button class="${S.productSelectionFilter==='selected'?'active':''}" onclick="S.productSelectionFilter=S.productSelectionFilter==='selected'?'all':'selected';renderProducts()">선택 ${S.selectedProducts.size?`(${S.selectedProducts.size})`:''}</button></div>
      <label class="control-select-v18">정렬 <select onchange="S.productSort=this.value;renderProducts()"><option value="registered" ${S.productSort==='registered'?'selected':''}>등록순</option><option value="name" ${S.productSort==='name'?'selected':''}>이름순</option><option value="groupname" ${S.productSort==='groupname'?'selected':''}>그룹 + 이름순</option></select></label><span class="control-count-v18">${shown.length} / ${ps.length}개</span>
    </div>
    <div class="control-row-v18 action-row-v18"><button class="secondary" onclick="selectAllVisibleProducts(true);renderProducts()">전체선택</button><button class="secondary" onclick="S.selectedProducts.clear();S.productSelectionFilter='all';renderProducts()">선택해제</button><button class="secondary" onclick="moveSelectedProducts(-1)">↑ 위로</button><button class="secondary" onclick="moveSelectedProducts(1)">↓ 아래로</button><button class="danger" onclick="deleteSelectedProducts()">선택삭제</button></div>
    <div class="control-row-v18 view-row-v18"><div class="view-select-v19"><select onchange="S.productView=this.value;renderProducts()"><option value="detail" ${S.productView==='detail'?'selected':''}>큰 아이콘</option><option value="name" ${S.productView==='name'?'selected':''}>보통 아이콘</option><option value="image" ${S.productView==='image'?'selected':''}>작은 아이콘</option><option value="deck" ${S.productView==='deck'?'selected':''}>목록 (Deck)</option></select></div><label class="page-size-v18">표시수 <select onchange="S.pageSize=+this.value;renderProducts()">${[10,20,50,100].map(n=>`<option ${S.pageSize===n?'selected':''}>${n}</option>`).join('')}</select></label></div>
  </div>${body}${productHistoryHtmlV10()}`;
}

/* ===== v23 FINAL VERIFIED UI / MOBILE / SAFE SYNC PATCH =====
   Canonical product list UI requested by user.
   This block intentionally runs last so earlier experimental renderers cannot override it.
*/
(function(){
  const VERSION='24.0.0';
  window.NAYESO_VERSION=VERSION;

  function v23Size(p){
    const vals=[p?.w??p?.W,p?.d??p?.D,p?.h??p?.H].map(v=>String(v??'').trim());
    return vals.some(Boolean)?vals.map(v=>v||'-').join(' × '):'-';
  }
  function v23IdName(p){return p?.name_id||p?.name_idn||p?.name_indonesia||p?.indonesian_name||''}
  function v23Info(p,compact=false){
    const group=escapeHtml(p?.group||'-'), spec=escapeHtml(v23Size(p));
    const material=escapeHtml(p?.material||'-'), finish=escapeHtml(p?.finish||'-');
    return `<div class="v23-product-name"><b>${productNameHtml(p)}</b></div>
      <div class="v23-product-meta">${group} · ${spec}</div>
      <div class="v23-product-meta">${material}${finish&&finish!=='-'?' / '+finish:''}</div>
      ${compact?'':`<div class="v23-product-stock">총수량 <b>${totalQty(p.id)}</b></div>`}`;
  }
  function v23Card(p,mode){
    const selected=S.selectedProducts.has(p.id)?' selected-product-v18':'';
    return `<article class="product-card v23-card v23-card-${mode} ${p.discontinued?'discontinued-card':''}${selected}" onclick="openProduct('${p.id}')">
      <div class="card-select" onclick="event.stopPropagation()">${productSelectBox(p.id)}</div>
      <div class="v23-card-image">${imgTag(p)}</div>
      <div class="v23-card-body">${v23Info(p,false)}
        <button class="product-edit-v20 v23-edit" onclick="event.stopPropagation();openProduct('${p.id}')">수정</button>
      </div>
    </article>`;
  }
  function v23Deck(ps){
    // Desktop/tablet follows the user's folder/list example. Mobile switches to readable rows, without removing information.
    return `<div class="v23-deck-desktop table-wrap"><table class="v23-deck-table"><thead><tr>
      <th class="select-col">선택</th><th>이미지</th><th>제품명</th><th>인니명</th><th>그룹</th><th>규격</th><th>수종</th><th>마감</th><th>수량</th><th></th>
      </tr></thead><tbody>${ps.map(p=>`<tr class="${p.discontinued?'discontinued-card':''}" onclick="openProduct('${p.id}')">
      <td onclick="event.stopPropagation()">${productSelectBox(p.id)}</td><td class="v23-deck-img">${imgTag(p)}</td>
      <td><b>${productNameHtml(p)}</b></td><td>${escapeHtml(v23IdName(p)||'-')}</td><td>${escapeHtml(p.group||'-')}</td><td>${escapeHtml(v23Size(p))}</td>
      <td>${escapeHtml(p.material||'-')}</td><td>${escapeHtml(p.finish||'-')}</td><td><b>${totalQty(p.id)}</b></td>
      <td><button class="secondary v23-deck-edit" onclick="event.stopPropagation();openProduct('${p.id}')">수정</button></td></tr>`).join('')}</tbody></table></div>
      <div class="v23-deck-mobile">${ps.map(p=>`<div class="v23-mobile-row ${p.discontinued?'discontinued-card':''}" onclick="openProduct('${p.id}')">
        <div class="v23-mobile-check" onclick="event.stopPropagation()">${productSelectBox(p.id)}</div>
        <div class="v23-mobile-img">${imgTag(p)}</div><div class="v23-mobile-info">${v23Info(p,false)}</div>
        <button class="secondary" onclick="event.stopPropagation();openProduct('${p.id}')">수정</button>
      </div>`).join('')}</div>`;
  }
  function v23VisibleProducts(){
    let ps=sortedProducts();
    ps=v18SelectionFiltered(ps);
    return ps;
  }
  function v23ViewSelector(){
    return `<label class="v23-view-select"><span>보기</span><select id="productViewV23" onchange="S.productView=this.value;renderProducts()">
      <option value="detail" ${S.productView==='detail'?'selected':''}>큰 아이콘</option>
      <option value="name" ${S.productView==='name'?'selected':''}>보통 아이콘</option>
      <option value="image" ${S.productView==='image'?'selected':''}>작은 아이콘</option>
      <option value="deck" ${S.productView==='deck'?'selected':''}>목록 (Deck)</option>
      </select></label>`;
  }

  // Final canonical product renderer.
  renderProducts=function(){
    ensureV18Data();
    if(!['detail','name','image','deck'].includes(S.productView))S.productView='name';
    const ps=v23VisibleProducts(), shown=ps.slice(0,Number(S.pageSize||20));
    const body=S.productView==='deck'?v23Deck(shown):`<div class="v23-product-grid v23-grid-${S.productView}">${shown.map(p=>v23Card(p,S.productView)).join('')}</div>`;
    const root=document.getElementById('page-products'); if(!root)return;
    root.innerHTML=`<div class="fixed-controls-v18 v23-product-controls">
      <div class="v23-toolbar v23-toolbar-top">
        <div class="tabs compact-tabs-v18 v23-filter-tabs">
          <button class="${S.productFilter==='all'?'active':''}" onclick="S.productFilter='all';renderProducts()">전체</button>
          <button class="${S.productFilter==='active'?'active':''}" onclick="S.productFilter='active';renderProducts()">판매제품</button>
          <button class="${S.productFilter==='discontinued'?'active':''}" onclick="S.productFilter='discontinued';renderProducts()">단종제품</button>
          <button class="${S.productSelectionFilter==='selected'?'active':''}" onclick="S.productSelectionFilter=S.productSelectionFilter==='selected'?'all':'selected';renderProducts()">선택${S.selectedProducts.size?' ('+S.selectedProducts.size+')':''}</button>
        </div>
        <label class="control-select-v18 v23-sort">정렬 <select onchange="S.productSort=this.value;renderProducts()">
          <option value="registered" ${S.productSort==='registered'?'selected':''}>등록순</option><option value="name" ${S.productSort==='name'?'selected':''}>이름순</option><option value="groupname" ${S.productSort==='groupname'?'selected':''}>그룹 + 이름순</option>
        </select></label><span class="v23-count">${shown.length} / ${ps.length}개</span>
      </div>
      <div class="v23-toolbar v23-selection-actions">
        <button class="secondary" onclick="selectAllVisibleProducts(true);renderProducts()">전체선택</button><button class="secondary" onclick="S.selectedProducts.clear();S.productSelectionFilter='all';renderProducts()">선택해제</button><button class="secondary" onclick="moveSelectedProducts(-1)">↑ 위로</button><button class="secondary" onclick="moveSelectedProducts(1)">↓ 아래로</button><button class="danger" onclick="deleteSelectedProducts()">선택삭제</button>
      </div>
      <div class="v23-toolbar v23-viewbar">${v23ViewSelector()}<label class="v23-page-size">표시수 <select onchange="S.pageSize=+this.value;renderProducts()">${[10,20,50,100].map(n=>`<option value="${n}" ${Number(S.pageSize)===n?'selected':''}>${n}</option>`).join('')}</select></label></div>
    </div>${body}${productHistoryHtmlV10()}`;
  };

  // Keep inventory controls in the same visual order as Product DB while preserving inventory editing behavior.
  const previousInventory=renderInventory;
  renderInventory=function(){
    previousInventory();
    const root=document.getElementById('page-inventory'); if(!root)return;
    const ctrl=root.querySelector('.fixed-controls-v18'); if(ctrl)ctrl.classList.add('v23-inventory-controls');
  };

  // ---- Version-update data protection ----
  // Keep rolling local recovery snapshots. They are NOT the source of truth for normal sync;
  // they exist only to prevent a bad deployment/server response from silently destroying a populated browser copy.
  function v23DataScore(d){
    if(!d||typeof d!=='object')return -1;
    const keys=['products','inventory','customers','invoices','stock_logs'];
    return keys.reduce((s,k)=>s+(Array.isArray(d[k])?d[k].length:0),0);
  }
  function v23Snapshot(reason){
    try{
      if(!S?.data||v23DataScore(S.data)<0)return;
      const key='nayeso_recovery_v23';
      const arr=JSON.parse(localStorage.getItem(key)||'[]');
      arr.unshift({at:new Date().toISOString(),reason,version:VERSION,data:clone(S.data)});
      localStorage.setItem(key,JSON.stringify(arr.slice(0,5)));
    }catch(e){console.warn('recovery snapshot',e)}
  }
  const oldSaveLocal=saveLocal;
  saveLocal=function(){v23Snapshot('before-local-save'); return oldSaveLocal()};
  window.nayesoRecoveryInfoV23=function(){try{return JSON.parse(localStorage.getItem('nayeso_recovery_v23')||'[]').map(x=>({at:x.at,reason:x.reason,version:x.version,score:v23DataScore(x.data)}))}catch(e){return[]}};

  // Product view choice should survive redraws/reloads on the same device.
  try{
    const pv=localStorage.getItem('nayeso_product_view_v23'); if(['detail','name','image','deck'].includes(pv))S.productView=pv;
    document.addEventListener('change',e=>{if(e.target?.id==='productViewV23')localStorage.setItem('nayeso_product_view_v23',e.target.value)});
  }catch(e){}

  // Render again after all patches are loaded, so the first visible product page also uses v23.
  const oldRender=render;
  render=function(){const r=oldRender(); if(S.page==='products')renderProducts(); return r};
})();



/* ===== v24 AUTHORITATIVE SYNC ENGINE =====
   Based on the stable SEMANGAT direct-REST pattern.
   Supabase app_state(id='main', data jsonb) is the cross-device source of truth.
   localStorage is recovery cache only. A verified empty server may be seeded once
   from a real local dataset, but never from the built-in DEMO sample.
*/
(function(){
  const cfg=window.NAYESO_CONFIG||{};
  const base=String(cfg.SUPABASE_URL||'').trim().replace(/\/+$/,'').replace(/\/rest\/v1.*$/i,'');
  const key=String(cfg.SUPABASE_ANON_KEY||cfg.SUPABASE_KEY||'').trim();
  const valid=/^https:\/\/[^/]+\.supabase\.co$/i.test(base)&&key.length>20;
  const H=(extra={})=>Object.assign({'apikey':key,'Authorization':'Bearer '+key,'Content-Type':'application/json','Accept':'application/json'},extra);
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const score=d=>!d||typeof d!=='object'?-1:['products','inventory','customers','invoices','stock_logs'].reduce((n,k)=>n+(Array.isArray(d[k])?d[k].length:0),0);
  const structurallyValid=d=>!!(d&&typeof d==='object'&&Array.isArray(d.products)&&Array.isArray(d.inventory)&&Array.isArray(d.customers)&&Array.isArray(d.invoices));
  const localKeyExists=()=>localStorage.getItem('nayeso_data_v2')!==null||localStorage.getItem('nayeso_data')!==null;
  const isDemo=d=>{try{return JSON.stringify(d)===JSON.stringify(DEMO)}catch(e){return false}};
  const hasRealLocal=()=>localKeyExists()&&structurallyValid(S.data)&&!isDemo(S.data);
  function bestRecoverySeed(){
    const candidates=[];
    if(structurallyValid(S.data)&&!isDemo(S.data))candidates.push(clone(S.data));
    for(const rk of ['nayeso_recovery_v23']){
      try{for(const x of JSON.parse(localStorage.getItem(rk)||'[]'))if(structurallyValid(x?.data)&&!isDemo(x.data))candidates.push(clone(x.data))}catch(e){}
    }
    candidates.sort((a,b)=>score(b)-score(a));
    return candidates[0]||null;
  }
  const stamp=()=>new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  let ready=false,busy=false,dirty=false,lastAt='',timer=null,writeChain=Promise.resolve(),started=false;

  function blankState(){
    const d=clone(DEMO);
    d.products=[]; d.inventory=[]; d.customers=[]; d.invoices=[]; d.stock_logs=[];
    normalizeForV24(d); return d;
  }
  function normalizeForV24(d){
    if(!d||typeof d!=='object')d={};
    if(!Array.isArray(d.products))d.products=[];
    if(!Array.isArray(d.inventory))d.inventory=[];
    if(!Array.isArray(d.customers))d.customers=[];
    if(!Array.isArray(d.invoices))d.invoices=[];
    if(!Array.isArray(d.stock_logs))d.stock_logs=[];
    if(!Array.isArray(d.locations)||!d.locations.length)d.locations=clone(DEMO.locations);
    if(!Array.isArray(d.invoice_templates)||!d.invoice_templates.length)d.invoice_templates=clone(DEMO.invoice_templates);
    return d;
  }
  function setStatus(text,state='syncing'){
    const old=document.getElementById('syncState');
    if(old){old.textContent=text;old.dataset.state=state;old.title='PC·휴대폰 공용 Supabase 동기화';}
    const badge=document.getElementById('syncBadgeV22'),bt=document.getElementById('syncBadgeTextV22'),tm=document.getElementById('syncBadgeTimeV22');
    if(badge){badge.classList.remove('ok','syncing','error');badge.classList.add(state);badge.title='눌러서 지금 동기화';}
    if(bt)bt.textContent=state==='ok'?'동기화 완료':state==='error'?'동기화 확인 필요':'동기화 중…';
    if(tm)tm.textContent=state==='ok'?('마지막 '+stamp()):text;
  }
  async function readMaster(){
    const r=await fetch(base+'/rest/v1/app_state?id=eq.main&select=data,updated_at',{method:'GET',headers:H(),cache:'no-store'});
    const text=await r.text(); if(!r.ok)throw new Error('DB 읽기 '+r.status+' '+text);
    let a=[];try{a=text?JSON.parse(text):[]}catch(e){throw new Error('DB 응답을 읽을 수 없습니다.')}
    return Array.isArray(a)?a[0]:a;
  }
  async function writeMaster(data){
    normalizeForV24(data);
    const payload={id:'main',data,updated_at:new Date().toISOString()};
    const r=await fetch(base+'/rest/v1/app_state?on_conflict=id',{method:'POST',headers:H({'Prefer':'resolution=merge-duplicates,return=representation'}),body:JSON.stringify(payload),cache:'no-store'});
    const text=await r.text(); if(!r.ok)throw new Error('DB 저장 '+r.status+' '+text);
    let a=[];try{a=text?JSON.parse(text):[]}catch(e){throw new Error('저장 응답을 읽을 수 없습니다.')}
    const row=Array.isArray(a)?a[0]:a; if(!row?.data)throw new Error('저장 확인 데이터가 없습니다.'); return row;
  }
  function applyRemote(row,renderNow=true){
    if(!row?.data||!structurallyValid(row.data))return false;
    S.data=row.data; normalizeData();
    try{ensureV13Data?.();ensureV14Auth?.();ensureV15Data?.();ensureV17Data?.();ensureV18Data?.();pruneHistory?.()}catch(e){console.warn('normalize extras',e)}
    lastAt=row.updated_at||''; dirty=false; saveLocal();
    if(renderNow){try{render();applyRoleUI?.()}catch(e){console.warn('render after cloud',e)}}
    return true;
  }
  async function verifyWritten(expected){
    for(let i=0;i<5;i++){
      const row=await readMaster();
      if(row?.data&&structurallyValid(row.data)&&score(row.data)>=score(expected))return row;
      await wait(120*(i+1));
    }
    throw new Error('서버 저장 확인에 실패했습니다.');
  }
  async function push(){
    if(!valid||!ready||!navigator.onLine)return false;
    const snapshot=clone(S.data); normalizeForV24(snapshot);
    writeChain=writeChain.then(async()=>{
      busy=true; setStatus('저장·동기화 중…','syncing');
      try{
        await writeMaster(snapshot);
        const checked=await verifyWritten(snapshot);
        // If edits occurred during this write, do not replace the newer local state.
        if(!dirty)applyRemote(checked,false); else lastAt=checked.updated_at||lastAt;
        dirty=false; saveLocal(); setStatus('공용 데이터 저장 완료','ok'); return true;
      }catch(e){console.error('V24_PUSH',e);dirty=true;setStatus('저장 실패 · 자동 재시도','error');return false}
      finally{busy=false}
    });
    return writeChain;
  }
  async function pull(force=false){
    if(!valid||!ready||busy||dirty||!navigator.onLine)return false;
    busy=true;
    try{
      const row=await readMaster();
      if(row?.data&&structurallyValid(row.data)){
        if(force||!lastAt||String(row.updated_at)!==String(lastAt))applyRemote(row,true);
        setStatus('공용 데이터 최신','ok');return true;
      }
      setStatus('서버 데이터 형식 확인 필요','error');return false;
    }catch(e){console.error('V24_PULL',e);setStatus('서버 확인 실패 · 재시도','error');return false}
    finally{busy=false}
  }
  async function connect(){
    if(!S.data){try{loadLocal()}catch(e){S.data=clone(DEMO);normalizeData()}}
    if(started&&ready)return pull(true);
    started=true;
    clearInterval(timer);
    if(!valid){setStatus('Streamlit Secrets 확인 필요','error');return false}
    setStatus('공용 데이터 연결 중…','syncing');
    try{
      let row=await readMaster();
      const empty=!row?.data||Object.keys(row.data||{}).length===0;
      const recovery=bestRecoverySeed();
      if(empty){
        const seed=recovery||blankState();
        // GET succeeded, so this is a verified empty/missing master row, not a network/schema error.
        // If v23 left a local recovery snapshot, restore the richest real dataset automatically.
        await writeMaster(seed);
        row=await verifyWritten(seed);
      }else if(row?.data&&isDemo(row.data)&&recovery&&score(recovery)>score(row.data)){
        // Repair an accidental old-version DEMO seed only when a richer local recovery copy exists.
        await writeMaster(recovery);
        row=await verifyWritten(recovery);
      }
      if(!row?.data||!structurallyValid(row.data))throw new Error('app_state/main 데이터 형식이 올바르지 않습니다.');
      applyRemote(row,true); ready=true; S.cloud=true;
      setStatus('공용 데이터 연결 완료','ok');
      timer=setInterval(async()=>{
        if(document.hidden||!navigator.onLine||busy)return;
        if(dirty)await push();else await pull(false);
      },1500);
      return true;
    }catch(e){console.error('V24_CONNECT',e);ready=false;S.cloud=false;setStatus('연결 실패 · 3초 후 재시도','error');setTimeout(()=>{started=false;connect()},3000);return false}
  }

  // Disable all legacy cloud engines. v24 direct REST is the only authority.
  initCloud=async function(){return false};
  v14ConnectCloud=async function(){return false};
  v14Refresh=async function(){return false};
  v14SyncNow=async function(){return false};
  try{clearInterval(S.cloudPollV14)}catch(e){}

  persist=async function(){
    try{ensureV13Data?.();ensureV14Auth?.();ensureV15Data?.();ensureV17Data?.();ensureV18Data?.();pruneHistory?.()}catch(e){console.warn(e)}
    saveLocal(); dirty=true;
    if(!navigator.onLine){setStatus('오프라인 · 기기에 임시 저장','error');return false}
    if(!ready){await connect(); if(!ready)return false}
    return push();
  };

  window.NAYESO_SYNC_V24={connect,pull,push,status:()=>({ready,busy,dirty,lastAt})};
  const manual=async()=>{if(!navigator.onLine){setStatus('오프라인','error');return} if(!ready)await connect(); else if(dirty)await push(); else await pull(true)};
  function bind(){
    const badge=document.getElementById('syncBadgeV22'); if(badge&&!badge.dataset.v24){badge.dataset.v24='1';badge.addEventListener('click',manual)}
  }
  window.addEventListener('focus',()=>{if(ready){dirty?push():pull(true)}else connect()});
  window.addEventListener('online',()=>{setStatus('온라인 · 동기화 중…','syncing');ready?(dirty?push():pull(true)):connect()});
  window.addEventListener('offline',()=>setStatus('오프라인 · 기기에 임시 저장','error'));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){ready?(dirty?push():pull(true)):connect()}});
  // Start immediately as well as on DOM ready. This fixes the endless '연결 확인 중' case in Streamlit components.
  bind(); setTimeout(connect,80);
  document.addEventListener('DOMContentLoaded',()=>{bind();setTimeout(connect,20)},{once:true});
})();
