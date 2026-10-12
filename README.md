# 🔍 AI 뉴스 사실 확인 도우미 (AI News Fact Checker)

> **Google Gemini API**, **Google Fact Check Tools API**, **네이버 뉴스 검색 API**를 결합하여, 뉴스 기사 및 문장의 핵심 주장을 추출하고 실제 공인된 검증 보도 및 언론사 보도와 대조하여 진위를 분석하며 **낚시성 제목(Clickbait)**까지 탐지하는 웹 애플리케이션입니다.

---

## 📌 1. 프로젝트 개요

인터넷 뉴스 기사의 링크(URL) 또는 의심스러운 문장을 입력하면, 다음과 같은 종합 파이프라인으로 사실 여부를 다각도로 검증합니다:

1. **입력 분석**: 웹 기사 URL을 전달받으면 기사 본문과 제목을 크롤링하고 정제합니다.
2. **낚시성 제목 탐지 (2단계)**: 기사 제목과 본문을 대조하여 과장, 왜곡, 어그로성 표현 여부 및 위험 지수(0~100)를 측정합니다.
3. **핵심 주장 추출**: Google Gemini AI가 주관적 의견/광고를 배제하고 검증 가능한 **핵심 주장 1~3개**를 정밀 추출합니다.
4. **공인 근거 수집 (Fact Check API)**: 추출된 주장의 키워드로 **Google Fact Check Tools API**를 호출하여 공인된 `ClaimReview` 검증 기사를 수집합니다.
5. **타 언론사 교차 보도 확인 (네이버 뉴스 API, 2단계)**: 국내 주요 언론사들의 실시간 관련 보도를 검색하여 교차 검증 데이터를 확보합니다.
6. **증거 대조 분석 (환각 방지)**: AI가 자체 기억에 의존하지 않고, **실제 수집된 API 근거만을 바탕으로** 주장과 증거를 엄격히 대조하여 판정을 내립니다.

---

## ⚖️ 2. 핵심 원칙 및 신뢰성 보장 장치

- **무환각(Anti-Hallucination) 원칙**:
  - AI의 자체 사전 학습 기억만으로 진위를 단정하지 않습니다.
  - 외부 API에서 검색된 근거가 없거나 부족할 경우, 절대로 그럴듯한 근거를 지어내지 않고 솔직하게 **`근거 부족(확인 불가)`**으로 판정합니다.
- **3단계 객관적 판정 라벨**:
  - `근거와 일치`: 공인된 검증 보도가 주장의 내용을 명확히 사실로 뒷받침하는 경우
  - `근거와 상충`: 공인된 검증 보도가 주장의 내용을 허위, 왜곡, 사실무근으로 반박하는 경우
  - `근거 부족(확인 불가)`: 공인된 팩트체크 보도가 없거나 진위를 가리기에 불충분한 경우
- **낚시성 제목(Clickbait) 진단**:
  - 기사 제목의 자극성(어조)과 본문과의 일치도를 분석하여 `낮음(신뢰)`, `주의(과장 의심)`, `높음(낚시성 제목)`으로 진단합니다.
- **출처(Sources) 투명성**: 모든 판정 결과에는 검증 기관명, 기관의 평가 등급, 원문 기사 링크가 함께 제공됩니다.
- **상시 면책 고지 표기**: *"AI 판단은 참고용이며 최종 확인은 제공된 출처 링크를 통해 직접 해야 합니다."* 문구가 상시 명시됩니다.

---

## 🛠️ 3. 기술 스택

- **Backend**: `Node.js (v18+)`, `Express`
  - `axios`: 외부 API 호출 및 웹 요청
  - `cheerio`: 뉴스 웹페이지 파싱 및 기사 본문 추출
  - `dotenv`: 서버 환경변수 은닉 및 보안 관리
  - `cors`: Cross-Origin 리소스 공유 지원
- **Frontend**: `Vanilla HTML5`, `CSS3`, `JavaScript (ES6+)` (프레임워크 없는 경량 순수 웹)
- **External APIs**:
  - `Google Gemini API` (`gemini-1.5-flash`): 핵심 주장 추출, 낚시성 제목 분석, 증거-주장 대조 분석
  - `Google Fact Check Tools API` (`claims:search`): 공인 팩트체크 기사(ClaimReview) 데이터베이스 조회
  - `네이버 뉴스 검색 API` (`search/news.json`): 국내 타 언론사 실시간 교차 보도 조회

---

## ⚙️ 4. 환경 변수 설정 (.env)

API 키는 클라이언트 코드에 절대 노출되지 않으며, 서버의 `.env` 파일에서만 안전하게 관리됩니다.

프로젝트 루트의 `.env.example`을 복사하여 `.env` 파일을 생성하고 키를 입력합니다:

```bash
cp .env.example .env
```

`.env` 파일 내용:
```env
PORT=3000

# [필수 1] Google Gemini API 키
GEMINI_API_KEY=your_gemini_api_key_here

# [필수 2] Google Fact Check Tools API 키
FACT_CHECK_API_KEY=your_google_fact_check_api_key_here

# [선택 3] 네이버 검색 API (언론사 교차 보도 - 키가 없어도 기존 기능 정상 작동)
NAVER_CLIENT_ID=your_naver_client_id_here
NAVER_CLIENT_SECRET=your_naver_client_secret_here
```

### 🔑 API 키 발급 방법
1. **GEMINI_API_KEY** (필수):
   - [Google AI Studio](https://aistudio.google.com/) 접속 ➔ **Get API key** 클릭 후 발급 (무료)
2. **FACT_CHECK_API_KEY** (필수):
   - [Google Cloud Console](https://console.cloud.google.com/) 접속 ➔ 프로젝트 선택
   - **API 및 서비스 > 라이브러리**에서 **Fact Check Tools API** 검색 후 **[사용 설정(Enable)]**
   - **사용자 인증 정보 > API 키 만들기**로 키 발급
3. **NAVER_CLIENT_ID & SECRET** (선택 사항):
   - [네이버 개발자 센터](https://developers.naver.com/) 접속 ➔ **애플리케이션 등록**
   - 사용 API: **검색 (Search)** 선택, 환경: **WEB 설정** (`http://localhost:3000`)
   - 발급된 Client ID와 Client Secret 입력 (미등록 시에도 Fact Check와 낚시성 탐지는 정상 작동)

---

## 🚀 5. 설치 및 실행 방법

### 1) 의존성 설치
```bash
npm install
```

### 2) 서버 실행
```bash
# 기본 실행
npm start

# 코드 변경 감지 개발 모드 (Node 18+)
npm run dev
```

### 3) 웹 브라우저 접속
웹 브라우저를 열고 아래 주소로 접속합니다:
```
http://localhost:3000
```

---

## 🧪 6. 테스트 시나리오 및 예시

웹 화면 상단의 **[빠른 테스트 예시]** 버튼을 클릭하여 즉시 테스트할 수 있습니다:

1. **루머 팩트체크 테스트** (`코로나 백신 마이크로칩 루머` 버튼)
   - 공인 Fact Check API의 검증 보도와 대조되어 **`근거와 상충`** 판정 확인
2. **기후 변화 팩트체크 테스트** (`지구 온난화와 북극 빙하` 버튼)
   - 기후 과학 검증 기관 보도와 대조되어 **`근거와 상충`** 및 원문 링크 확인
3. **낚시성 제목 탐지 테스트** (`낚시성 제목 기사 예시` 버튼)
   - 제목: *"충격! 정부가 내일부터 전 국민 통장을 전격 동결한다는 긴급 발표?!"*
   - 본문: *"의심 계좌에 한해 24시간 임시 지급정지 가이드라인 검토 중"*
   - 분석 결과: **`위험도: 높음(낚시성 제목)`**, 낚시성 지수 80점 이상 및 구체적 왜곡 사유 도출 확인

---

## 📂 7. 디렉터리 구조

```text
fact-checker/
├── .env.example           # 환경변수 템플릿
├── .gitignore             # Git 추적 제외 설정 (.env, node_modules)
├── package.json           # 프로젝트 메타데이터 및 의존성
├── README.md              # 프로젝트 안내 문서
├── server/
│   ├── server.js          # Express 서버 엔트리포인트 및 라우트 등록
│   ├── routes/
│   │   └── check.js       # 사실 확인 통합 API 엔드포인트 (/api/check)
│   └── services/
│       ├── scraper.js     # 뉴스 기사 URL 본문 추출 모듈 (Cheerio)
│       ├── gemini.js      # Gemini 주장 추출 및 대조 분석 모듈
│       ├── factCheck.js   # Google Fact Check Tools API 연동 모듈
│       ├── naverNews.js   # [2단계] 네이버 뉴스 검색 API 모듈 (타 언론사 교차 보도)
│       └── clickbait.js   # [2단계] Gemini 기반 낚시성 제목 탐지 모듈
└── public/
    ├── index.html         # 메인 웹 페이지 마크업 (낚시성 카드, 결과 영역)
    ├── style.css          # 모던 반응형 스타일시트
    └── app.js             # 클라이언트 폼 핸들링, 로딩, 낚시성 및 교차 보도 렌더링
```
