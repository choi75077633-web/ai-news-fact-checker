const express = require('express');
const router = express.Router();
const { isUrl, scrapeArticle } = require('../services/scraper');
const { extractClaims, compareClaimWithEvidence } = require('../services/gemini');
const { searchFactChecks } = require('../services/factCheck');

/**
 * POST /api/check
 * 기사 URL 또는 텍스트를 받아 사실 확인을 수행하는 메인 엔드포인트
 */
router.post('/check', async (req, res) => {
  try {
    const { textOrUrl } = req.body;

    if (!textOrUrl || typeof textOrUrl !== 'string' || textOrUrl.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: '뉴스 기사 URL 또는 검증할 텍스트를 입력해 주세요.'
      });
    }

    const input = textOrUrl.trim();
    let title = '';
    let content = '';
    let sourceUrl = null;
    let isInputUrl = isUrl(input);

    // 1단계: 입력 처리 (URL 스크래핑 또는 텍스트 정제)
    if (isInputUrl) {
      try {
        const scraped = await scrapeArticle(input);
        title = scraped.title;
        content = scraped.content;
        sourceUrl = scraped.sourceUrl;
      } catch (scrapeErr) {
        return res.status(422).json({
          success: false,
          error: `URL에서 기사를 불러오지 못했습니다: ${scrapeErr.message}`
        });
      }
    } else {
      // 텍스트 직접 입력인 경우
      if (input.length < 20) {
        return res.status(400).json({
          success: false,
          error: '사실 확인을 위해 최소 20자 이상의 문장이나 기사 내용을 입력해 주세요.'
        });
      }

      // 첫 줄을 제목으로 추정하거나 본문 요약
      const lines = input.split('\n').map(l => l.trim()).filter(Boolean);
      title = lines.length > 1 ? lines[0] : '직접 입력한 텍스트';
      content = input.slice(0, 4000);
    }

    // 2단계: Gemini를 통한 핵심 주장 1~3개 추출
    let claimExtractionResult;
    try {
      claimExtractionResult = await extractClaims(title, content);
    } catch (geminiErr) {
      return res.status(500).json({
        success: false,
        error: `Gemini 핵심 주장 추출 실패: ${geminiErr.message}`
      });
    }

    const claims = claimExtractionResult.claims || [];
    const articleSummary = claimExtractionResult.articleSummary || '기사 요약 정보가 없습니다.';

    if (claims.length === 0) {
      return res.json({
        success: true,
        article: {
          title,
          summary: articleSummary,
          sourceUrl,
          isUrl: isInputUrl
        },
        disclaimer: '⚠️ AI 판단은 참고용이며 최종 확인은 직접 해야 합니다.',
        results: [],
        message: '입력된 내용에서 검증 가능한 사실적 주장을 찾지 못했습니다. 의견이나 주관적 주장이 아닌 객관적 사건/통계가 포함된 글을 입력해 주세요.'
      });
    }

    // 3단계 & 4단계: 각 주장별 Google Fact Check API 검색 + Gemini 대조 분석 병렬 실행
    const verificationResults = await Promise.all(
      claims.map(async (claim, index) => {
        const query = claim.searchQuery || claim.claimText;

        // 3-1. 실제 Fact Check Tools API 호출
        const evidences = await searchFactChecks(query, 'ko');

        // 3-2. Gemini 대조 분석 (환각 방지 원칙 적용)
        let analysis;
        try {
          analysis = await compareClaimWithEvidence(claim.claimText, evidences);
        } catch (compErr) {
          console.error(`[Verification] 주장 ${index + 1} 대조 분석 실패:`, compErr.message);
          analysis = {
            verdict: '근거 부족(확인 불가)',
            reason: '분석 중 오류가 발생하여 진위를 확인할 수 없습니다.',
            evidenceSummary: '대조 분석을 완료하지 못했습니다.',
            confidence: '낮음'
          };
        }

        // 라벨 강제 검증 (원칙: 근거와 일치, 근거와 상충, 근거 부족(확인 불가))
        let verdict = analysis.verdict;
        if (!['근거와 일치', '근거와 상충', '근거 부족(확인 불가)'].includes(verdict)) {
          verdict = '근거 부족(확인 불가)';
        }

        // 근거가 아예 없는데 일치/상충으로 잘못 판단했을 경우 방어 로직 (환각 방지 안전망)
        if (evidences.length === 0 && verdict !== '근거 부족(확인 불가)') {
          verdict = '근거 부족(확인 불가)';
          analysis.reason = '외부 Fact Check API에서 검색된 관련 검증 기사나 공인된 근거가 존재하지 않아 진위를 확정할 수 없습니다.';
        }

        return {
          claimId: claim.claimId || index + 1,
          claimText: claim.claimText,
          context: claim.context || '',
          searchQuery: query,
          verdict: verdict,
          reason: analysis.reason || '상세 사유가 제공되지 않았습니다.',
          evidenceSummary: analysis.evidenceSummary || '관련 근거 요약 없음',
          confidence: analysis.confidence || '보통',
          sources: evidences // 실제 검증 기관명 및 원문 링크 목록
        };
      })
    );

    // 최종 결과 반환
    res.json({
      success: true,
      article: {
        title,
        summary: articleSummary,
        sourceUrl,
        isUrl: isInputUrl
      },
      disclaimer: '⚠️ AI 판단은 참고용이며 최종 확인은 직접 해야 합니다.',
      results: verificationResults
    });
  } catch (err) {
    console.error('[Check Route Error]', err);
    res.status(500).json({
      success: false,
      error: `서버 내부 오류가 발생했습니다: ${err.message}`
    });
  }
});

module.exports = router;
