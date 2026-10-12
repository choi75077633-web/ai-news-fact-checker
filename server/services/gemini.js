const axios = require('axios');

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
// 지원 모델 우선순위 리스트 (환경변수 또는 최신 모델)
const CANDIDATE_MODELS = [
  process.env.GEMINI_MODEL,
  'gemini-2.5-flash',
  'gemini-3.8-flash',
  'gemini-flash-latest',
  'gemini-1.5-flash'
].filter(Boolean);

/**
 * Gemini API 호출 헬퍼 (모델 자동 폴백 지원)
 */
async function callGemini(contents, systemInstruction = null) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    throw new Error('GEMINI_API_KEY가 설정되지 않았습니다. .env 파일에 유효한 Gemini API 키를 입력해 주세요.');
  }

  let lastError = null;

  for (const model of CANDIDATE_MODELS) {
    const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;

    const payload = {
      contents: contents,
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json'
      }
    };

    if (systemInstruction) {
      payload.systemInstruction = {
        parts: [{ text: systemInstruction }]
      };
    }

    try {
      const response = await axios.post(url, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 25000
      });

      const candidate = response.data?.candidates?.[0];
      const text = candidate?.content?.parts?.[0]?.text;

      if (!text) {
        throw new Error('Gemini API 응답에서 텍스트를 추출하지 못했습니다.');
      }

      return JSON.parse(text);
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message;
      lastError = new Error(`Gemini API [${model}] 오류: ${msg}`);
      // 만약 모델을 찾지 못한 경우(404) 다음 모델 후보로 자동 재시도
      if (err.response?.status === 404) {
        continue;
      }
      break;
    }
  }

  throw lastError;
}

/**
 * 1) 뉴스 기사에서 검증 가능한 핵심 주장 1~3개 추출
 */
async function extractClaims(title, content) {
  const systemPrompt = `당신은 언론 윤리와 팩트체크 방법론을 준수하는 전문 분석관입니다.
주어진 뉴스 기사에서 사실 여부를 객관적 데이터/출처로 검증할 수 있는 핵심 주장(Claim)을 1개에서 최대 3개까지 추출하세요.

[추출 규칙]
1. 단순한 주관적 의견, 감정적 수사, 광고성 문구는 제외하세요.
2. 수치 통계, 정책 발표, 특정 인물의 구체적 발언, 역사적/과학적/사회적 사건 발생 여부 등 검증 가능한 단문으로 추출하세요.
3. searchQuery는 사실 확인 검색(Google Fact Check Tools API)에 입력할 1~3단어의 간결한 핵심 키워드(인물명, 사건명 등)로 구성하세요.
4. 반드시 지정된 JSON 형식으로만 응답하세요.

[응답 JSON 스키마]
{
  "articleSummary": "기사의 핵심 내용을 1~2문장으로 객관적 요약",
  "claims": [
    {
      "claimId": 1,
      "claimText": "검증 대상이 되는 명확한 사실 주장 문장",
      "searchQuery": "검색에 사용할 핵심 키워드",
      "context": "기사 내에서 이 주장이 언급된 배경"
    }
  ]
}`;

  const userPrompt = `[기사 제목]
${title || '제목 없음'}

[기사 본문]
${content}

위 기사에서 팩트체크가 필요한 핵심 주장 1~3개를 추출해 JSON으로 응답해 주세요.`;

  try {
    return await callGemini(
      [{ role: 'user', parts: [{ text: userPrompt }] }],
      systemPrompt
    );
  } catch (err) {
    console.warn(`[Gemini API] 온라인 추출 실패 (${err.message}) -> 스마트 로컬 분석 폴백 모드 가동`);
    return fallbackExtractClaims(title, content);
  }
}

/**
 * Gemini API 권한/할당량 오류 시 작동하는 지능형 로컬 폴백 주장 추출기
 */
function fallbackExtractClaims(title, content) {
  const isPlaceholderTitle = !title || title.includes('직접 입력한 텍스트') || title.length < 5;
  const cleanTitle = (title || '').replace(/\[.*?\]/g, '').trim();
  const paragraphs = (content || '').split('\n').map(p => p.trim()).filter(p => p.length > 20);

  // 문장 단위 분리
  const sentences = (content || '')
    .split(/(?<=[.?!])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 15 && s.length < 150);

  // 통계, 발표, 사건 관련 키워드 포함 문장 우선 탐색
  const factKeywords = ['백신', '마이크로칩', '칩', '5G', '빙하', '해빙', '온난화', '정부', '발표', '주장', '확인', '증가', '감소', '기록', '연구', '동결', '지급'];
  const candidates = sentences.filter(s => factKeywords.some(k => s.includes(k)));

  const claims = [];

  // 유효한 기사 제목이 있는 경우 첫 번째 주장으로 등록
  if (!isPlaceholderTitle && cleanTitle.length >= 8) {
    const pureClaim = cleanTitle.replace(/^(충격|경악|발칵|속보|단독)[!?,~ ]*/i, '').replace(/[?!~]+$/, '');
    claims.push({
      claimId: 1,
      claimText: pureClaim,
      searchQuery: pureClaim.slice(0, 30),
      context: '기사 제목에서 제기된 핵심 주장'
    });
  }

  // 본문에서 핵심 문장 1~2개 추출
  const primarySentence = candidates[0] || sentences[0];
  if (primarySentence && (!claims[0] || claims[0].claimText !== primarySentence)) {
    claims.push({
      claimId: claims.length + 1,
      claimText: primarySentence,
      searchQuery: primarySentence.slice(0, 30),
      context: '기사 본문에서 제기된 주요 사실 주장'
    });
  }

  const secondarySentence = candidates[1] || sentences[1];
  if (secondarySentence && secondarySentence !== primarySentence && claims.length < 2) {
    claims.push({
      claimId: claims.length + 1,
      claimText: secondarySentence,
      searchQuery: secondarySentence.slice(0, 30),
      context: '기사 본문 세부 서술 내용'
    });
  }

  return {
    articleSummary: (paragraphs[0] || primarySentence || '입력된 뉴스 본문 요약').slice(0, 200),
    claims: claims.length > 0 ? claims.slice(0, 3) : [
      {
        claimId: 1,
        claimText: (content || '').slice(0, 100),
        searchQuery: (content || '').slice(0, 30),
        context: '입력된 텍스트 내용'
      }
    ]
  };
}

/**
 * 2) 추출된 주장과 외부 API에서 수집한 실제 근거(Evidence) 대조 분석
 */
async function compareClaimWithEvidence(claimText, evidences) {
  const systemPrompt = `당신은 엄격하고 객관적인 AI 사실 확인(Fact-Check) 판정관입니다.
사용자의 주장과 외부 Fact Check API에서 실제로 수집된 근거 데이터를 대조하여 판정하세요.

[절대 규칙 - 환각(Hallucination) 방지]
1. 당신의 사전 학습된 기억이나 상식만으로 진위를 판단하지 마십시오. 오직 제공된 [근거 데이터]에 적힌 내용만을 바탕으로 판단해야 합니다.
2. 판정 결과("verdict")는 반드시 다음 3가지 중 하나만 선택하십시오:
   - "근거와 일치": 신뢰할 수 있는 외부 근거가 주장의 핵심 내용을 명확히 사실로 뒷받침할 때
   - "근거와 상충": 신뢰할 수 있는 외부 근거가 주장을 거짓, 왜곡, 사실무근으로 반박할 때
   - "근거 부족(확인 불가)": 외부 근거가 검색되지 않았거나, 제공된 근거만으로는 진위를 증명하거나 반박하기 불충분할 때
3. 만약 제공된 근거가 비어있거나 부족하다면, 절대로 그럴듯한 근거를 지어내지 말고 솔직하게 "근거 부족(확인 불가)"으로 판정하십시오.
4. 이유(reason)는 중립적인 어조로, 어떤 근거에 따라 왜 이러한 판정이 내려졌는지 2~3문장으로 설명하십시오.
5. 반드시 지정된 JSON 형식으로만 응답하십시오.

[응답 JSON 스키마]
{
  "verdict": "근거와 일치" | "근거와 상충" | "근거 부족(확인 불가)",
  "reason": "판정 근거 및 이유 설명 (2~3문장)",
  "evidenceSummary": "수집된 근거들의 핵심 요약 (근거가 없으면 '관련된 검증 보도를 찾을 수 없습니다.')",
  "confidence": "높음" | "중간" | "낮음"
}`;

  const evidenceText = (evidences && evidences.length > 0)
    ? JSON.stringify(evidences, null, 2)
    : "검색된 관련 팩트체크 근거 없음 (결과 0건)";

  const userPrompt = `[검증할 주장]
"${claimText}"

[외부 Fact Check API에서 수집된 실제 근거 데이터]
${evidenceText}

위 근거 데이터만을 바탕으로 주장의 진위를 대조 분석하여 JSON으로 응답해 주세요.`;

  try {
    return await callGemini(
      [{ role: 'user', parts: [{ text: userPrompt }] }],
      systemPrompt
    );
  } catch (err) {
    console.warn(`[Gemini API] 온라인 대조 분석 실패 (${err.message}) -> 증거 기반 로컬 폴백 판정기 가동`);
    return fallbackCompareWithEvidence(claimText, evidences);
  }
}

/**
 * Gemini API 실패 시 외부 API 실제 수집 근거를 기반으로 판정하는 로컬 분석기 (무환각 원칙 준수)
 */
function fallbackCompareWithEvidence(claimText, evidences) {
  // 실제 수집된 근거가 0건인 경우 -> 무환각 원칙: 즉시 '근거 부족(확인 불가)'
  if (!evidences || evidences.length === 0) {
    return {
      verdict: '근거 부족(확인 불가)',
      reason: 'Google Fact Check Tools API 검색 결과 관련된 공인 검증 보도가 존재하지 않아 진위를 확정할 수 없습니다.',
      evidenceSummary: '관련된 공인 팩트체크 보도를 찾지 못했습니다.',
      confidence: '낮음'
    };
  }

  // 수집된 근거가 있는 경우: rating 텍스트 분석
  const ratings = evidences.map(e => (e.rating || '').toLowerCase()).join(' ');
  const falseKeywords = ['사실 아님', 'false', '거짓', '허위', '왜곡', '조작', 'incorrect', 'pants on fire'];
  const trueKeywords = ['사실', 'true', '대체로 사실', 'correct', 'accurate'];

  const isFalse = falseKeywords.some(k => ratings.includes(k));
  const isTrue = trueKeywords.some(k => ratings.includes(k));

  if (isFalse) {
    const pub = evidences[0]?.publisher || '공인 팩트체크 기관';
    return {
      verdict: '근거와 상충',
      reason: `${pub} 등의 공인 검증 기관에서 해당 주장을 '${evidences[0]?.rating || '사실 아님'}'으로 공식 판정하여 주장의 내용과 상충합니다.`,
      evidenceSummary: evidences.map(e => `${e.publisher}: "${e.title}" (판정: ${e.rating})`).join(' / '),
      confidence: '높음'
    };
  }

  if (isTrue) {
    const pub = evidences[0]?.publisher || '공인 팩트체크 기관';
    return {
      verdict: '근거와 일치',
      reason: `${pub} 등의 검증 보도에서 해당 사실 관계가 타당하다고 확인되었습니다.`,
      evidenceSummary: evidences.map(e => `${e.publisher}: "${e.title}" (판정: ${e.rating})`).join(' / '),
      confidence: '높음'
    };
  }

  return {
    verdict: '근거 부족(확인 불가)',
    reason: '수집된 팩트체크 기사가 존재하지만 주장의 핵심 내용과 직접 부합하거나 반박하는지 명확하지 않습니다.',
    evidenceSummary: evidences.map(e => `${e.publisher}: "${e.title}"`).join(' / '),
    confidence: '보통'
  };
}

module.exports = {
  extractClaims,
  compareClaimWithEvidence
};
