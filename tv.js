/* MovieBox Pro TV 0.2.0 — independent TizenBrew module. MIT license. */
(function () {
  'use strict';
  var START_URL = "https://www.movieboxpro.app/";
  var home = document.createElement('a'); home.href = START_URL;
  if (window.top !== window.self || location.hostname.replace(/^www\./, '') !== home.hostname.replace(/^www\./, '') || window.__movieboxTVLoaded) return;
  window.__movieboxTVLoaded = true;
  var css = document.createElement('style'); css.id = 'mbptv-styles';
  css.textContent = "#mbptv-app,#mbptv-native-button,#mbptv-toast{font-family:Arial,Helvetica,sans-serif!important;color:#f8f6f1!important;box-sizing:border-box;text-align:left;letter-spacing:normal;line-height:1.3}\n#mbptv-app{position:fixed;inset:0;top:0;right:0;bottom:0;left:0;z-index:2147483645;background:#090909;display:none;font-size:1.65vw;overflow:hidden}\n#mbptv-app *{box-sizing:border-box}\n#mbptv-app button{font:inherit;color:inherit;cursor:pointer;border:0;margin:0;letter-spacing:normal;line-height:1.25;text-transform:none;box-shadow:none}\n#mbptv-app h1,#mbptv-app h2,#mbptv-app p{padding:0;border:0;line-height:1.2;color:inherit;font-family:inherit;text-transform:none;letter-spacing:normal}\n#mbptv-app button:focus{outline:none}\n#mbptv-app .mbptv-focus{outline:.25vw solid #fff!important;outline-offset:.3vw!important}\n#mbptv-rail{position:absolute;top:0;bottom:0;left:0;width:12.2vw;padding:3vw 1.4vw 2vw 2vw;background:#090909;z-index:2}\n#mbptv-brand{font-size:1.8vw;font-weight:800;line-height:1.15;letter-spacing:-.07vw;color:#f0cc70;margin:0 0 3vw .4vw}\n#mbptv-brand span{display:block;color:#f8f6f1;font-size:.8vw;letter-spacing:.19vw;margin-top:.45vw;font-weight:400}\n#mbptv-app .mbptv-nav{display:block;background:transparent;text-align:left;width:100%;font-size:1.2vw;padding:1vw .5vw;border-radius:.2vw;color:#aaa8ab;margin-bottom:.65vw}\n#mbptv-app .mbptv-nav.mbptv-current{color:#fff;background:#232222}\n#mbptv-app .mbptv-nav.mbptv-focus{color:#090909;background:#fff;outline:none!important}\n#mbptv-rail-bottom{position:absolute;bottom:2vw;left:2vw;right:1.4vw}\n#mbptv-browse{position:absolute;left:12.2vw;right:0;top:0;bottom:3.6vw;overflow:auto;scrollbar-width:none}\n#mbptv-browse::-webkit-scrollbar,#mbptv-app .mbptv-track::-webkit-scrollbar,#mbptv-results::-webkit-scrollbar{display:none}\n#mbptv-hero{position:relative;height:26vw;min-height:280px;overflow:hidden;padding:3.5vw 3vw 1.5vw}\n#mbptv-art{position:absolute;right:0;top:0;bottom:0;width:59%;object-fit:contain;object-position:75% 25%;opacity:.88}\n#mbptv-hero.mbptv-backdrop #mbptv-art{width:82%;object-fit:cover;object-position:50% 30%}\n#mbptv-scrim{position:absolute;inset:0;top:0;left:0;bottom:0;right:0;background:linear-gradient(90deg,#090909 14%,rgba(9,9,9,.92) 36%,rgba(9,9,9,.25) 76%),linear-gradient(0deg,#090909 0%,rgba(9,9,9,0) 40%);pointer-events:none}\n#mbptv-hero-copy{position:relative;width:57%;z-index:1}\n#mbptv-context{font-size:1.05vw;color:#c6c2b9!important;margin:0 0 .9vw}\n#mbptv-title{font-size:3.8vw;font-weight:750;letter-spacing:-.12vw!important;line-height:1.05!important;max-height:8vw;overflow:hidden;margin:0 0 1vw}\n#mbptv-meta{font-size:1.1vw;min-height:1.4vw;color:#d2cec6!important;margin:0 0 1.45vw}\n#mbptv-app .mbptv-primary,#mbptv-app .mbptv-secondary{padding:.85vw 1.45vw;border-radius:.22vw;font-size:1.15vw;font-weight:700;margin-right:1vw}\n#mbptv-app .mbptv-primary{background:#f8f6f1;color:#101010}\n#mbptv-app .mbptv-secondary{background:#333234;color:#fff}\n#mbptv-app .mbptv-primary.mbptv-focus,#mbptv-app .mbptv-secondary.mbptv-focus{outline-offset:.25vw!important}\n#mbptv-rows{position:relative;padding:0 0 2vw 3vw}\n#mbptv-app .mbptv-row{margin:0 0 2vw}\n#mbptv-app .mbptv-row h2{font-size:1.55vw;font-weight:600;margin:0 0 1.05vw}\n#mbptv-app .mbptv-track{display:flex;overflow:auto;padding:.6vw 1vw .8vw .5vw;margin-left:-.5vw;scrollbar-width:none}\n#mbptv-app .mbptv-card{position:relative;flex:none;width:10.9vw;display:block;background:transparent;text-align:left;margin-right:1.1vw;border-radius:.25vw;padding:0;vertical-align:top}\n#mbptv-app .mbptv-cover{position:relative;display:block;width:100%;height:15.8vw;border-radius:.25vw;overflow:hidden;background:#262629}\n#mbptv-app .mbptv-cover img{display:block;width:100%;height:100%;object-fit:cover;border:0}\n#mbptv-app .mbptv-card-name{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:.65vw .15vw .15vw;font-size:1.02vw;color:#ccc9c5}\n#mbptv-app .mbptv-card.mbptv-focus .mbptv-card-name{color:white}\n#mbptv-app .mbptv-score{position:absolute;bottom:.45vw;right:.4vw;padding:.15vw .35vw;background:#111;color:#f0cc70;font-size:.85vw;border-radius:.15vw}\n#mbptv-app .mbptv-more{align-self:center;min-height:9vw;background:#242426;font-size:1.1vw;padding:1vw;text-align:center}\n#mbptv-footer{position:absolute;bottom:0;left:15.2vw;right:3vw;height:3.6vw;display:flex;align-items:center;justify-content:space-between;font-size:.92vw;color:#aaa6a0;background:#090909}\n#mbptv-app kbd{display:inline-block;border:1px solid #777;border-radius:.2vw;padding:.1vw .35vw;margin:0 .25vw;color:#fff;background:transparent;font:inherit}\n#mbptv-search{position:absolute;top:0;left:12.2vw;right:0;bottom:3.6vw;display:none;padding:3.2vw 3vw;overflow:hidden}\n#mbptv-search h1{font-size:2.65vw;margin:0 0 1.6vw;letter-spacing:-.07vw}\n#mbptv-query{font-size:2vw;min-height:3.8vw;line-height:1.3;padding:.65vw .2vw .6vw;border-bottom:2px solid #746e60;margin-bottom:1.6vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#fff}\n#mbptv-query:empty:before{content:'Movies, shows, something new…';color:#8d8982;font-size:1.7vw}\n#mbptv-search-left{position:absolute;top:13.5vw;left:3vw;width:29vw;bottom:1vw}\n#mbptv-keyboard{display:flex;flex-wrap:wrap;align-content:flex-start;width:29vw;margin-bottom:1.3vw}\n#mbptv-app .mbptv-key{display:block;width:4.2vw;height:3.15vw;margin:0 .55vw .55vw 0;background:#252527;border-radius:.2vw;font-size:1.55vw;text-align:center}\n#mbptv-app .mbptv-key.mbptv-wide{width:8.95vw;font-size:1.1vw}\n#mbptv-app .mbptv-key.mbptv-focus{background:#fff;color:#090909;outline:none!important}\n#mbptv-submit{width:28vw;margin:0 0 1vw!important;display:block}\n#mbptv-search-help{font-size:1vw!important;line-height:1.5!important;color:#aaa6a0!important;max-width:28vw;margin:.5vw 0!important}\n#mbptv-results{position:absolute;top:13.5vw;left:36vw;right:2vw;bottom:1vw;overflow:auto;padding:.5vw .8vw}\n#mbptv-results h2{font-size:1.2vw!important;color:#bcb8b1!important;margin:0 0 1.5vw}\n#mbptv-result-cards{display:flex;flex-wrap:wrap}\n#mbptv-results .mbptv-card{margin:0 1.25vw 1.2vw 0;width:12.5vw}\n#mbptv-results .mbptv-cover{height:17.6vw}\n#mbptv-results p{font-size:1.25vw;color:#c7c3bc;line-height:1.5;margin:2vw 0}\n#mbptv-menu{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:39vw;padding:3vw;background:#19191c;display:none}\n#mbptv-menu h1{font-size:2.3vw;margin:0 0 1vw}\n#mbptv-menu p{font-size:1.15vw;line-height:1.5;margin:0 0 1.6vw;color:#c5c0b8}\n#mbptv-menu button{display:block;width:100%;text-align:left;background:#303033;padding:1vw 1.4vw;margin:.8vw 0;font-size:1.3vw;border-radius:.2vw}\n#mbptv-native-button{position:fixed;z-index:2147483644;bottom:1.5vw;left:1.5vw;background:#181818;border:1px solid #a29d91;border-radius:.3vw;padding:.75vw 1.2vw;font-size:1.1vw;cursor:pointer}\n#mbptv-native-button:focus{outline:3px solid #fff}\n#mbptv-ring{position:fixed;z-index:2147483644;border:3px solid #fff;box-shadow:0 0 0 2px #090909;pointer-events:none;display:none;border-radius:4px}\n#mbptv-toast{position:fixed;bottom:5vw;left:50%;transform:translateX(-50%);z-index:2147483647;display:none;font-size:1.3vw;background:#262628;padding:1vw 1.5vw;max-width:65vw;border-radius:.3vw;border:1px solid #8d8779}\n@media(max-width:850px){#mbptv-app{font-size:16px}#mbptv-hero{min-height:0}#mbptv-app .mbptv-nav{font-size:12px}#mbptv-footer{font-size:10px}#mbptv-app .mbptv-card-name{font-size:11px}}\n";
  (document.head || document.documentElement).appendChild(css);
(function (window, document) {
  'use strict';
  var headings = 'h1,h2,h3,h4,h5,h6,[role="heading"]';
  var generic = /^(?:watch(?: now)?|play(?: now)?|full(?: movie)?|view|details|more|poster|image|thumbnail|movie|tv|undefined|null)$/i;
  var auth = /(?:^|[\/?#=_-])(?:login|logout|signin|signout|signup|register|oauth|authentication)(?:$|[\/?#=&_-])/i;
  function text(value) { return String(value || '').replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, ''); }
  function hash(value) { var n = 0, i; for (i = 0; i < value.length; i++) n = ((n << 5) - n + value.charCodeAt(i)) | 0; return 'c' + (n >>> 0).toString(36); }
  function matches(node, selector) { var fn = node.matches || node.webkitMatchesSelector; return !!(fn && fn.call(node, selector)); }
  function inside(node, selector) { while (node && node.nodeType === 1) { if (matches(node, selector)) return node; node = node.parentElement; } return null; }
  function excluded(node) {
    while (node && node.nodeType === 1) {
      if (/^mbptv-/.test(node.id || '') || node.hidden || node.hasAttribute('disabled') || node.getAttribute('aria-disabled') === 'true' || node.getAttribute('aria-hidden') === 'true') return true;
      var style = window.getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return true;
      node = node.parentElement;
    }
    return false;
  }
  function url(value, image, allowCurrent) {
    value = text(value);
    if (!value || /[\u0000-\u001f\u007f]/.test(value) || /^(?:javascript|data|blob|file|vbscript):/i.test(value)) return '';
    var link = document.createElement('a'); link.href = value;
    if (!/^https?:$/.test(link.protocol) || link.username || link.password) return '';
    if (image) return link.protocol === 'https:' || link.host === window.location.host ? link.href : '';
    if (link.protocol !== window.location.protocol || link.host !== window.location.host || auth.test(link.pathname + link.search + link.hash)) return '';
    if ((!allowCurrent && link.href === window.location.href) || value === '#') return '';
    return link.href;
  }
  function candidateTitle(anchor, img) {
    var nearby = anchor.querySelector('[data-title],.title,.name,h2,h3,h4');
    var values = [anchor.getAttribute('data-title'), anchor.getAttribute('title'), anchor.getAttribute('aria-label'), img && img.getAttribute('alt'), nearby && (nearby.getAttribute('data-title') || nearby.textContent), anchor.textContent];
    for (var i = 0; i < values.length; i++) {
      var value = text(values[i]);
      if (value && value.length <= 180 && !generic.test(value) && !/^(?:sign in|log in|sign up|register|my account)$/i.test(value)) return value;
    }
    return '';
  }
  function artwork(anchor) {
    var nodes = anchor.querySelectorAll('img'), i, node, image, rect, width, height, marker;
    for (i = 0; i < nodes.length; i++) {
      node = nodes[i];
      if (excluded(node)) continue;
      marker = [node.id, node.className, node.alt, node.getAttribute('src')].join(' ');
      if (/(?:^|[\s\/_-])(?:logo|avatar|icon|spinner|loading|tracking)(?:$|[\s\/_.-])/i.test(marker)) continue;
      rect = node.getBoundingClientRect();
      width = rect.width || parseInt(node.getAttribute('width'), 10) || node.naturalWidth;
      height = rect.height || parseInt(node.getAttribute('height'), 10) || node.naturalHeight;
      if ((width && width < 48) || (height && height < 48) || (node.naturalWidth && node.naturalWidth <= 2) || (node.naturalHeight && node.naturalHeight <= 2)) continue;
      image = url(node.currentSrc || node.getAttribute('src') || node.getAttribute('data-src'), true);
      if (image) return { image: image, node: node };
    }
    nodes = [anchor];
    var children = anchor.querySelectorAll('[style],.poster,.cover,.thumbnail');
    for (i = 0; i < children.length && i < 20; i++) nodes.push(children[i]);
    for (i = 0; i < nodes.length; i++) {
      node = nodes[i]; if (excluded(node)) continue;
      rect = node.getBoundingClientRect();
      if (rect.width < 48 || rect.height < 48) continue;
      var background = window.getComputedStyle(node).backgroundImage;
      var found = /^url\(["']?([^"')]+)["']?\)$/.exec(background || '');
      image = found && url(found[1], true);
      if (image) return { image: image, node: node };
    }
    return null;
  }
  function groupHeading(anchor, root) {
    var parent = anchor.parentElement, depth = 0;
    while (parent && parent !== document.body && depth++ < 9) {
      var candidates = parent.querySelectorAll(headings), i;
      for (i = 0; i < candidates.length; i++) {
        var heading = candidates[i];
        if (!inside(heading, 'a') && !excluded(heading) && (heading.compareDocumentPosition(anchor) & 4) && text(heading.textContent)) return heading;
      }
      var previous = parent.previousElementSibling, count = 0;
      while (previous && count++ < 3) {
        if (matches(previous, headings) && !excluded(previous) && text(previous.textContent)) return previous;
        if (previous.querySelector('a[href]')) break;
        previous = previous.previousElementSibling;
      }
      if (parent === root) break;
      parent = parent.parentElement;
    }
    return null;
  }
  function headingText(heading) {
    if (!heading) return 'Browse titles';
    var copy = heading.cloneNode(true), links = copy.querySelectorAll('a,button');
    for (var i = 0; i < links.length; i++) links[i].parentNode.removeChild(links[i]);
    return text(copy.textContent) || 'Browse titles';
  }
  function literalTarget(element) {
    var handler = element.getAttribute('onclick') || '';
    var match = /^\s*(?:window\.)?location\.href\s*=\s*(['"])([^'"\\\r\n]+)\1\s*;?\s*$/.exec(handler);
    var href = match && url(match[2], false), parsed = document.createElement('a');
    if (!href) return ''; parsed.href = href;
    return /^\/(?:movie|tvshow)\/\d+\/?$/.test(parsed.pathname) ? href : '';
  }
  function movieBoxRows(root) {
    var cards = root.querySelectorAll('.contents li[title]'), rows = [], groups = [], i, j;
    for (i = 0; i < cards.length && i < 1500; i++) {
      var card = cards[i]; if (excluded(card)) continue;
      var posters = card.querySelectorAll('img[onclick]'), element = null, href = '', image = '';
      for (j = 0; j < posters.length; j++) {
        var poster = posters[j], target = literalTarget(poster), rect = poster.getBoundingClientRect();
        if (!target || excluded(poster) || rect.width < 48 || rect.height < 80) continue;
        image = url(poster.currentSrc || poster.getAttribute('src') || poster.getAttribute('data-src'), true);
        if (image) { element = poster; href = target; break; }
      }
      var title = text(card.getAttribute('title'));
      if (!element || !title || generic.test(title)) continue;
      var group = inside(card, '.section') || inside(card, '.contents'), index = groups.indexOf(group);
      if (index < 0) {
        index = groups.length; groups.push(group);
        var heading = group.querySelector('h3'), more = heading && heading.querySelector('a[href]');
        rows.push({ id: hash('moviebox:' + headingText(heading) + ':' + index), title: headingText(heading), items: [] });
        if (more && url(more.getAttribute('href'), false)) rows[index].more = { href: url(more.getAttribute('href'), false), element: more };
      }
      var row = rows[index], duplicate = false;
      for (j = 0; j < row.items.length; j++) if (row.items[j].href === href) duplicate = true;
      if (duplicate || row.items.length >= 150) continue;
      var item = { id: hash(href), title: title, image: image, href: href, element: element };
      var score = card.querySelector('.score span'), tomato = card.querySelector('.tomato span');
      var rating = text(score && score.textContent), freshness = text(tomato && tomato.textContent);
      if (/^(?:[0-9](?:\.\d)?|10(?:\.0)?)$/.test(rating)) item.rating = rating;
      if (/^(?:\d{1,2}|100)%$/.test(freshness)) item.tomato = freshness;
      item.kind = /\/tvshow\//.test(href) ? 'TV show' : 'Movie';
      row.items.push(item);
    }
    var banners = root.querySelectorAll('.contents .section a[href]');
    for (i = 0; i < banners.length; i++) {
      var link = banners[i], bannerHref = url(link.getAttribute('href'), false), art = bannerHref && artwork(link);
      if (!art) continue;
      var parsed = document.createElement('a'); parsed.href = bannerHref;
      for (j = 0; j < rows.length; j++) for (var k = 0; k < rows[j].items.length; k++) {
        var entry = rows[j].items[k], itemUrl = document.createElement('a'); itemUrl.href = entry.href;
        if (itemUrl.pathname === parsed.pathname) entry.backdrop = art.image;
      }
    }
    return rows;
  }
  function scan(root) {
    root = root || document;
    if (root !== document && root.ownerDocument !== document) return { rows: [], navigation: [], fingerprint: 'foreign-document' };
    var anchors = root.querySelectorAll('a[href]'), rows = movieBoxRows(root), navigation = [], groups = [], seenNav = {}, parts = [], i, siteRows = rows.length > 0;
    var siteNav = root.querySelectorAll('#top_nav_home,#top_nav_movie,#top_nav_tv,#top_nav_list');
    for (i = 0; i < siteNav.length; i++) {
      var navAnchor = inside(siteNav[i], 'a[href]'), navHref = navAnchor && url(navAnchor.getAttribute('href'), false, true);
      if (navHref && !excluded(navAnchor) && !seenNav[navHref]) { navigation.push({ label: text(siteNav[i].textContent), href: navHref, element: navAnchor }); seenNav[navHref] = true; }
    }
    for (i = 0; i < anchors.length && i < 1500; i++) {
      var anchor = anchors[i], href = url(anchor.getAttribute('href'), false);
      if (!href || excluded(anchor) || inside(anchor, 'form')) continue;
      var nav = inside(anchor, 'nav,[role="navigation"]');
      if (nav) {
        var label = text(anchor.getAttribute('aria-label') || anchor.textContent);
        if (label && label.length <= 45 && !seenNav[href] && !/^(?:sign in|log in|sign up|register|my account)$/i.test(label)) {
          navigation.push({ label: label, href: href, element: anchor }); seenNav[href] = true;
        }
        continue;
      }
      if (siteRows) continue;
      var art = artwork(anchor), title = art && candidateTitle(anchor, art.node);
      if (!art || !title) continue;
      var heading = groupHeading(anchor, root), groupIndex = groups.indexOf(heading);
      if (groupIndex < 0) { groupIndex = groups.length; groups.push(heading); rows.push({ id: hash((heading ? text(heading.textContent) : 'browse') + ':' + groupIndex), title: heading ? text(heading.textContent) : 'Browse titles', items: [] }); }
      var row = rows[groupIndex], duplicate = null, j;
      for (j = 0; j < row.items.length; j++) if (row.items[j].href === href) { duplicate = row.items[j]; break; }
      if (duplicate || row.items.length >= 150) continue;
      var item = { id: hash(href), title: title, image: art.image, href: href, element: anchor };
      var yearNode = anchor.querySelector('[data-year],.year,[itemprop="datePublished"]');
      var year = text(anchor.getAttribute('data-year') || (yearNode && (yearNode.getAttribute('data-year') || yearNode.getAttribute('content') || yearNode.textContent)));
      if (/^(?:19|20)\d{2}$/.test(year)) item.year = year;
      var detailNode = anchor.querySelector('[data-description],.description,.synopsis');
      var detail = text(anchor.getAttribute('data-description') || (detailNode && (detailNode.getAttribute('data-description') || detailNode.textContent)));
      if (detail && detail.length <= 1200 && detail !== title) item.detail = detail;
      row.items.push(item);
    }
    for (i = 0; i < rows.length; i++) {
      parts.push(rows[i].id + ':' + rows[i].title);
      for (var k = 0; k < rows[i].items.length; k++) { var entry = rows[i].items[k]; parts.push([entry.href, entry.title, entry.image, entry.backdrop || '', entry.rating || '', entry.tomato || '', entry.year || '', entry.detail || ''].join('|')); }
    }
    for (i = 0; i < navigation.length; i++) parts.push(navigation[i].href + ':' + navigation[i].label);
    return { rows: rows, navigation: navigation, fingerprint: hash(parts.join('\n')) };
  }
  function safeForm(form) {
    if (!form) return true;
    if (form.querySelector('input[type="password"]')) return false;
    var action = text(form.getAttribute('action'));
    if (!action) return true;
    var link = document.createElement('a'); link.href = action;
    return /^https?:$/.test(link.protocol) && link.protocol === window.location.protocol && link.host === window.location.host && !link.username && !link.password && !auth.test(link.pathname + link.search);
  }
  function searchLabel(node) { return text([node.getAttribute('aria-label'), node.getAttribute('title'), node.getAttribute('placeholder'), node.getAttribute('name'), node.id].join(' ')); }
  function findSearch(root) {
    root = root || document;
    if (root !== document && root.ownerDocument !== document) return null;
    var siteForm = root.querySelector('form#search_form'), siteInput = siteForm && siteForm.querySelector('input#top_search[name="word"]'), siteOpener = root.querySelector('.top-search-btn');
    if (siteForm && siteInput && siteOpener && safeForm(siteForm) && !excluded(siteOpener)) {
      var action = document.createElement('a'); action.href = siteForm.getAttribute('action') || window.location.href;
      if (action.pathname === '/index/search' && (siteForm.getAttribute('method') || 'get').toLowerCase() === 'get' && !siteInput.disabled && !siteInput.readOnly) return { input: siteInput, form: siteForm, submit: null, opener: siteOpener };
    }
    var inputs = root.querySelectorAll('input'), input = null, score = 0, i;
    for (i = 0; i < inputs.length; i++) {
      var field = inputs[i], type = (field.getAttribute('type') || 'text').toLowerCase();
      if (!/^(?:text|search)$/.test(type) || field.readOnly || excluded(field) || !safeForm(field.form)) continue;
      var label = searchLabel(field), candidate = 0;
      if (/(?:password|email|username|sign.?in|log.?in|register|verification)/i.test(label)) continue;
      if (type === 'search') candidate += 10;
      if (field.getAttribute('role') === 'searchbox') candidate += 10;
      if (inside(field, '[role="search"]')) candidate += 5;
      if (/(?:search|keyword|搜索|搜尋)/i.test(label)) candidate += 4;
      if (/^(?:q|query)$/i.test(field.getAttribute('name') || '')) candidate += 3;
      if (candidate > score) { input = field; score = candidate; }
    }
    var opener = null, controls = root.querySelectorAll('a[href],button,[role="button"]');
    for (i = 0; i < controls.length; i++) {
      var control = controls[i];
      if (excluded(control) || !safeForm(control.form) || (control.tagName === 'A' && !url(control.getAttribute('href'), false))) continue;
      var name = text(control.getAttribute('aria-label') || control.getAttribute('title') || control.textContent);
      if (/^(?:search(?: (?:movies|titles|shows|films|videos|everything|the catalog))?|find (?:movies|titles|shows|films)|搜索|搜尋)$/i.test(name)) { opener = control; break; }
    }
    if (!input && !opener) return null;
    var form = input && input.form, submit = null;
    if (form) {
      var buttons = form.querySelectorAll('button,input[type="submit"],input[type="image"]');
      for (i = 0; i < buttons.length; i++) {
        var button = buttons[i], buttonType = (button.getAttribute('type') || 'submit').toLowerCase();
        if (/^(?:submit|image)$/.test(buttonType) && !excluded(button) && button.form === form) { submit = button; break; }
      }
    }
    return { input: input, form: form || null, submit: submit, opener: opener };
  }
  window.MBPTVCatalog = { scan: scan, findSearch: findSearch };
}(window, document));

/* MovieBox Pro TV: connect TV search to the site's existing form and events. */
(function (window, document) {
  'use strict';

  function locate() {
    var adapter = window.MBPTVCatalog;
    return (adapter && typeof adapter.findSearch === 'function' ? adapter.findSearch(document) : null) || {};
  }

  function usableInput(input) {
    return !!input && !input.disabled && !input.readOnly && typeof input.value === 'string';
  }

  function visible(input) {
    return !!input && !!(input.offsetWidth || input.offsetHeight || (input.getClientRects && input.getClientRects().length));
  }

  function describe() {
    var controls = locate();
    var input = usableInput(controls.input) ? controls.input : null;
    var form = input && controls.form && input.form === controls.form ? controls.form : null;
    var opener = controls.opener || null;
    return {
      available: !!(input || opener),
      canSubmit: !!form,
      canOpenOriginal: !!opener || visible(input),
      input: input,
      form: form,
      opener: opener
    };
  }

  function notify(input, type) {
    var event = document.createEvent('HTMLEvents');
    event.initEvent(type, true, false);
    input.dispatchEvent(event);
  }

  function submit(query) {
    var term = String(query == null ? '' : query).replace(/^\s+|\s+$/g, '');
    var current = describe();
    if (!term) return { ok: false, reason: 'empty-query' };
    if (!current.canSubmit) return { ok: false, reason: 'native-search-unavailable' };

    current.input.value = term;
    notify(current.input, 'input');
    notify(current.input, 'change');
    if (typeof current.form.checkValidity === 'function' && !current.form.checkValidity()) {
      return { ok: false, reason: 'native-validation-failed' };
    }

    /* A native submission keeps the live site's validation, submit handlers,
       field names, form action and current session. Never construct a URL. */
    if (typeof current.form.requestSubmit === 'function') {
      current.form.requestSubmit();
    } else {
      /* Older Samsung engines lack requestSubmit. Clicking a temporary native
         submit button has the same validation/event path; form.submit() does not. */
      var button = document.createElement('button');
      button.type = 'submit';
      button.tabIndex = -1;
      button.style.display = 'none';
      button.setAttribute('aria-hidden', 'true');
      current.form.appendChild(button);
      try {
        button.click();
      } finally {
        if (button.parentNode) button.parentNode.removeChild(button);
      }
    }
    /* This confirms the request was dispatched, not that remote results loaded. */
    return { ok: true, reason: 'native-submit-requested' };
  }

  function openOriginal() {
    var current = describe();
    if (current.opener && typeof current.opener.click === 'function') {
      current.opener.click();
      return { ok: true, reason: 'native-search-opened' };
    }
    if (current.input && visible(current.input)) {
      current.input.focus();
      return { ok: true, reason: 'native-search-focused' };
    }
    return { ok: false, reason: 'native-search-unavailable' };
  }

  window.MBPTVSearch = { describe: describe, submit: submit, openOriginal: openOriginal };
}(window, document));

/* TV shell uses the live page's catalog and original actions. */
function bootMovieBoxTV() {
  var mode = 'native', catalog = { rows: [], navigation: [], fingerprint: '' }, focusNode = null;
  var featured = null, selectedId = '', rowPosition = {}, savedFocus = '', query = '', scanTimer, toastTimer;
  var initial = true, nativeRequested = false, restoreOnReturn = false, lastNativeFocus = null, nativeEnabled = true, oldOverflow = '';
  function make(tag, cls, text, parent) {
    var node = document.createElement(tag); if (cls) node.className = cls;
    if (text != null) node.textContent = text; if (parent) parent.appendChild(node); return node;
  }
  function identified(tag, id, parent) { var node = make(tag, '', null, parent); node.id = id; return node; }
  function button(text, action, parent, cls) {
    var b = make('button', cls || '', text, parent); b.type = 'button';
    if (action) b.setAttribute('data-mb-action', action); return b;
  }
  var app = identified('div', 'mbptv-app', document.body); app.setAttribute('role', 'dialog'); app.setAttribute('aria-label', 'MovieBox Pro TV'); app.setAttribute('aria-modal', 'true');
  var rail = identified('nav', 'mbptv-rail', app); rail.setAttribute('aria-label', 'Main navigation');
  var brand = identified('div', 'mbptv-brand', rail); brand.textContent = 'MovieBox'; make('span', '', 'Pro TV', brand);
  var nav = identified('div', 'mbptv-nav', rail);
  var railBottom = identified('div', 'mbptv-rail-bottom', rail);
  button('Website', 'native', railBottom, 'mbptv-nav'); button('TV menu', 'menu', railBottom, 'mbptv-nav');
  var browse = identified('main', 'mbptv-browse', app);
  var hero = identified('section', 'mbptv-hero', browse);
  var art = identified('img', 'mbptv-art', hero); art.alt = ''; art.setAttribute('aria-hidden', 'true');
  identified('div', 'mbptv-scrim', hero);
  var copy = identified('div', 'mbptv-hero-copy', hero);
  var context = identified('p', 'mbptv-context', copy);
  var heroTitle = identified('h1', 'mbptv-title', copy);
  var meta = identified('p', 'mbptv-meta', copy);
  var openTitle = button('Open title', 'open', copy, 'mbptv-primary');
  button('Search', 'search', copy, 'mbptv-secondary');
  var rows = identified('div', 'mbptv-rows', browse);
  var search = identified('section', 'mbptv-search', app);
  make('h1', '', 'Find your next watch', search);
  var queryNode = identified('div', 'mbptv-query', search); queryNode.setAttribute('role', 'searchbox'); queryNode.setAttribute('aria-label', 'Search query'); queryNode.setAttribute('aria-readonly', 'true'); queryNode.setAttribute('aria-live', 'polite');
  var searchLeft = identified('div', 'mbptv-search-left', search);
  var keyboard = identified('div', 'mbptv-keyboard', searchLeft); keyboard.setAttribute('aria-label', 'On-screen keyboard');
  var letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890'.split('');
  letters.forEach(function (letter) { var key = button(letter, '', keyboard, 'mbptv-key'); key.setAttribute('data-mb-key', letter); key.setAttribute('aria-label', letter); });
  [['Space','space'],['Delete','delete'],['Clear','clear']].forEach(function (pair) { var key = button(pair[0], '', keyboard, 'mbptv-key mbptv-wide'); key.setAttribute('data-mb-key', pair[1]); });
  var submit = button('Search MovieBox', 'submit', searchLeft, 'mbptv-primary'); submit.id = 'mbptv-submit';
  var searchHelp = identified('p', 'mbptv-search-help', searchLeft);
  var results = identified('div', 'mbptv-results', search);
  var menu = identified('section', 'mbptv-menu', app);
  make('h1', '', 'MovieBox Pro TV', menu);
  make('p', '', 'Use the arrows to explore, OK to select and Back to return. Blue or Info opens this menu.', menu);
  button('Continue', 'continue', menu); button('Home', 'home', menu); button('Search', 'search', menu);
  button('Use website', 'native', menu); var nativeToggle = button('Website remote controls: on', 'toggle-native', menu);
  button('Reload page', 'reload', menu);
  var footer = identified('div', 'mbptv-footer', app);
  var footerHint = make('span', '', 'Arrows to explore     OK to select     Back to return', footer);
  make('span', '', 'MovieBox Pro TV 0.2', footer);
  var nativeButton = button('TV menu', '', document.body); nativeButton.id = 'mbptv-native-button'; nativeButton.addEventListener('click', function () { showMenu(); });
  var ring = identified('div', 'mbptv-ring', document.body); ring.setAttribute('aria-hidden', 'true');
  var toast = identified('div', 'mbptv-toast', document.body); toast.setAttribute('role', 'status');
  function message(text) { toast.textContent = text; toast.style.display = 'block'; clearTimeout(toastTimer); toastTimer = setTimeout(function () { toast.style.display = 'none'; }, 4500); }
  function live(node) { return !!node && document.documentElement.contains(node); }
  function own(node) { while (node && node.nodeType === 1) { if (/^mbptv-/.test(node.id || '')) return true; node = node.parentElement; } return false; }
  function visible(node) {
    if (!live(node) || node.disabled || node.getAttribute('aria-disabled') === 'true') return false;
    var r = node.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false;
    for (var p = node; p && p.nodeType === 1; p = p.parentElement) {
      var s = window.getComputedStyle(p); if (p.hidden || p.getAttribute('aria-hidden') === 'true' || s.display === 'none' || s.visibility === 'hidden') return false;
    }
    return true;
  }
  function editing(node) { return node && (node.isContentEditable || /^(TEXTAREA|SELECT)$/.test(node.tagName) || (node.tagName === 'INPUT' && !/^(button|submit|checkbox|radio|range)$/i.test(node.type))); }
  function fullscreen() { return document.fullscreenElement || document.webkitFullscreenElement; }
  function playing() { var videos = document.querySelectorAll('video'); for (var i = 0; i < videos.length; i++) if (!videos[i].paused && !videos[i].ended) return true; return false; }
  function findItem(id) { for (var i = 0; i < catalog.rows.length; i++) for (var j = 0; j < catalog.rows[i].items.length; j++) if (catalog.rows[i].items[j].id === id) return catalog.rows[i].items[j]; return null; }
  function feature(item, rowTitle) {
    if (!item) return; featured = item; selectedId = item.id;
    heroTitle.textContent = item.title; context.textContent = rowTitle || 'Browse MovieBox';
    var bits = []; if (item.kind) bits.push(item.kind); if (item.year) bits.push(item.year); if (item.rating) bits.push('Rating ' + item.rating); if (item.tomato) bits.push('Tomatometer ' + item.tomato);
    meta.textContent = bits.join('   /   '); openTitle.textContent = /[?&]play=1(?:&|$)/.test(item.href) ? 'Continue watching' : 'Open title';
    hero.className = item.backdrop ? 'mbptv-backdrop' : '';
    art.style.display = 'block'; art.src = item.backdrop || item.image; art.onerror = function () { art.style.display = 'none'; };
  }
  function focusKey(node) { return node && (node.getAttribute('data-mb-id') || node.getAttribute('data-mb-key') || node.getAttribute('data-mb-action')); }
  function setFocus(node) {
    if (!node || !visible(node)) return;
    if (focusNode) focusNode.classList.remove('mbptv-focus');
    focusNode = node; node.classList.add('mbptv-focus');
    try { node.focus({preventScroll:true}); } catch (e) { node.focus(); }
    var track = node.parentElement;
    if (track && track.classList.contains('mbptv-track')) {
      var nr = node.getBoundingClientRect(), tr = track.getBoundingClientRect();
      if (nr.right > tr.right - 20) track.scrollLeft += nr.right - tr.right + 40;
      if (nr.left < tr.left + 10) track.scrollLeft += nr.left - tr.left - 10;
      var rr = track.parentElement.getBoundingClientRect(), br = browse.getBoundingClientRect();
      if (rr.bottom > br.bottom) browse.scrollTop += rr.bottom - br.bottom + 12;
      if (rr.top < br.top + 12) browse.scrollTop += rr.top - br.top - 24;
      rowPosition[track.getAttribute('data-mb-row')] = node.getAttribute('data-mb-id');
    } else if (results.contains(node)) {
      var cr = node.getBoundingClientRect(), vr = results.getBoundingClientRect();
      if (cr.bottom > vr.bottom) results.scrollTop += cr.bottom - vr.bottom + 10;
      if (cr.top < vr.top) results.scrollTop += cr.top - vr.top - 10;
    }
    var id = node.getAttribute('data-mb-id'), item = id && findItem(id);
    if (item && mode === 'browse') feature(item, node.getAttribute('data-mb-rowtitle'));
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function card(item, parent, rowTitle) {
    var b = button('', '', parent, 'mbptv-card'); b.setAttribute('data-mb-id', item.id); b.setAttribute('data-mb-rowtitle', rowTitle || ''); b.setAttribute('aria-label', item.title);
    var cover = make('span', 'mbptv-cover', '', b), img = make('img', '', null, cover); img.alt = ''; img.src = item.image; img.setAttribute('loading','lazy');
    img.onerror = function () { img.style.display = 'none'; };
    if (item.rating) make('span', 'mbptv-score', item.rating, cover);
    make('span', 'mbptv-card-name', item.title, b); return b;
  }
  function renderCatalog() {
    var previousKey = focusKey(focusNode), tracks = rows.querySelectorAll('.mbptv-track'), scrolls = {}, i;
    for (i = 0; i < tracks.length; i++) scrolls[tracks[i].getAttribute('data-mb-row')] = tracks[i].scrollLeft;
    clear(nav); var homeBtn = button('Home', 'home', nav, 'mbptv-nav' + (location.pathname === '/' ? ' mbptv-current' : ''));
    button('Search', 'search', nav, 'mbptv-nav');
    catalog.navigation.forEach(function (entry, index) {
      var destination = document.createElement('a'); destination.href = entry.href;
      if (/^home$/i.test(entry.label) || (destination.pathname === home.pathname && destination.search === home.search)) return;
      var b = button(entry.label, 'nav:' + index, nav, 'mbptv-nav');
      if (entry.href.split('?')[0] === location.href.split('?')[0]) b.classList.add('mbptv-current');
    });
    clear(rows);
    catalog.rows.forEach(function (row, index) {
      if (!row.items.length) return;
      var section = make('section', 'mbptv-row', '', rows); make('h2', '', row.title, section);
      var track = make('div', 'mbptv-track', '', section); track.setAttribute('data-mb-row', row.id);
      row.items.forEach(function (item) { card(item, track, row.title); });
      if (row.more) button('See all', 'more:' + index, track, 'mbptv-card mbptv-more');
      track.scrollLeft = scrolls[row.id] || 0;
    });
    featured = findItem(selectedId) || (catalog.rows[0] && catalog.rows[0].items[0]);
    if (featured) feature(featured, catalog.rows[0].title);
    if (mode === 'browse') {
      var options = app.querySelectorAll('button'), restore = null;
      for (i = 0; i < options.length; i++) if (focusKey(options[i]) === previousKey && visible(options[i])) { restore = options[i]; break; }
      setFocus(restore || rows.querySelector('button') || homeBtn);
    }
  }
  function state(next) {
    if (mode === 'native' && next !== 'native') { oldOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; }
    mode = next; app.style.display = next === 'native' ? 'none' : 'block'; nativeButton.style.display = next === 'native' ? 'block' : 'none'; ring.style.display = 'none';
    browse.style.display = next === 'browse' ? 'block' : 'none'; search.style.display = next === 'search' ? 'block' : 'none'; menu.style.display = next === 'menu' ? 'block' : 'none';
    rail.style.display = next === 'menu' ? 'none' : 'block'; footer.style.display = next === 'menu' ? 'none' : 'flex';
    if (next === 'native') { document.body.style.overflow = oldOverflow; if (focusNode && focusNode.blur) focusNode.blur(); focusNode = null; }
  }
  function nativeMode() { nativeRequested = true; state('native'); }
  function showBrowse() {
    scan(); if (!catalog.rows.length) { nativeMode(); message('No catalog is available on this page. Use the website or open Home.'); return; }
    if (playing() || fullscreen()) { message('Pause or leave the player before opening the TV catalog.'); return; }
    state('browse'); var candidates = rows.querySelectorAll('button'), restore = null;
    for (var i = 0; i < candidates.length; i++) if (candidates[i].getAttribute('data-mb-id') === savedFocus) restore = candidates[i];
    setFocus(restore || candidates[0] || openTitle);
  }
  function renderResults() {
    clear(results); make('h2', '', query ? 'Matches on this page' : 'On this page', results);
    var container = identified('div', 'mbptv-result-cards', results), seen = {}, count = 0;
    catalog.rows.forEach(function (row) { row.items.forEach(function (item) {
      if (count >= 36 || seen[item.id] || (query && item.title.toLowerCase().indexOf(query.toLowerCase()) < 0)) return;
      seen[item.id] = true; count++; card(item, container, row.title);
    }); });
    if (!count) make('p', '', query ? 'Search MovieBox to find titles across the full catalog.' : 'Search MovieBox to load titles.', results);
    queryNode.textContent = query;
    var available = window.MBPTVSearch.describe();
    submit.textContent = available.canSubmit ? 'Search MovieBox' : 'Open website search';
    searchHelp.textContent = available.canSubmit ? 'Choose letters, then Search MovieBox. A physical keyboard works too.' : 'The search form is not available on this page. Open the website search to continue.';
  }
  function showSearch() {
    if (playing() || fullscreen()) { message('Pause or leave the player before searching.'); return; }
    savedFocus = selectedId; state('search'); renderResults(); setFocus(keyboard.querySelector('button'));
  }
  var menuPrevious = 'native';
  function showMenu() {
    if (mode === 'menu') { resume(); return; }
    if (fullscreen()) {
      var exitFullscreen=document.exitFullscreen||document.webkitExitFullscreen;
      if (!exitFullscreen) {message('Leave fullscreen to open the TV menu.');return;}
      try {var exited=exitFullscreen.call(document);if(exited&&exited.catch)exited.catch(function(){nativeMode();});} catch(e){return;}
    }
    menuPrevious = mode; savedFocus = selectedId; state('menu'); setFocus(menu.querySelector('button'));
  }
  function resume() { if (menuPrevious === 'search') showSearch(); else if (menuPrevious === 'browse') showBrowse(); else nativeMode(); }
  function activateOriginal(entry) {
    if (!entry || !live(entry.element)) { scan(); message('This title changed. Select it again.'); return; }
    savedFocus = selectedId; restoreOnReturn = true; nativeMode(); entry.element.click();
  }
  function homeAction() {
    if (location.pathname === home.pathname && location.search === home.search && catalog.rows.length) { browse.scrollTop = 0; showBrowse(); }
    else { nativeMode(); location.href = START_URL; }
  }
  function doSearch() {
    var info = window.MBPTVSearch.describe();
    if (!info.canSubmit) { nativeMode(); var opened = window.MBPTVSearch.openOriginal(); if (!opened.ok) { showSearch(); message('Open Home to access MovieBox search.'); } return; }
    if (!query.replace(/\s/g,'')) { message('Choose a title or enter a search.'); return; }
    restoreOnReturn = true; nativeMode();
    try { var outcome = window.MBPTVSearch.submit(query); if (!outcome.ok) { showSearch(); message('Search is unavailable on this page. Open Home and try again.'); } }
    catch (e) { showSearch(); message('The website could not start the search. Try its search control.'); }
  }
  function activate(node) {
    var key = node.getAttribute('data-mb-key'), action = node.getAttribute('data-mb-action'), id = node.getAttribute('data-mb-id');
    if (key) { query = key === 'delete' ? query.slice(0,-1) : key === 'clear' ? '' : query.length < 120 ? query + (key === 'space' ? ' ' : key.toLowerCase()) : query; renderResults(); return; }
    if (id) { activateOriginal(findItem(id)); return; }
    if (action === 'open') activateOriginal(featured);
    else if (action === 'search') showSearch();
    else if (action === 'submit') doSearch();
    else if (action === 'native') nativeMode();
    else if (action === 'home') homeAction();
    else if (action === 'menu') showMenu();
    else if (action === 'continue') resume();
    else if (action === 'reload') location.reload();
    else if (action === 'toggle-native') { nativeEnabled = !nativeEnabled; nativeToggle.textContent = 'Website remote controls: ' + (nativeEnabled ? 'on' : 'off'); }
    else if (action && action.indexOf('nav:') === 0) activateOriginal(catalog.navigation[parseInt(action.slice(4),10)]);
    else if (action && action.indexOf('more:') === 0) { var row = catalog.rows[parseInt(action.slice(5),10)]; activateOriginal(row && row.more); }
  }
  app.addEventListener('click', function (event) { var n = event.target; while (n && n !== app && n.tagName !== 'BUTTON') n = n.parentElement; if (n && n.tagName === 'BUTTON') { setFocus(n); activate(n); } });
  function spatial(list, origin, direction) {
    if (!origin || !visible(origin)) return list[0];
    var o = origin.getBoundingClientRect(), ox = (o.left + o.right)/2, oy = (o.top + o.bottom)/2, best = null, score = Infinity;
    for (var i = 0; i < list.length; i++) {
      var el = list[i]; if (el === origin || el.contains(origin) || origin.contains(el)) continue;
      var r = el.getBoundingClientRect(), dx = (r.left + r.right)/2-ox, dy = (r.top + r.bottom)/2-oy;
      var horizontal = direction === 37 || direction === 39, ahead = direction === 37 ? -dx : direction === 39 ? dx : direction === 38 ? -dy : dy;
      if (ahead < 2) continue;
      var overlap = horizontal ? r.bottom > o.top && r.top < o.bottom : r.right > o.left && r.left < o.right;
      var rank = ahead + Math.abs(horizontal ? dy : dx) * 3 + (overlap ? 0 : 10000);
      if (rank < score) { score = rank; best = el; }
    }
    return best;
  }
  function moveShell(code) {
    var track = focusNode && focusNode.parentElement;
    if (mode === 'browse' && track && track.classList.contains('mbptv-track')) {
      if (code === 37 || code === 39) {
        var sibling = code === 37 ? focusNode.previousElementSibling : focusNode.nextElementSibling;
        if (sibling) { setFocus(sibling); return; }
        if (code === 37) { setFocus(nav.querySelector('button')); return; } return;
      }
      var section = code === 38 ? track.parentElement.previousElementSibling : track.parentElement.nextElementSibling;
      if (section) {
        var next = section.querySelector('.mbptv-track'), saved = rowPosition[next.getAttribute('data-mb-row')], cards = next.querySelectorAll('button'), target = null;
        for (var i = 0; i < cards.length; i++) if (cards[i].getAttribute('data-mb-id') === saved) target = cards[i];
        setFocus(target || cards[0]); return;
      }
      if (code === 38) { browse.scrollTop = 0; setFocus(openTitle); return; } return;
    }
    var list = Array.prototype.filter.call(app.querySelectorAll('button'), visible);
    setFocus(spatial(list, focusNode, code));
  }
  function nativeTargets() { return Array.prototype.filter.call(document.querySelectorAll('a[href],button,input:not([type="hidden"]),select,textarea,[onclick],[role="button"],[tabindex]'), function(n) { return !own(n) && visible(n); }); }
  function paintRing() {
    if (mode !== 'native' || !nativeEnabled || fullscreen() || !visible(lastNativeFocus)) { ring.style.display='none'; return; }
    var r=lastNativeFocus.getBoundingClientRect(); ring.style.left=(r.left-4)+'px';ring.style.top=(r.top-4)+'px';ring.style.width=(r.width+8)+'px';ring.style.height=(r.height+8)+'px';ring.style.display='block';
  }
  function focusNative(node) {
    if (!node) return; lastNativeFocus=node;
    if (!editing(node)) { if (!node.hasAttribute('tabindex')) node.setAttribute('tabindex','-1'); try {node.focus({preventScroll:true});}catch(e){node.focus();} }
    try {node.scrollIntoView({block:'nearest',inline:'nearest'});}catch(e2){node.scrollIntoView(false);} paintRing();
  }
  function consume(event) { event.preventDefault(); event.stopImmediatePropagation(); }
  window.addEventListener('keydown', function(event) {
    var code=event.keyCode||event.which, key=event.key||'', back=code===10009||code===27, typing=editing(document.activeElement);
    if (mode==='native' && typing) return;
    if (code===406||code===457) {consume(event);showMenu();return;}
    if (mode==='native') {
      if (fullscreen() || !nativeEnabled) return;
      if (code>=37&&code<=40) {consume(event);focusNative(spatial(nativeTargets(),lastNativeFocus,code));}
      else if (code===13 && visible(lastNativeFocus)) {consume(event);if(editing(lastNativeFocus))lastNativeFocus.focus();else lastNativeFocus.click();}
      // Player media keys and Back belong to the website while it is active.
      return;
    }
    if (back) {consume(event);if(mode==='search')showBrowse();else if(mode==='menu')resume();else showMenu();return;}
    if (code>=37&&code<=40) {consume(event);moveShell(code);return;}
    if (code===13) {consume(event);if(focusNode)activate(focusNode);return;}
    if (code===9) {consume(event);moveShell(event.shiftKey?37:39);return;}
    if (mode==='search' && !event.ctrlKey && !event.altKey && !event.metaKey) {
      if (code===8) {consume(event);query=query.slice(0,-1);renderResults();}
      else if (key.length===1 && query.length<120) {consume(event);query+=key;renderResults();}
    }
  },true);
  window.addEventListener('keydown',function(event){
    var code=event.keyCode||event.which;
    if(mode==='native' && nativeEnabled && code===10009 && !event.defaultPrevented && !editing(document.activeElement) && !fullscreen()) {consume(event);history.back();}
    var actions={415:'play',19:'pause',10252:'toggle',413:'stop',417:'forward',412:'rewind'};
    if(mode==='native' && !event.defaultPrevented && !editing(document.activeElement) && actions[code]) {
      var videos=Array.prototype.filter.call(document.querySelectorAll('video'),visible);
      videos.sort(function(a,b){if(a.paused!==b.paused)return a.paused?1:-1;var ar=a.getBoundingClientRect(),br=b.getBoundingClientRect();return br.width*br.height-ar.width*ar.height;});
      var v=videos[0],action=actions[code];if(!v)return;
      consume(event);
      try {
        if(action==='toggle')action=v.paused?'play':'pause';
        if(action==='play'){var promise=v.play();if(promise&&promise.catch)promise.catch(function(){message('Select Play in the website player.');});}
        else if(action==='pause')v.pause();
        else if(action==='stop'){v.pause();if(isFinite(v.duration))v.currentTime=0;}
        else {var lower=0,upper=isFinite(v.duration)?v.duration:Infinity;if(v.seekable&&v.seekable.length){lower=v.seekable.start(0);upper=v.seekable.end(v.seekable.length-1);}v.currentTime=Math.max(lower,Math.min(upper,v.currentTime+(action==='forward'?10:-10)));}
      }catch(e){message('Use the website player controls for this video.');}
    }
  },false);
  document.addEventListener('focusin',function(event){if(mode==='native'&&!own(event.target)){lastNativeFocus=event.target;paintRing();}});
  window.addEventListener('scroll',paintRing,true);window.addEventListener('resize',paintRing);
  function autoPage() { return !/^\/(?:movie|tvshow)\/\d+/.test(location.pathname) && !/(?:login|signin|oauth|register)/i.test(location.pathname); }
  function scan() {
    if (!window.MBPTVCatalog) return;
    var next=window.MBPTVCatalog.scan(document), changed=next.fingerprint!==catalog.fingerprint;
    catalog=next; if(changed)renderCatalog(); else featured=findItem(selectedId)||featured;
    if(initial && catalog.rows.length && !nativeRequested && autoPage() && !playing() && !fullscreen() && !editing(document.activeElement)) {initial=false;state('browse');setFocus(rows.querySelector('button'));}
    if(mode==='search'&&changed)renderResults();
  }
  function scheduleScan() {clearTimeout(scanTimer);scanTimer=setTimeout(scan,350);}
  if(window.MutationObserver) new MutationObserver(function(changes){for(var i=0;i<changes.length;i++)if(!own(changes[i].target)){scheduleScan();break;}}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['src','title','class']});
  window.addEventListener('pageshow',function(event){
    if(event.persisted && restoreOnReturn && autoPage()) {restoreOnReturn=false;showBrowse();}
    else scheduleScan();
  });document.addEventListener('load',function(e){if(!own(e.target))scheduleScan();},true);
  document.addEventListener('play',function(){if(mode!=='native')nativeMode();},true);
  try { if(window.tizen&&tizen.tvinputdevice) ['ColorF3Blue','Info'].forEach(function(key){try{tizen.tvinputdevice.registerKey(key);}catch(e){}}); } catch(e){}
  scan();setTimeout(scan,1500);setTimeout(scan,4500);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootMovieBoxTV); else bootMovieBoxTV();

}());
