const btn = document.getElementById('btn');
const cnt = document.getElementById('cnt');
let n = 0;
btn.addEventListener('click', () => { n++; cnt.textContent = n; });
