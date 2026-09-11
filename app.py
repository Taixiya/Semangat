import json
import re
from pathlib import Path
import streamlit as st
import streamlit.components.v1 as components

st.set_page_config(page_title="NAYESO 국내 관리", layout="wide", initial_sidebar_state="collapsed")
st.markdown("""
<style>
[data-testid="stSidebar"], [data-testid="stHeader"], #MainMenu, footer {display:none !important;}
.block-container {padding:0 !important; max-width:none !important;}
[data-testid="stAppViewContainer"] {background:#f5f7fa;}
iframe {display:block; width:100% !important; border:0 !important; min-height:940px;}
</style>
""", unsafe_allow_html=True)
ROOT=Path(__file__).parent
INDEX=(ROOT/'patched_index.html').read_text(encoding='utf-8')
STYLE=(ROOT/'patched_style.css').read_text(encoding='utf-8')
APP=(ROOT/'patched_app.js').read_text(encoding='utf-8')
config={
    'SUPABASE_URL': str(st.secrets.get('SUPABASE_URL','')).strip(),
    'SUPABASE_ANON_KEY': str(st.secrets.get('SUPABASE_KEY','')).strip(),
    'REQUIRE_CLOUD': True,
}
INDEX=re.sub(r'<link[^>]+href=["\']style\.css[^"\']*["\'][^>]*>','',INDEX,flags=re.I)
INDEX=re.sub(r'<script[^>]+src=["\']app\.js[^"\']*["\'][^>]*>\s*</script>','',INDEX,flags=re.I)
head='<style>'+STYLE+'</style>\n<script>window.NAYESO_CONFIG='+json.dumps(config)+';</script>'
page=INDEX.replace('</head>',head+'\n</head>').replace('</body>','<script>'+APP+'</script>\n</body>')
components.html(page,height=940,scrolling=True)
