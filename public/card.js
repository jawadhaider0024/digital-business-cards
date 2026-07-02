(function () {
  var flip = document.getElementById('flip');
  if (flip) {
    var toggle = function () { flip.classList.toggle('flipped'); };
    flip.addEventListener('click', toggle);
    flip.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });
  }

  // Copy a string to the clipboard, flashing "Copied!" on the button's label.
  function copyText(val, lbl) {
    var orig = lbl ? lbl.textContent : '';
    function done() {
      if (!lbl) return;
      lbl.textContent = 'Copied!';
      setTimeout(function () { lbl.textContent = orig; }, 1500);
    }
    function fallback() {
      var t = document.createElement('textarea');
      t.value = val; t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.focus(); t.select();
      try { document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(t); done();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(val).then(done).catch(fallback);
    } else {
      fallback();
    }
  }

  // Copy-to-clipboard buttons (e.g. WeChat ID — no reliable "add by ID" link exists).
  document.querySelectorAll('[data-copy]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      copyText(btn.getAttribute('data-copy'), btn.querySelector('.lbl'));
    });
  });

  // Share button: native share sheet on mobile, copy-the-link fallback elsewhere.
  document.querySelectorAll('[data-share-url]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var url = btn.getAttribute('data-share-url');
      var title = btn.getAttribute('data-share-title') || document.title;
      if (navigator.share) {
        navigator.share({ title: title, text: title, url: url }).catch(function () {});
      } else {
        copyText(url, btn.querySelector('.lbl'));
      }
    });
  });
})();
