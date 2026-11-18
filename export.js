// My Library Books: the Export button. Runs after app.js and uses its load().

document.getElementById('export').addEventListener('click', () => {
  const msg = document.getElementById('export-msg');
  const ics = buildIcs(load(), new Date());
  if (ics === null) {
    msg.textContent = 'Nothing to export';
    return;
  }
  msg.textContent = '';
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'books.ics';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});
