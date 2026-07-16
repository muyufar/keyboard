(function () {
  const SWIPE_THRESHOLD = 56;
  const SWIPE_MAX = 72;
  const BLOCK_SELECTOR = 'video, audio, button, a, input, textarea, .reply-quote';

  function initSwipeToReply(container, onReply) {
    if (!container || container.dataset.swipeReply === '1') return;
    container.dataset.swipeReply = '1';

    let startX = 0;
    let startY = 0;
    let activeMsg = null;
    let activeContent = null;
    let activeHint = null;
    let msgId = null;
    let tracking = false;
    let swiping = false;

    function resetSwipe() {
      if (activeContent) {
        activeContent.style.transform = '';
        activeContent.classList.remove('snap-back');
      }
      if (activeHint) {
        activeHint.style.opacity = '';
        activeHint.style.transform = '';
      }
      activeContent?.closest('.message-swipe-area')?.classList.remove('swiping');
      activeMsg = activeContent = activeHint = msgId = null;
      tracking = swiping = false;
    }

    container.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      const msg = e.target.closest('.message');
      if (!msg || e.target.closest(BLOCK_SELECTOR)) return;

      const area = msg.querySelector('.message-swipe-area');
      const content = area?.querySelector('.message-content');
      if (!area || !content) return;

      activeMsg = msg;
      activeContent = content;
      activeHint = area.querySelector('.message-swipe-hint');
      msgId = parseInt(msg.dataset.id, 10);
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      tracking = true;
      swiping = false;
    }, { passive: true });

    container.addEventListener('touchmove', (e) => {
      if (!tracking || !activeContent) return;

      const touch = e.touches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;

      if (!swiping) {
        if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 12) {
          resetSwipe();
          return;
        }
        if (Math.abs(dx) < 8) return;
        swiping = true;
        activeContent.closest('.message-swipe-area')?.classList.add('swiping');
      }

      const isOwn = activeMsg.classList.contains('own');
      let clamped = 0;
      if (isOwn) {
        clamped = Math.max(-SWIPE_MAX, Math.min(0, dx));
      } else {
        clamped = Math.min(SWIPE_MAX, Math.max(0, dx));
      }

      if (clamped !== 0) {
        e.preventDefault();
        activeContent.style.transform = `translateX(${clamped}px)`;
        const progress = Math.min(1, Math.abs(clamped) / SWIPE_THRESHOLD);
        if (activeHint) {
          activeHint.style.opacity = String(progress);
          activeHint.style.transform = `translateY(-50%) scale(${0.85 + progress * 0.15})`;
        }
      }
    }, { passive: false });

    container.addEventListener('touchend', () => {
      if (!tracking || !activeContent) return;

      const isOwn = activeMsg.classList.contains('own');
      const match = activeContent.style.transform.match(/translateX\((-?\d+(?:\.\d+)?)px\)/);
      const dx = match ? parseFloat(match[1]) : 0;
      const triggered = isOwn ? dx <= -SWIPE_THRESHOLD : dx >= SWIPE_THRESHOLD;

      if (triggered && msgId && typeof onReply === 'function') {
        if (navigator.vibrate) navigator.vibrate(10);
        onReply(msgId);
      }

      activeContent.classList.add('snap-back');
      activeContent.style.transform = '';
      if (activeHint) {
        activeHint.style.opacity = '';
        activeHint.style.transform = '';
      }
      setTimeout(() => activeContent?.classList.remove('snap-back'), 200);
      activeContent?.closest('.message-swipe-area')?.classList.remove('swiping');
      activeMsg = activeContent = activeHint = msgId = null;
      tracking = swiping = false;
    });

    container.addEventListener('touchcancel', resetSwipe);
  }

  window.initSwipeToReply = initSwipeToReply;
})();
