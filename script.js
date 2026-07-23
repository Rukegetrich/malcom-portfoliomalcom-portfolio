  document.documentElement.classList.add("js");

  /* =========================================================
     LIVE UK CLOCK
     Updates the hero status line with the current time in
     London and the correct seasonal offset (GMT/BST).
  ========================================================= */
  (function(){
    var timeEl = document.getElementById('clock-time');
    var tzEl   = document.getElementById('clock-tz');
    if(!timeEl) return;

    function update(){
      var now = new Date();
      timeEl.textContent = new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/London'
      }).format(now);

      if(tzEl){
        var parts = new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Europe/London', timeZoneName: 'shortOffset'
        }).formatToParts(now);
        var offset = parts.find(function(p){ return p.type === 'timeZoneName'; });
        tzEl.textContent = offset ? offset.value : 'GMT';
      }
    }

    update();
    setInterval(update, 30000);
  })();

  /* =========================================================
     AMBIENT INTELLIGENCE CURSOR SYSTEM
  ========================================================= */
  (function(){
    // Only activate on fine-pointer (mouse) devices
    var mq = window.matchMedia('(pointer: fine)');
    if(!mq.matches) return;

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(reduceMotion) return;

    var html    = document.documentElement;
    var dot     = document.getElementById('curDot');
    var ring    = document.getElementById('curRing');
    var glow    = document.getElementById('curGlow');
    var label   = document.getElementById('curLabel');
    if(!dot || !ring || !glow) return;

    html.classList.add('has-custom-cursor', 'cur-default');

    // --- Position tracking ---
    var mouseX = -300, mouseY = -300;   // start off-screen
    var ringX  = -300, ringY  = -300;
    var glowX  = -300, glowY  = -300;
    var dotX   = -300, dotY   = -300;
    var rafId;

    document.addEventListener('mousemove', function(e){
      mouseX = e.clientX;
      mouseY = e.clientY;
      html.classList.remove('cur-away');
    }, { passive: true });

    document.addEventListener('mouseleave', function(){
      html.classList.add('cur-away');
    }, { passive: true });

    document.addEventListener('mouseenter', function(){
      html.classList.remove('cur-away');
    }, { passive: true });

    // --- Spring lerp loop ---
    // Ring follows with lag (spring coefficient 0.10)
    // Glow follows even slower (0.06) for a dreamy float
    // Dot snaps immediately via CSS transform on rAF
    function lerp(a, b, t){ return a + (b - a) * t; }

    function tick(){
      // Dot: snap exactly (no JS lerp, just update transform directly each frame)
      if(dotX !== mouseX || dotY !== mouseY){
        dotX = mouseX; dotY = mouseY;
        dot.style.transform = 'translate(' + (dotX - 0.5) + 'px,' + (dotY - 0.5) + 'px) translate(-50%,-50%)';
      }

      // Ring: spring lag, tighter coefficient = snappier, less theatrical
      var rChanged = Math.abs(ringX - mouseX) > 0.05 || Math.abs(ringY - mouseY) > 0.05;
      if(rChanged){
        ringX = lerp(ringX, mouseX, 0.16);
        ringY = lerp(ringY, mouseY, 0.16);
        ring.style.transform = 'translate(' + ringX + 'px,' + ringY + 'px) translate(-50%,-50%)';
      }

      // Glow: slower drift, barely perceptible movement
      var gChanged = Math.abs(glowX - mouseX) > 0.05 || Math.abs(glowY - mouseY) > 0.05;
      if(gChanged){
        glowX = lerp(glowX, mouseX, 0.04);
        glowY = lerp(glowY, mouseY, 0.04);
        glow.style.transform = 'translate(' + glowX + 'px,' + glowY + 'px) translate(-50%,-50%)';
      }

      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);

    // --- Context detection ---
    // Priority: image > link/button > text heading > default
    var cursorState = 'default';
    var onDark = false;

    function setCursorState(state, dark){
      var changed = (state !== cursorState) || (dark !== onDark);
      if(!changed) return;

      cursorState = state;
      onDark = dark;

      // Remove all cur-* classes except has-custom-cursor and cur-away
      html.className = html.className
        .split(' ')
        .filter(function(c){ return c !== 'cur-default' && c !== 'cur-link' && c !== 'cur-image' && c !== 'cur-text' && c !== 'cur-on-dark'; })
        .join(' ');

      html.classList.add('cur-' + state);
      if(dark) html.classList.add('cur-on-dark');

      // No label text, keeping cursor invisible/atmospheric
      if(label){ label.textContent = ''; }
    }

    function isOnDarkSurface(el){
      return !!el.closest('[data-cursor-dark]');
    }

    document.addEventListener('mouseover', function(e){
      var el = e.target;
      var dark = isOnDarkSurface(el);

      if(el.closest('[data-cursor="image"]') || el.tagName === 'IMG'){
        setCursorState('image', dark);
      } else if(el.closest('a, button, .email-cta, .case-link, nav a, .footer-links a, .nav-overlay nav a')){
        setCursorState('link', dark);
      } else if(el.closest('[data-cursor="text"]')){
        setCursorState('text', dark);
      } else {
        setCursorState('default', dark);
      }
    }, { passive: true });

    // Also re-check dark state on scroll (cursor doesn't move but section can scroll under it)
    document.addEventListener('scroll', function(){
      var el = document.elementFromPoint(mouseX, mouseY);
      if(!el) return;
      var dark = isOnDarkSurface(el);
      if(dark !== onDark){
        setCursorState(cursorState, dark);
      }
    }, { passive: true });

  })();

  /* =========================================================
     HERO HEADLINE SCROLL COMPRESSION
     As you scroll away from the pinned hero, the headline
     letter-spacing contracts and opacity fades, it feels
     like the words are being left behind, receding into depth.
  ========================================================= */
  (function(){
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(reduceMotion) return;

    var heroH1 = document.querySelector('.hero-head');
    var pinWrap = document.querySelector('.hero-pin-wrap');
    if(!heroH1 || !pinWrap) return;

    var ticking = false;

    function updateHeroCompression(){
      var wrapH  = pinWrap.offsetHeight;
      var viewH  = window.innerHeight;
      var scrollable = wrapH - viewH;
      var progress = Math.max(0, Math.min(1, window.scrollY / scrollable));

      // Letter-spacing: -0.018em (open) → -0.04em (compressed)
      var ls = -0.018 + (progress * -0.022);
      // Opacity: 1 → 0.55
      var op = 1 - (progress * 0.45);

      heroH1.style.letterSpacing = ls + 'em';
      heroH1.style.opacity = op;
      ticking = false;
    }

    document.addEventListener('scroll', function(){
      if(!ticking){
        requestAnimationFrame(updateHeroCompression);
        ticking = true;
      }
    }, { passive: true });

    updateHeroCompression();
  })();

  // =========================================================
  // NAV SYSTEM, progress thread, section-aware color,
  //              active link, mobile overlay, side index
  // =========================================================
  (function(){
    var sections = [
      { id: 'hero',       label: 'Intro',      dark: true  },
      { id: 'work',       label: 'Work',       dark: false },
      { id: 'about',      label: 'About',      dark: true  },
      { id: 'experience', label: 'Experience', dark: false },
      { id: 'leadership', label: 'Leadership', dark: false },
      { id: 'skills',     label: 'Skills',     dark: false },
      { id: 'contact',    label: 'Contact',    dark: true  }
    ];

    var nodes = sections.map(function(s){
      return { meta: s, el: document.getElementById(s.id) };
    }).filter(function(n){ return n.el; });

    var progressBar = document.getElementById('navProgress');
    var navLinks    = document.querySelectorAll('#navLinks a');
    var siFill      = document.getElementById('siFill');
    var siLabel     = document.getElementById('siLabel');
    var body        = document.body;
    var ticking     = false;

    function update(){
      var docH = document.documentElement.scrollHeight - window.innerHeight;
      var prog = docH > 0 ? Math.max(0, Math.min(1, window.scrollY / docH)) : 0;

      // Progress thread
      if(progressBar) progressBar.style.width = (prog * 100) + '%';

      // Side index fill
      if(siFill) siFill.style.top = (prog * 82) + '%';

      // Which section are we in? (pages without these section ids,
      // e.g. case-study sub-pages, just keep the light-page default)
      var mid = window.scrollY + window.innerHeight * 0.42;
      var current = nodes.length ? nodes[0].meta : { label: '', dark: false };
      for(var i = 0; i < nodes.length; i++){
        var top = nodes[i].el.getBoundingClientRect().top + window.scrollY;
        if(top <= mid) current = nodes[i].meta;
      }

      // Body class for dark/light context (nav + cursor use this)
      body.classList.toggle('nav-on-dark',  current.dark);
      body.classList.toggle('nav-on-light', !current.dark);
      // Keep cursor system in sync
      body.classList.toggle('on-light', !current.dark);

      // Side index label
      if(siLabel) siLabel.textContent = current.label;

      // Active nav link
      navLinks.forEach(function(a){
        var href = a.getAttribute('href').replace('#','');
        a.classList.toggle('is-active', href === current.id);
      });

      ticking = false;
    }

    document.addEventListener('scroll', function(){
      if(!ticking){ requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
    update();

    // Mobile overlay
    var menuBtn  = document.getElementById('navMenuBtn');
    var overlay  = document.getElementById('navOverlay');
    var closeBtn = document.getElementById('navCloseBtn');
    var overlayLinks = document.querySelectorAll('.nav-overlay-link');

    function openMenu(){ if(overlay) overlay.classList.add('is-open'); }
    function closeMenu(){ if(overlay) overlay.classList.remove('is-open'); }

    if(menuBtn)  menuBtn.addEventListener('click', openMenu);
    if(closeBtn) closeBtn.addEventListener('click', closeMenu);
    overlayLinks.forEach(function(a){ a.addEventListener('click', closeMenu); });
  })();

  // Scroll reveal
  var revealEls = document.querySelectorAll('.reveal, .reveal-stagger');
  if('IntersectionObserver' in window){
    var observer = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(entry.isIntersecting){
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -60px 0px' });
    revealEls.forEach(function(el){ observer.observe(el); });
  } else {
    revealEls.forEach(function(el){ el.classList.add('is-visible'); });
  }

  // Subtle parallax on case images
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var parallaxEls = Array.prototype.slice.call(document.querySelectorAll('[data-parallax]'));
  if(!reduceMotion && parallaxEls.length){
    var ticking = false;
    function updateParallax(){
      var vh = window.innerHeight;
      parallaxEls.forEach(function(el){
        var rect = el.getBoundingClientRect();
        var center = rect.top + rect.height / 2;
        var offset = (center - vh / 2) / vh;
        var translate = Math.max(-18, Math.min(18, offset * -22));
        el.style.transform = 'translateY(' + translate + 'px) scale(1.06)';
      });
      ticking = false;
    }
    document.addEventListener('scroll', function(){
      if(!ticking){ window.requestAnimationFrame(updateParallax); ticking = true; }
    }, { passive: true });
    updateParallax();
  }



  // Respect reduced-motion: pause autoplay video
  (function(){
    var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    var video = document.querySelector('.stemscope-visual video');
    if (video && prefersReduced.matches) {
      video.removeAttribute('autoplay');
      video.pause();
    }
  })();


  // Failsafe: guarantee all content becomes visible even if observer misfires
  (function(){
    function revealAll(){
      document.querySelectorAll('.reveal:not(.is-visible), .reveal-stagger:not(.is-visible)').forEach(function(el){
        el.classList.add('is-visible');
      });
    }
    // Hard failsafe after 2.5s — nothing stays hidden
    setTimeout(revealAll, 2500);
    // Also reveal on load for anything above the fold
    window.addEventListener('load', function(){
      document.querySelectorAll('.reveal, .reveal-stagger').forEach(function(el){
        var rect = el.getBoundingClientRect();
        if(rect.top < window.innerHeight + 200){ el.classList.add('is-visible'); }
      });
    });
  })();

