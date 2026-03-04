import { gameState, ACTIONS } from './state';
import { initRenderer, refreshLocale } from './renderer';
import { initPouch } from './pouch';
import { loadHistory, saveSession, deleteAllHistory } from './history';
import { calculateDifficulty } from './tokens';
import { debounce, generateId } from './utils';
import { initI18n, setLocale, getLocale, t, updateDOM } from './i18n';
import {
  prefetchDailyTokens,
  getDailyTokens,
  todayDateString,
  getDailyNumber,
  markDailyComplete,
  isDailyComplete,
  getDailyCompletion,
} from './daily';
import { startCountdown, stopCountdown } from './countdown';
import { downloadShareCard, shareToTwitter, nativeShare, buildCompactShare } from './share';
import { submitRecord } from './feed';
import type { GameStateSnapshot, HistoryData, HistorySession, FeedState, DailyCompletion, Token, PouchColor } from './types';

const MIN_STORY_LENGTH = 50;
const MAX_STORY_LENGTH = 2000;

document.addEventListener('DOMContentLoaded', () => {
  bootstrap();
});

function bootstrap(): void {
  initI18n();
  updateDOM();

  initRenderer(gameState, loadHistory);

  // Home button
  bindButtons(['#btn-home'], () => {
    const state = gameState.getState();
    if (state.phase !== 'IDLE' && state.phase !== 'COMPLETE') {
      if (!confirm(t('confirm.backHome'))) return;
    }
    dispatchAction('RESTART');
    checkDailyState();
  });

  // View record detail from history
  bindButtons(['[data-action="view-record-detail"]'], (event) => {
    // This is handled via state subscription for complex payloads
  });

  if (typeof gameState?.subscribe === 'function') {
    gameState.subscribe((state, action, payload) => {
      if (action === 'VIEW_RECORD_DETAIL' && payload) {
        const { session } = payload as { session: HistorySession };
        const historyEl = document.getElementById('layer-history');
        if (historyEl) closeOverlay(historyEl);

        dispatchAction('SET_GAME_MODE', 'free');
        if (session.tokens.red) dispatchAction('DRAW_TOKEN', { pouch: 'red', token: session.tokens.red });
        dispatchAction('CONFIRM_TOKEN');
        if (session.tokens.blue) dispatchAction('DRAW_TOKEN', { pouch: 'blue', token: session.tokens.blue });
        dispatchAction('CONFIRM_TOKEN');
        if (session.tokens.green) dispatchAction('DRAW_TOKEN', { pouch: 'green', token: session.tokens.green });
        dispatchAction('CONFIRM_TOKEN');
        if (session.userStory) dispatchAction('UPDATE_STORY', session.userStory);
        dispatchAction('COMPLETE');
      }
      syncStarsFromState(state);
      syncWritingValidation(state?.userStory || '');
    });
  }

  const history = loadHistory();
  updateHistoryPreview(history);

  initPouch(gameState);
  initHistoryNavigation(gameState);
  prefetchDailyTokens();
  initDailyBanner();
  bindAllButtons();
  bindFeedButtons();
  bindSharePanel();
  hideUnsupportedShareButtons();
  bindLangToggle();
  bindWritingInputs();
  applyAccessibilityLabels();
  initOverlayKeyHandlers();
  checkDailyState();
  initTheme();
  bindThemeToggle();

  // --- Check for shared result link ---
  handleSharedLink();
}

async function handleSharedLink(): Promise<void> {
  const urlParams = new URLSearchParams(window.location.search);
  const recordId = urlParams.get('r');
  const redId = urlParams.get('red');
  const blueId = urlParams.get('blue');
  const greenId = urlParams.get('green');
  const story = urlParams.get('story');

  if (recordId) {
    try {
      const { fetchRecord } = await import('./feed');
      const record = await fetchRecord(recordId);
      if (record && record.tokens) {
        dispatchAction('SET_GAME_MODE', 'free');
        if (record.tokens.red) dispatchAction('DRAW_TOKEN', { pouch: 'red', token: record.tokens.red });
        dispatchAction('CONFIRM_TOKEN');
        if (record.tokens.blue) dispatchAction('DRAW_TOKEN', { pouch: 'blue', token: record.tokens.blue });
        dispatchAction('CONFIRM_TOKEN');
        if (record.tokens.green) dispatchAction('DRAW_TOKEN', { pouch: 'green', token: record.tokens.green });
        dispatchAction('CONFIRM_TOKEN');
        if (record.story) dispatchAction('UPDATE_STORY', record.story);
        dispatchAction('SUBMIT_RECORD', { recordId });
        dispatchAction('COMPLETE');
        return;
      }
    } catch (e) {
      console.error('Failed to fetch shared record:', e);
    }
  }

  if (redId && blueId && greenId) {
    const { getTokenById } = await import('./tokens');
    const red = getTokenById('red', redId);
    const blue = getTokenById('blue', blueId);
    const green = getTokenById('green', greenId);

    if (red && blue && green) {
      dispatchAction('SET_GAME_MODE', 'free');
      dispatchAction('DRAW_TOKEN', { pouch: 'red', token: red });
      dispatchAction('CONFIRM_TOKEN');
      dispatchAction('DRAW_TOKEN', { pouch: 'blue', token: blue });
      dispatchAction('CONFIRM_TOKEN');
      dispatchAction('DRAW_TOKEN', { pouch: 'green', token: green });
      dispatchAction('CONFIRM_TOKEN');
      if (story) {
        dispatchAction('UPDATE_STORY', story);
      }
      dispatchAction('COMPLETE');
    }
  }
}

const FORWARD_ACTIONS: Set<string> = new Set([
  ACTIONS.START_GAME,
  ACTIONS.CONFIRM_TOKEN,
  ACTIONS.START_WRITING,
  ACTIONS.COMPLETE,
]);

function initHistoryNavigation(stateInstance: typeof gameState): void {
  let isHandlingPopState = false;

  window.addEventListener('popstate', () => {
    isHandlingPopState = true;
    stateInstance.dispatch(ACTIONS.GO_BACK);
    isHandlingPopState = false;
  });

  stateInstance.subscribe((_state, action) => {
    if (isHandlingPopState) return;
    if (FORWARD_ACTIONS.has(action)) {
      history.pushState(null, '');
    }
  });
}

function bindAllButtons(): void {
  // Start game
  bindButtons(['[data-action="start-game"]', '#btn-start'], (event) => {
    const btn = document.getElementById('btn-start') as HTMLElement | null;
    const mode = (event?.currentTarget as HTMLElement)?.dataset?.mode || btn?.dataset.mode || 'daily';
    dispatchAction('SET_GAME_MODE', mode);
    dispatchAction('START_GAME');
  });

  bindButtons(['#btn-free-play', '#btn-free-play-after'], () => {
    dispatchAction('SET_GAME_MODE', 'free');
    dispatchAction('START_GAME');
  });

  // Morphing CTA: "이 세계를 기록하기" (REVIEW) → "기록 완료" (WRITING)
  bindButtons(['#btn-start-writing', '#step-btn-write'], async (event) => {
    const state = readState();
    if (state?.phase === 'WRITING') {
      // === Complete logic ===
      event.preventDefault();

      const storyText = getStoryText();
      if (!isStoryValid(storyText)) {
        syncWritingValidation(storyText, true);
        announce(t('announce.minLength'));
        focusStoryInput();
        return;
      }

      const sessionSnapshot = readState();
      const mode = sessionSnapshot?.gameMode === 'free' ? 'free' : 'daily';

      dispatchAction('UPDATE_STORY', storyText);
      const session = createSession(sessionSnapshot, storyText);
      dispatchAction('COMPLETE');
      const historyResult = saveSession(session);
      updateHistoryPreview(historyResult);

      if (mode === 'daily') {
        markDailyComplete({
          id: session.id as string,
          tokens: session.tokens as Record<string, unknown>,
          story: storyText,
          rating: Number(sessionSnapshot?.rating) || 0,
        });

        const countdownSection = document.getElementById('daily-countdown-section');
        const countdownTimer = document.getElementById('countdown-timer');
        if (countdownSection && countdownTimer) {
          countdownSection.removeAttribute('hidden');
          startCountdown(countdownTimer);
        }
      }

      const todayCountWrap = document.getElementById('today-record-count');
      const todayCountNumber = document.getElementById('today-count-number');
      if (todayCountWrap) {
        todayCountWrap.setAttribute('hidden', '');
      }
      if (todayCountNumber) {
        todayCountNumber.textContent = '0';
      }

      autoSubmitRecord({ ...sessionSnapshot, userStory: storyText } as GameStateSnapshot);
      fetchTodayCount();
    } else {
      // === Start writing logic ===
      dispatchAction('START_WRITING');
    }
  });

  // Restart (from complete step)
  bindButtons(['[data-action="restart"]', '#step-btn-restart'], () => {
    dispatchAction('RESTART');
    checkDailyState();
  });

  // History — open overlay
  bindButtons(['[data-action="view-history"]', '#btn-history-idle', '#step-btn-history'], () => {
    dispatchAction('VIEW_HISTORY');
    updateHistoryPreview(loadHistory());
  });

  // History — close overlay
  bindButtons(['#btn-close-history'], () => {
    dispatchAction('CLOSE_HISTORY');
  });

  // Delete all history
  bindButtons(['[data-action="delete-history"]', '#btn-delete-all'], () => {
    const confirmed = window.confirm(t('confirm.deleteAll'));
    if (!confirmed) {
      return;
    }

    const historyResult = deleteAllHistory();
    updateHistoryPreview(historyResult);
    announce(t('announce.deleted'));
  });

  bindButtons(['[data-action="copy-result"]', '#btn-copy-result'], async (event) => {
    event.preventDefault();
    const state = readState();
    const text = buildCompactShare(state);
    const copied = await copyToClipboard(text);
    showToast(copied ? t('share.clipboard') : t('announce.shareError'));
  });
}

function bindLangToggle(): void {
  const btn = document.getElementById('btn-lang-toggle');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const next = getLocale() === 'ko' ? 'en' : 'ko';
    setLocale(next);
    updateDOM();
    if (readState()?.phase === 'IDLE') {
      checkDailyState();
    }
    refreshLocale();
  });
}

const THEMES = ['default', 'sci-fi', 'fantasy'] as const;
type Theme = (typeof THEMES)[number];

function initTheme(): void {
  const saved = localStorage.getItem('nova-pouch-theme') as Theme | null;
  if (saved && THEMES.includes(saved)) {
    document.body.dataset.theme = saved;
  }
}

function bindThemeToggle(): void {
  const btn = document.getElementById('btn-theme-toggle');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const current = (document.body.dataset.theme || 'default') as Theme;
    const nextIdx = (THEMES.indexOf(current) + 1) % THEMES.length;
    const next = THEMES[nextIdx];
    
    document.body.dataset.theme = next;
    localStorage.setItem('nova-pouch-theme', next);
    
    // Feedback
    if (navigator.vibrate) navigator.vibrate(5);
  });
}


function initDailyBanner(): void {
  const banner = document.getElementById('daily-banner');
  const dateEl = document.getElementById('daily-date');
  const shareBtn = document.getElementById('btn-share-daily');
  
  if (banner && dateEl) {
    const { date, dayNumber } = getDailyTokens();
    const n = Number.isFinite(dayNumber) ? dayNumber : getDailyNumber(date);
    dateEl.textContent = `#${n} · ${date}`;
    banner.removeAttribute('hidden');

    if (shareBtn) {
      shareBtn.onclick = (e) => {
        e.stopPropagation();
        const url = new URL(window.location.href);
        url.searchParams.set('date', date);
        copyToClipboard(url.toString()).then(ok => {
          showToast(ok ? t('share.clipboard') : t('announce.shareError'));
        });
      };
    }
  }
}

function checkDailyState(): void {
  const completion = isDailyComplete() ? getDailyCompletion() : null;
  const idleCompleteSection = document.getElementById('idle-complete-section');
  const btnStart = document.getElementById('btn-start');
  const btnFreePlay = document.getElementById('btn-free-play');

  if (completion) {
    // Show completion info
    if (idleCompleteSection) {
      idleCompleteSection.removeAttribute('hidden');
      renderIdleCompletion(completion);
    }

    // Morph Start button to Free Play
    if (btnStart) {
      btnStart.textContent = t('daily.freePlay');
      (btnStart as HTMLElement).dataset.mode = 'free';
      btnStart.className = 'btn btn--secondary btn--full'; // Change style to secondary
    }

    // Hide original Free Play button to avoid duplicate
    if (btnFreePlay) {
      btnFreePlay.setAttribute('hidden', '');
    }

    const countdownEl = document.getElementById('idle-countdown-timer');
    if (countdownEl) {
      if (getDailyTokens().date === todayDateString()) {
        startCountdown(countdownEl);
      } else {
        const wrap = document.querySelector('.daily-complete__countdown');
        if (wrap) (wrap as HTMLElement).style.display = 'none';
      }
    }
  } else {
    // Not complete -> Reset to initial
    if (idleCompleteSection) {
      idleCompleteSection.setAttribute('hidden', '');
    }

    if (btnStart) {
      btnStart.textContent = t('idle.start');
      (btnStart as HTMLElement).dataset.mode = 'daily';
      btnStart.className = 'btn btn--primary btn--full';
    }

    if (btnFreePlay) {
      btnFreePlay.removeAttribute('hidden');
    }

    stopCountdown();
  }
}

function renderIdleCompletion(completion: DailyCompletion): void {
  const tokensEl = document.getElementById('idle-complete-tokens');
  const storyEl = document.getElementById('idle-complete-story');

  if (tokensEl && completion.tokens) {
    tokensEl.innerHTML = '';
    (['red', 'blue', 'green'] as PouchColor[]).forEach((color) => {
      const token = (completion.tokens as Record<string, Token | null>)[color];
      if (!token) return;
      const chip = document.createElement('span');
      chip.className = `collected-chip collected-chip--${color}`;
      chip.textContent = `${token.emoji || ''} ${token.label || ''}`.trim();
      tokensEl.appendChild(chip);
    });
  }

  if (storyEl) {
    const story = completion.story || '';
    storyEl.textContent = story.slice(0, 200) + (story.length > 200 ? '...' : '');
  }
}

let _feedSelectedDate: string = todayDateString();

function buildDatePicker(): void {
  const picker = document.getElementById('feed-date-picker');
  if (!picker) return;
  picker.innerHTML = '';

  const today = new Date();
  const days = getLocale() === 'en'
    ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    : ['일', '월', '화', '수', '목', '금', '토'];

  // Show 14 days: today + 13 past days
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayLabel = days[d.getDay()];
    const dateLabel = `${d.getMonth() + 1}/${d.getDate()}`;

    const chip = document.createElement('button');
    chip.className = `feed-date-chip${dateStr === _feedSelectedDate ? ' feed-date-chip--active' : ''}`;
    chip.dataset.date = dateStr;
    chip.setAttribute('role', 'tab');
    chip.setAttribute('aria-selected', dateStr === _feedSelectedDate ? 'true' : 'false');
    chip.innerHTML = `<span class="feed-date-chip__day">${dayLabel}</span><span class="feed-date-chip__date">${dateLabel}</span>`;

    chip.addEventListener('click', () => selectFeedDate(dateStr));
    picker.appendChild(chip);
  }
}

async function selectFeedDate(date: string): Promise<void> {
  _feedSelectedDate = date;

  // Update active chip
  document.querySelectorAll('.feed-date-chip').forEach(chip => {
    const isActive = (chip as HTMLElement).dataset.date === date;
    chip.classList.toggle('feed-date-chip--active', isActive);
    chip.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  // Reload feed
  const { loadFeed } = await import('./feed');
  const state = await loadFeed(date);
  renderFeedCards(state);
}

function bindFeedButtons(): void {
  bindButtons(['#btn-feed-idle', '#btn-feed-complete'], async () => {
    const feedLayer = document.getElementById('layer-feed');
    if (!feedLayer) return;

    _feedSelectedDate = todayDateString();
    buildDatePicker();
    openOverlay(feedLayer);

    const { loadFeed } = await import('./feed');
    const state = await loadFeed(_feedSelectedDate);
    renderFeedCards(state);
  });

  bindButtons(['#btn-close-feed'], () => {
    const feedLayer = document.getElementById('layer-feed');
    if (feedLayer) closeOverlay(feedLayer);
  });

  bindButtons(['#btn-feed-more'], async () => {
    const { loadMoreFeed } = await import('./feed');
    const state = await loadMoreFeed();
    renderFeedCards(state);
  });
}

function renderFeedCards(feedState: FeedState): void {
  const listEl = document.getElementById('feed-list');
  const moreBtn = document.getElementById('btn-feed-more');
  if (!listEl) return;

  if (feedState.isLoading) {
    listEl.innerHTML = `<div class="feed-skeleton">
      <div class="feed-skeleton__card"><div class="feed-skeleton__line feed-skeleton__line--short"></div><div class="feed-skeleton__line feed-skeleton__line--long"></div><div class="feed-skeleton__line feed-skeleton__line--medium"></div></div>
      <div class="feed-skeleton__card"><div class="feed-skeleton__line feed-skeleton__line--short"></div><div class="feed-skeleton__line feed-skeleton__line--long"></div><div class="feed-skeleton__line feed-skeleton__line--medium"></div></div>
      <div class="feed-skeleton__card"><div class="feed-skeleton__line feed-skeleton__line--short"></div><div class="feed-skeleton__line feed-skeleton__line--long"></div><div class="feed-skeleton__line feed-skeleton__line--medium"></div></div>
    </div>`;
    return;
  }

  if (feedState.error) {
    listEl.innerHTML = `<div class="feed-error"><div class="feed-error__icon">⚠️</div><p>${t('feed.error')}</p></div>`;
    return;
  }

  if (!feedState.records || feedState.records.length === 0) {
    listEl.innerHTML = `<div class="feed-empty"><div class="feed-empty__icon">📜</div><p>${t('feed.empty')}</p></div>`;
    if (moreBtn) moreBtn.setAttribute('hidden', '');
    return;
  }

  if (feedState.page === 1) listEl.innerHTML = '';
  
  feedState.records.forEach(record => {
    // Avoid duplicates if already in DOM (for load more)
    if (listEl.querySelector(`[data-record-id="${CSS.escape(record.id)}"]`)) return;

    const card = document.createElement('article');
    card.className = 'feed-card';
    card.dataset.recordId = record.id;
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');

    card.addEventListener('click', () => {
      const feedLayer = document.getElementById('layer-feed');
      if (feedLayer) closeOverlay(feedLayer);
      
      // Adapt FeedRecord to look enough like HistorySession for the detail view
      const session = {
        tokens: record.tokens,
        userStory: record.story,
        id: record.id,
      };
      dispatchAction('VIEW_RECORD_DETAIL', { session });
    });

    const tokens = record.tokens || {};
    const authorName = escapeHtml(record.user?.displayName || record.anonName || t('feed.anonymous'));
    const displayDate = record.date || '';

    const redChip = tokens.red?.label ? `<span class="collected-chip collected-chip--red">${escapeHtml(tokens.red.emoji || '')} ${escapeHtml(tokens.red.label)}</span>` : '';
    const blueChip = tokens.blue?.label ? `<span class="collected-chip collected-chip--blue">${escapeHtml(tokens.blue.emoji || '')} ${escapeHtml(tokens.blue.label)}</span>` : '';
    const greenChip = tokens.green?.label ? `<span class="collected-chip collected-chip--green">${escapeHtml(tokens.green.emoji || '')} ${escapeHtml(tokens.green.label)}</span>` : '';
    const likeHtml = record.source === 'preset'
      ? ''
      : `<button class="feed-card__like ${feedState.likedIds?.has(record.id) ? 'is-liked' : ''}" data-record-id="${escapeHtml(record.id)}" aria-pressed="${feedState.likedIds?.has(record.id) ? 'true' : 'false'}">
          <span class="like-icon">${feedState.likedIds?.has(record.id) ? '❤️' : '🤍'}</span>
          <span class="like-count">${record.likeCount || 0}</span>
        </button>`;

    card.innerHTML = `
      <div class="feed-card__header">
        <div class="feed-card__author">${authorName}</div>
        <div class="feed-card__date">${displayDate}</div>
      </div>
      <div class="feed-card__tokens">
        ${redChip}${blueChip}${greenChip}
      </div>
      <div class="feed-card__story">${escapeHtml(record.story || '')}</div>
      <div class="feed-card__actions">
        ${likeHtml}
      </div>
    `;

    // Bind like button
    const likeBtn = card.querySelector('.feed-card__like') as HTMLElement | null;
    if (likeBtn) {
      likeBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const { toggleLike } = await import('./feed');
        toggleLike(record.id, likeBtn);
        // Update emoji immediately for snappy feel
        const icon = likeBtn.querySelector('.like-icon');
        if (icon) icon.textContent = likeBtn.classList.contains('is-liked') ? '❤️' : '🤍';
      });
    }

    listEl.appendChild(card);
  });

  if (moreBtn) {
    if (feedState.page < feedState.totalPages) {
      moreBtn.removeAttribute('hidden');
    } else {
      moreBtn.setAttribute('hidden', '');
    }
  }
}

const HTML_ESCAPE_MAP: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, ch => HTML_ESCAPE_MAP[ch]);
}

function bindSharePanel(): void {
  bindButtons(['[data-action="share-link"]'], async (event) => {
    event.preventDefault();
    const { buildShareLink } = await import('./share');
    const state = readState();
    const link = buildShareLink(state);
    const copied = await copyToClipboard(link);
    showToast(copied ? t('share.clipboard') : t('announce.shareError'));
  });

  bindButtons(['[data-action="share-download"]'], async (event) => {
    event.preventDefault();
    const state = readState();
    await downloadShareCard(state);
  });

  bindButtons(['[data-action="share-twitter"]'], (event) => {
    event.preventDefault();
    const state = readState();
    shareToTwitter(state);
  });

  bindButtons(['[data-action="share-native"]'], async (event) => {
    event.preventDefault();
    const state = readState();
    const result = await nativeShare(state);
    if (result === 'clipboard') {
      showToast(t('share.clipboard'));
    } else if (result === 'failed') {
      showToast(t('announce.shareError'));
    }
  });

  bindButtons(['[data-action="copy-result"]'], async (event) => {
    event.preventDefault();
    const state = readState();
    const text = buildCompactShare(state);
    const copied = await copyToClipboard(text);
    showToast(copied ? t('share.clipboard') : t('announce.shareError'));
  });
}

function hideUnsupportedShareButtons(): void {
  if (!navigator.share) {
    const btn = document.getElementById('btn-share-native');
    if (btn) btn.style.display = 'none';
  }
}

function autoSubmitRecord(state: GameStateSnapshot): void {
  const tokens = state?.drawnTokens;
  if (!tokens?.red || !tokens?.blue || !tokens?.green) return;

  const date = todayDateString();
  submitRecord({
    date,
    tokens: {
      red: { id: tokens.red.id, label: tokens.red.label, emoji: tokens.red.emoji, labelEn: tokens.red.labelEn },
      blue: { id: tokens.blue.id, label: tokens.blue.label, emoji: tokens.blue.emoji, labelEn: tokens.blue.labelEn },
      green: { id: tokens.green.id, label: tokens.green.label, emoji: tokens.green.emoji, labelEn: tokens.green.labelEn },
    },
    story: state.userStory || '',
  }).then(result => {
    if ((result as Record<string, unknown>)?.id) {
      dispatchAction('SUBMIT_RECORD', { recordId: (result as Record<string, string>).id });
    }
  }).catch(() => {
    // Silent fail — record saved locally via history.js
  });
}

async function fetchTodayCount(): Promise<void> {
  try {
    const { loadFeed } = await import('./feed');
    const state = await loadFeed(todayDateString());
    const countEl = document.getElementById('today-count-number');
    const containerEl = document.getElementById('today-record-count');
    if (countEl && containerEl && state.total > 0) {
      countEl.textContent = String(state.total);
      containerEl.removeAttribute('hidden');
    }
  } catch {
    // silent
  }
}



function showToast(message: string, durationMs = 2000): void {
  const toast = document.getElementById('toast');
  const msgEl = document.getElementById('toast-message');
  if (!toast || !msgEl) return;

  msgEl.textContent = message;
  toast.removeAttribute('hidden');
  toast.style.display = 'block';
  
  requestAnimationFrame(() => {
    toast.classList.add('toast--visible');
  });

  setTimeout(() => {
    toast.classList.remove('toast--visible');
    setTimeout(() => {
      toast.setAttribute('hidden', '');
      toast.style.display = 'none';
    }, 260);
  }, durationMs);
}

function bindWritingInputs(): void {
  const storyInput = queryFirst('#step-input-story', '[data-field="user-story"]', 'textarea[name="userStory"]') as HTMLTextAreaElement | null;

  if (storyInput) {
    storyInput.setAttribute('maxlength', String(MAX_STORY_LENGTH));
    storyInput.setAttribute('aria-label', storyInput.getAttribute('aria-label') || t('aria.storyInput'));

    const onStoryInput = debounce(() => {
      autoResizeTextarea(storyInput);
      const story = storyInput.value || '';
      syncWritingValidation(story);
      dispatchAction('UPDATE_STORY', story);
    }, 80);

    storyInput.addEventListener('input', onStoryInput);
    autoResizeTextarea(storyInput);
    syncWritingValidation(storyInput.value || '');
  }
}

function createSession(state: GameStateSnapshot | null, storyText: string): Record<string, unknown> {
  const now = new Date().toISOString();
  const tokens = state?.drawnTokens || { red: null, blue: null, green: null };

  const difficultyResult = calculateDifficultySafely(tokens);

  return {
    id: generateIdSafe(),
    createdAt: state?.createdAt || now,
    completedAt: now,
    tokens: {
      red: normalizeToken(tokens.red),
      blue: normalizeToken(tokens.blue),
      green: normalizeToken(tokens.green)
    },
    combinedDifficulty: difficultyResult,
    worldName: t('complete.noName'),
    userStory: (storyText || '').trim(),
    rating: Number(state?.rating) || 0
  };
}

function calculateDifficultySafely(tokensObj: Partial<Record<string, Token | null>>): number {
  try {
    const result = calculateDifficulty(tokensObj);

    if (typeof result === 'number') {
      return result;
    }

    if (result && typeof result === 'object') {
      if (typeof result.sum === 'number') {
        return result.sum;
      }
    }

    return 0;
  } catch {
    return 0;
  }
}


function setRating(ratingValue: number): void {
  const value = Math.max(1, Math.min(5, Number(ratingValue) || 0));
  if (!value) {
    return;
  }

  dispatchAction('SET_RATING', value);
  syncStars(value);
}

function syncStarsFromState(state: GameStateSnapshot | null): void {
  syncStars(Number(state?.rating) || 0);
}

function syncStars(currentRating: number): void {
  const stars = queryAll('#step-star-rating .star', '[data-rating-value]', '.rating-star[data-value]', '.rating-stars button');

  stars.forEach((star, index) => {
    const starValue = getRatingValue(star as HTMLElement, index + 1);
    const active = starValue <= currentRating;

    star.classList.toggle('is-active', active);
    star.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function syncWritingValidation(storyText: string, forceError = false): void {
  const trimmedLength = (storyText || '').trim().length;
  const valid = trimmedLength >= MIN_STORY_LENGTH;

  const counter = queryFirst('#step-char-count', '[data-role="story-count"]') as HTMLElement | null;
  if (counter) {
    counter.textContent = String(trimmedLength);
    counter.setAttribute('aria-live', 'polite');
  }

  const ctaBtn = document.getElementById('btn-start-writing') as HTMLButtonElement | null;
  const state = readState();
  if (ctaBtn && state?.phase === 'WRITING') {
    ctaBtn.disabled = !valid;
    ctaBtn.setAttribute('aria-disabled', valid ? 'false' : 'true');
    ctaBtn.setAttribute('aria-label', ctaBtn.getAttribute('aria-label') || t('aria.complete'));
  }

  const storyInput = queryFirst('#step-input-story', '[data-field="user-story"]', 'textarea[name="userStory"]') as HTMLTextAreaElement | null;
  if (storyInput) {
    storyInput.setCustomValidity(valid || !forceError ? '' : t('announce.minLength'));
  }
}

function autoResizeTextarea(textarea: HTMLTextAreaElement | null): void {
  if (!textarea) {
    return;
  }

  textarea.style.height = 'auto';
  textarea.style.height = `${Math.max(textarea.scrollHeight, 120)}px`;
}



function getStoryText(): string {
  const storyInput = queryFirst('#step-input-story', '[data-field="user-story"]', 'textarea[name="userStory"]') as HTMLTextAreaElement | null;
  return (storyInput?.value || '').trim();
}

function isStoryValid(storyText: string): boolean {
  return (storyText || '').trim().length >= MIN_STORY_LENGTH;
}

function focusStoryInput(): void {
  const storyInput = queryFirst('#step-input-story', '[data-field="user-story"]', 'textarea[name="userStory"]') as HTMLTextAreaElement | null;
  if (storyInput) {
    storyInput.focus();
  }
}

function updateHistoryPreview(historyObj: HistoryData): void {
  const totalElement = queryFirst('#stats-total', '[data-history-stat="totalPlayed"]') as HTMLElement | null;
  if (totalElement) {
    totalElement.textContent = String(historyObj?.stats?.totalPlayed || 0);
  }
  // History list rendering is handled by renderHistory() in renderer.ts.
  // Do NOT write to #history-list here.
}


/* ----------------------------------------------------------
   Focus Trap for Overlay Panels
   ---------------------------------------------------------- */

let _lastFocusedElement: Element | null = null;

function openOverlay(overlayEl: HTMLElement): void {
  _lastFocusedElement = document.activeElement;
  overlayEl.classList.add('layer--active');
  overlayEl.style.display = 'flex';

  // Focus first focusable element
  requestAnimationFrame(() => {
    const focusable = overlayEl.querySelector<HTMLElement>('button, [tabindex="0"], a, input, textarea');
    if (focusable) focusable.focus();
  });
}

function closeOverlay(overlayEl: HTMLElement): void {
  overlayEl.classList.remove('layer--active');
  setTimeout(() => {
    if (!overlayEl.classList.contains('layer--active')) {
      overlayEl.style.display = 'none';
    }
  }, 260);

  // Restore focus
  if (_lastFocusedElement && typeof (_lastFocusedElement as HTMLElement).focus === 'function') {
    (_lastFocusedElement as HTMLElement).focus();
    _lastFocusedElement = null;
  }
}

function trapFocusInOverlay(event: KeyboardEvent): void {
  const overlays = ['layer-feed', 'layer-history'];
  for (const id of overlays) {
    const overlay = document.getElementById(id);
    if (!overlay || !overlay.classList.contains('layer--active')) continue;

    const focusable = overlay.querySelectorAll<HTMLElement>(
      'button:not([disabled]):not([hidden]), [tabindex="0"], a[href], input:not([disabled]), textarea:not([disabled])'
    );
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
    return;
  }
}

function initOverlayKeyHandlers(): void {
  document.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      const feedLayer = document.getElementById('layer-feed');
      if (feedLayer?.classList.contains('layer--active')) {
        closeOverlay(feedLayer);
        return;
      }
      const historyLayer = document.getElementById('layer-history');
      if (historyLayer?.classList.contains('layer--active')) {
        dispatchAction('CLOSE_HISTORY');
        if (_lastFocusedElement && typeof (_lastFocusedElement as HTMLElement).focus === 'function') {
          (_lastFocusedElement as HTMLElement).focus();
          _lastFocusedElement = null;
        }
        return;
      }
    }
    if (event.key === 'Tab') {
      trapFocusInOverlay(event);
    }
  });
}

function applyAccessibilityLabels(): void {
  queryAll('button', '[role="button"]', '[data-pouch]', '.pouch').forEach((element) => {
    if (!element.getAttribute('aria-label')) {
      const pouchType = inferPouchType(element as HTMLElement);

      if (pouchType) {
        element.setAttribute('aria-label', t(`aria.pouch.${pouchType}`));
      } else {
        const label = (element.textContent || '').trim();
        if (label) {
          element.setAttribute('aria-label', label);
        }
      }
    }

    if (element.matches('[role="button"]') && !element.hasAttribute('tabindex')) {
      element.setAttribute('tabindex', '0');
    }
  });

  let liveRegion = document.getElementById('token-live-region');
  if (!liveRegion) {
    liveRegion = document.createElement('div');
    liveRegion.id = 'token-live-region';
    liveRegion.className = 'sr-only';
    liveRegion.setAttribute('aria-live', 'polite');
    document.body.appendChild(liveRegion);
  }
}

function bindButtons(selectors: string[], handler: (event: Event) => void): void {
  const elements = queryAll(...selectors);

  elements.forEach((element) => {
    if ((element as HTMLElement).dataset.boundAppButton === 'true') {
      return;
    }

    (element as HTMLElement).dataset.boundAppButton = 'true';

    element.addEventListener('click', handler);

    if (!isNativeKeyboardButton(element)) {
      element.addEventListener('keydown', (event) => {
        if ((event as KeyboardEvent).key === 'Enter' || (event as KeyboardEvent).key === ' ') {
          event.preventDefault();
          handler(event);
        }
      });
    }
  });
}

function dispatchAction(action: string, payload?: unknown): void {
  if (!gameState || typeof gameState.dispatch !== 'function') return;
  gameState.dispatch(action, payload);
}

function readState(): GameStateSnapshot {
  if (!gameState) {
    return {} as GameStateSnapshot;
  }

  if (typeof gameState.getState === 'function') {
    try {
      return gameState.getState();
    } catch {
      return {} as GameStateSnapshot;
    }
  }

  return gameState as unknown as GameStateSnapshot;
}

function inferPouchType(element: HTMLElement | null): string | null {
  if (!element) {
    return null;
  }

  if (element.dataset?.pouch) {
    return element.dataset.pouch;
  }

  const source = `${element.id || ''} ${element.className || ''}`.toLowerCase();

  if (source.includes('red')) {
    return 'red';
  }

  if (source.includes('blue')) {
    return 'blue';
  }

  if (source.includes('green')) {
    return 'green';
  }

  return null;
}

function getRatingValue(star: HTMLElement, fallback: number): number {
  const raw = star.dataset.ratingValue || star.dataset.value || star.dataset.rating || star.getAttribute('value');
  const parsed = Number(raw);

  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  return fallback;
}

function normalizeToken(token: Token | null): { id: string; label: string; emoji: string } | null {
  if (!token || typeof token !== 'object') {
    return null;
  }

  return {
    id: token.id || '',
    label: token.label || '',
    emoji: token.emoji || ''
  };
}

function generateIdSafe(): string {
  if (typeof generateId === 'function') {
    try {
      return generateId();
    } catch {
      return `session-${Date.now()}`;
    }
  }

  return `session-${Date.now()}`;
}


async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fallback below */ }

  // Fallback for non-secure contexts
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

function announce(message: string): void {
  const liveRegion = document.getElementById('token-live-region');
  if (liveRegion) {
    liveRegion.textContent = message;
  }
}

function queryFirst(...selectors: string[]): Element | null {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      return element;
    }
  }

  return null;
}

function queryAll(...selectors: string[]): Element[] {
  const merged = new Set<Element>();

  selectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((element) => merged.add(element));
  });

  return Array.from(merged);
}

function isNativeKeyboardButton(element: Element): boolean {
  if (!element || !element.tagName) {
    return false;
  }

  const tag = element.tagName.toUpperCase();
  if (tag === 'BUTTON') {
    return true;
  }

  if (tag === 'INPUT') {
    const type = (element.getAttribute('type') || '').toLowerCase();
    return type === 'button' || type === 'submit' || type === 'reset';
  }

  return false;
}
