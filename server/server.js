const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어 설정
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 정적 파일 서빙 (프론트엔드)
app.use(express.static(path.join(__dirname, '../public')));

// 헬스체크 엔드포인트
app.get('/api/health', (req, res) => {
  const hasGeminiKey = !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here';
  const hasFactCheckKey = !!process.env.FACT_CHECK_API_KEY && process.env.FACT_CHECK_API_KEY !== 'your_google_fact_check_api_key_here';

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    apiKeysConfigured: {
      gemini: hasGeminiKey,
      factCheck: hasFactCheckKey
    }
  });
});

// 기본 라우트 (SPA index.html 연결)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// 서버 실행
app.listen(PORT, () => {
  console.log(`[Server] 사실 확인 도우미 서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});
