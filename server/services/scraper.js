const axios = require('axios');
const cheerio = require('cheerio');

/**
 * 문자열이 유효한 HTTP/HTTPS URL인지 검사
 */
function isUrl(string) {
  try {
    const url = new URL(string.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

/**
 * URL에서 기사 제목과 본문 텍스트를 추출
 */
async function scrapeArticle(targetUrl) {
  try {
    const response = await axios.get(targetUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    });

    const $ = cheerio.load(response.data);

    // 불필요한 스크립트, 스타일, 광고, 주석 요소 제거
    $('script, style, noscript, nav, header, footer, aside, iframe, .ad, .ads, .advertisement, .comment, #comment, .sns_share').remove();

    // 1. 제목 추출
    let title = $('meta[property="og:title"]').attr('content') ||
                $('meta[name="twitter:title"]').attr('content') ||
                $('h1').first().text().trim() ||
                $('title').text().trim() ||
                '제목 없음';

    title = title.replace(/\s+/g, ' ').trim();

    // 2. 주요 뉴스 본문 셀렉터 탐색
    const contentSelectors = [
      '#dic_area',                    // 네이버 뉴스 본문
      '#newsct_article',               // 네이버 뉴스 신규
      '#articleBodyContents',          // 구 네이버 뉴스
      '#dmcfContents',                 // 다음 뉴스 본문
      '.article_view',                 // 다음 뉴스 신규
      'article',                       // 표준 article 태그
      '.article-body',                 // 일반 언론사 본문
      '.article_body',
      '.news-content',
      '#article-view-content-div',
      '.entry-content',
      'main'
    ];

    let contentText = '';

    for (const selector of contentSelectors) {
      const el = $(selector);
      if (el.length > 0) {
        // 단락(p)들을 줄바꿈과 함께 수집
        const paragraphs = [];
        el.find('p').each((_, p) => {
          const t = $(p).text().trim();
          if (t.length > 15) paragraphs.push(t);
        });

        if (paragraphs.length > 0) {
          contentText = paragraphs.join('\n\n');
        } else {
          contentText = el.text().trim();
        }

        if (contentText.length > 100) break;
      }
    }

    // 셀렉터로 못 찾은 경우 전체 p 태그 수집
    if (!contentText || contentText.length < 100) {
      const paragraphs = [];
      $('p').each((_, p) => {
        const t = $(p).text().trim();
        if (t.length > 20) paragraphs.push(t);
      });
      contentText = paragraphs.join('\n\n');
    }

    // 공백 정리
    contentText = contentText.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

    if (!contentText || contentText.length < 30) {
      throw new Error('기사 본문 내용을 충분히 추출하지 못했습니다. 본문 텍스트를 직접 복사해서 입력창에 붙여넣어 주세요.');
    }

    // Gemini 토큰 및 요청 제한을 위해 최대 4,000자로 절삭
    const truncatedContent = contentText.slice(0, 4000);

    return {
      title,
      content: truncatedContent,
      sourceUrl: targetUrl,
      isScraped: true
    };
  } catch (err) {
    if (err.response && err.response.status === 403) {
      throw new Error('해당 웹사이트의 접근이 제한되어 기사를 가져올 수 없습니다. 본문 텍스트를 복사해서 직접 붙여넣어 주세요.');
    }
    throw new Error(err.message || 'URL에서 기사 내용을 가져오는 중 오류가 발생했습니다.');
  }
}

module.exports = {
  isUrl,
  scrapeArticle
};
