/* Viva questions (js/viva.js): tick one answer per question, Submit shows the score out of 5,
 * marks each answer right or wrong and shows why. "Try again" clears everything. */
(function () {
  'use strict';
  document.querySelectorAll('form.viva').forEach((form) => {
    const qs = [...form.querySelectorAll('.viva-q')];
    const score = form.querySelector('.viva-score');
    const again = form.querySelector('.viva-again');
    const submit = form.querySelector('.viva-submit');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const unanswered = qs.filter((q) => !q.querySelector('input:checked'));
      if (unanswered.length) {
        score.hidden = false;
        score.className = 'viva-score viva-warn';
        score.textContent = `Please answer all ${qs.length} questions (${unanswered.length} left).`;
        unanswered[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      let right = 0;
      qs.forEach((q) => {
        const ans = q.dataset.answer;
        const picked = q.querySelector('input:checked');
        const ok = picked.value === ans;
        if (ok) right += 1;
        q.classList.add(ok ? 'is-right' : 'is-wrong');
        q.querySelectorAll('label').forEach((l) => {
          const inp = l.querySelector('input');
          inp.disabled = true;
          if (inp.value === ans) l.classList.add('viva-correct');
          else if (inp.checked) l.classList.add('viva-picked-wrong');
        });
        q.querySelector('.viva-why').hidden = false;
      });
      score.hidden = false;
      score.className = 'viva-score';
      score.innerHTML = `You scored <b>${right} / ${qs.length}</b>` +
        (right === qs.length ? ' – excellent!' : right >= qs.length - 2 ? ' – good, check the explanations.' : ' – read the page again and try once more.');
      submit.hidden = true; again.hidden = false;
      score.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    again.addEventListener('click', () => {
      form.reset();
      qs.forEach((q) => {
        q.classList.remove('is-right', 'is-wrong');
        q.querySelector('.viva-why').hidden = true;
        q.querySelectorAll('label').forEach((l) => { l.classList.remove('viva-correct', 'viva-picked-wrong'); l.querySelector('input').disabled = false; });
      });
      score.hidden = true; submit.hidden = false; again.hidden = true;
      qs[0].scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
})();
