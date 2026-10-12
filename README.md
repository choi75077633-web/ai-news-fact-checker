# 🔍 AI 뉴스 사실 확인 도우미 (AI News Fact Checker)

> **Google Gemini API**와 **Google Fact Check Tools API**를 결합하여, 뉴스 기사 및 문장의 핵심 주장을 추출하고 실제 공인된 검증 보도와 대조하여 진위를 분석하는 웹 애플리케이션입니다.

---

## 📌 1. 프로젝트 개요

인터넷 뉴스 기사의 링크(URL) 또는 의심스러운 문장을 입력하면, 다음과 같은 4단계 파이프라인으로 사실 여부를 검증합니다:

1. **입력 분석**: 웹 기사 URL을 전달받으면 기사 본문과 제목을 크롤링하고 정제합니다.
2. **핵심 주장 추출**: Google Gemini AI가 주관적 의견/광고를 배제하고 검증 가능한 **핵심 주장 1~3개**를 정밀 추출합니다.
3. **공인 근거 수집**: 추출된 주장의 키워드로 **Google Fact Check Tools API**를 호출하여 언론사 및 팩트체크 기관의 `ClaimReview` 검증 기사를 수집합니다.
4. **증거 대조 분석 (환각 방지)**: AI가 자체 기억에 의존하지 않고, **실제 수집된 API 근거만을 바탕으로** 주장과 증거를 엄격히 대조하여 판정을 내립니다.

---

## ⚖️ 2. 핵심 원칙 및 신뢰성 보장 장치

- **무환각(Anti-Hallucination) 원칙**:
  - AI의 자체 사전 학습 기억만으로 진위를 단정하지 않습니다.
  - 외부 API에서 검색된 근거가 없거나 부족할 경우, 절대로 그럴듯한 근거를 지어내지 않고 솔직하게 **`근거 부족(확인 불가)`**으로 판정합니다.
- **3단계 객관적 판정 라벨**:
  - `근거와 일치`: 공인된 검증 보도가 주장의 내용을 명확히 사실로 뒷받침하는 경우
  - `근거와 상충`: 공인된 검증 보도가 주장의 내용을 허위, 왜곡, 사실무근으로 반박하는 경우
  - `근거 부족(확인 불가)`: 공인된 팩트체크 보도가 없거나 진위를 가리기에 불충분한 경우
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
  - `Google Gemini API` (`gemini-1.5-flash`): 핵심 주장 추출 및 증거-주장 대조 분석
  - `Google Fact Check Tools API` (`claims:search`): 공인 팩트체크 기사(ClaimReview) 데이터베이스 조회

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
GEMINI_API_KEY=your_gemini_api_key_here
FACT_CHECK_API_KEY=your_google_fact_check_api_key_here
```

### 🔑 API 키 발급 방법
1. **GEMINI_API_KEY**:
   - [Google AI Studio](https://aistudio.google.com/) 접속 ➔ **Get API key** 클릭 후 발급 (무료)
2. **FACT_CHECK_API_KEY**:
   - [Google Cloud Console](https://console.cloud.google.com/) 접속
   - 프로젝트 선택 ➔ **API 및 서비스 > 라이브러리**
   - **Fact Check Tools API** 검색 후 **[사용 설정(Enable)]** 클릭
   - **사용자 인증 정보 > API 키 만들기**로 키 발급

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

## 📂 6. 디렉터리 구조

```text
fact-checker/
├── .env.example           # 환경변수 템플릿
├── .gitignore             # Git 추적 제외 설정 (.env, node_modules)
├── package.json           # 프로젝트 메타데이터 및 의존성
├── README.md              # 프로젝트 안내 문서
├── server/
│   ├── server.js          # Express 서버 엔트리포인트 및 라우트 등록
│   ├── routes/
│   │   └── check.js       # 사실 확인 메인 API 엔드포인트 (/api/check)
│   └── services/
│       ├── scraper.js     # 뉴스 기사 URL 본문 추출 모듈 (Cheerio)
│       ├── gemini.js      # Gemini 주장 추출 및 대조 분석 모듈
│       └── factCheck.js   # Google Fact Check Tools API 연동 모듈
└── public/
    ├── index.html         # 메인 웹 페이지 마크업
    ├── style.css          # 모던 반응형 스타일시트
    └── app.js             # 클라이언트 폼 핸들링, 로딩, 결과 렌더링
```

---

## ⚠️ 7. 서비스 한계점 및 향후 개선 계획

1. **언론사 접근 차단 사이트**:
   - 일부 언론사는 봇 차단(Cloudflare, 403 Forbidden)이 적용되어 있어 URL 자동 크롤링이 차단될 수 있습니다. 이 경우 사용자가 **본문 텍스트를 직접 복사하여 입력창에 붙여넣도록 안내**합니다.
2. **한국어 팩트체크 데이터베이스 범위**:
   - Google Fact Check Tools API는 전 세계 팩트체크 기관의 데이터를 보유하고 있으나, 최신 국내 단독 이슈의 경우 등록된 기사가 적을 수 있습니다. 이에 대비하여 글로벌 데이터 검색 및 '근거 부족' 상태를 정확히 안내합니다.
3. **2단계 추가 계획**:
   - **네이버 뉴스 검색 API** 연동을 통한 여러 언론사 교차 보도 확인 기능 추가
   - 낚시성 기사 제목 탐지 (제목과 본문 내용 간의 괴리율 분석)
