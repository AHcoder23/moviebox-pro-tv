/* MovieBox Pro TV: an independent, experimental TizenBrew website module. */
(function () {
  'use strict';
  var START_URL = "https://www.movieboxpro.app/";
  var home = document.createElement('a');
  home.href = START_URL;
  // Leave external sign-in providers and embedded players untouched.
  if (window.top !== window.self || location.hostname.replace(/^www\./, '') !== home.hostname.replace(/^www\./, '')) return;
  if (window.__movieboxTVLoaded) return;
  window.__movieboxTVLoaded = true;

  function boot() {
    var selected = null;
    var previous = null;
    var panelOpen = false;
    var enabled = true;
    var toastTimer;
    var frameQueued = false;
    var selector = 'a[href],button,input:not([type="hidden"]),select,textarea,[role="button"],[role="link"],[tabindex],[onclick],video';
    var css = document.createElement('style');
    css.textContent =
      '#mbptv-ring{position:fixed;z-index:2147483645;pointer-events:none;border:4px solid #ffd36d;border-radius:8px;box-shadow:0 0 0 2px #171d2e;box-sizing:border-box;display:none}' +
      '#mbptv-menu-button{position:fixed;left:24px;bottom:22px;z-index:2147483646;border:1px solid #67738b;border-radius:8px;background:#182237;color:#f6f7fa;padding:12px 20px;font:600 20px Arial,sans-serif;cursor:pointer}' +
      '#mbptv-panel{position:fixed;right:28px;top:28px;bottom:28px;width:380px;max-width:85vw;overflow:auto;z-index:2147483646;box-sizing:border-box;border:1px solid #67738b;border-radius:12px;background:#182237;color:#f6f7fa;padding:28px;box-shadow:0 12px 48px #000;font:22px Arial,sans-serif;display:none}' +
      '#mbptv-panel h2{font:600 30px Arial,sans-serif;color:#fff;margin:0 0 12px}' +
      '#mbptv-panel p{font:18px/1.5 Arial,sans-serif;color:#cbd3e3;margin:0 0 20px}' +
      '#mbptv-panel button{display:block;box-sizing:border-box;width:100%;margin:9px 0;padding:15px 18px;text-align:left;border:1px solid #67738b;border-radius:7px;background:#25334e;color:#fff;font:22px Arial,sans-serif;cursor:pointer}' +
      '#mbptv-panel button:focus,#mbptv-menu-button:focus{outline:4px solid #ffd36d;outline-offset:3px}' +
      '#mbptv-toast{position:fixed;bottom:34px;left:50%;transform:translateX(-50%);max-width:70vw;z-index:2147483647;background:#182237;color:#fff;border:1px solid #67738b;border-radius:8px;padding:15px 24px;font:22px/1.4 Arial,sans-serif;display:none;pointer-events:none}';
    document.head.appendChild(css);
    function element(tag, id, text) {
      var el = document.createElement(tag);
      el.id = id;
      if (text) el.textContent = text;
      document.body.appendChild(el);
      return el;
    }
    var ring = element('div', 'mbptv-ring');
    ring.setAttribute('aria-hidden', 'true');
    var menuButton = element('button', 'mbptv-menu-button', 'TV menu');
    menuButton.type = 'button';
    var panel = element('aside', 'mbptv-panel');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', 'TV controls');
    var title = document.createElement('h2');
    title.textContent = 'MovieBox Pro TV';
    panel.appendChild(title);
    var hint = document.createElement('p');
    hint.textContent = 'Arrows move. OK selects. Back returns. Blue or Info opens this menu.';
    panel.appendChild(hint);
    var toast = element('div', 'mbptv-toast');
    toast.setAttribute('role', 'status');

    function message(text) {
      toast.textContent = text;
      toast.style.display = 'block';
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { toast.style.display = 'none'; }, 3000);
    }
    function visible(el) {
      if (!el || !document.documentElement.contains(el) || el.disabled || el.getAttribute('aria-disabled') === 'true') return false;
      var rect = el.getBoundingClientRect();
      if (rect.width <= 1 || rect.height <= 1) return false;
      for (var node = el; node && node.nodeType === 1; node = node.parentElement) {
        if (node.hasAttribute('hidden') || node.hasAttribute('inert') || node.getAttribute('aria-hidden') === 'true') return false;
        var style = window.getComputedStyle(node);
        if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0') return false;
      }
      return true;
    }
    function inView(el) {
      var r = el.getBoundingClientRect();
      return r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight;
    }
    function targets() {
      var list = (panelOpen ? panel : document).querySelectorAll(selector);
      return Array.prototype.filter.call(list, function (el) {
        if (!visible(el)) return false;
        if (el.getAttribute('tabindex') === '-1' && !/^(BUTTON|INPUT|SELECT|TEXTAREA|VIDEO)$/.test(el.tagName) &&
          !(el.tagName === 'A' && el.hasAttribute('href')) && !el.hasAttribute('onclick') &&
          el.getAttribute('role') !== 'button' && el.getAttribute('role') !== 'link') return false;
        if (!panelOpen && panel.contains(el)) return false;
        return true;
      });
    }
    function paint() {
      frameQueued = false;
      if (!enabled || panelOpen || fullscreenElement() || !visible(selected) || !inView(selected)) { ring.style.display = 'none'; return; }
      var r = selected.getBoundingClientRect();
      ring.style.left = (r.left - 4) + 'px';
      ring.style.top = (r.top - 4) + 'px';
      ring.style.width = (r.width + 8) + 'px';
      ring.style.height = (r.height + 8) + 'px';
      ring.style.display = 'block';
    }
    function schedulePaint() {
      if (!frameQueued) { frameQueued = true; requestAnimationFrame(paint); }
    }
    function field(el) {
      return el && (/^(TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable ||
        (el.tagName === 'INPUT' && !/^(button|submit|reset|checkbox|radio|file|image|color)$/i.test(el.type)));
    }
    function focus(el, scroll) {
      if (!el) return;
      selected = el;
      // Do not open the TV keyboard just by passing an input. OK starts editing.
      if (!field(el)) {
        if (!el.hasAttribute('tabindex') && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) el.setAttribute('tabindex', '-1');
        try { el.focus({preventScroll:true}); } catch (ignore) { el.focus(); }
      } else if (document.activeElement && document.activeElement !== document.body) {
        document.activeElement.blur();
      }
      if (scroll) {
        // Also reveal controls clipped by a nested scrolling menu or carousel.
        try { el.scrollIntoView({block:'nearest', inline:'nearest'}); } catch (ignore2) { el.scrollIntoView(false); }
      }
      paint();
    }
    function move(direction) {
      var list = targets();
      if (!visible(selected) || (panelOpen && !panel.contains(selected))) {
        focus(list.filter(inView)[0] || list[0], true);
        return;
      }
      var origin = selected.getBoundingClientRect();
      var ox = (origin.left + origin.right) / 2;
      var oy = (origin.top + origin.bottom) / 2;
      var best = null;
      var bestScore = Infinity;
      list.forEach(function (el) {
        if (el === selected || el.contains(selected) || selected.contains(el)) return;
        var r = el.getBoundingClientRect();
        var dx = (r.left + r.right) / 2 - ox;
        var dy = (r.top + r.bottom) / 2 - oy;
        var horizontal = direction === 'left' || direction === 'right';
        var ahead = direction === 'left' ? -dx : direction === 'right' ? dx : direction === 'up' ? -dy : dy;
        if (ahead <= 2) return;
        var cross = Math.abs(horizontal ? dy : dx);
        var overlap = horizontal ? r.bottom > origin.top && r.top < origin.bottom : r.right > origin.left && r.left < origin.right;
        var score = ahead + cross * 2 + (overlap ? 0 : 700);
        if (score < bestScore) { best = el; bestScore = score; }
      });
      if (best) focus(best, true);
      else if (!panelOpen) {
        window.scrollBy(direction === 'left' ? -innerWidth * 0.6 : direction === 'right' ? innerWidth * 0.6 : 0,
          direction === 'up' ? -innerHeight * 0.6 : direction === 'down' ? innerHeight * 0.6 : 0);
      }
    }
    function video() {
      var videos = Array.prototype.filter.call(document.querySelectorAll('video'), visible);
      videos.sort(function (a, b) {
        if (a.paused !== b.paused) return a.paused ? 1 : -1;
        var ar = a.getBoundingClientRect(), br = b.getBoundingClientRect();
        return br.width * br.height - ar.width * ar.height;
      });
      return videos[0] || null;
    }
    function media(action) {
      var v = video();
      if (!v) { message('Use the website player controls for this video.'); return; }
      try {
        if (action === 'toggle') action = v.paused ? 'play' : 'pause';
        if (action === 'play') {
          var result = v.play();
          if (result && result.catch) result.catch(function () { message('Select Play in the website player.'); });
        } else if (action === 'pause') v.pause();
        else if (action === 'stop') { v.pause(); if (isFinite(v.duration)) v.currentTime = 0; }
        else if (action === 'forward' || action === 'rewind') {
          var next = v.currentTime + (action === 'forward' ? 10 : -10);
          var lower = 0, upper = isFinite(v.duration) ? v.duration : Infinity;
          if (v.seekable && v.seekable.length) { lower = v.seekable.start(0); upper = v.seekable.end(v.seekable.length - 1); }
          v.currentTime = Math.max(lower, Math.min(upper, next));
          message(action === 'forward' ? 'Forward 10 seconds' : 'Back 10 seconds');
        }
      } catch (error) { message('Use the website player controls for this video.'); }
    }
    function fullscreenElement() { return document.fullscreenElement || document.webkitFullscreenElement; }
    function leaveFullscreen() {
      var fn = document.exitFullscreen || document.webkitExitFullscreen;
      if (fn) { try { var p = fn.call(document); if (p && p.catch) p.catch(function () {}); } catch (ignore) {} }
    }
    function fullscreen() {
      if (fullscreenElement()) { leaveFullscreen(); return; }
      var v = video();
      if (!v) { message('Open a video first, then use its fullscreen control.'); return; }
      // Keep the site's player controls with the video when possible.
      var target = v.parentElement || v;
      var fn = target.requestFullscreen || target.webkitRequestFullscreen;
      if (!fn) { message('Use the fullscreen button in the website player.'); return; }
      try { var p = fn.call(target); if (p && p.catch) p.catch(function () { message('Use the fullscreen button in the website player.'); }); }
      catch (ignore) { message('Use the fullscreen button in the website player.'); }
    }
    function closeMenu() {
      panelOpen = false;
      panel.style.display = 'none';
      focus(visible(previous) ? previous : menuButton, false);
    }
    function openMenu() {
      if (panelOpen) { closeMenu(); return; }
      if (fullscreenElement()) leaveFullscreen();
      previous = selected;
      panelOpen = true;
      panel.style.display = 'block';
      focus(panel.querySelector('button'), false);
    }
    function addButton(label, action) {
      var button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.addEventListener('click', action);
      panel.appendChild(button);
      return button;
    }
    addButton('Return to page', closeMenu);
    addButton('Home', function () { location.href = START_URL; });
    addButton('Play / pause', function () { closeMenu(); media('toggle'); });
    addButton('Back 10 seconds', function () { closeMenu(); media('rewind'); });
    addButton('Forward 10 seconds', function () { closeMenu(); media('forward'); });
    addButton('Fullscreen', function () { closeMenu(); fullscreen(); });
    var mode = addButton('TV navigation: on', function () {
      enabled = !enabled;
      mode.textContent = 'TV navigation: ' + (enabled ? 'on' : 'off');
      paint();
      message(enabled ? 'TV navigation enabled.' : 'Website navigation enabled. Blue or Info opens the TV menu.');
    });
    addButton('Reload page', function () { location.reload(); });
    addButton('Close app', function () {
      try {
        if (window.tizen && tizen.application) {
          tizen.application.getCurrentApplication().exit();
          return;
        }
      } catch (ignore) {}
      message('Hold Back to close, then reopen TizenBrew.');
    });
    menuButton.addEventListener('click', openMenu);

    function consume(event) { event.preventDefault(); event.stopImmediatePropagation(); }
    function keydown(event) {
      var code = event.keyCode || event.which;
      var key = event.key;
      var active = document.activeElement;
      var typing = field(active);
      var back = code === 10009 || key === 'Escape';
      // Preserve native text editing, including M, arrows, Enter and space.
      if (typing && !panelOpen) {
        if (back) { consume(event); if (active && active.blur) active.blur(); paint(); }
        return;
      }
      if (code === 406 || code === 457 || (!typing && (key === 'm' || key === 'M'))) { consume(event); openMenu(); return; }
      if (back) {
        if (panelOpen) { consume(event); closeMenu(); }
        else if (fullscreenElement()) { consume(event); leaveFullscreen(); }
        else if (enabled) { consume(event); history.back(); }
        return;
      }
      if (!enabled && !panelOpen) return;
      var directions = {37:'left',38:'up',39:'right',40:'down'};
      // Fullscreen players often have their own subtitle, volume and settings navigation.
      if (!panelOpen && fullscreenElement() && (directions[code] || code === 13)) return;
      if (directions[code]) { consume(event); move(directions[code]); return; }
      if (code === 13 || key === 'Enter') {
        if (!visible(selected)) { focus(targets().filter(inView)[0], false); }
        if (selected) {
          if (field(selected)) { consume(event); selected.focus(); return; }
          consume(event);
          if (selected.tagName === 'VIDEO') media('toggle');
          else selected.click();
        }
        return;
      }
      var actions = {415:'play',19:'pause',10252:'toggle',413:'stop',417:'forward',412:'rewind'};
      if (actions[code] && !panelOpen) { consume(event); media(actions[code]); }
    }
    window.addEventListener('keydown', keydown, true);
    document.addEventListener('focusin', function (event) {
      if (event.target === selected) return;
      selected = event.target;
      schedulePaint();
    });
    window.addEventListener('scroll', schedulePaint, true);
    window.addEventListener('resize', schedulePaint);
    document.addEventListener('fullscreenchange', schedulePaint);
    document.addEventListener('webkitfullscreenchange', schedulePaint);
    var observer = new MutationObserver(function (records) {
      // Ignore our own overlays to avoid a repaint feedback loop.
      for (var i = 0; i < records.length; i++) {
        var node = records[i].target;
        if (node === ring || node === toast || node === panel || panel.contains(node)) continue;
        schedulePaint();
        break;
      }
    });
    observer.observe(document.body, {childList:true, subtree:true});
    message('TV controls ready. Use arrows and OK. Blue or Info opens the menu.');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
}());
