import json
from pathlib import Path
import streamlit as st
import streamlit.components.v1 as components

st.set_page_config(page_title="NAYESO 국내 관리", layout="wide", initial_sidebar_state="collapsed")
st.markdown("""<style>[data-testid="stSidebar"],[data-testid="stHeader"],#MainMenu,footer{display:none!important}.block-container{padding:0!important;max-width:none!important}[data-testid="stAppViewContainer"]{background:#f5f7fa}iframe{display:block;width:100%!important;border:0!important}</style>""", unsafe_allow_html=True)
ROOT=Path(__file__).parent
INDEX=(ROOT/"patched_index.html").read_text(encoding="utf-8")
STYLE=(ROOT/"patched_style.css").read_text(encoding="utf-8")
APP=(ROOT/"patched_app.js").read_text(encoding="utf-8")
url=str(st.secrets.get("SUPABASE_URL","")).strip()
key=str(st.secrets.get("SUPABASE_KEY","")).strip()
config={"SUPABASE_URL":url,"SUPABASE_ANON_KEY":key,"REQUIRE_CLOUD":True}
head="<style>"+STYLE+"</style>\n<script>window.NAYESO_CONFIG="+json.dumps(config)+";</script>"
page=INDEX.replace("</head>",head+"\n</head>")
page=page.replace("</body>","<script>"+APP+"</script>\n</body>")
components.html(page,height=900,scrolling=True)
