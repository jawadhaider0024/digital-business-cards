(function () {
  // Copy-to-clipboard buttons
  document.querySelectorAll('.copy').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var text = btn.getAttribute('data-copy');
      var done = function () {
        var old = btn.textContent;
        btn.textContent = 'Copied!';
        btn.classList.add('ok');
        setTimeout(function () { btn.textContent = old; btn.classList.remove('ok'); }, 1500);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () { prompt('Copy this link:', text); });
      } else {
        prompt('Copy this link:', text);
      }
    });
  });

  // Confirm before deleting
  document.querySelectorAll('form.js-delete').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      var name = form.getAttribute('data-name') || 'this card';
      if (!confirm('Delete the e-card for ' + name + '? This cannot be undone.')) {
        e.preventDefault();
      }
    });
  });
})();
