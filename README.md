# SEMANGAT Streamlit Test

테스트 목적의 Streamlit 버전입니다. 기존 HTML/PWA 버전은 삭제하지 말고 별도로 테스트하세요.

## 포함 기능
- 로그인 화면 / 왼쪽 상단에만 SEMANGAT 표시
- 일반 로그인 / 관리자 로그인
- 대시보드
- 제품 DB + 이미지 업로드
- Box DB
- Order
- Produk Selesai
- Stok Produk
- DB Pekerja
- Pengiriman
- 관리자 설정: 일반 로그인 이름, 관리자 비밀번호, JSON 백업, 제품 Excel 내보내기
- 기존 Supabase `app_state` 테이블과 `product-images` Storage 사용

## Streamlit Community Cloud 배포
1. GitHub에 이 폴더 파일을 새 저장소로 업로드합니다.
2. https://share.streamlit.io 에서 GitHub 저장소를 연결합니다.
3. Main file path는 `app.py`로 설정합니다.
4. Advanced settings / Secrets에 아래 두 줄을 입력합니다.

```toml
SUPABASE_URL = "복사한 Project URL"
SUPABASE_KEY = "복사한 anon 또는 publishable key"
```

5. Deploy를 누릅니다.

## 참고
- 이 버전은 '사용감 테스트용'입니다. 기존 v14/PWA의 모든 세부 기능을 100% 옮긴 최종본은 아닙니다.
- Streamlit은 기본적으로 웹앱이라 PWA처럼 Service Worker를 직접 관리하지 않아도 됩니다.
- 여러 사용자가 같은 데이터를 쓰도록 Supabase를 사용합니다. 현재 테스트판은 화면 자동 실시간 갱신 대신 왼쪽의 `Muat data terbaru` 버튼으로 최신 데이터를 다시 읽습니다.
- 테스트가 괜찮으면 기존 프로그램의 세부 기능(멀티삭제/정렬/제품 상세블록/완료취소/박스자동복구/출력양식 등)을 최종 버전으로 옮기는 것이 안전합니다.
