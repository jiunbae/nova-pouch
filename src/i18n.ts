/* ============================================================
   i18n.ts — Lightweight i18n (ko / en)
   No library, no build step. data-i18n attribute system.
   ============================================================ */

import type { Locale } from './types';

const STORAGE_KEY = 'nova-pouch-locale';
const DEFAULT_LOCALE: Locale = 'ko';

/* ----------------------------------------------------------
   String Table
   ---------------------------------------------------------- */

const STRINGS: Record<Locale, Record<string, string>> = {
  ko: {
    // Idle
    'idle.subtitle':        '막을 건너온 사소한 물건들,\n그 너머에 존재하는 것은\n거대한 세계와 사람들.\n할 수 있는 것은 오직 상상하는 일뿐.',
    'idle.subtitle.source': '— 김초엽, <양면의 조개껍데기> 중 <비구름을 따라서>',
    'idle.start':           '시작하기',
    'idle.history':         '기록 보관소',
    'idle.rule1':           '세 개의 주머니에서 파편을 하나씩 뽑으세요',
    'idle.rule2':           '물건 + 속성 + 제약의 조합이 만들어집니다',
    'idle.rule3':           '이 조합이 일상인 세계를 상상하고 기록하세요',

    // Pouch names / lore
    'pouch.red.name':       '물건',
    'pouch.blue.name':      '속성',
    'pouch.green.name':     '제약',
    'pouch.red.lore':       '물질계',
    'pouch.blue.lore':      '성질계',
    'pouch.green.lore':     '규율계',
    'pouch.red.label':      '빨간 주머니',
    'pouch.blue.label':     '파란 주머니',
    'pouch.green.label':    '초록 주머니',
    'pouch.red.desc':       '물건의 파편',
    'pouch.blue.desc':      '속성의 파편',
    'pouch.green.desc':     '제약의 파편',

    // Draw steps
    'draw.red.instruction':    '빨간 주머니를 열어보세요',
    'draw.blue.instruction':   '파란 주머니를 열어보세요',
    'draw.green.instruction':  '초록 주머니를 열어보세요',
    'draw.sub':                '주머니를 탭하면 파편이 나타납니다',
    'draw.confirm':            '다음',
    'draw.redraw':             '다시 뽑기',
    'draw.redraw.used':        '사용 완료',

    // Review
    'review.prompt':        '이 물건이 일상적으로 쓰이는\n세계는 어떤 모습일까요?',
    'review.write':         '이 세계를 상상하기',
    'review.retry':         '다시 탐험하기',

    // Writing
    'writing.storyPlaceholder': '이 세계는 어떤 곳인가요?\n누가 이 물건을 사용하나요?\n왜 이 물건이 필요한가요?\n이 물건의 제약은 어떤 의미를 가지나요?',
    'writing.complete':     '기록 완료',
    'writing.completeMin':  '기록 완료',

    // Complete
    'complete.title':       '세계가 기록되었습니다',
    'complete.ratingLabel': '이 기록에 별점을 매겨주세요:',
    'complete.restart':     '다시 탐험',
    'complete.share':       '공유하기',
    'complete.history':     '기록 보관소',
    'complete.noName':      '이름 없는 세계',

    // History
    'history.back':         '← 돌아가기',
    'history.title':        '기록 보관소',
    'history.statsTotal':   '총 {count}개의 세계를 기록',
    'history.statsAvg':     '평균 ★ {avg}',
    'history.empty':        '아직 기록된 세계가 없습니다.',
    'history.worldPrefix':  '세계: ',
    'history.deleteAll':    '전체 기록 삭제',

    // Announce (live region)
    'announce.minLength':   '기록은 50자 이상 작성해야 합니다.',
    'announce.copied':      '기록이 클립보드에 복사되었습니다.',
    'announce.shareError':  '공유 중 오류가 발생했습니다.',
    'announce.noShare':     '공유를 지원하지 않는 환경입니다.',
    'announce.deleted':     '모든 기록이 삭제되었습니다.',
    'announce.redraw.used': '{lore} 파우치는 다시 뽑기를 이미 사용했습니다.',
    'announce.token.found': '{lore} 파편 발견: {label} {emoji}',

    // Confirm dialog
    'confirm.deleteAll':    '기록 보관소를 모두 비우시겠습니까?',
    'confirm.backHome':     '홈으로 돌아가시겠습니까? 진행 중인 기록은 사라질 수 있습니다.',


    // Share text
    'share.title':          '✦ Nova Pouch 기록 ✦',
    'share.world':          '세계: {name}',
    'share.fragment':       '파편: {combo}',
    'share.record':         '기록: {story}',
    'share.noCombo':        '조합 없음',
    'share.shareTitle':     'Nova Pouch 기록',

    // Aria labels
    'aria.pouch.red':       '빨간 주머니',
    'aria.pouch.blue':      '파란 주머니',
    'aria.pouch.green':     '초록 주머니',
    'aria.pouch.open.red':  '빨간 주머니 열기',
    'aria.pouch.open.blue': '파란 주머니 열기',
    'aria.pouch.open.green':'초록 주머니 열기',
    'aria.draw.red':        '빨간 주머니에서 토큰 뽑기',
    'aria.draw.blue':       '파란 주머니에서 토큰 뽑기',
    'aria.draw.green':      '초록 주머니에서 토큰 뽑기',
    'aria.start':           '게임 시작',
    'aria.historyOpen':     '기록 보관소 열기',
    'aria.confirm':         '확인',
    'aria.redraw':          '다시 뽑기',
    'aria.write':           '이 세계를 상상하기',
    'aria.retry':           '다시 탐험하기',
    'aria.complete':        '기록 완료',
    'aria.restart':         '다시 탐험하기',
    'aria.share':           '공유하기',
    'aria.history':         '기록 보관소',
    'aria.close':           '닫기',
    'aria.deleteAll':       '전체 기록 삭제',
    'aria.starRating':      '별점 선택',
    'aria.star':            '{n}점',
    'aria.starRate':        '{n}점 평가',
    'aria.worldInput':      '세계 이름 입력',
    'aria.storyInput':      '세계 기록 입력',
    'aria.token.fragment':  '{lore} 파편: {label}',

    // Daily
    'daily.banner':         '오늘의 조합',
    'daily.banner.number':  '#${n}',
    'daily.puzzleLabel':    'Day #{n}',
    'daily.alreadyComplete':'오늘의 기록을 완료했습니다',
    'daily.viewRecord':     '기록 보기',
    'daily.freePlay':       '자유 모드',

    // Countdown
    'countdown.label':      '새로운 물건이 도착하기까지',
    'countdown.nextPuzzle': '새로운 물건이 준비됩니다',

    // Feed
    'feed.button':          '다른 세계의 기록',
    'feed.title':           '다른 세계의 기록',
    'feed.back':            '← 돌아가기',
    'feed.loadMore':        '더 보기',
    'feed.empty':           '아직 기록이 없습니다. 첫 번째 기록을 남겨보세요!',
    'feed.error':           '기록을 불러올 수 없습니다',
    'feed.retry':           '다시 시도',
    'feed.offline':         '오프라인 상태입니다',
    'feed.like':            '좋아요',
    'feed.anonymous':       '익명의 기록자',
    'feed.seeOthers':       '다른 사람들은 어떻게 상상했을까?',
    'feed.todayCount':      '오늘',
    'feed.todayCountSuffix':'개의 세계가 기록되었습니다',

    // Share panel
    'share.download':       '이미지 저장',
    'share.twitter':        'Twitter',
    'share.native':         '공유',
    'share.clipboard':      '복사됨!',
    'share.generating':     '이미지 생성 중...',
    'share.copyResult':     '결과 복사',
    'share.moreOptions':    '더 많은 공유 옵션',

    // Complete additions
    'complete.submitted':   '커뮤니티에 공유되었습니다',
    'complete.submitFailed':'공유에 실패했습니다 (로컬에 저장됨)',

    // Footer
    'footer.feedback':      '의견 보내기',

    // Auth
    'auth.login':           '로그인',
    'auth.loginTitle':      '로그인',
    'auth.logout':          '로그아웃',
    'auth.savePrompt':      '로그인하면 기록이 계정에 저장됩니다',
    'auth.saveLogin':       '로그인하고 기록 저장하기',
    'auth.google':          'Google 계정으로 로그인',
    'auth.github':          'GitHub로 로그인',
    'auth.kakao':           '카카오 로그인',
    'auth.naver':           '네이버로 로그인',
    'auth.twitter':         'X로 로그인',

    // Lang toggle
    'lang.toggle':          'EN',
  },

  en: {
    // Idle
    'idle.subtitle':        'Trivial objects that crossed the veil,\nbeyond them lie vast worlds and people.\nAll you can do is imagine.',
    'idle.subtitle.source': '— Kim Choyeop, <Following the Rain Clouds>',
    'idle.start':           'Start',
    'idle.history':         'Archive',
    'idle.rule1':           'Draw one fragment from each of three pouches',
    'idle.rule2':           'An Object + Property + Constraint combo is formed',
    'idle.rule3':           'Imagine and record a world where this combo is everyday life',

    // Pouch names / lore
    'pouch.red.name':       'Object',
    'pouch.blue.name':      'Property',
    'pouch.green.name':     'Constraint',
    'pouch.red.lore':       'Material Realm',
    'pouch.blue.lore':      'Property Realm',
    'pouch.green.lore':     'Constraint Realm',
    'pouch.red.label':      'Red Pouch',
    'pouch.blue.label':     'Blue Pouch',
    'pouch.green.label':    'Green Pouch',
    'pouch.red.desc':       'Object fragment',
    'pouch.blue.desc':      'Property fragment',
    'pouch.green.desc':     'Constraint fragment',

    // Draw steps
    'draw.red.instruction':    'Open the Red Pouch',
    'draw.blue.instruction':   'Open the Blue Pouch',
    'draw.green.instruction':  'Open the Green Pouch',
    'draw.sub':                'Tap the pouch to reveal a fragment',
    'draw.confirm':            'Confirm',
    'draw.redraw':             'Redraw',
    'draw.redraw.used':        'Used',

    // Review
    'review.prompt':        'What would a world look like\nwhere this item is used daily?',
    'review.write':         'Imagine this world',
    'review.retry':         'Explore again',

    // Writing
    'writing.storyPlaceholder': 'What kind of place is this world?\nWho uses this item?\nWhy is this item needed?\nWhat does the constraint mean?',
    'writing.complete':     'Complete',
    'writing.completeMin':  'Complete',

    // Complete
    'complete.title':       'A world has been recorded',
    'complete.ratingLabel': 'Rate this record:',
    'complete.restart':     'Explore again',
    'complete.share':       'Share',
    'complete.history':     'Archive',
    'complete.noName':      'Unnamed world',

    // History
    'history.back':         '← Back',
    'history.title':        'Archive',
    'history.statsTotal':   '{count} worlds recorded',
    'history.statsAvg':     'Avg ★ {avg}',
    'history.empty':        'No worlds recorded yet.',
    'history.worldPrefix':  'World: ',
    'history.deleteAll':    'Delete all records',

    // Announce (live region)
    'announce.minLength':   'Records must be at least 50 characters.',
    'announce.copied':      'Record copied to clipboard.',
    'announce.shareError':  'An error occurred while sharing.',
    'announce.noShare':     'Sharing is not supported in this environment.',
    'announce.deleted':     'All records have been deleted.',
    'announce.redraw.used': 'Redraw already used for {lore} pouch.',
    'announce.token.found': '{lore} fragment found: {label} {emoji}',

    // Confirm dialog
    'confirm.deleteAll':    'Clear the entire archive?',
    'confirm.backHome':     'Return to home? Your current progress might be lost.',

    // Share text
    'share.title':          '✦ Nova Pouch Record ✦',
    'share.world':          'World: {name}',
    'share.fragment':       'Fragments: {combo}',
    'share.record':         'Record: {story}',
    'share.noCombo':        'No combo',
    'share.shareTitle':     'Nova Pouch Record',

    // Aria labels
    'aria.pouch.red':       'Red Pouch',
    'aria.pouch.blue':      'Blue Pouch',
    'aria.pouch.green':     'Green Pouch',
    'aria.pouch.open.red':  'Open Red Pouch',
    'aria.pouch.open.blue': 'Open Blue Pouch',
    'aria.pouch.open.green':'Open Green Pouch',
    'aria.draw.red':        'Draw token from Red Pouch',
    'aria.draw.blue':       'Draw token from Blue Pouch',
    'aria.draw.green':      'Draw token from Green Pouch',
    'aria.start':           'Start game',
    'aria.historyOpen':     'Open archive',
    'aria.confirm':         'Confirm',
    'aria.redraw':          'Redraw',
    'aria.write':           'Imagine this world',
    'aria.retry':           'Explore again',
    'aria.complete':        'Complete record',
    'aria.restart':         'Explore again',
    'aria.share':           'Share',
    'aria.history':         'Archive',
    'aria.close':           'Close',
    'aria.deleteAll':       'Delete all records',
    'aria.starRating':      'Star rating',
    'aria.star':            '{n} stars',
    'aria.starRate':        'Rate {n} stars',
    'aria.worldInput':      'Enter world name',
    'aria.storyInput':      'Enter world record',
    'aria.token.fragment':  '{lore} fragment: {label}',

    // Daily
    'daily.banner':         "Today's Combination",
    'daily.banner.number':  '#${n}',
    'daily.puzzleLabel':    'Day #{n}',
    'daily.alreadyComplete':"Today's record is complete",
    'daily.viewRecord':     'View Record',
    'daily.freePlay':       'Free Play',

    // Countdown
    'countdown.label':      'Until the next objects arrive',
    'countdown.nextPuzzle': 'The next objects will be ready',

    // Feed
    'feed.button':          'Records from Other Worlds',
    'feed.title':           'Records from Other Worlds',
    'feed.back':            '← Back',
    'feed.loadMore':        'Load More',
    'feed.empty':           'No records yet. Be the first!',
    'feed.error':           'Unable to load records',
    'feed.retry':           'Retry',
    'feed.offline':         "You're offline",
    'feed.like':            'Like',
    'feed.anonymous':       'Anonymous Archivist',
    'feed.seeOthers':       'How did others imagine this world?',
    'feed.todayCount':      'Today,',
    'feed.todayCountSuffix':'worlds have been recorded',

    // Share panel
    'share.download':       'Save Image',
    'share.twitter':        'Twitter',
    'share.native':         'Share',
    'share.clipboard':      'Copied!',
    'share.generating':     'Generating image...',
    'share.copyResult':     'Copy Result',
    'share.moreOptions':    'More sharing options',

    // Complete additions
    'complete.submitted':   'Shared with the community',
    'complete.submitFailed':'Share failed (saved locally)',

    // Footer
    'footer.feedback':      'Send Feedback',

    // Auth
    'auth.login':           'Login',
    'auth.loginTitle':      'Login',
    'auth.logout':          'Logout',
    'auth.savePrompt':      'Log in to save records to your account',
    'auth.saveLogin':       'Log in and save record',
    'auth.google':          'Sign in with Google',
    'auth.github':          'Sign in with GitHub',
    'auth.kakao':           'Sign in with Kakao',
    'auth.naver':           'Sign in with Naver',
    'auth.twitter':         'Sign in with X',

    // Lang toggle
    'lang.toggle':          '한국어',
  },
};

/* ----------------------------------------------------------
   State
   ---------------------------------------------------------- */

let _locale: Locale = DEFAULT_LOCALE;

/* ----------------------------------------------------------
   Public API
   ---------------------------------------------------------- */

/**
 * Initialise locale from localStorage. Call once on startup.
 */
export function initI18n(): void {
  const stored = localStorage.getItem(STORAGE_KEY);
  _locale = (stored === 'en' || stored === 'ko') ? stored : DEFAULT_LOCALE;
  document.documentElement.setAttribute('lang', _locale);
}

/**
 * Get the current locale.
 */
export function getLocale(): Locale {
  return _locale;
}

/**
 * Set locale, persist, and update <html lang>.
 */
export function setLocale(locale: Locale): void {
  _locale = (locale === 'en' || locale === 'ko') ? locale : DEFAULT_LOCALE;
  localStorage.setItem(STORAGE_KEY, _locale);
  document.documentElement.setAttribute('lang', _locale);
}

/**
 * Translate a key with optional {placeholder} interpolation.
 * Falls back: current locale -> ko -> raw key.
 */
export function t(key: string, vars?: Record<string, string | number>): string {
  let str = STRINGS[_locale]?.[key] ?? STRINGS.ko?.[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replaceAll(`{${k}}`, String(v));
    }
  }
  return str;
}

/**
 * Walk the DOM and update elements bearing data-i18n attributes.
 */
export function updateDOM(): void {
  // data-i18n -> textContent (supports <br> via innerHTML when \n present)
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (!key) return;
    const text = t(key);
    if (text.includes('\n')) {
      const htmlEl = el as HTMLElement;
      htmlEl.textContent = '';
      text.split('\n').forEach((part, i) => {
        if (i > 0) htmlEl.appendChild(document.createElement('br'));
        htmlEl.appendChild(document.createTextNode(part));
      });
    } else {
      el.textContent = text;
    }
  });

  // data-i18n-placeholder -> placeholder attribute
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key) el.setAttribute('placeholder', t(key));
  });

  // data-i18n-aria -> aria-label attribute
  document.querySelectorAll('[data-i18n-aria]').forEach(el => {
    const key = el.getAttribute('data-i18n-aria');
    if (key) el.setAttribute('aria-label', t(key));
  });
}
