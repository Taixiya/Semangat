import io
import json
import hashlib
import uuid
from datetime import datetime, timezone

import pandas as pd
import streamlit as st
from supabase import create_client

st.set_page_config(page_title="Production Manager", page_icon="📦", layout="wide", initial_sidebar_state="expanded")

# ============================== STYLE ==============================
CSS = """
<style>
:root{--nav:#17212e;--blue:#2563eb;--pale:#eef4ff;--line:#d9e1ea;--muted:#64748b;--bg:#f5f7fb;--danger:#dc2626}
html,body,[data-testid="stAppViewContainer"]{background:var(--bg)}
[data-testid="stHeader"]{background:transparent;height:0}
[data-testid="stToolbar"]{right:8px;top:4px}
[data-testid="stSidebar"]{background:#fff;border-right:1px solid var(--line);min-width:214px;max-width:214px}
[data-testid="stSidebar"] [data-testid="stVerticalBlock"]{gap:.25rem}
[data-testid="stSidebar"] *{color:#0f172a}
.brand{font-size:22px;font-weight:900;letter-spacing:.04em;padding:8px 6px 18px}
.topbar{background:var(--nav);color:#fff;margin:-1rem -1rem 1.2rem -1rem;padding:18px 24px;border-radius:0}
.topbar h1{font-size:22px;margin:0;color:#fff}.topbar p{font-size:12px;color:#cbd5e1;margin:5px 0 0}
.login-wrap{max-width:760px;margin:7vh auto 0;background:white;border:1px solid var(--line);border-radius:16px;padding:30px;box-shadow:0 10px 35px rgba(15,23,42,.06)}
.login-title{font-size:31px;font-weight:900;margin-bottom:8px}.login-sub{color:var(--muted);margin-bottom:16px}
[data-testid="stButton"] button{border-radius:9px;min-height:39px;border:1px solid var(--line)}
[data-testid="stSidebar"] [data-testid="stButton"] button{justify-content:flex-start;width:100%;border:0;background:transparent;padding:10px 12px}
[data-testid="stSidebar"] [data-testid="stButton"] button:hover{background:var(--pale);color:var(--blue)}
.metric-card{background:#fff;border:1px solid var(--line);border-radius:12px;padding:16px}.metric-card small{color:var(--muted)}.metric-card strong{font-size:27px;display:block;margin-top:7px}
.card{background:#fff;border:1px solid var(--line);border-radius:12px;padding:14px;margin-bottom:12px}
.muted{color:var(--muted)}
.status-ok{background:#ecfdf5;color:#047857;border-radius:8px;padding:8px 10px;font-size:12px}.status-bad{background:#fff7ed;color:#c2410c;border-radius:8px;padding:8px 10px;font-size:12px}
img{object-fit:contain!important}
[data-testid="stDataFrame"]{background:#fff;border:1px solid var(--line);border-radius:10px;overflow:hidden}
.stTabs [data-baseweb="tab-list"]{gap:6px}.stTabs [data-baseweb="tab"]{background:white;border:1px solid var(--line);border-radius:8px;padding:8px 12px}
@media(max-width:780px){
 [data-testid="stSidebar"]{min-width:185px;max-width:185px}.topbar{padding:14px 16px}.topbar h1{font-size:18px}.topbar p{display:none}
 .login-wrap{margin:1vh auto;padding:18px}.login-title{font-size:26px}
 [data-testid="column"]{min-width:0!important}
}
</style>
"""
st.markdown(CSS, unsafe_allow_html=True)

# ============================== DATA ==============================
DEFAULT_ADMIN_HASH = hashlib.sha256("1082".encode()).hexdigest()
BLANK = {
    "products": [], "boxes": [], "orders": [], "completed": [], "shipments": [],
    "inventory": [], "workers": [], "groups": ["PLATE", "PLATEBOARD", "TRAY"],
    "loginUsers": [], "adminConfig": [{"id":"admin", "passwordHash":DEFAULT_ADMIN_HASH}], "logs": []
}

def uid(): return str(uuid.uuid4())
def now_iso(): return datetime.now(timezone.utc).isoformat()
def clone(x): return json.loads(json.dumps(x, ensure_ascii=False))
def htxt(s): return hashlib.sha256(str(s).encode()).hexdigest()
def num(v, default=0):
    try: return float(v)
    except: return default

def normalize(data):
    if not isinstance(data, dict): data={}
    for k,v in BLANK.items():
        if k not in data or data[k] is None: data[k]=clone(v)
    return data

def make_sb():
    try:
        url=st.secrets.get("SUPABASE_URL","").strip()
        key=st.secrets.get("SUPABASE_KEY","").strip()
        if not url or not key: return None, "Secrets SUPABASE_URL / SUPABASE_KEY belum diisi"
        return create_client(url,key), None
    except Exception as e: return None, str(e)

SB, SB_INIT_ERR = make_sb()

def load_state():
    if SB is None: return clone(BLANK), SB_INIT_ERR or "Supabase belum tersambung"
    try:
        # maybe_single() intentionally avoided: some PostgREST versions reject its path.
        res=SB.table("app_state").select("data,updated_at").eq("id","main").limit(1).execute()
        rows=res.data or []
        if rows:
            return normalize(rows[0].get("data") or {}), None
        payload={"id":"main","data":clone(BLANK),"updated_at":now_iso()}
        SB.table("app_state").insert(payload).execute()
        return clone(BLANK), None
    except Exception as e:
        return clone(BLANK), f"{type(e).__name__}: {e}"

def save_state(data,label="Perubahan data"):
    if SB is None:
        st.error("Supabase belum tersambung."); return False
    try:
        data=normalize(data)
        data["logs"].insert(0,{"id":uid(),"at":now_iso(),"actor":st.session_state.get("actor","") if st.session_state.get("role")!="admin" else "","label":label})
        data["logs"]=data["logs"][:500]
        payload={"id":"main","data":data,"updated_at":now_iso()}
        # Use upsert against the primary key, no unsupported single-row helper.
        SB.table("app_state").upsert(payload,on_conflict="id").execute()
        st.session_state.data=data
        st.session_state.cloud_error=None
        return True
    except Exception as e:
        st.error(f"Gagal menyimpan: {type(e).__name__}: {e}")
        return False

def refresh():
    d,e=load_state(); st.session_state.data=d; st.session_state.cloud_error=e; return d

def upload_image(file, folder="products"):
    if SB is None or file is None: return ""
    safe=(file.name or "image.jpg").replace("/","_").replace("\\","_")
    ext=safe.rsplit(".",1)[-1].lower() if "." in safe else "jpg"
    path=f"{folder}/{datetime.now().strftime('%Y%m')}/{uid()}.{ext}"
    try:
        content=file.getvalue()
        opts={"content-type":file.type or "image/jpeg","upsert":"true"}
        SB.storage.from_("product-images").upload(path,content,file_options=opts)
        return SB.storage.from_("product-images").get_public_url(path)
    except Exception as e:
        st.warning(f"Upload gambar gagal: {type(e).__name__}: {e}")
        return ""

def init_session():
    st.session_state.setdefault("role",None)
    st.session_state.setdefault("actor","")
    st.session_state.setdefault("page","Beranda")
    if "data" not in st.session_state: refresh()
init_session()

# ============================== LAYOUT ==============================
def topbar(title,sub=""):
    st.markdown(f'<div class="topbar"><h1>{title}</h1><p>{sub}</p></div>',unsafe_allow_html=True)

def login_screen():
    st.markdown('<div class="login-wrap"><div class="login-title">SEMANGAT</div><div class="login-sub">Pilih cara masuk.</div></div>',unsafe_allow_html=True)
    st.write("")
    a,b=st.columns(2)
    data=st.session_state.data
    with a:
        with st.container(border=True):
            st.subheader("Login Umum")
            st.caption("Pekerja memilih nama lalu langsung masuk")
            names=[u.get("name","") for u in data.get("loginUsers",[]) if u.get("active",True)]
            name=st.selectbox("Nama Pekerja",[""]+names,key="login_name")
            if st.button("Login Umum",use_container_width=True,type="primary"):
                if name:
                    st.session_state.role="worker"; st.session_state.actor=name; st.session_state.page="Beranda"; st.rerun()
                st.warning("Pilih nama pekerja.")
    with b:
        with st.container(border=True):
            st.subheader("Login Admin")
            st.caption("Pengaturan dan pengelolaan pengguna")
            pwd=st.text_input("Password",type="password",key="login_admin_pwd")
            if st.button("Login Admin",use_container_width=True):
                ah=next((x.get("passwordHash") for x in data.get("adminConfig",[]) if x.get("id")=="admin"),DEFAULT_ADMIN_HASH)
                if htxt(pwd)==ah:
                    st.session_state.role="admin"; st.session_state.actor=""; st.session_state.page="Beranda"; st.rerun()
                st.error("Password salah.")
    if st.session_state.get("cloud_error"):
        st.error("Koneksi Supabase gagal: "+st.session_state.cloud_error)

def sidebar():
    with st.sidebar:
        st.markdown('<div class="brand">SEMANGAT</div>',unsafe_allow_html=True)
        pages=["Beranda","DB Produk","DB Box","Order","Produk Selesai","Stok Produk","DB Pekerja","Pengiriman"]
        if st.session_state.role=="admin": pages.append("Pengaturan")
        for p in pages:
            if st.button(p,key=f"nav_{p}",use_container_width=True):
                st.session_state.page=p; st.rerun()
        st.write("")
        if st.button("↻ Muat data terbaru",use_container_width=True): refresh(); st.rerun()
        ok=SB is not None and not st.session_state.get("cloud_error")
        st.markdown(f'<div class="{"status-ok" if ok else "status-bad"}">{"Cloud tersambung" if ok else "Cloud belum tersambung"}</div>',unsafe_allow_html=True)
        if st.button("Keluar",use_container_width=True):
            st.session_state.role=None; st.session_state.actor=""; st.rerun()

# ============================== PAGES ==============================
def dashboard(data):
    topbar("Beranda","Ringkasan produksi dan data terbaru")
    active=[o for o in data["orders"] if not o.get("archived")]
    items=[i for o in active for i in o.get("items",[]) if num(i.get("qty"))>0]
    otypes=len({i.get("productId") for i in items}); oqty=int(sum(num(i.get("qty")) for i in items))
    ctypes=len({c.get("productId") for c in data["completed"]}); cqty=int(sum(num(c.get("totalQty")) for c in data["completed"]))
    vals=[("Total Produk",len(data["products"]),"jenis"),("Total Box",len(data["boxes"]),"jenis"),("Order",otypes,f"jenis · {oqty} pcs"),("Produk Selesai",ctypes,f"jenis · {cqty} pcs")]
    cols=st.columns(4)
    for col,(lab,val,sub) in zip(cols,vals):
        col.markdown(f'<div class="metric-card"><small>{lab}</small><strong>{val}</strong><div class="muted">{sub}</div></div>',unsafe_allow_html=True)
    st.write("")
    st.subheader("Produk Terbaru")
    for row_start in range(0,min(6,len(data["products"])),3):
        cols=st.columns(3)
        for col,p in zip(cols,data["products"][row_start:row_start+3]):
            with col:
                with st.container(border=True):
                    if p.get("image"): st.image(p["image"],height=150)
                    st.write(f"**{p.get('name','')}**")
                    st.caption(f"{p.get('group','')} · {p.get('wood','')} · {p.get('finish','')}")

def product_excel_import(data):
    f=st.file_uploader("File Excel Produk",type=["xlsx","xls","csv"],key="prod_excel")
    if f and st.button("Impor Excel",key="prod_excel_go"):
        try:
            df=pd.read_csv(f) if f.name.lower().endswith('.csv') else pd.read_excel(f)
            latest,_=load_state(); added=0
            for _,r in df.fillna("").iterrows():
                name=str(r.get("제품명",r.get("Nama Produk",""))).strip()
                if not name: continue
                w=num(r.get("W",0)); d=num(r.get("D",0)); h=num(r.get("H",0))
                latest["products"].append({"id":uid(),"name":name,"group":str(r.get("그룹",r.get("Grup",""))),"w":w,"d":d,"h":h,"weight_g":num(r.get("무게(g)",r.get("Berat(g)",0))),"wood":str(r.get("수종",r.get("Jenis Kayu",""))),"finish":str(r.get("마감",r.get("Finishing",""))),"unitPrice":num(r.get("단가",r.get("Harga Satuan",0))),"image":"","imageFilename":str(r.get("이미지",r.get("Gambar",""))),"cbm":num(r.get("CBM",w*d*h/1e9)),"parts":[],"makers":[],"details":[]})
                added+=1
            if added and save_state(latest,f"Impor Excel produk {added}"): st.success(f"{added} produk berhasil diimpor."); st.rerun()
        except Exception as e: st.error(f"Impor gagal: {e}")

def products_page(data):
    topbar("DB Produk","Data produk, gambar, ukuran, bahan, harga, komponen dan pembuat")
    tabs=st.tabs(["Daftar Produk","+ Produk Baru","Impor Excel"])
    with tabs[1]:
        with st.form("product_add",clear_on_submit=True):
            a,b=st.columns([2,1]); name=a.text_input("Nama Produk *"); group=b.selectbox("Grup",[""]+data["groups"])
            a,b,c=st.columns(3); w=a.number_input("W (mm)",0.0); d=b.number_input("D (mm)",0.0); h=c.number_input("H (mm)",0.0)
            a,b,c=st.columns(3); weight=a.number_input("Berat (g)",0.0); wood=b.text_input("Jenis Kayu"); finish=c.text_input("Finishing")
            a,b=st.columns(2); price=a.number_input("Harga Satuan",0.0); cbm=b.number_input("CBM",0.0,format="%.6f",help="0이면 W×D×H로 자동 계산")
            img=st.file_uploader("Gambar Produk",type=["jpg","jpeg","png","webp"])
            parts=st.text_area("Komponen tambahan (1 baris 1개: nama | ukuran | qty)")
            makers=st.text_area("Pembuat & harga produksi (1 baris 1개: nama pekerja | harga)")
            if st.form_submit_button("Simpan Produk",type="primary"):
                if not name.strip(): st.warning("Nama produk wajib diisi.")
                else:
                    latest,_=load_state(); image=upload_image(img,"products") if img else ""
                    part_rows=[]
                    for line in parts.splitlines():
                        z=[x.strip() for x in line.split("|")]
                        if z and z[0]: part_rows.append({"id":uid(),"name":z[0],"size":z[1] if len(z)>1 else "","qty":int(num(z[2],1)) if len(z)>2 else 1})
                    maker_rows=[]
                    for line in makers.splitlines():
                        z=[x.strip() for x in line.split("|")]
                        if z and z[0]: maker_rows.append({"id":uid(),"workerName":z[0],"price":num(z[1],0) if len(z)>1 else 0})
                    latest["products"].insert(0,{"id":uid(),"name":name.strip(),"group":group,"w":w,"d":d,"h":h,"weight_g":weight,"wood":wood,"finish":finish,"unitPrice":price,"image":image,"imageFilename":getattr(img,"name","") if img else "","cbm":cbm if cbm>0 else w*d*h/1e9,"parts":part_rows,"makers":maker_rows,"details":[]})
                    if save_state(latest,"Tambah produk"): st.success("Produk disimpan."); st.rerun()
    with tabs[2]: product_excel_import(data)
    with tabs[0]:
        a,b,c,d=st.columns([2,1,1,1]); q=a.text_input("Cari Produk"); gf=b.selectbox("Filter Grup",["Semua"]+data["groups"]); sort=c.selectbox("Urut",["Nama A-Z","Nama Z-A","Grup + Nama"]); view=d.selectbox("Tampilan",["Detail","Nama","Galeri"])
        rows=[p for p in data["products"] if (not q or q.lower() in p.get("name","").lower()) and (gf=="Semua" or p.get("group")==gf)]
        if sort=="Nama A-Z": rows.sort(key=lambda x:x.get("name","").lower())
        elif sort=="Nama Z-A": rows.sort(key=lambda x:x.get("name","").lower(),reverse=True)
        else: rows.sort(key=lambda x:(x.get("group",""),x.get("name","").lower()))
        if view=="Galeri":
            for s in range(0,len(rows),4):
                cols=st.columns(4)
                for col,p in zip(cols,rows[s:s+4]):
                    with col:
                        with st.container(border=True):
                            if p.get("image"): st.image(p["image"],height=150)
                            st.caption(p.get("name",""))
        else:
            for p in rows:
                with st.container(border=True):
                    cols=st.columns([1,4,1])
                    with cols[0]:
                        if p.get("image"): st.image(p["image"],height=100)
                    with cols[1]:
                        st.write(f"**{p.get('name','')}**")
                        if view=="Detail":
                            st.caption(f"{p.get('group','')} · {p.get('w',0)}×{p.get('d',0)}×{p.get('h',0)} mm · {p.get('wood','')} · {p.get('finish','')}")
                            st.write(f"Berat {p.get('weight_g',0)} g · CBM {num(p.get('cbm')):.6f} · Harga {num(p.get('unitPrice')):,.0f}")
                    with cols[2]:
                        if st.session_state.role=="admin" and st.button("Hapus",key="delp_"+p["id"]):
                            latest,_=load_state(); latest["products"]=[x for x in latest["products"] if x["id"]!=p["id"]]; save_state(latest,"Hapus produk"); st.rerun()

def boxes_page(data):
    topbar("DB Box","Ukuran box, harga, stok dan produk kompatibel")
    with st.expander("+ Box Baru"):
        with st.form("box_add",clear_on_submit=True):
            a,b,c=st.columns(3); w=a.number_input("W (mm)",0.0); d=b.number_input("D (mm)",0.0); h=c.number_input("H (mm)",0.0)
            a,b,c=st.columns(3); price=a.number_input("Harga",0.0); qty=b.number_input("Stok",0,step=1); bw=c.number_input("Berat Box (g)",0.0)
            a,b=st.columns(2); workplace=a.text_input("Tempat Kerja"); phone=b.text_input("Kontak")
            pmap={p["id"]:p["name"] for p in data["products"]}; compatibles=st.multiselect("Produk kompatibel",list(pmap),format_func=lambda x:pmap[x])
            if st.form_submit_button("Simpan Box"):
                latest,_=load_state(); latest["boxes"].append({"id":uid(),"name":f"{int(w)}x{int(d)}x{int(h)}","w":w,"d":d,"h":h,"price":price,"qty":qty,"weight_g":bw,"workplace":workplace,"phone":phone,"productIds":compatibles}); save_state(latest,"Tambah box"); st.rerun()
    if data["boxes"]:
        st.dataframe(pd.DataFrame([{"Box":b.get("name") or f"{b.get('w')}x{b.get('d')}x{b.get('h')}","Harga":b.get("price",0),"Stok":b.get("qty",0),"Berat(g)":b.get("weight_g",0),"Tempat":b.get("workplace","") } for b in data["boxes"]]),use_container_width=True,hide_index=True)

def orders_page(data):
    topbar("Order","Order aktif otomatis berkurang saat produk selesai dicatat")
    pmap={p["id"]:p for p in data["products"]}; wmap={w["id"]:w for w in data["workers"]}
    with st.expander("+ Order Baru"):
        worker=st.selectbox("Pekerja",[""]+list(wmap),format_func=lambda x:wmap.get(x,{}).get("name","Pilih pekerja"),key="ord_worker")
        pids=st.multiselect("Produk",list(pmap),format_func=lambda x:pmap[x].get("name",""),key="ord_pids")
        qtys={pid:st.number_input(f"Qty · {pmap[pid]['name']}",1,step=1,key="ordq_"+pid) for pid in pids}
        note=st.text_input("Catatan",key="ord_note")
        if st.button("Simpan Order",type="primary"):
            if not pids: st.warning("Pilih produk.")
            else:
                latest,_=load_state(); latest["orders"].append({"id":uid(),"orderNo":datetime.now().strftime("%y%m%d"),"createdAt":now_iso(),"workerId":worker,"note":note,"archived":False,"items":[{"id":uid(),"productId":pid,"qty":int(qtys[pid]),"initialQty":int(qtys[pid]),"note":""} for pid in pids]}); save_state(latest,"Tambah order"); st.rerun()
    for o in [x for x in data["orders"] if not x.get("archived")]:
        with st.container(border=True):
            st.write(f"### Order {o.get('orderNo','')}")
            st.caption(wmap.get(o.get("workerId"),{}).get("name","") + (" · "+o.get("note","") if o.get("note") else ""))
            amount=0
            for i in o.get("items",[]):
                p=pmap.get(i.get("productId"),{}); amount += num(p.get("unitPrice"))*num(i.get("qty")); st.write(f"{p.get('name','-')} — **{int(num(i.get('qty')))} pcs** · {num(p.get('unitPrice')):,.0f}")
            st.write(f"**Total aktif: {amount:,.0f}**")

def completed_page(data):
    topbar("Produk Selesai","Catat hasil produksi, packing, box dan pengurangan order otomatis")
    pmap={p["id"]:p for p in data["products"]}; bmap={b["id"]:b for b in data["boxes"]}
    candidates=[]
    for o in data["orders"]:
        if not o.get("archived"):
            for i in o.get("items",[]):
                if num(i.get("qty"))>0: candidates.append((o,i))
    with st.expander("+ Produk Selesai"):
        labels={f"{o['id']}|{i['id']}":f"{pmap.get(i.get('productId'),{}).get('name','-')} · sisa {int(num(i.get('qty')))}" for o,i in candidates}
        pick=st.selectbox("Item Order",[""]+list(labels),format_func=lambda x:labels.get(x,"Pilih item"),key="comp_pick")
        selected_p={}
        if pick:
            oid,iid=pick.split("|"); oo=next(o for o,i in candidates if o["id"]==oid and i["id"]==iid); ii=next(i for o,i in candidates if o["id"]==oid and i["id"]==iid); selected_p=pmap.get(ii.get("productId"),{})
        a,b,c=st.columns(3); qty=a.number_input("Qty selesai",1,step=1); group=b.text_input("Grup",value=selected_p.get("group","") if selected_p else ""); seq=c.text_input("No.")
        a,b,c=st.columns(3); perbox=a.number_input("Qty / Box",0,step=1); boxcount=b.number_input("Jumlah Box",0,step=1); boxid=c.selectbox("Box",[""]+list(bmap),format_func=lambda x:bmap.get(x,{}).get("name",f"{bmap.get(x,{}).get('w','')}x{bmap.get(x,{}).get('d','')}x{bmap.get(x,{}).get('h','')}") if x else "Tanpa box")
        if pick:
            total_pack=perbox*boxcount; st.caption(f"Total packing: {total_pack} · Selisih terhadap selesai: {qty-total_pack}")
        if st.button("Simpan Produk Selesai",type="primary") and pick:
            latest,_=load_state(); oid,iid=pick.split("|"); order=next(o for o in latest["orders"] if o["id"]==oid); item=next(i for i in order["items"] if i["id"]==iid); used=min(int(qty),int(num(item.get("qty"))))
            if boxid:
                box=next(b for b in latest["boxes"] if b["id"]==boxid)
                if int(num(box.get("qty")))<int(boxcount): st.error("Stok box tidak cukup."); return
                box["qty"]=int(num(box.get("qty")))-int(boxcount)
            item["qty"]=int(num(item.get("qty")))-used
            order["items"]=[i for i in order["items"] if int(num(i.get("qty")))>0]
            if not order["items"]: order["archived"]=True
            p=next(p for p in latest["products"] if p["id"]==item["productId"])
            latest["completed"].append({"id":uid(),"orderId":oid,"orderItemId":iid,"productId":item["productId"],"totalQty":used,"orderQty":used,"consumedQty":used,"group":group or p.get("group",""),"sequence":seq,"unitPrice":num(p.get("unitPrice")),"amount":used*num(p.get("unitPrice")),"totalWeightG":used*num(p.get("weight_g")),"totalCbm":used*num(p.get("cbm")),"boxCount":int(boxcount),"perBox":int(perbox),"boxId":boxid,"createdAt":now_iso()})
            save_state(latest,"Tambah produk selesai"); st.rerun()
    rows=[]
    for c in data["completed"]:
        p=pmap.get(c.get("productId"),{}); rows.append({"Produk":p.get("name","-"),"Grup":c.get("group",""),"No.":c.get("sequence",""),"Qty":c.get("totalQty",0),"Qty/Box":c.get("perBox",0),"Box":c.get("boxCount",0),"Berat(g)":c.get("totalWeightG",0),"CBM":c.get("totalCbm",0)})
    if rows: st.dataframe(pd.DataFrame(rows),use_container_width=True,hide_index=True)
    if st.session_state.role=="admin" and data["completed"]:
        cmap={c["id"]:f"{pmap.get(c.get('productId'),{}).get('name','-')} · {c.get('totalQty',0)} pcs" for c in data["completed"]}
        dels=st.multiselect("Pilih Produk Selesai untuk hapus / kembalikan",list(cmap),format_func=lambda x:cmap[x],key="comp_dels")
        if st.button("Hapus pilihan & kembalikan ke Order") and dels:
            latest,_=load_state()
            for cid in dels:
                c=next((x for x in latest["completed"] if x["id"]==cid),None)
                if not c: continue
                o=next((x for x in latest["orders"] if x["id"]==c.get("orderId")),None)
                if o:
                    o["archived"]=False
                    it=next((x for x in o.get("items",[]) if x.get("id")==c.get("orderItemId")),None)
                    if it: it["qty"]=int(num(it.get("qty")))+int(num(c.get("consumedQty",c.get("totalQty"))))
                    else: o.setdefault("items",[]).append({"id":c.get("orderItemId") or uid(),"productId":c.get("productId"),"qty":int(num(c.get("consumedQty",c.get("totalQty"))))})
                if c.get("boxId"):
                    b=next((x for x in latest["boxes"] if x["id"]==c.get("boxId")),None)
                    if b: b["qty"]=int(num(b.get("qty")))+int(num(c.get("boxCount")))
            latest["completed"]=[x for x in latest["completed"] if x["id"] not in dels]
            save_state(latest,"Hapus produk selesai / pulihkan order"); st.rerun()

def inventory_page(data):
    topbar("Stok Produk","Stok berdasarkan produk, kayu, finishing dan lokasi")
    with st.expander("+ Stok"):
        with st.form("inv_add",clear_on_submit=True):
            a,b,c=st.columns(3); name=a.text_input("Nama Produk"); wood=b.text_input("Jenis Kayu"); finish=c.text_input("Finishing")
            a,b=st.columns(2); qty=a.number_input("Qty",0,step=1); loc=b.text_input("Lokasi")
            if st.form_submit_button("Simpan Stok"):
                latest,_=load_state(); latest["inventory"].append({"id":uid(),"name":name,"wood":wood,"finish":finish,"qty":qty,"location":loc,"updatedAt":now_iso()}); save_state(latest,"Tambah stok"); st.rerun()
    if data["inventory"]: st.dataframe(pd.DataFrame([{"Nama":x.get("name"),"Kayu":x.get("wood"),"Finishing":x.get("finish"),"Qty":x.get("qty"),"Lokasi":x.get("location")} for x in data["inventory"]]),use_container_width=True,hide_index=True)

def workers_page(data):
    topbar("DB Pekerja","Pekerja, tempat kerja, kontak dan riwayat produksi")
    with st.expander("+ Pekerja"):
        with st.form("wrk_add",clear_on_submit=True):
            a,b=st.columns(2); name=a.text_input("Nama"); workplace=b.text_input("Tempat Kerja"); a,b=st.columns(2); phone=a.text_input("Kontak"); note=b.text_input("Catatan")
            if st.form_submit_button("Simpan Pekerja"):
                if name:
                    latest,_=load_state(); latest["workers"].append({"id":uid(),"name":name,"workplace":workplace,"phone":phone,"note":note}); save_state(latest,"Tambah pekerja"); st.rerun()
    for w in data["workers"]:
        qty=0; amount=0
        order_ids={o["id"] for o in data["orders"] if o.get("workerId")==w["id"]}
        history=[c for c in data["completed"] if c.get("orderId") in order_ids]
        for c in history: qty+=int(num(c.get("totalQty"))); amount+=num(c.get("amount"))
        st.markdown(f'<div class="card"><b>{w.get("name","")}</b><div class="muted">{w.get("workplace","")} · {w.get("phone","")}</div><div>Produksi tercatat: {qty} pcs · {amount:,.0f}</div></div>',unsafe_allow_html=True)

def shipping_page(data):
    topbar("Pengiriman","Pilih produk selesai untuk dipindahkan ke riwayat pengiriman")
    pmap={p["id"]:p for p in data["products"]}
    cmap={c["id"]:f"{pmap.get(c.get('productId'),{}).get('name','-')} · {c.get('totalQty',0)} pcs" for c in data["completed"]}
    selected=st.multiselect("Produk Selesai",list(cmap),format_func=lambda x:cmap[x])
    ship_date=st.date_input("Tanggal Kirim",datetime.now().date())
    if st.button("Tandai Dikirim",type="primary") and selected:
        latest,_=load_state(); items=[c for c in latest["completed"] if c["id"] in selected]; latest["completed"]=[c for c in latest["completed"] if c["id"] not in selected]; latest["shipments"].insert(0,{"id":uid(),"shipCode":ship_date.strftime("%y%m%d"),"shippedAt":now_iso(),"items":items}); save_state(latest,"Pengiriman"); st.rerun()
    for sh in data["shipments"]:
        with st.container(border=True):
            st.write(f"**{sh.get('shipCode','')}** · {len(sh.get('items',[]))} item")
            for c in sh.get("items",[]): st.write(f"- {pmap.get(c.get('productId'),{}).get('name','-')} · {c.get('totalQty',0)} pcs")
            if st.session_state.role=="admin" and st.button("Batalkan pengiriman",key="unship_"+sh["id"]):
                latest,_=load_state(); cur=next(x for x in latest["shipments"] if x["id"]==sh["id"]); latest["completed"].extend(cur.get("items",[])); latest["shipments"]=[x for x in latest["shipments"] if x["id"]!=sh["id"]]; save_state(latest,"Batalkan pengiriman"); st.rerun()

def settings_page(data):
    topbar("Pengaturan","Admin saja")
    t1,t2,t3,t4=st.tabs(["Grup Produk","Login Umum","Password Admin","Backup"])
    with t1:
        new=st.text_input("Grup baru")
        if st.button("Tambah Grup") and new.strip():
            latest,_=load_state();
            if new.strip() not in latest["groups"]: latest["groups"].append(new.strip()); save_state(latest,"Tambah grup"); st.rerun()
        dels=st.multiselect("Hapus grup",data["groups"])
        if st.button("Hapus Grup Terpilih") and dels:
            latest,_=load_state(); latest["groups"]=[x for x in latest["groups"] if x not in dels]; save_state(latest,"Hapus grup"); st.rerun()
    with t2:
        a,b=st.columns([2,1]); nm=a.text_input("Nama login baru"); active=b.checkbox("Aktif",True)
        if st.button("Tambah Login") and nm.strip():
            latest,_=load_state(); latest["loginUsers"].append({"id":uid(),"name":nm.strip(),"active":active}); save_state(latest,"Tambah login umum"); st.rerun()
        for u in data["loginUsers"]:
            st.write(f"{u.get('name')} · {'aktif' if u.get('active',True) else 'nonaktif'}")
    with t3:
        p1=st.text_input("Password baru",type="password"); p2=st.text_input("Ulangi password",type="password")
        if st.button("Ubah Password"):
            if not p1 or p1!=p2: st.error("Password tidak sama.")
            else:
                latest,_=load_state(); ac=next((x for x in latest["adminConfig"] if x.get("id")=="admin"),None)
                if not ac: ac={"id":"admin"}; latest["adminConfig"].append(ac)
                ac["passwordHash"]=htxt(p1); save_state(latest,"Ubah password admin"); st.success("Password diubah.")
    with t4:
        blob=json.dumps(data,ensure_ascii=False,indent=2).encode("utf-8")
        st.download_button("Download Backup JSON",blob,file_name=f"backup_{datetime.now().strftime('%Y%m%d_%H%M')}.json",mime="application/json")
        upl=st.file_uploader("Pulihkan dari JSON",type=["json"],key="restore_json")
        if upl and st.button("Pulihkan Backup"):
            try:
                restored=normalize(json.loads(upl.getvalue().decode("utf-8")))
                if save_state(restored,"Pulihkan backup"): st.success("Backup dipulihkan."); st.rerun()
            except Exception as e: st.error(f"Backup tidak valid: {e}")

# ============================== APP ==============================
if st.session_state.role is None:
    login_screen(); st.stop()
sidebar()
data=st.session_state.data
page=st.session_state.page
{"Beranda":dashboard,"DB Produk":products_page,"DB Box":boxes_page,"Order":orders_page,"Produk Selesai":completed_page,"Stok Produk":inventory_page,"DB Pekerja":workers_page,"Pengiriman":shipping_page,"Pengaturan":settings_page}.get(page,dashboard)(data)
