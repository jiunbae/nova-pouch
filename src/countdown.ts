/* countdown.ts — Countdown to next daily puzzle */

let _intervalId: ReturnType<typeof setInterval> | null = null;

export function startCountdown(targetEl: HTMLElement): void {
  if (!targetEl) return;
  stopCountdown();

  function update(): void {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);

    const diff = tomorrow.getTime() - now.getTime();
    if (diff <= 0) {
      targetEl.textContent = '00:00:00';
      stopCountdown();
      window.location.reload();
      return;
    }

    const hours = String(Math.floor(diff / 3_600_000)).padStart(2, '0');
    const mins = String(Math.floor((diff % 3_600_000) / 60_000)).padStart(2, '0');
    const secs = String(Math.floor((diff % 60_000) / 1000)).padStart(2, '0');
    targetEl.textContent = `${hours}:${mins}:${secs}`;
  }

  update();
  _intervalId = setInterval(update, 1000);
}

export function stopCountdown(): void {
  if (_intervalId) {
    clearInterval(_intervalId);
    _intervalId = null;
  }
}
