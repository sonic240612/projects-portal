(() => {
  'use strict';

  const body = document.body;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const active = () => body.dataset.theme === 'liquid-glass';
  const motionEnabled = () => body.dataset.liquidMotion
    ? body.dataset.liquidMotion === 'full'
    : !reducedMotion.matches;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const dimensions = ['x', 'y', 'width', 'height'];
  const deformations = ['scaleX', 'scaleY', 'rotate'];
  const variables = {
    x: '--lens-x', y: '--lens-y', width: '--lens-width', height: '--lens-height',
    scaleX: '--lens-scale-x', scaleY: '--lens-scale-y', rotate: '--lens-rotate'
  };
  const states = [...document.querySelectorAll('.category-control, .sort-control')].map(group => ({
    group,
    buttons: [...group.querySelectorAll('.tab-btn')],
    value: { x: 0, y: 0, width: 0, height: 0, scaleX: 1, scaleY: 1, rotate: 0 },
    target: { x: 0, y: 0, width: 0, height: 0, scaleX: 1, scaleY: 1, rotate: 0 },
    velocity: { x: 0, y: 0, width: 0, height: 0, scaleX: 0, scaleY: 0, rotate: 0 },
    initialized: false,
    drag: null,
    suppressClickUntil: 0,
    dispatchingSelection: false
  }));
  let springFrame = 0;
  let measureFrame = 0;
  let previousFrameTime = 0;
  const cardAnimations = new Map();
  let cardChange = 0;

  function selectedButton(state) {
    return state.group.querySelector('.tab-btn[aria-pressed="true"]')
      || state.group.querySelector('.tab-btn.active') || state.buttons[0];
  }

  function buttonGeometry(button) {
    // Layout coordinates stay stable while the outer glass surface is pressed or tilted.
    return { x: button.offsetLeft, y: button.offsetTop, width: button.offsetWidth, height: button.offsetHeight };
  }

  function render(state) {
    for (const key of dimensions) {
      state.group.style.setProperty(variables[key], `${state.value[key].toFixed(3)}px`);
    }
    for (const key of deformations) {
      const unit = key === 'rotate' ? 'deg' : '';
      state.group.style.setProperty(variables[key], `${state.value[key].toFixed(5)}${unit}`);
    }
  }

  function snap(state) {
    Object.assign(state.target, { scaleX: 1, scaleY: 1, rotate: 0 });
    Object.assign(state.value, state.target);
    for (const key of Object.keys(state.velocity)) state.velocity[key] = 0;
    render(state);
  }

  function wake() {
    if (!active() || !motionEnabled() || springFrame) return;
    previousFrameTime = 0;
    springFrame = requestAnimationFrame(advance);
  }

  function aim(state, geometry, immediate = false) {
    if (!active() || !geometry.width || !geometry.height) return;
    Object.assign(state.target, geometry);
    if (immediate || !state.initialized || !motionEnabled()) snap(state);
    else wake();
    state.initialized = true;
  }

  function integrate(state, key, dt, stiffness, damping) {
    const acceleration = stiffness * (state.target[key] - state.value[key]) - damping * state.velocity[key];
    state.velocity[key] += acceleration * dt;
    state.value[key] += state.velocity[key] * dt;
  }

  function advance(now) {
    springFrame = 0;
    if (!active() || !motionEnabled()) return;
    // Substeps keep the same spring stable on 60/120 Hz displays and after a dropped frame.
    const elapsed = previousFrameTime ? clamp((now - previousFrameTime) / 1000, 0.001, 0.064) : 1 / 60;
    previousFrameTime = now;
    const steps = Math.ceil(elapsed / (1 / 120));
    const dt = elapsed / steps;
    let unsettled = false;

    for (const state of states) {
      if (!state.initialized || !state.group.clientWidth) continue;
      const dragging = state.drag?.moved;
      for (let step = 0; step < steps; step += 1) {
        for (const key of dimensions) integrate(state, key, dt, dragging ? 640 : 370, dragging ? 43 : 25);
        const speed = Math.abs(state.velocity.x);
        const press = state.drag && !dragging ? -0.025 : 0;
        state.target.scaleX = 1 + clamp(speed * 0.00013, 0, 0.16) + (dragging ? 0.025 : press);
        state.target.scaleY = 1 - clamp(speed * 0.000055, 0, 0.07) + (dragging ? 0.025 : press);
        state.target.rotate = clamp(-state.velocity.x * 0.0007, -1.1, 1.1);
        for (const key of deformations) integrate(state, key, dt, 420, 30);
      }

      let moving = false;
      for (const key of [...dimensions, ...deformations]) {
        const tolerance = dimensions.includes(key) ? 0.025 : 0.0002;
        if (Math.abs(state.value[key] - state.target[key]) > tolerance || Math.abs(state.velocity[key]) > tolerance * 4) moving = true;
        else { state.value[key] = state.target[key]; state.velocity[key] = 0; }
      }
      render(state);
      unsettled ||= moving;
    }
    if (unsettled) springFrame = requestAnimationFrame(advance);
    else previousFrameTime = 0;
  }

  function refresh(immediate = false) {
    if (!active()) return;
    for (const state of states) {
      if (!state.drag) {
        const button = selectedButton(state);
        if (button) aim(state, buttonGeometry(button), immediate);
      }
    }
  }

  function schedule() {
    if (measureFrame) return;
    measureFrame = requestAnimationFrame(() => { measureFrame = 0; refresh(); });
  }

  function localPointerX(state, clientX) {
    const rect = state.group.getBoundingClientRect();
    return (clientX - rect.left) * state.group.offsetWidth / (rect.width || 1);
  }

  function nearestButton(state, clientX) {
    const x = localPointerX(state, clientX);
    return state.buttons.filter(button => !button.disabled && button.offsetWidth).reduce((closest, button) => {
      const delta = Math.abs(x - button.offsetLeft - button.offsetWidth / 2);
      return !closest || delta < closest.delta ? { button, delta } : closest;
    }, null)?.button;
  }

  function followPointer(state, clientX) {
    const button = nearestButton(state, clientX);
    if (!button) return;
    const geometry = buttonGeometry(button);
    if (motionEnabled()) {
      const inset = parseFloat(getComputedStyle(state.group).paddingLeft) || 0;
      const center = localPointerX(state, clientX) - state.drag.grabOffset;
      geometry.x = clamp(center - geometry.width / 2, inset, state.group.clientWidth - inset - geometry.width);
    }
    aim(state, geometry);
  }

  function clearDrag(state) {
    const drag = state.drag;
    state.drag = null;
    state.group.classList.remove('is-dragging');
    if (drag && state.group.hasPointerCapture(drag.id)) state.group.releasePointerCapture(drag.id);
    return drag;
  }

  function finishDrag(state, event, cancelled) {
    if (!state.drag || (event && state.drag.id !== event.pointerId)) return;
    const drag = clearDrag(state);
    if (drag.moved) state.suppressClickUntil = performance.now() + 700;
    if (drag.moved && !cancelled && active()) {
      const button = nearestButton(state, event.clientX);
      if (button) {
        state.dispatchingSelection = true;
        try { button.click(); } finally { state.dispatchingSelection = false; }
        button.focus({ preventScroll: true });
      }
    }
    const selected = selectedButton(state);
    if (selected) aim(state, buttonGeometry(selected));
  }

  function stopCardAnimations() {
    cardChange += 1;
    for (const animation of cardAnimations.values()) animation.cancel();
    cardAnimations.clear();
  }

  function captureCards() {
    return new Map([...document.querySelectorAll('main .card')]
      .filter(card => card.getClientRects().length)
      .map(card => [card, card.getBoundingClientRect()]));
  }

  function animateCards(before) {
    for (const animation of cardAnimations.values()) animation.cancel();
    cardAnimations.clear();
    const visible = [...document.querySelectorAll('main .card')].filter(card => card.getClientRects().length);
    const after = visible.map(card => ({ card, rect: card.getBoundingClientRect(), base: getComputedStyle(card).transform }));
    for (let index = 0; index < after.length; index += 1) {
      const { card, rect, base } = after[index];
      if (typeof card.animate !== 'function') continue;
      const old = before.get(card);
      const dx = old ? old.left - rect.left : 0;
      const dy = old ? old.top - rect.top : 8;
      if (old && Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
      const rest = base === 'none' ? '' : base;
      const animation = card.animate([
        { transform: `translate3d(${dx}px, ${dy}px, 0) ${rest}`.trim(), opacity: old ? 1 : 0 },
        { transform: base, opacity: 1 }
      ], { duration: 320, delay: Math.min(index, 9) * 24, easing: 'cubic-bezier(.2,.75,.25,1)', fill: 'both' });
      cardAnimations.set(card, animation);
      animation.finished.then(() => {
        if (cardAnimations.get(card) !== animation) return;
        cardAnimations.delete(card);
        animation.cancel();
      }).catch(() => {});
    }
  }

  for (const state of states) {
    const { group, buttons } = state;
    group.addEventListener('pointerdown', event => {
      if (!active() || event.button !== 0 || event.isPrimary === false) return;
      const button = event.target.closest?.('.tab-btn');
      if (!button || !buttons.includes(button) || button.disabled) return;
      finishDrag(state, null, true);
      state.suppressClickUntil = 0;
      body.classList.remove('glass-compact');
      const geometry = buttonGeometry(button);
      state.drag = {
        id: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false,
        grabOffset: localPointerX(state, event.clientX) - geometry.x - geometry.width / 2
      };
      aim(state, geometry);
    });

    group.addEventListener('pointermove', event => {
      const drag = state.drag;
      if (!drag || drag.id !== event.pointerId) return;
      const dx = Math.abs(event.clientX - drag.startX);
      const dy = Math.abs(event.clientY - drag.startY);
      if (!drag.moved && dy > dx && dy > 8) { finishDrag(state, event, true); return; }
      if (!drag.moved && dx > 7) {
        drag.moved = true;
        group.classList.add('is-dragging');
        group.setPointerCapture(event.pointerId);
      }
      if (drag.moved) followPointer(state, event.clientX);
    });

    group.addEventListener('pointerup', event => finishDrag(state, event, false));
    group.addEventListener('pointercancel', event => finishDrag(state, event, true));
    group.addEventListener('lostpointercapture', event => finishDrag(state, event, true));
    group.addEventListener('pointerleave', event => {
      if (state.drag && !state.drag.moved) finishDrag(state, event, true);
    });

    group.addEventListener('click', event => {
      if (!state.dispatchingSelection && event.detail !== 0 && performance.now() < state.suppressClickUntil) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (!active() || !motionEnabled()) return;
      const button = event.target.closest?.('.tab-btn');
      if (!button || button === selectedButton(state)) return;
      const before = captureCards();
      const change = ++cardChange;
      // Existing click handlers own filtering and sorting. Measure after those synchronous changes.
      queueMicrotask(() => {
        if (change === cardChange && active() && motionEnabled()) animateCards(before);
      });
    }, true);

    group.addEventListener('keydown', event => {
      if (!active() || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      const index = buttons.indexOf(event.target);
      if (index === -1) return;
      event.preventDefault();
      finishDrag(state, null, true);
      body.classList.remove('glass-compact');
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
        : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next].click();
      buttons[next].focus({ preventScroll: true });
    });

    new MutationObserver(schedule).observe(group, { subtree: true, attributes: true, attributeFilter: ['aria-pressed'] });
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(schedule).observe(group);
  }

  let scrollFrame = 0;
  let previousScroll = window.scrollY;
  let scrollTravel = 0;
  window.addEventListener('scroll', () => {
    if (!active() || scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0;
      if (!active()) return;
      const y = window.scrollY;
      const delta = y - previousScroll;
      scrollTravel = Math.sign(delta) === Math.sign(scrollTravel) ? scrollTravel + delta : delta;
      previousScroll = y;
      body.classList.toggle('glass-scrolled', y > 40);
      if (y < 120 || states.some(state => state.drag)) body.classList.remove('glass-compact');
      else if (Math.abs(scrollTravel) > 8) body.classList.toggle('glass-compact', scrollTravel > 0);
    });
  }, { passive: true });

  function syncPolicy() {
    for (const state of states) finishDrag(state, null, true);
    if (springFrame) cancelAnimationFrame(springFrame);
    springFrame = 0;
    previousFrameTime = 0;
    stopCardAnimations();
    previousScroll = window.scrollY;
    scrollTravel = 0;
    if (!active()) body.classList.remove('glass-compact', 'glass-scrolled');
    else body.classList.toggle('glass-scrolled', window.scrollY > 40);
    refresh(true);
  }

  new MutationObserver(syncPolicy).observe(body, { attributes: true, attributeFilter: ['data-theme', 'data-liquid-motion'] });
  reducedMotion.addEventListener('change', syncPolicy);
  window.addEventListener('blur', () => {
    for (const state of states) finishDrag(state, null, true);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      for (const state of states) finishDrag(state, null, true);
      if (springFrame) cancelAnimationFrame(springFrame);
      springFrame = 0;
    } else schedule();
  });
  window.addEventListener('resize', schedule, { passive: true });
  document.fonts?.ready.then(schedule);
  refresh(true);
})();
