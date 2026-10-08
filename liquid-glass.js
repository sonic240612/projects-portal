(() => {
  'use strict';

  const surfaces = [...document.querySelectorAll('[data-liquid-surface]')];
  if (!surfaces.length) return;

  const ns = 'http://www.w3.org/2000/svg';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const reducedTransparency = matchMedia('(prefers-reduced-transparency: reduce)');
  const forcedColors = matchMedia('(forced-colors: active)');
  const isChromium = /(?:Chrome|Chromium|Edg|OPR)\//.test(navigator.userAgent) &&
    !/(?:CriOS|EdgiOS|OPiOS)/.test(navigator.userAgent);
  const canRefract = isChromium && typeof ResizeObserver !== 'undefined' &&
    CSS.supports('backdrop-filter', 'url("#liquid-glass-support")');
  const records = new Map();
  const mapCache = new Map();
  let refreshFrame = 0;
  let motionFrame = 0;
  let previousTime = 0;
  let nextId = 0;

  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.style.cssText = 'position:fixed;pointer-events:none;overflow:hidden;';
  const defs = document.createElementNS(ns, 'defs');
  svg.append(defs);
  document.body.append(svg);

  const active = () => document.body.dataset.theme === 'liquid-glass';
  const motionEnabled = () => active() && !document.hidden &&
    (document.body.dataset.liquidMotion === 'full' ||
      (document.body.dataset.liquidMotion !== 'reduced' && !reducedMotion.matches));
  const opticsEnabled = () => active() && canRefract &&
    !reducedTransparency.matches && !forcedColors.matches;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function element(name, attributes) {
    const node = document.createElementNS(ns, name);
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
    return node;
  }

  function radiusInPixels(value, extent) {
    return value.endsWith('%') ? parseFloat(value) / 100 * extent : parseFloat(value);
  }

  function getRadius(surface, width, height) {
    const value = getComputedStyle(surface).borderTopLeftRadius.trim().split(/\s+/);
    const horizontal = radiusInPixels(value[0], width);
    const vertical = radiusInPixels(value[1] || value[0], height);
    return Math.max(0, Math.min(horizontal || 0, vertical || 0, width / 2, height / 2));
  }

  function displacementMap(width, height, radius) {
    const key = width + ':' + height + ':' + radius.toFixed(1);
    if (mapCache.has(key)) return mapCache.get(key);

    const resolution = Math.min(1.5, 1200 / width, 300 / height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * resolution));
    canvas.height = Math.max(1, Math.round(height * resolution));
    const context = canvas.getContext('2d');
    if (!context) return null;

    const data = context.createImageData(canvas.width, canvas.height);
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    const lensDepth = Math.min(halfHeight, Math.max(18, radius));
    const strength = Math.min(30, Math.max(12, lensDepth * 0.78));

    // feDisplacementMap samples P(x + scale * (R - .5), y + scale * (G - .5)).
    // Inward sampling magnifies the real backdrop. A cylindrical lens profile
    // carries that magnification through the capsule, instead of a thin blur rim.
    for (let y = 0; y < canvas.height; y += 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        const px = (x + 0.5) / canvas.width * width - halfWidth;
        const py = (y + 0.5) / canvas.height * height - halfHeight;
        const qx = Math.abs(px) - halfWidth + radius;
        const qy = Math.abs(py) - halfHeight + radius;
        const outerX = Math.max(qx, 0);
        const outerY = Math.max(qy, 0);
        const length = Math.hypot(outerX, outerY);
        const depth = radius - length - Math.min(Math.max(qx, qy), 0);
        let bendX = 0;
        let bendY = 0;

        if (depth >= 0) {
          const normalX = length > 0 ? outerX / length : Number(qx > qy);
          const normalY = length > 0 ? outerY / length : Number(qy >= qx);
          const t = clamp(1 - depth / lensDepth, 0, 1);
          // Snell's law (air -> glass, n = 1.5) supplies the curved ray profile.
          const incident = Math.asin(Math.min(0.995, t));
          const refracted = Math.asin(Math.sin(incident) / 1.5);
          const curvature = Math.sin(incident - refracted) / 0.68;
          const interior = 0.11 * (1 - t);
          bendX = -Math.sign(px) * normalX * curvature - (px / halfWidth) * interior;
          bendY = -Math.sign(py) * normalY * curvature - (py / halfHeight) * interior;
        }

        const offset = (y * canvas.width + x) * 4;
        data.data[offset] = Math.round(127.5 + clamp(bendX, -1, 1) * 127.5);
        data.data[offset + 1] = Math.round(127.5 + clamp(bendY, -1, 1) * 127.5);
        data.data[offset + 2] = 128;
        data.data[offset + 3] = 255;
      }
    }

    context.putImageData(data, 0, 0);
    const result = { href: canvas.toDataURL('image/png'), scale: strength * 2 };
    if (mapCache.size >= 32) mapCache.delete(mapCache.keys().next().value);
    mapCache.set(key, result);
    return result;
  }

  function buildFilter(record) {
    record.id = 'portal-liquid-lens-' + (++nextId);
    record.filter = element('filter', {
      id: record.id,
      filterUnits: 'userSpaceOnUse',
      primitiveUnits: 'userSpaceOnUse',
      'color-interpolation-filters': 'sRGB'
    });
    record.image = element('feImage', { result: 'lens-map', preserveAspectRatio: 'none' });
    record.filter.append(record.image);
    record.displacements = [];

    // Dispersion stays below a pixel for most of the lens, strongest at its edge.
    // Only the backdrop is filtered; labels and icons remain crisp on top.
    ['red', 'green', 'blue'].forEach((channel, index) => {
      const displacement = element('feDisplacementMap', {
        in: 'SourceGraphic', in2: 'lens-map',
        xChannelSelector: 'R', yChannelSelector: 'G', result: channel + '-refracted'
      });
      const matrix = [
        index === 0 ? '1 0 0 0 0' : '0 0 0 0 0',
        index === 1 ? '0 1 0 0 0' : '0 0 0 0 0',
        index === 2 ? '0 0 1 0 0' : '0 0 0 0 0',
        '0 0 0 1 0'
      ].join(' ');
      record.filter.append(displacement, element('feColorMatrix', {
        in: channel + '-refracted', type: 'matrix', values: matrix, result: channel
      }));
      record.displacements.push(displacement);
    });
    record.filter.append(
      element('feBlend', { in: 'red', in2: 'green', mode: 'screen', result: 'red-green' }),
      element('feBlend', { in: 'red-green', in2: 'blue', mode: 'screen' })
    );
    defs.append(record.filter);
  }

  function setThickness(record, value) {
    if (!record.displacements) return;
    const scale = record.baseScale * value;
    if (Math.abs(scale - record.lastScale) < 0.012) return;
    record.lastScale = scale;
    record.displacements.forEach((node, index) => {
      node.setAttribute('scale', (scale * [1.035, 1, 0.965][index]).toFixed(3));
    });
  }

  function updateSurface(surface) {
    const record = records.get(surface);
    if (!opticsEnabled() || record.failed) {
      surface.style.removeProperty('--liquid-filter');
      surface.removeAttribute('data-liquid-optics');
      return;
    }

    const width = surface.clientWidth;
    const height = surface.clientHeight;
    if (width < 1 || height < 1) return;
    const radius = getRadius(surface, width, height);
    const size = width + ':' + height + ':' + radius.toFixed(1);
    if (!record.filter || record.size !== size) {
      const map = displacementMap(width, height, radius);
      if (!map) return;
      if (!record.filter) buildFilter(record);
      for (const node of [record.filter, record.image]) {
        node.setAttribute('x', '0');
        node.setAttribute('y', '0');
        node.setAttribute('width', width);
        node.setAttribute('height', height);
      }
      record.image.setAttribute('href', map.href);
      record.baseScale = map.scale;
      record.lastScale = -Infinity;
      setThickness(record, record.spring.thickness.value);
      record.size = size;
    }

    surface.style.setProperty('--liquid-filter', 'url("#' + record.id + '") blur(var(--glass-blur, 0.35px)) saturate(1.24)');
    surface.setAttribute('data-liquid-optics', 'refractive');
  }

  function spring(value) { return { value, target: value, velocity: 0 }; }

  function applyInteraction(surface, record) {
    const state = record.spring;
    surface.style.setProperty('--pointer-x', (state.lightX.value * 100).toFixed(2) + '%');
    surface.style.setProperty('--pointer-y', (state.lightY.value * 100).toFixed(2) + '%');
    const angle = Math.atan2(state.lightY.value - 0.5, state.lightX.value - 0.5) * 180 / Math.PI + 90;
    surface.style.setProperty('--light-angle', angle.toFixed(2) + 'deg');
    surface.style.setProperty('--surface-x', state.x.value.toFixed(3) + 'px');
    surface.style.setProperty('--surface-y', state.y.value.toFixed(3) + 'px');
    surface.style.setProperty('--surface-scale-x', state.scaleX.value.toFixed(4));
    surface.style.setProperty('--surface-scale-y', state.scaleY.value.toFixed(4));
    surface.style.setProperty('--surface-glow', clamp(state.glow.value, 0, 1).toFixed(3));
    if (opticsEnabled()) setThickness(record, state.thickness.value);
  }

  function tick(time) {
    motionFrame = 0;
    if (!motionEnabled()) { previousTime = 0; return; }
    const dt = Math.min(0.032, previousTime ? (time - previousTime) / 1000 : 1 / 60);
    previousTime = time;
    let moving = false;
    records.forEach((record, surface) => {
      if (!record.moving) return;
      let settled = true;
      Object.values(record.spring).forEach(state => {
        // Two small integration steps keep the spring stable on 30-144 Hz screens.
        for (let step = 0; step < 2; step += 1) {
          state.velocity += ((state.target - state.value) * 260 - state.velocity * 24) * dt / 2;
          state.value += state.velocity * dt / 2;
        }
        if (Math.abs(state.target - state.value) < 0.0007 && Math.abs(state.velocity) < 0.006) {
          state.value = state.target;
          state.velocity = 0;
        } else settled = false;
      });
      applyInteraction(surface, record);
      record.moving = !settled;
      moving ||= !settled;
    });
    if (moving) motionFrame = requestAnimationFrame(tick);
    else previousTime = 0;
  }

  function wake(record) {
    record.moving = true;
    if (!motionFrame && motionEnabled()) motionFrame = requestAnimationFrame(tick);
  }

  function resetInteraction(surface, immediate = false) {
    const record = records.get(surface);
    surface.classList.remove('is-pressing');
    record.hovered = false;
    record.pressed = false;
    const defaults = { lightX: 0.5, lightY: 0.12, x: 0, y: 0, scaleX: 1, scaleY: 1, glow: 0, thickness: 1 };
    Object.entries(defaults).forEach(([key, value]) => {
      record.spring[key].target = value;
      if (immediate) Object.assign(record.spring[key], { value, velocity: 0 });
    });
    if (immediate) {
      record.moving = false;
      applyInteraction(surface, record);
    } else wake(record);
  }

  function refresh() {
    refreshFrame = 0;
    surfaces.forEach(surface => {
      // A missing graphics feature must never interrupt navigation or theme controls.
      try { updateSurface(surface); }
      catch (error) {
        records.get(surface).failed = true;
        surface.style.removeProperty('--liquid-filter');
        surface.removeAttribute('data-liquid-optics');
        console.warn('Liquid Glass optical layer unavailable:', error);
      }
      if (!motionEnabled()) resetInteraction(surface, true);
    });
    if (!motionEnabled() && motionFrame) {
      cancelAnimationFrame(motionFrame);
      motionFrame = 0;
      previousTime = 0;
    }
  }

  function scheduleRefresh() {
    if (!refreshFrame) refreshFrame = requestAnimationFrame(refresh);
  }

  function updateTargets(record) {
    const state = record.spring;
    const pressing = record.pressed;
    state.scaleX.target = pressing ? 0.94 : record.hovered ? 1.035 : 1;
    state.scaleY.target = pressing ? 0.96 : record.hovered ? 1.035 : 1;
    state.glow.target = pressing ? 1 : record.hovered ? 0.42 : 0;
    state.thickness.target = pressing ? 1.26 : record.hovered ? 1.08 : 1;
    wake(record);
  }

  function moveLight(surface, event) {
    if (!motionEnabled()) return;
    const rect = surface.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const record = records.get(surface);
    const x = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((event.clientY - rect.top) / rect.height, 0, 1);
    record.spring.lightX.target = x;
    record.spring.lightY.target = y;
    record.spring.x.target = (x - 0.5) * (record.pressed ? 6 : 3.5);
    record.spring.y.target = (y - 0.5) * (record.pressed ? 5 : 2.5);
    record.hovered = true;
    updateTargets(record);
  }

  function release(surface) {
    const record = records.get(surface);
    if (!record.pressed) return;
    record.pressed = false;
    surface.classList.remove('is-pressing');
    if (motionEnabled()) updateTargets(record);
    else resetInteraction(surface, true);
  }

  const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(scheduleRefresh) : null;
  surfaces.forEach(surface => {
    const record = {
      filter: null, size: '', moving: false, hovered: false, pressed: false, failed: false,
      spring: {
        lightX: spring(0.5), lightY: spring(0.12), x: spring(0), y: spring(0),
        scaleX: spring(1), scaleY: spring(1), glow: spring(0), thickness: spring(1)
      }
    };
    records.set(surface, record);
    observer?.observe(surface);
    surface.addEventListener('pointerenter', event => moveLight(surface, event), { passive: true });
    surface.addEventListener('pointermove', event => moveLight(surface, event), { passive: true });
    surface.addEventListener('pointerdown', event => {
      if (!motionEnabled() || event.button !== 0) return;
      record.pressed = true;
      moveLight(surface, event);
      surface.classList.add('is-pressing');
    }, { passive: true });
    surface.addEventListener('pointerup', () => release(surface), { passive: true });
    surface.addEventListener('pointercancel', () => resetInteraction(surface), { passive: true });
    surface.addEventListener('pointerleave', () => resetInteraction(surface), { passive: true });
    surface.addEventListener('lostpointercapture', () => release(surface), { passive: true });
    surface.addEventListener('keydown', event => {
      if (!motionEnabled() || (event.key !== 'Enter' && event.key !== ' ')) return;
      record.pressed = true;
      updateTargets(record);
      surface.classList.add('is-pressing');
    });
    surface.addEventListener('keyup', () => release(surface));
    surface.addEventListener('focusout', () => resetInteraction(surface));
  });

  new MutationObserver(scheduleRefresh).observe(document.body, {
    attributes: true, attributeFilter: ['data-theme', 'data-mode', 'data-liquid-motion']
  });
  [reducedMotion, reducedTransparency, forcedColors].forEach(query => {
    query.addEventListener('change', scheduleRefresh);
  });
  window.addEventListener('blur', () => surfaces.forEach(surface => resetInteraction(surface, true)));
  window.addEventListener('pointerup', () => surfaces.forEach(release), { passive: true });
  window.addEventListener('resize', scheduleRefresh, { passive: true });
  document.addEventListener('visibilitychange', scheduleRefresh);
  document.fonts?.ready.then(scheduleRefresh);
  scheduleRefresh();
})();
