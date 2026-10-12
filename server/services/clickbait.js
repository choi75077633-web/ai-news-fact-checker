const axios = require('axios');

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODEL_NAME = 'gemini-1.5-flash';

/**
 * 기사 제목과 본문 내용의 일치 여부를 대조하여 낚시성 제목(Clickbait) 여부를 분석
 * @param {string} title - 기사 제목
 * @param {string} content - 기사 본문
 * @returns {Promise<Object>} 낚시성 분석 결과 객체
 */
async function detectClickbait(title, content) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    return {
      available: false,
      riskLevel: '확인 불가',
      score: 0,
      summary: 'Gemini API 키가 설정되지 않아 낚시성 제목 분석을 진행할 수 없습니다.',
      reasons: []
    };
  }

  // 제목이 없거나 너무 짧은 경우
  if (!title || title.trim().length < 3) {
    return {
      available: true,
      riskLevel: '낮음(신뢰)',
      score: 0,
      summary: '제목이 입력되지 않아 본문 위주로 분석되었습니다.',
      reasons: ['제목 정보 없음']
    };
  }

  const systemPrompt = `당신은 언론 저널리즘 및 미디어 리터러시 전문가입니다.
기사 제목과 기사 본문을 대조하여 "낚시성/어그로성 제목(Clickbait)" 여부를 엄밀하게 분석하세요.

[분석 기준]
1. 불일치/괴리: 제목에서 강조한 핵심 내용이 본문에 전혀 없거나 아주 미미하게 다뤄지는가?
2. 과장/왜곡: 본문은 단순한 가능성이나 일상적 사건인데, 제목에서 "충격", "발칵", "경악", "알고보니" 등 자극적인 어휘로 부풀렸는가?
3. 맥락 생략(Cherry-picking): 중요한 전제 조건이나 반대 사실을 의도적으로 누락하여 오해를 유도하는가?
4. 의문형 유도: 사실 확인이 안 된 루머를 의문형("~했나?", "~충격 진실?")으로 호기심만 유발하는가?

[응답 JSON 스키마]
{
  "riskLevel": "낮음(신뢰)" | "주의(과장 의심)" | "높음(낚시성 제목)",
  "score": 0부터 100 사이의 정수 (0: 제목과 본문 완벽 일치, 100: 심각한 낚시성),
  "summary": "제목과 본문 관계에 대한 1~2문장 핵심 총평",
  "reasons": [
    "구체적인 분석 이유 1",
    "구체적인 분석 이유 2"
  ],
  "titleTone": "중립적/보도형" | "과장/자극형" | "의문/호기심 유발형"
}`;

  const userPrompt = `[기사 제목]
"${title}"

[기사 본문 요약/발췌]
${content.slice(0, 3000)}

위 기사의 제목이 본문 내용을 왜곡하거나 과장하는 낚시성 제목인지 분석하여 JSON으로 응답해 주세요.`;

  try {
    const url = `${GEMINI_API_BASE}/${MODEL_NAME}:generateContent?key=${apiKey}`;
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
      { timeout: 20000 }
    );

    const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('응답을 생성하지 못했습니다.');
    }

    const result = JSON.parse(text);
    return {
      available: true,
      riskLevel: result.riskLevel || '낮음(신뢰)',
      score: typeof result.score === 'number' ? result.score : 20,
      summary: result.summary || '제목과 본문의 관련성이 적절합니다.',
      reasons: Array.isArray(result.reasons) ? result.reasons : [],
      titleTone: result.titleTone || '중립적/보도형'
    };
  } catch (err) {
    console.warn('[Clickbait] 분석 실패:', err.message);
    return {
      available: false,
      riskLevel: '확인 불가',
      score: 0,
      summary: `낚시성 제목 분석 중 오류가 발생했습니다: ${err.message}`,
      reasons: []
    };
  }
}

module.exports = {
  detectClickbait
};
