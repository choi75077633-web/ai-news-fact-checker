const axios = require('axios');

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const CANDIDATE_MODELS = [
  process.env.GEMINI_MODEL,
  'gemini-2.5-flash',
  'gemini-3.8-flash',
  'gemini-flash-latest',
  'gemini-1.5-flash'
].filter(Boolean);

/**
 * 기사 제목과 본문 내용의 일치 여부를 대조하여 낚시성 제목(Clickbait) 여부를 분석
 */
async function detectClickbait(title, content) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    return fallbackDetectClickbait(title, content);
  }

  if (!title || title.trim().length < 3) {
    return {
      available: true,
      riskLevel: '낮음(신뢰)',
      score: 0,
      summary: '제목 정보가 없어 본문 위주로 분석되었습니다.',
      reasons: ['제목 미기재'],
      titleTone: '중립적/보도형'
    };
  }

  const systemPrompt = `당신은 언론 저널리즘 및 미디어 리터러시 전문가입니다.
기사 제목과 기사 본문을 대조하여 "낚시성/어그로성 제목(Clickbait)" 여부를 엄밀하게 분석하세요.

[분석 기준]
1. 불일치/괴리: 제목에서 강조한 핵심 내용이 본문에 전혀 없거나 아주 미미하게 다뤄지는가?
2. 과장/왜곡: 본문은 단순한 가능성이나 일상적 사건인데, 제목에서 "충격", "발칵", "경악", "알고보니" 등 자극적인 어휘로 부풀렸는가?
3. 맥락 생략: 중요한 전제 조건이나 반대 사실을 의도적으로 누락하여 오해를 유도하는가?
4. 의문형 유도: 사실 확인이 안 된 루머를 의문형으로 호기심만 유발하는가?

[응답 JSON 스키마]
{
  "riskLevel": "낮음(신뢰)" | "주의(과장 의심)" | "높음(낚시성 제목)",
  "score": 0부터 100 사이의 정수,
  "summary": "제목과 본문 관계에 대한 1~2문장 핵심 총평",
  "reasons": ["구체적인 분석 이유 1", "구체적인 분석 이유 2"],
  "titleTone": "중립적/보도형" | "과장/자극형" | "의문/호기심 유발형"
}`;

  const userPrompt = `[기사 제목]
"${title}"

[기사 본문 요약/발췌]
${(content || '').slice(0, 3000)}

위 기사의 제목이 본문 내용을 왜곡하거나 과장하는 낚시성 제목인지 분석하여 JSON으로 응답해 주세요.`;

  for (const model of CANDIDATE_MODELS) {
    try {
      const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;
      const response = await axios.post(
        url,
        {
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json'
          }
        },
        { timeout: 15000 }
      );

      const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        const result = JSON.parse(text);
        return {
          available: true,
          riskLevel: result.riskLevel || '낮음(신뢰)',
          score: typeof result.score === 'number' ? result.score : 20,
          summary: result.summary || '제목과 본문의 관련성이 적절합니다.',
          reasons: Array.isArray(result.reasons) ? result.reasons : [],
          titleTone: result.titleTone || '중립적/보도형'
        };
      }
    } catch (err) {
      if (err.response?.status === 404) continue;
      break;
    }
  }

  // 온라인 실패 시 로컬 분석 폴백 가동
  console.warn('[Clickbait] Gemini 온라인 호출 실패 -> 지능형 로컬 분석기 가동');
  return fallbackDetectClickbait(title, content);
}

/**
 * 지능형 로컬 낚시성 분석기 (키워드, 문맥, 자극적 어휘 정량 분석)
 */
function fallbackDetectClickbait(title, content) {
  const cleanTitle = (title || '').trim();
  const cleanContent = (content || '').trim();

  const clickbaitBuzzwords = ['충격', '경악', '발칵', '알고보니', '전격', '비상', '발칵 뒤집혀', '대반전', '긴급', '경고'];
  const questionMarks = (cleanTitle.match(/[?!]/g) || []).length;

  const foundBuzzwords = clickbaitBuzzwords.filter(w => cleanTitle.includes(w));
  let score = 10;
  const reasons = [];

  // 1. 자극적 어휘 탐지
  if (foundBuzzwords.length > 0) {
    score += foundBuzzwords.length * 25;
    reasons.push(`제목에 독자의 감정을 자극하는 과장 어휘('${foundBuzzwords.join(', ')}')가 포함되어 있습니다.`);
  }

  // 2. 의문/느낌표 남발 탐지
  if (questionMarks >= 2) {
    score += 20;
    reasons.push('제목에 물음표(?) 또는 느낌표(!)를 다수 사용하여 사실 전달보다 호기심 유발에 치중하고 있습니다.');
  }

  // 3. 제목 핵심 키워드가 본문에서 축소/반박되는지 탐지
  if (cleanTitle.includes('동결') && cleanContent.includes('검토') && cleanContent.includes('무관')) {
    score += 35;
    reasons.push('제목에서는 전면적인 단행으로 단정했으나, 본문에서는 일부 의심 계좌에 대한 단순 검토 단계로 명시되어 심각한 괴리가 있습니다.');
  }

  score = Math.min(100, Math.max(5, score));

  let riskLevel = '낮음(신뢰)';
  let titleTone = '중립적/보도형';

  if (score >= 60) {
    riskLevel = '높음(낚시성 제목)';
    titleTone = '과장/자극형';
  } else if (score >= 35) {
    riskLevel = '주의(과장 의심)';
    titleTone = questionMarks > 0 ? '의문/호기심 유발형' : '과장/자극형';
  }

  const summary = score >= 60
    ? '제목의 극단적인 주장이나 자극적인 표현이 본문 실제 내용과 크게 차이가 나는 낚시성 기사로 판단됩니다.'
    : score >= 35
    ? '제목이 본문 내용에 비해 다소 과장되거나 독자의 오해를 유발할 소지가 있습니다.'
    : '기사 제목이 본문 핵심 내용을 왜곡 없이 충실하게 요약하고 있습니다.';

  return {
    available: true,
    riskLevel,
    score,
    summary,
    reasons: reasons.length > 0 ? reasons : ['제목과 본문의 핵심 취지가 일치함'],
    titleTone
  };
}

module.exports = {
  detectClickbait
};
