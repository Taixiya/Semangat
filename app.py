import io
import json
import hashlib
import uuid
from datetime import datetime, timezone

import pandas as pd
import streamlit as st
from supabase import create_client

st.set_page_config(page_title="SEMANGAT", page_icon="🪵", layout="wide", initial_sidebar_state="expanded")

CSS = """
<style>
[data-testid="stSidebar"]{background:#17212e}
[data-testid="stSidebar"] *{color:#eef3f8}
.semangat{font-size:1.8rem;font-weight:800;letter-spacing:.04em;padding:.25rem 0 1rem 0}
.login-wrap{max-width:620px;margin:7vh auto 0 auto;padding:2.2rem;border:1px solid #e5e7eb;border-radius:18px;background:white;box-shadow:0 14px 40px rgba(0,0,0,.07)}
.login-title{font-size:2rem;font-weight:800;margin-bottom:.25rem}
.muted{color:#6b7280}
.metric-card{border:1px solid #e5e7eb;border-radius:15px;padding:1rem;background:#fff}
div[data-testid="stButton"] button{border-radius:10px}
</style>
"""
st.markdown(CSS, unsafe_allow_html=True)

DEFAULT_ADMIN_HASH = hashlib.sha256("1082".encode()).hexdigest()
BLANK = {
    "products": [], "boxes": [], "orders": [], "completed": [], "shipments": [],
    "inventory": [], "workers": [], "groups": ["PLATE", "PLATEBOARD", "TRAY"],
    "loginUsers": [], "adminConfig": [{"id":"admin", "passwordHash":DEFAULT_ADMIN_HASH}], "logs": []
}

def uid(): return str(uuid.uuid4())
def now_iso(): return datetime.now(timezone.utc).isoformat()
def hash_text(s): return hashlib.sha256(str(s).encode()).hexdigest()
def clone(x): return json.loads(json.dumps(x, ensure_ascii=False))

def sb_client():
    url = st.secrets.get("SUPABASE_URL", "")
    key = st.secrets.get("SUPABASE_KEY", "")
    if not url or not key:
        return None
    return create_client(url, key)

SB = sb_client()

def load_state():
    if SB is None:
        return clone(BLANK), "Supabase belum dikonfigurasi"
    try:
        res = SB.table("app_state").select("data,updated_at").eq("id", "main").maybe_single().execute()
        row = res.data
        if row and row.get("data"):
            data = row["data"]
            for k,v in BLANK.items():
                if k not in data:
                    data[k] = clone(v)
            return data, None
        SB.table("app_state").upsert({"id":"main", "data":clone(BLANK), "updated_at":now_iso()}).execute()
        return clone(BLANK), None
    except Exception as e:
        return clone(BLANK), str(e)

def save_state(data, action="Perubahan data"):
    if SB is None:
        st.error("Supabase belum dikonfigurasi.")
        return False
    try:
        data.setdefault("logs", []).insert(0, {"id":uid(), "at":now_iso(), "actor":st.session_state.get("actor", ""), "label":action})
        data["logs"] = data["logs"][:500]
        SB.table("app_state").upsert({"id":"main", "data":data, "updated_at":now_iso()}).execute()
        st.session_state.data = data
        return True
    except Exception as e:
        st.error(f"Gagal menyimpan: {e}")
        return False

def fresh_data():
    data, err = load_state()
    st.session_state.data = data
    st.session_state.cloud_error = err
    return data

def upload_image(file, product_id):
    if SB is None or file is None: return ""
    ext = file.name.split(".")[-1].lower() if "." in file.name else "jpg"
    path = f"products/{product_id}/{uid()}.{ext}"
    b = file.getvalue()
    try:
        SB.storage.from_("product-images").upload(path, b, {"content-type": file.type or "image/jpeg", "upsert":"true"})
        return SB.storage.from_("product-images").get_public_url(path)
    except Exception as e:
        st.warning(f"Gambar gagal diunggah: {e}")
        return ""

def ensure_session():
    st.session_state.setdefault("role", None)
    st.session_state.setdefault("actor", "")
    st.session_state.setdefault("page", "Beranda")
    if "data" not in st.session_state:
        fresh_data()
ensure_session()

def login_screen():
    st.markdown('<div class="login-wrap"><div class="login-title">SEMANGAT</div><div class="muted">Manajemen Produksi Indonesia</div></div>', unsafe_allow_html=True)
    st.write("")
    tab1, tab2 = st.tabs(["Login Umum", "Login Admin"])
    data = st.session_state.data
    with tab1:
        names = [u.get("name","") for u in data.get("loginUsers",[]) if u.get("active",True)]
        name = st.selectbox("Nama Pekerja", [""] + names)
        if st.button("Masuk sebagai Pekerja", use_container_width=True):
            if not name: st.warning("Pilih nama pekerja.")
            else:
                st.session_state.role="worker"; st.session_state.actor=name; st.session_state.page="Beranda"; st.rerun()
    with tab2:
        pwd = st.text_input("Password Admin", type="password")
        if st.button("Masuk sebagai Admin", use_container_width=True):
            admin_hash = next((x.get("passwordHash") for x in data.get("adminConfig",[]) if x.get("id")=="admin"), DEFAULT_ADMIN_HASH)
            if hash_text(pwd)==admin_hash:
                st.session_state.role="admin"; st.session_state.actor=""; st.session_state.page="Beranda"; st.rerun()
            else: st.error("Password salah.")
    if st.session_state.get("cloud_error"):
        st.warning("Koneksi Supabase belum aktif: " + st.session_state.cloud_error)

def sidebar():
    with st.sidebar:
        st.markdown('<div class="semangat">SEMANGAT</div>', unsafe_allow_html=True)
        pages=["Beranda","DB Produk","DB Box","Order","Produk Selesai","Stok Produk","DB Pekerja","Pengiriman"]
        if st.session_state.role=="admin": pages.append("Pengaturan")
        for p in pages:
            if st.button(p, use_container_width=True, type="primary" if st.session_state.page==p else "secondary"):
                st.session_state.page=p; st.rerun()
        st.divider()
        if st.button("↻ Muat data terbaru", use_container_width=True): fresh_data(); st.rerun()
        st.caption("Supabase: " + ("terhubung" if SB is not None and not st.session_state.get("cloud_error") else "belum terhubung"))
        st.caption("Admin" if st.session_state.role=="admin" else st.session_state.actor)
        if st.button("Keluar", use_container_width=True):
            st.session_state.role=None; st.session_state.actor=""; st.rerun()

def dashboard(data):
    st.title("Beranda")
    active_orders=[o for o in data["orders"] if not o.get("archived")]
    order_items=[i for o in active_orders for i in o.get("items",[])]
    order_types=len(set(i.get("productId") for i in order_items)); order_qty=sum(int(i.get("qty",0) or 0) for i in order_items)
    comp_types=len(set(c.get("productId") for c in data["completed"])); comp_qty=sum(int(c.get("totalQty",0) or 0) for c in data["completed"])
    c1,c2,c3,c4=st.columns(4)
    c1.metric("DB Produk",len(data["products"])); c2.metric("DB Box",len(data["boxes"])); c3.metric("Order",f"{order_types} jenis / {order_qty} pcs"); c4.metric("Produk Selesai",f"{comp_types} jenis / {comp_qty} pcs")
    st.subheader("Produk Terbaru")
    cols=st.columns(3)
    for col,p in zip(cols,data["products"][:3]):
        with col:
            if p.get("image"): st.image(p["image"], use_container_width=True)
            st.write(f"**{p.get('name','')}**")
            st.caption(f"{p.get('wood','')} · {p.get('finish','')}")

def products_page(data):
    st.title("DB Produk")
    with st.expander("+ Tambah Produk", expanded=False):
        with st.form("add_product"):
            name=st.text_input("Nama Produk"); group=st.selectbox("Grup", [""]+data["groups"])
            a,b,c=st.columns(3); w=a.number_input("W (mm)",min_value=0.0); d=b.number_input("D (mm)",min_value=0.0); h=c.number_input("H (mm)",min_value=0.0)
            a,b,c=st.columns(3); weight=a.number_input("Berat (g)",min_value=0.0); wood=b.text_input("Jenis Kayu"); finish=c.text_input("Finishing")
            price=st.number_input("Harga Satuan",min_value=0.0); img=st.file_uploader("Gambar",type=["jpg","jpeg","png","webp"])
            if st.form_submit_button("Simpan"):
                if not name: st.warning("Nama produk wajib diisi.")
                else:
                    latest,_=load_state(); pid=uid(); url=upload_image(img,pid) if img else ""
                    latest["products"].insert(0,{"id":pid,"name":name,"group":group,"w":w,"d":d,"h":h,"weight_g":weight,"cbm":w*d*h/1e9,"wood":wood,"finish":finish,"unitPrice":price,"image":url,"parts":[],"makers":[],"details":[]})
                    if save_state(latest,"Tambah produk"): st.success("Produk disimpan."); st.rerun()
    q=st.text_input("Cari produk")
    rows=[p for p in data["products"] if q.lower() in p.get("name","").lower()]
    for p in rows:
        with st.container(border=True):
            c1,c2,c3=st.columns([1,3,1])
            with c1:
                if p.get("image"): st.image(p["image"], use_container_width=True)
            with c2:
                st.write(f"### {p.get('name','')}"); st.caption(f"{p.get('group','')} · {p.get('w',0)}x{p.get('d',0)}x{p.get('h',0)} · {p.get('wood','')} · {p.get('finish','')}")
                st.write(f"Rp {int(p.get('unitPrice',0) or 0):,}")
            with c3:
                if st.session_state.role=="admin" and st.button("Hapus",key="dp"+p["id"]):
                    latest,_=load_state(); latest["products"]=[x for x in latest["products"] if x["id"]!=p["id"]]; save_state(latest,"Hapus produk"); st.rerun()

def boxes_page(data):
    st.title("DB Box")
    with st.form("box"):
        a,b,c=st.columns(3); w=a.number_input("W",0.0); d=b.number_input("D",0.0); h=c.number_input("H",0.0)
        a,b,c=st.columns(3); price=a.number_input("Harga",0.0); qty=b.number_input("Stok",0,step=1); weight=c.number_input("Berat box (g)",0.0)
        workplace=st.text_input("Tempat Kerja"); phone=st.text_input("Kontak")
        if st.form_submit_button("Tambah Box"):
            latest,_=load_state(); latest["boxes"].append({"id":uid(),"w":w,"d":d,"h":h,"price":price,"qty":qty,"weight_g":weight,"workplace":workplace,"phone":phone,"productIds":[]}); save_state(latest,"Tambah box"); st.rerun()
    if data["boxes"]:
        st.dataframe(pd.DataFrame([{"Ukuran":f"{b['w']}x{b['d']}x{b['h']}","Harga":b['price'],"Stok":b['qty'],"Berat(g)":b['weight_g']} for b in data["boxes"]]), use_container_width=True, hide_index=True)

def orders_page(data):
    st.title("Order")
    prod_map={p["id"]:p["name"] for p in data["products"]}; worker_map={w["id"]:w["name"] for w in data["workers"]}
    with st.expander("+ Buat Order"):
        if not data["products"]: st.info("Tambahkan produk terlebih dahulu.")
        else:
            pids=st.multiselect("Produk",list(prod_map),format_func=lambda x:prod_map[x]); worker=st.selectbox("Pekerja",[""]+list(worker_map),format_func=lambda x:worker_map.get(x,"Pilih pekerja")); note=st.text_input("Catatan")
            qtys={pid:st.number_input(f"Qty · {prod_map[pid]}",min_value=1,step=1,key="oq"+pid) for pid in pids}
            if st.button("Simpan Order"):
                latest,_=load_state(); latest["orders"].append({"id":uid(),"orderNo":datetime.now().strftime("%y%m%d"),"createdAt":now_iso(),"workerId":worker,"note":note,"archived":False,"items":[{"productId":pid,"qty":qtys[pid],"note":""} for pid in pids]}); save_state(latest,"Tambah order"); st.rerun()
    for o in [x for x in data["orders"] if not x.get("archived")]:
        with st.container(border=True):
            st.write(f"**Order {o.get('orderNo','')}** · {worker_map.get(o.get('workerId'),'')}")
            for i in o.get("items",[]): st.write(f"- {prod_map.get(i.get('productId'),'-')}: **{i.get('qty',0)} pcs**")

def completed_page(data):
    st.title("Produk Selesai")
    prod_map={p["id"]:p for p in data["products"]}; candidates=[]
    for o in data["orders"]:
        if not o.get("archived"):
            for i in o.get("items",[]):
                if i.get("qty",0)>0: candidates.append((o,i))
    with st.expander("+ Catat Produk Selesai"):
        opts=[f"{o['id']}|{i['productId']}" for o,i in candidates]
        pick=st.selectbox("Item Order",[""]+opts,format_func=lambda x:"Pilih item" if not x else f"{prod_map.get(x.split('|')[1],{}).get('name','-')} · sisa {next((i['qty'] for o,i in candidates if o['id']==x.split('|')[0] and i['productId']==x.split('|')[1]),0)}")
        qty=st.number_input("Qty selesai",min_value=1,step=1)
        if st.button("Simpan Produk Selesai") and pick:
            oid,pid=pick.split("|"); latest,_=load_state(); order=next(o for o in latest["orders"] if o["id"]==oid); item=next(i for i in order["items"] if i["productId"]==pid); used=min(qty,item["qty"]); item["qty"]-=used; order["items"]=[i for i in order["items"] if i["qty"]>0]; order["archived"]=not order["items"]; p=next(p for p in latest["products"] if p["id"]==pid); latest["completed"].append({"id":uid(),"orderId":oid,"productId":pid,"totalQty":used,"orderQty":used,"consumedQty":used,"group":p.get("group",""),"unitPrice":p.get("unitPrice",0),"amount":used*p.get("unitPrice",0),"totalWeightG":used*p.get("weight_g",0),"totalCbm":used*p.get("cbm",0),"boxCount":0,"perBox":0,"boxId":"","createdAt":now_iso()}); save_state(latest,"Tambah produk selesai"); st.rerun()
    rows=[]
    for c in data["completed"]:
        p=prod_map.get(c["productId"],{}); rows.append({"Produk":p.get("name","-"),"Grup":c.get("group",""),"Qty":c.get("totalQty",0),"Berat(g)":c.get("totalWeightG",0),"CBM":c.get("totalCbm",0)})
    if rows: st.dataframe(pd.DataFrame(rows),use_container_width=True,hide_index=True)

def inventory_page(data):
    st.title("Stok Produk")
    with st.form("inv"):
        a,b,c=st.columns(3); name=a.text_input("Nama Produk"); wood=b.text_input("Kayu"); finish=c.text_input("Finishing")
        qty=st.number_input("Qty",0,step=1); loc=st.text_input("Lokasi")
        if st.form_submit_button("Tambah Stok"):
            latest,_=load_state(); latest["inventory"].append({"id":uid(),"name":name,"wood":wood,"finish":finish,"qty":qty,"location":loc}); save_state(latest,"Tambah stok"); st.rerun()
    if data["inventory"]: st.dataframe(pd.DataFrame(data["inventory"]),use_container_width=True,hide_index=True,column_order=["name","wood","finish","qty","location"])

def workers_page(data):
    st.title("DB Pekerja")
    with st.form("worker"):
        a,b=st.columns(2); name=a.text_input("Nama"); workplace=b.text_input("Tempat Kerja"); phone=st.text_input("Kontak"); note=st.text_input("Catatan")
        if st.form_submit_button("Tambah Pekerja"):
            latest,_=load_state(); latest["workers"].append({"id":uid(),"name":name,"workplace":workplace,"phone":phone,"note":note}); save_state(latest,"Tambah pekerja"); st.rerun()
    if data["workers"]: st.dataframe(pd.DataFrame(data["workers"]),use_container_width=True,hide_index=True)

def shipping_page(data):
    st.title("Pengiriman")
    prod_map={p["id"]:p["name"] for p in data["products"]}
    choices=[c["id"] for c in data["completed"]]
    selected=st.multiselect("Pilih produk selesai",choices,format_func=lambda cid:f"{prod_map.get(next((c['productId'] for c in data['completed'] if c['id']==cid),''),'-')} · {next((c['totalQty'] for c in data['completed'] if c['id']==cid),0)} pcs")
    if st.button("Tandai Dikirim") and selected:
        latest,_=load_state(); items=[c for c in latest["completed"] if c["id"] in selected]; latest["completed"]=[c for c in latest["completed"] if c["id"] not in selected]; latest["shipments"].append({"id":uid(),"shipCode":datetime.now().strftime("%y%m%d"),"shippedAt":now_iso(),"items":items}); save_state(latest,"Pengiriman"); st.rerun()
    for sh in data["shipments"]:
        with st.container(border=True): st.write(f"**{sh.get('shipCode','')}** · {len(sh.get('items',[]))} item")

def settings_page(data):
    st.title("Pengaturan")
    st.subheader("Login Umum")
    with st.form("loginuser"):
        name=st.text_input("Nama login baru")
        if st.form_submit_button("Tambah") and name:
            latest,_=load_state(); latest["loginUsers"].append({"id":uid(),"name":name,"active":True}); save_state(latest,"Tambah login umum"); st.rerun()
    if data["loginUsers"]: st.dataframe(pd.DataFrame(data["loginUsers"]),use_container_width=True,hide_index=True)
    st.subheader("Password Admin")
    p1=st.text_input("Password baru",type="password",key="p1"); p2=st.text_input("Ulangi password",type="password",key="p2")
    if st.button("Ubah Password"):
        if not p1 or p1!=p2: st.error("Password tidak sama.")
        else:
            latest,_=load_state(); latest["adminConfig"]=[{"id":"admin","passwordHash":hash_text(p1)}]; save_state(latest,"Ubah password admin"); st.success("Password diubah.")
    st.subheader("Backup")
    st.download_button("Download JSON",json.dumps(data,ensure_ascii=False,indent=2),file_name=f"backup-{datetime.now().strftime('%Y%m%d-%H%M')}.json",mime="application/json")
    st.subheader("Ekspor Produk")
    if data["products"]:
        df=pd.DataFrame(data["products"]); out=io.BytesIO();
        with pd.ExcelWriter(out,engine="openpyxl") as writer: df.to_excel(writer,index=False,sheet_name="Produk")
        st.download_button("Download Excel Produk",out.getvalue(),file_name="produk.xlsx",mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

if st.session_state.role is None:
    login_screen(); st.stop()

# always refresh once when app run starts, then user can refresh manually
sidebar()
data=st.session_state.data
page=st.session_state.page
if page=="Beranda": dashboard(data)
elif page=="DB Produk": products_page(data)
elif page=="DB Box": boxes_page(data)
elif page=="Order": orders_page(data)
elif page=="Produk Selesai": completed_page(data)
elif page=="Stok Produk": inventory_page(data)
elif page=="DB Pekerja": workers_page(data)
elif page=="Pengiriman": shipping_page(data)
elif page=="Pengaturan" and st.session_state.role=="admin": settings_page(data)
