'use strict';
/* Aurelia: online flight reservation. Front-end demo, data kept in localStorage. */
const KEY = 'aurelia_v1';
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = p => p + Math.random().toString(36).slice(2, 8).toUpperCase();
const hs = s => { let h = 5381; for (const c of s) h = ((h << 5) + h + c.charCodeAt(0)) | 0; return 'h' + (h >>> 0).toString(36); }; // demo hash only
const inr = n => '₹' + Number(n).toLocaleString('en-IN');
const iso = d => d.toISOString().slice(0, 10);
const today = () => iso(new Date());
const plus = n => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
const fmtD = d => new Date(d + 'T00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const fmtDT = s => new Date(s).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const tm = m => { m = ((m % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
const mins = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const dur = m => Math.floor(m / 60) + 'h ' + (m % 60) + 'm';
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const CL = ['First', 'Business', 'Economy'];
const LAY = { First: 'AD', Business: 'ACDF', Economy: 'ABCDEF' };

/* ---------- seat layout (depends only on the flight) ---------- */
function seatLayout(f) {
  let row = 1; const out = {};
  CL.forEach(c => {
    const k = f.classes[c]; if (!k || !k.seats) return;
    const cols = LAY[c], rows = Math.ceil(k.seats / cols.length), seats = [];
    for (let r = 0; r < rows; r++) for (const L of cols) if (seats.length < k.seats) seats.push((row + r) + L);
    out[c] = { cols, start: row, rows, seats }; row += rows;
  });
  return out;
}

/* ---------- seed ---------- */
function seed() {
  const airlines = [{ code: 'SK', name: 'Skyline Air', color: '#0a6cff', synced: new Date().toISOString() }, { code: 'MW', name: 'Monsoon Airways', color: '#0b8f6b', synced: new Date().toISOString() }, { code: 'BB', name: 'Bluebird', color: '#7b3fe4', synced: new Date().toISOString() }, { code: 'LJ', name: 'Lotus Jet', color: '#d6336c', synced: new Date().toISOString() }];
  const airports = [['MAA', 'Chennai', 'Chennai International'], ['DEL', 'Delhi', 'Indira Gandhi International'], ['BOM', 'Mumbai', 'Chhatrapati Shivaji International'], ['BLR', 'Bengaluru', 'Kempegowda International'], ['HYD', 'Hyderabad', 'Rajiv Gandhi International'], ['CCU', 'Kolkata', 'Netaji Subhas Chandra Bose International'], ['COK', 'Kochi', 'Cochin International'], ['GOI', 'Goa', 'Manohar International'], ['DXB', 'Dubai', 'Dubai International'], ['SIN', 'Singapore', 'Changi']].map(a => ({ c: a[0], city: a[1], name: a[2] }));
  const routes = [['MAA', 'DEL', 170, 5200], ['MAA', 'BOM', 125, 3800], ['MAA', 'BLR', 60, 2100], ['MAA', 'HYD', 80, 2600], ['MAA', 'COK', 70, 2400], ['BLR', 'DEL', 165, 5000], ['BOM', 'DEL', 130, 4100], ['DEL', 'CCU', 130, 3900], ['MAA', 'DXB', 270, 14500], ['MAA', 'SIN', 270, 12500], ['BLR', 'GOI', 65, 2300], ['HYD', 'BOM', 90, 2900]];
  const times = ['06:15', '08:50', '11:30', '14:05', '17:40', '20:25'], flights = []; let n = 0;
  routes.forEach((r, ri) => [[r[0], r[1]], [r[1], r[0]]].forEach(([a, b], di) => [0, 1].forEach(k => {
    n++; const al = airlines[(ri + di + k * 2) % 4], base = Math.round(r[3] * (.92 + ((ri + k + di) % 5) * .04) / 10) * 10;
    const classes = { Economy: { seats: 120, fare: base }, Business: { seats: 24, fare: Math.round(base * 2.6 / 10) * 10 } };
    if (r[2] >= 150) classes.First = { seats: 8, fare: Math.round(base * 4.2 / 10) * 10 };
    flights.push({ id: 'F' + (100 + n), no: al.code + (200 + n), al: al.code, from: a, to: b, dep: times[(ri * 2 + di * 3 + k * 3) % 6], dur: r[2], days: [0, 1, 2, 3, 4, 5, 6], ac: r[2] >= 250 ? 'B787' : r[2] >= 150 ? 'A321' : ['A320', 'B737', 'ATR72'][n % 3], bag: r[2] >= 250 ? '30 kg' : '15 kg', status: 'Scheduled', delay: 0, active: true, classes });
  })));
  const mkPax = (c, k, f) => seatLayout(f)[c].seats.slice(0, k).map((s, i) => ({ title: 'Mr', first: 'Guest' + (i + 1), last: 'Agent', age: 35, idno: '', seat: s }));
  const snap = (f, d, c, pax, u, em, ph, pay, ageFee) => { const fare = f.classes[c].fare * pax.length, tax = Math.round(fare * .12), fee = ageFee; return { pnr: uid('').slice(0, 6), userId: u, fid: f.id, no: f.no, al: f.al, from: f.from, to: f.to, dep: f.dep, dur: f.dur, date: d, cls: c, pax, contact: { email: em, phone: ph }, fare, tax, fee, amount: fare + tax + fee, mode: pay, payStatus: 'Paid', payId: uid('PAY'), status: 'Confirmed', created: new Date(Date.now() - 36e5).toISOString(), refund: null }; };
  const fA = flights.find(f => f.from === 'MAA' && f.to === 'DEL'), fB = flights.find(f => f.from === 'MAA' && f.to === 'BLR');
  const bk = [
    snap(fB, plus(3), 'Economy', [{ title: 'Mr', first: 'Demo', last: 'Traveller', age: 28, idno: '', seat: seatLayout(fB).Economy.seats[30] }, { title: 'Ms', first: 'Guest', last: 'Traveller', age: 26, idno: '', seat: seatLayout(fB).Economy.seats[31] }], 'U2', 'rider@aurelia.in', '9876543210', 'Card ****4242', 150),
    snap(fA, plus(1), 'Business', mkPax('Business', 22, fA), 'U3', 'agent@aurelia.in', '9000000000', 'UPI agent@okbank', 0)
  ];
  bk[0].pnr = 'K7Q2ZD'; bk[1].pnr = 'AGT001';
  return {
    users: [
      { id: 'U1', name: 'Admin', email: 'admin@aurelia.in', phone: '', pass: hs('admin123'), role: 'admin', blocked: false, created: today() },
      { id: 'U2', name: 'Demo Traveller', email: 'rider@aurelia.in', phone: '9876543210', pass: hs('rider123'), role: 'user', blocked: false, created: today() },
      { id: 'U3', name: 'Agent Desk', email: 'agent@aurelia.in', phone: '9000000000', pass: hs('agent123'), role: 'agent', blocked: false, created: today() }
    ],
    airlines, airports, flights, blocks: [], bookings: bk,
    payments: bk.map(b => ({ id: b.payId, pnr: b.pnr, userId: b.userId, method: b.mode, amount: b.amount, status: 'Paid', time: b.created })),
    rules: [{ hrs: 72, pct: 90 }, { hrs: 24, pct: 75 }, { hrs: 4, pct: 50 }, { hrs: 0, pct: 25 }],
    feedback: [{ id: 'FB1', userId: 'U2', name: 'Demo Traveller', pnr: 'K7Q2ZD', rating: 5, cat: 'Booking experience', text: 'Seat selection was smooth and the e-ticket arrived instantly.', date: today(), reply: '' }],
    gds: { last: new Date().toISOString() }, session: null, outbox: [], reset: null
  };
}
let db; try { db = JSON.parse(localStorage.getItem(KEY)); } catch (e) { }
if (!db || !db.flights) db = seed();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { } };
save();

/* ---------- lookups and business rules ---------- */
const me = () => db.users.find(u => u.id === db.session);
const flt = id => db.flights.find(f => f.id === id);
const alOf = c => db.airlines.find(a => a.code === c) || { code: c, name: c, color: '#555' };
const apOf = c => db.airports.find(a => a.c === c) || { c, city: c, name: c };
const apLabel = c => `${apOf(c).city} (${c})`;
const depTs = (f, d) => new Date(d + 'T' + f.dep).getTime();
const arrInfo = f => { const t = mins(f.dep) + f.dur; return { t: tm(t), dd: Math.floor(t / 1440) }; };
const fst = f => f.status === 'Delayed' ? `Delayed ${f.delay}m` : f.status === 'Cancelled' ? 'Cancelled' : 'On time';
const fstCls = f => f.status === 'Scheduled' ? 'OnTime' : f.status;
function inv(f, d, c) {
  const lay = seatLayout(f)[c] || { seats: [], cols: LAY[c], start: 1, rows: 0 };
  const booked = new Set(db.bookings.filter(b => b.fid === f.id && b.date === d && b.cls === c && b.status === 'Confirmed').flatMap(b => b.pax.map(p => p.seat)));
  const blocked = new Set(db.blocks.filter(x => x.fid === f.id && x.date === d && x.cls === c).flatMap(x => x.seats));
  return { lay, booked, blocked, free: lay.seats.filter(s => !booked.has(s) && !blocked.has(s)), total: lay.seats.length };
}
function price(f, d, c) { // real-time fare: rises as the date nears and as seats sell
  const k = f.classes[c], a = inv(f, d, c), load = 1 - a.free.length / Math.max(1, a.total), days = Math.round((new Date(d + 'T00:00') - new Date(today() + 'T00:00')) / 864e5);
  let m = 1; if (days <= 2) m += .25; else if (days <= 7) m += .1; if (load >= .7) m += .15; else if (load >= .4) m += .05;
  return Math.round(k.fare * m / 10) * 10;
}
function refundCalc(b) {
  const f = flt(b.fid), hrs = (new Date(b.date + 'T' + b.dep).getTime() - Date.now()) / 36e5;
  if (f && f.status === 'Cancelled') return { pct: 100, amt: b.amount, hrs, rule: 'Flight cancelled by the airline: full refund including fees.' };
  if (hrs < 0) return { pct: 0, amt: 0, hrs, rule: 'Flight has already departed.' };
  const rs = [...db.rules].sort((x, y) => y.hrs - x.hrs), i = rs.findIndex(r => hrs >= r.hrs), pct = i < 0 ? 0 : rs[i].pct;
  return { pct, amt: Math.round((b.fare + b.tax) * pct / 100), hrs, idx: i, rs, rule: `Cancelled ${Math.floor(hrs)} hours before departure. Convenience fee is non-refundable.` };
}
const newPnr = () => { const ch = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let p; do { p = Array.from({ length: 6 }, () => ch[Math.floor(Math.random() * ch.length)]).join(''); } while (db.bookings.some(b => b.pnr === p)); return p; };
const pname = p => `${p.title} ${p.first} ${p.last}`;
const resolve = x => { x = (x || '').trim().toLowerCase(); if (!x) return ''; const m = x.match(/\(([a-z]{3})\)\s*$/), code = m ? m[1] : x; return (db.airports.find(a => a.c.toLowerCase() === code) || db.airports.find(a => a.city.toLowerCase().includes(x) || a.name.toLowerCase().includes(x)) || {}).c || null; };

/* ---------- ui helpers ---------- */
const app = h => { $('#app').innerHTML = h; };
function toast(m, t = 'ok') { const e = document.createElement('div'); e.className = 'toast ' + t; e.textContent = m; $('#toasts').append(e); setTimeout(() => e.remove(), 3400); }
function modal(h, wide) { $('#modal').innerHTML = `<div class="mbox ${wide ? 'wide' : ''}" role="dialog"><button class="x" onclick="closeModal()" aria-label="Close">×</button>${h}</div>`; $('#modal').classList.add('on'); }
function closeModal() { $('#modal').classList.remove('on'); }
function mail(to, subject, body, ref) { const m = { id: uid('M'), to, subject, body, ref, time: new Date().toISOString() }; db.outbox.push(m); save(); return m; }
function showMail(m) { modal(`<h3>Email sent to ${esc(m.to)}</h3><p class="muted">Demo mode: nothing leaves your browser. Replace <code>mail()</code> with EmailJS, SMTP or your backend.</p><div class="mail"><b>${esc(m.subject)}</b><pre>${esc(m.body)}</pre></div>`, true); }
function nav() {
  const u = me();
  $('#nav').innerHTML = `<a href="#/home">Flights</a><a href="#/status">Booking status</a><a href="#/cancel">Cancel ticket</a><a href="#/feedback">Feedback</a>${u ? '<a href="#/dashboard">My trips</a>' : ''}${u?.role === 'admin' ? '<a href="#/admin">Admin</a>' : ''}` +
    (u ? `<button class="btn ghost sm" onclick="A.logout()">Log out (${esc(u.name.split(' ')[0])})</button>` : '<a href="#/login">Log in</a><a class="btn sm" href="#/register">Register</a>');
  document.body.classList.remove('menu');
}
const nf = () => app('<div class="wrap page"><div class="empty">Page not found. <a href="#/home">Back to flights</a></div></div>');
function guard(role) { const u = me(); if (!u) { sessionStorage.setItem('next', location.hash); location.hash = '#/login'; return false; } if (role && u.role !== role) { nf(); return false; } return true; }
const badge = (t, c) => `<span class="badge ${(c || t).replace(/\s/g, '')}">${esc(t)}</span>`;
const logo = c => `<span class="logo" style="background:${alOf(c).color}">${esc(c)}</span>`;
function barcode(s) { let x = 0, o = ''; for (const c of s + s + s) { const w = (c.charCodeAt(0) % 3) + 1; o += `<rect x="${x}" y="0" width="${w}" height="54"/>`; x += w + ((c.charCodeAt(0) % 2) + 1); } return `<svg class="bars" viewBox="0 0 ${x} 54" preserveAspectRatio="none" fill="#0b2530" aria-hidden="true">${o}</svg>`; }
const starsTxt = n => '★'.repeat(n) + '☆'.repeat(5 - n);

/* ---------- state / router ---------- */
let S = { from: '', to: '', date: plus(2), cls: 'Economy', pax: 1, sort: 'dep', al: '' };
let F = null, CUR = '', TAB = { d: 'trips', a: 'reports' }, REP = { from: '', to: '' }, AD = { fid: '', date: plus(1), q: '' }, ST = { pnr: '', last: '' }, FB = { rating: 5 };
const R = { home, book, pay, ticket, print: printPage, status, cancel, feedback, login, register, forgot, 'admin-login': adminLogin, dashboard, admin };
function route() {
  const [p, a, b] = location.hash.replace(/^#\//, '').split('/'); CUR = p || 'home';
  closeModal(); nav(); (R[CUR] || nf)(a, b); window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);
function live() { // real-time seat availability and fares
  const l = $('#lv'), t = new Date().toLocaleTimeString('en-IN');
  if (CUR === 'home' && $('#res')) $('#res').innerHTML = results();
  else if (CUR === 'book' && F && F.step === 2 && $('#cabin')) { $('#cabin').innerHTML = cabinHTML(); }
  else if (CUR === 'status' && ST.pnr && $('#stres')) $('#stres').innerHTML = statusBody();
  const l2 = $('#lv'); if (l2) l2.textContent = 'Live · ' + t;
}
setInterval(live, 5000);
window.addEventListener('storage', e => { if (e.key === KEY && e.newValue) { db = JSON.parse(e.newValue); live(); } });

/* ---------- search flights ---------- */
function find() {
  const a = resolve(S.from), b = resolve(S.to);
  if (a === null || b === null) return { err: 'Airport not found. Pick one from the suggestions.' };
  if (!a || !b) return { hint: true };
  if (a === b) return { err: 'Origin and destination are the same.' };
  const wd = new Date(S.date + 'T00:00').getDay();
  let all = db.flights.filter(f => f.active && f.from === a && f.to === b && f.days.includes(wd) && f.classes[S.cls]?.seats && depTs(f, S.date) > Date.now() + 36e5);
  const airlines = [...new Set(all.map(f => f.al))];
  if (S.al) all = all.filter(f => f.al === S.al);
  const key = { dep: f => mins(f.dep), price: f => price(f, S.date, S.cls), dur: f => f.dur }[S.sort];
  return { list: all.sort((x, y) => key(x) - key(y)), airlines };
}
function flCard(f) {
  const a = inv(f, S.date, S.cls), p = price(f, S.date, S.cls), ar = arrInfo(f), can = f.status !== 'Cancelled' && a.free.length >= S.pax;
  const left = a.free.length === 0 ? '<span class="pill bad">Sold out</span>' : a.free.length < S.pax ? `<span class="pill bad">Only ${a.free.length} left</span>` : a.free.length <= 9 ? `<span class="pill warn">${a.free.length} seats left</span>` : `<span class="pill ok">${a.free.length} seats</span>`;
  return `<article class="strip"><div class="st-t"><b>${f.dep}</b><span>${f.from}</span></div><div class="st-p"><i></i><em>${dur(f.dur)}</em><i></i></div><div class="st-t r"><b>${ar.t}${ar.dd ? `<sup>+${ar.dd}</sup>` : ''}</b><span>${f.to}</span></div>
  <div class="st-i">${logo(f.al)}<div><b>${esc(alOf(f.al).name)}</b><small>${f.no} · ${f.ac} · ${f.bag} bag</small><div class="meta">${badge(fst(f), fstCls(f))}${left}</div></div></div>
  <div class="st-b"><b>${inr(p)}</b><small>per guest</small><button class="btn" ${can ? '' : 'disabled'} onclick="A.pick('${f.id}')">Reserve</button></div></article>`;
}
function results() {
  const r = find();
  if (r.err) return `<div class="empty">${r.err}</div>`;
  if (r.hint) return `<div class="panel"><h3>Popular routes</h3><div class="chips" style="margin-top:12px">${[['MAA', 'DEL'], ['MAA', 'BOM'], ['BLR', 'DEL'], ['MAA', 'DXB'], ['MAA', 'SIN'], ['HYD', 'BOM']].map(x => `<button class="chip" onclick="A.quick('${x[0]}','${x[1]}')">${apOf(x[0]).city} → ${apOf(x[1]).city}</button>`).join('')}</div><p class="muted" style="margin-top:12px">Enter an origin, destination and date above, or pick a route.</p></div>`;
  return `<div class="sec-h"><h2>${r.list.length} flight${r.list.length === 1 ? '' : 's'} · ${esc(apOf(resolve(S.from)).city)} to ${esc(apOf(resolve(S.to)).city)}</h2><span class="live" id="lv">Live · ${new Date().toLocaleTimeString('en-IN')}</span></div>
  <div class="toolbar" style="margin-bottom:14px"><label style="flex-direction:row;align-items:center">Sort <select onchange="A.sort(this.value)"><option value="dep" ${S.sort === 'dep' ? 'selected' : ''}>Departure</option><option value="price" ${S.sort === 'price' ? 'selected' : ''}>Price</option><option value="dur" ${S.sort === 'dur' ? 'selected' : ''}>Duration</option></select></label>
  <div class="chips"><button class="chip ${S.al ? '' : 'on'}" onclick="A.al('')">All airlines</button>${r.airlines.map(c => `<button class="chip ${S.al === c ? 'on' : ''}" onclick="A.al('${c}')">${esc(alOf(c).name)}</button>`).join('')}</div></div>` +
    (r.list.length ? r.list.map(flCard).join('') : '<div class="empty">No flights match. Try another date or class.</div>');
}
function home() {
  const city = [['DEL', 300, 70], ['BOM', 150, 195], ['CCU', 470, 120], ['HYD', 270, 220], ['BLR', 240, 285], ['MAA', 335, 280], ['DXB', 50, 110], ['SIN', 545, 335]];
  app(`<section class="hero"><div class="wrap hero-in"><div><h1>Where to <em>next?</em></h1><p>Live fares from every airline, real seat maps, and an e-ticket in your inbox before you close the tab.</p></div>
  <svg class="map" viewBox="0 0 600 360" aria-hidden="true"><path id="r1" d="M335 280 Q340 160 300 70" /><path id="r2" d="M335 280 Q170 330 50 110" /><path id="r3" d="M240 285 Q400 380 545 335" /><path d="M150 195 Q220 100 300 70" /><path d="M300 70 Q420 50 470 120" />
  ${city.map(c => `<circle cx="${c[1]}" cy="${c[2]}" r="4.5" class="cd"/><text x="${c[1] + 9}" y="${c[2] + 4}">${c[0]}</text>`).join('')}
  <circle r="5" class="plane"><animateMotion dur="7s" repeatCount="indefinite"><mpath href="#r1"/></animateMotion></circle><circle r="5" class="plane"><animateMotion dur="9s" begin="2s" repeatCount="indefinite"><mpath href="#r2"/></animateMotion></circle><circle r="5" class="plane"><animateMotion dur="8s" begin="4s" repeatCount="indefinite"><mpath href="#r3"/></animateMotion></circle></svg></div></section>
  <section class="wrap pull"><form class="search" onsubmit="A.search(event)">
  <label class="f"><span>From</span><input name="from" list="apl" value="${esc(S.from)}" placeholder="Chennai (MAA)" autocomplete="off" required></label>
  <button type="button" class="swap" onclick="A.swap()" aria-label="Swap airports">⇄</button>
  <label class="f"><span>To</span><input name="to" list="apl" value="${esc(S.to)}" placeholder="Delhi (DEL)" autocomplete="off" required></label>
  <label class="f"><span>Depart</span><input type="date" name="date" min="${today()}" value="${S.date}" required></label>
  <label class="f"><span>Cabin</span><select name="cls">${CL.slice().reverse().map(c => `<option ${S.cls === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
  <label class="f"><span>Guests</span><select name="pax">${[1, 2, 3, 4, 5, 6].map(n => `<option ${S.pax === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
  <button class="btn lg go">Search flights</button>
  <datalist id="apl">${db.airports.map(a => `<option value="${esc(a.city)} (${a.c})">`).join('')}</datalist></form></section>
  <section class="wrap cols"><div id="res">${results()}</div><aside><div class="panel"><h3>Already booked?</h3><p class="muted" style="margin:6px 0 14px">Look up your trip with a PNR and last name.</p><a class="btn dark" href="#/status">View booking status</a></div>
  <div class="panel"><h3>Change of plans</h3><table>${[...db.rules].sort((a, b) => b.hrs - a.hrs).map(r => `<tr><td>${r.hrs ? r.hrs + '+ hours out' : 'Under ' + Math.min(...db.rules.map(x => x.hrs).filter(h => h > 0)) + ' hours'}</td><td><b>${r.pct}%</b></td></tr>`).join('')}</table><p class="muted" style="margin-top:10px">Share of fare and taxes returned. Convenience fee is non-refundable. If an airline cancels, you get everything back.</p></div></aside></section>`);
}

/* ---------- seat map ---------- */
function cabinHTML(admin) {
  const f = flt(admin ? AD.fid : F.fid), d = admin ? AD.date : F.date, cls = admin ? null : F.cls;
  const draw = c => {
    const a = inv(f, d, c), L = a.lay, gap = Math.floor(L.cols.length / 2) - 1;
    let rows = '';
    for (let r = 0; r < L.rows; r++) {
      const row = L.start + r;
      rows += `<div class="srw"><span class="rn">${row}</span>${[...L.cols].map((col, i) => {
        const id = row + col; if (!L.seats.includes(id)) return '<button class="sbtn ph" tabindex="-1" disabled></button>' + (i === gap ? '<span class="gap"></span>' : '');
        const tk = a.booked.has(id), bl = a.blocked.has(id), sel = !admin && F.seats.includes(id);
        const click = admin ? (tk ? '' : `onclick="A.blk('${c}','${id}')"`) : (tk || bl ? '' : `onclick="A.seat('${id}')"`);
        return `<button class="sbtn ${tk ? 'tk' : bl ? 'blk' : sel ? 'sel' : ''}" ${tk || (bl && !admin) ? 'disabled' : ''} ${click} title="${id}">${col}</button>` + (i === gap ? '<span class="gap"></span>' : '');
      }).join('')}<span class="rn">${row}</span></div>`;
    }
    return `<div class="cabin"><h4>${c} · ${a.free.length} of ${a.total} free</h4>${rows}</div>`;
  };
  return (admin ? CL.filter(c => f.classes[c]?.seats) : [cls]).map(draw).join('');
}
const legend = a => `<div class="legend"><span><i style="background:#dff4f6"></i>Free</span>${a ? '' : '<span><i style="background:var(--teal)"></i>Yours</span>'}<span><i style="background:#d6dde0"></i>Booked</span><span><i style="background:#f3d4cf"></i>Blocked</span></div>`;

/* ---------- book ticket ---------- */
function sumHTML() {
  const f = flt(F.fid), ar = arrInfo(f), n = F.pax.length, unit = F.unit || price(f, F.date, F.cls), fare = unit * n, tax = Math.round(fare * .12), fee = me()?.role === 'agent' ? 0 : 150;
  F.calc = { unit, fare, tax, fee, total: fare + tax + fee };
  return `<div class="panel sum"><div class="al">${logo(f.al)}<div><b>${esc(alOf(f.al).name)}</b><small>${f.no} · ${F.cls}</small></div></div>
  <div class="route" style="margin-top:14px"><div><b>${f.dep}</b><small>${f.from}</small></div><div class="line"><span>${dur(f.dur)}</span></div><div class="r"><b>${ar.t}${ar.dd ? `<sup>+${ar.dd}</sup>` : ''}</b><small>${f.to}</small></div></div><p class="muted">${fmtD(F.date)}</p>
  <dl><dt>Fare × ${n}</dt><dd>${inr(fare)}</dd><dt>Taxes (12%)</dt><dd>${inr(tax)}</dd><dt>Convenience fee</dt><dd>${fee ? inr(fee) : 'Waived'}</dd><dt class="tot">Total</dt><dd class="tot">${inr(F.calc.total)}</dd></dl>${F.seats?.length ? `<p class="muted" style="margin-top:10px">Seats: <b>${F.seats.join(', ')}</b></p>` : ''}</div>`;
}
function book(fid, cls) {
  const f = flt(fid); if (!f || !f.classes[cls]?.seats) return nf();
  if (!guard()) return;
  if (!F || F.fid !== fid || F.cls !== cls) { A.pick(fid, true); F.cls = cls; }
  if (F.step > 2) F.step = 2;
  bookView();
}
function paxHTML() {
  return F.pax.map((p, i) => `<div class="pax"><h4>Passenger ${i + 1}</h4><div class="row4"><label>Title<select onchange="A.ps(${i},'title',this.value)">${['Mr', 'Ms', 'Mrs', 'Mstr', 'Miss'].map(t => `<option ${p.title === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label><label>First name<input value="${esc(p.first)}" oninput="A.ps(${i},'first',this.value)" maxlength="30"></label><label>Last name<input value="${esc(p.last)}" oninput="A.ps(${i},'last',this.value)" maxlength="30"></label><label>Age<input type="number" min="1" max="120" value="${p.age}" oninput="A.ps(${i},'age',this.value)"></label></div>
  <label style="margin-top:12px">Passport / ID number (optional for domestic)<input value="${esc(p.idno)}" oninput="A.ps(${i},'idno',this.value)" maxlength="20"></label></div>`).join('');
}
function bookView() {
  const f = flt(F.fid), st = ['Passengers', 'Seats', 'Payment'];
  const body = F.step === 1 ? `<h3>Passenger details</h3><div style="margin-top:14px">${paxHTML()}<div class="pax"><h4>Contact for e-ticket</h4><div class="row2"><label>Email<input type="email" value="${esc(F.contact.email)}" oninput="F.contact.email=this.value"></label><label>Phone<input value="${esc(F.contact.phone)}" oninput="F.contact.phone=this.value" inputmode="tel"></label></div></div><button class="btn lg" onclick="A.next1()">Continue to seats</button></div>`
    : `<h3>Choose your seats</h3><p class="muted">Pick ${F.pax.length} seat${F.pax.length > 1 ? 's' : ''}. Availability updates live.</p><div class="picks" id="picks">${picksHTML()}</div><div id="cabin">${cabinHTML()}</div>${legend()}<div class="acts" style="margin-top:18px"><button class="btn ghost dark" onclick="A.step(1)">Back</button><button class="btn ghost dark" onclick="A.auto()">Auto-assign seats</button><button class="btn lg" id="topay" onclick="A.toPay()">Continue to payment</button></div>`;
  app(`<div class="wrap page"><a class="crumb" href="#/home">← Back to flights</a><div class="stepper">${st.map((s, i) => `<span class="${F.step === i + 1 ? 'on' : F.step > i + 1 ? 'done' : ''}">${i + 1}. ${s}</span>`).join('')}</div><div class="bk"><div class="panel">${body}</div><aside id="sumbox">${sumHTML()}</aside></div></div>`);
}
const picksHTML = () => F.pax.map((p, i) => `<span class="tag">${esc(p.first || 'Passenger ' + (i + 1))}: <b>${F.seats[i] || 'no seat'}</b></span>`).join('');

/* ---------- ticket payment ---------- */
function pay() {
  if (!guard()) return; if (!F || F.step < 3) { location.hash = '#/home'; return; }
  const m = F.mode, sb = sumHTML();
  app(`<div class="wrap page"><div class="stepper"><span class="done">1. Passengers</span><span class="done">2. Seats</span><span class="on">3. Payment</span></div><div class="bk"><div class="panel"><h3>Ticket payment</h3><p class="muted" style="margin:4px 0 16px">Sandbox gateway. Test card 4242 4242 4242 4242, any future expiry, any CVV.</p>
  <form onsubmit="A.pay(event)"><div class="pm">
  <label><input type="radio" name="m" value="card" ${m === 'card' ? 'checked' : ''} onchange="A.pm()"><span><b>Credit / debit card</b>Visa, Mastercard, RuPay</span></label>
  <label><input type="radio" name="m" value="upi" ${m === 'upi' ? 'checked' : ''} onchange="A.pm()"><span><b>UPI</b>Pay with any UPI app</span></label>
  <label><input type="radio" name="m" value="net" ${m === 'net' ? 'checked' : ''} onchange="A.pm()"><span><b>Net banking</b>Choose your bank</span></label></div>
  <div id="pcard" class="stack"><label>Card number<input name="num" inputmode="numeric" maxlength="19" placeholder="4242 4242 4242 4242" oninput="this.value=this.value.replace(/\\D/g,'').slice(0,16).replace(/(.{4})/g,'$1 ').trim()"></label><label>Name on card<input name="holder"></label><div class="row2"><label>Expiry (MM/YY)<input name="exp" maxlength="5" placeholder="12/29" oninput="this.value=this.value.replace(/[^\\d]/g,'').replace(/^(\\d{2})(\\d)/,'$1/$2').slice(0,5)"></label><label>CVV<input name="cvv" type="password" inputmode="numeric" maxlength="4"></label></div></div>
  <div id="pupi" class="stack" hidden><label>UPI ID<input name="upi" placeholder="name@bank"></label></div>
  <div id="pnet" class="stack" hidden><label>Bank<select name="bank"><option>State Bank</option><option>HDFC Bank</option><option>ICICI Bank</option><option>Axis Bank</option><option>Canara Bank</option></select></label></div>
  <p class="err" id="e"></p><div class="acts"><a class="btn ghost dark" href="#/book/${F.fid}/${F.cls}" onclick="F.step=2">Back</a><button class="btn green lg">Pay ${inr(F.calc.total)} securely</button></div><p class="muted" style="margin-top:12px">Encrypted checkout. Card details are never stored.</p></form></div><aside>${sb}</aside></div></div>`);
  A.pm();
}

/* ---------- tickets ---------- */
function myBooking(p) { const u = me(); return db.bookings.find(x => x.pnr === p && (x.userId === u.id || u.role === 'admin')); }
function passHTML(b, p, i) {
  const ar = arrInfo(b), f = flt(b.fid), cancelled = b.status === 'Cancelled', col = alOf(b.al).color;
  return `<div class="pass">${cancelled ? '<div class="stamp">CANCELLED</div>' : ''}<div class="p-band" style="background:${col}"><b>${esc(alOf(b.al).name)} · ${b.no}</b><span>${b.cls} class · ${badge(b.status)}</span></div><span class="n1"></span><span class="n2"></span>
  <div class="p-main"><div class="codes"><div><h2>${b.from}</h2><small>${esc(apOf(b.from).city)}</small></div><div class="line" style="min-width:80px"><span>${dur(b.dur)}</span></div><div class="r"><h2>${b.to}</h2><small>${esc(apOf(b.to).city)}</small></div></div>
  <p><small>Passenger</small><br><b style="font:700 20px var(--fh)">${esc(pname(p).toUpperCase())}</b></p>
  <div class="grid4"><div><small>Date</small><b>${fmtD(b.date)}</b></div><div><small>Departs</small><b>${b.dep}</b></div><div><small>Arrives</small><b>${ar.t}${ar.dd ? ' (+' + ar.dd + ')' : ''}</b></div><div><small>Seat</small><b>${p.seat}</b></div><div><small>Flight status</small><b>${f ? fst(f) : 'N/A'}</b></div><div><small>Baggage</small><b>${f ? f.bag : '15 kg'}</b></div><div><small>Gate</small><b>${'ABCD'[b.no.length % 4]}${(b.no.charCodeAt(2) % 20) + 1}</b></div><div><small>Boarding</small><b>${tm(mins(b.dep) - 40)}</b></div></div></div>
  <div class="p-stub"><div>${barcode(b.pnr + p.seat)}<p class="pnr">${b.pnr}</p><small>PNR · Passenger ${i + 1} of ${b.pax.length}</small></div><div><small>Seat</small><div style="font:800 40px var(--fh)">${p.seat}</div></div></div></div>`;
}
function ticket(pnrNo) {
  if (!guard()) return; const b = myBooking(pnrNo); if (!b) return nf();
  const m = [...db.outbox].reverse().find(x => x.ref === b.pnr), f = flt(b.fid);
  app(`<div class="wrap page"><div class="acts no-print" style="margin-bottom:18px;justify-content:center"><a class="btn ghost dark" href="#/dashboard">My trips</a><a class="btn dark" href="#/print/${b.pnr}">Print ticket</a>${m ? `<button class="btn ghost dark" onclick="A.mail('${m.id}')">View e-ticket email</button>` : ''}${b.status === 'Confirmed' ? `<a class="btn danger" href="#/cancel/${b.pnr}">Cancel ticket</a>` : ''}</div>
  ${f && f.status === 'Cancelled' && b.status === 'Confirmed' ? '<div class="banner bad no-print" style="max-width:900px;margin:0 auto 14px">This flight was cancelled by the airline. Cancel the ticket for a full refund.</div>' : ''}${f && f.status === 'Delayed' ? `<div class="banner no-print" style="max-width:900px;margin:0 auto 14px">This flight is delayed by ${f.delay} minutes.</div>` : ''}
  ${b.pax.map((p, i) => i === 0 ? passHTML(b, p, i) : '').join('')}
  <div class="panel" style="max-width:900px;margin:0 auto"><h3>Itinerary and passengers</h3><div class="scroll" style="margin-top:12px"><table><tr><th>#</th><th>Passenger</th><th>Age</th><th>Seat</th><th>ID</th></tr>${b.pax.map((p, i) => `<tr><td>${i + 1}</td><td>${esc(pname(p))}</td><td>${p.age}</td><td><b>${p.seat}</b></td><td>${esc(p.idno || '-')}</td></tr>`).join('')}</table></div>
  <dl style="display:grid;grid-template-columns:1fr auto;gap:6px 14px;max-width:360px"><dt>Fare</dt><dd>${inr(b.fare)}</dd><dt>Taxes</dt><dd>${inr(b.tax)}</dd><dt>Convenience fee</dt><dd>${inr(b.fee)}</dd><dt><b>Total paid</b></dt><dd><b>${inr(b.amount)}</b></dd></dl>
  ${b.refund ? `<div class="banner" style="margin-top:12px">Refund of <b>${inr(b.refund.amt)}</b> (${b.refund.pct}%) was issued on ${fmtDT(b.refund.date)}.</div>` : ''}<small>Booked ${fmtDT(b.created)} · Payment ref ${esc(b.payId)}</small></div></div>`);
}
function printPage(pnrNo) {
  if (!guard()) return; const b = myBooking(pnrNo); if (!b) return nf();
  app(`<div class="wrap page"><div class="acts no-print" style="margin-bottom:18px;justify-content:center"><a class="btn ghost dark" href="#/ticket/${b.pnr}">← Back to ticket</a><button class="btn" onclick="print()">Print boarding passes</button></div>${b.pax.map((p, i) => passHTML(b, p, i)).join('')}<p class="muted no-print" style="text-align:center">One boarding pass per passenger. Carry a valid photo ID.</p></div>`);
}

/* ---------- booking status (public) ---------- */
function statusBody() {
  const b = db.bookings.find(x => x.pnr === ST.pnr);
  if (!b || !b.pax.some(p => p.last.trim().toLowerCase() === ST.last.trim().toLowerCase())) return '<div class="empty">No booking found for this PNR and last name. Check both and try again.</div>';
  const f = flt(b.fid), ar = arrInfo(b);
  return `<div class="panel"><div class="al" style="margin-bottom:14px">${logo(b.al)}<div><b>${esc(alOf(b.al).name)} ${b.no}</b><small>${b.cls}</small></div><span style="margin-left:auto">${badge(b.status)} ${f ? badge(fst(f), fstCls(f)) : ''}</span></div>
  <div class="route"><div><b>${b.dep}</b><small>${esc(apOf(b.from).city)} (${b.from})</small></div><div class="line"><span>${dur(b.dur)}</span></div><div class="r"><b>${ar.t}${ar.dd ? `<sup>+${ar.dd}</sup>` : ''}</b><small>${esc(apOf(b.to).city)} (${b.to})</small></div></div><p class="muted">${fmtD(b.date)} · Payment ${b.payStatus}</p>
  <div class="scroll" style="margin-top:12px"><table><tr><th>#</th><th>Passenger</th><th>Seat</th></tr>${b.pax.map((p, i) => `<tr><td>${i + 1}</td><td>${esc(pname(p))}</td><td><b>${p.seat}</b></td></tr>`).join('')}</table></div>${b.refund ? `<div class="banner">Refund of ${inr(b.refund.amt)} issued.</div>` : ''}</div>`;
}
function status(p) {
  if (p && p !== ST.pnr) { ST.pnr = p; ST.last = ''; }
  app(`<div class="wrap page"><div class="sec-h"><h2>View booking status</h2>${ST.last ? '<span class="live" id="lv">Live</span>' : ''}</div><form class="filters" onsubmit="A.statusGo(event)"><label>PNR (6 characters)<input name="p" maxlength="6" required value="${esc(ST.pnr)}" style="text-transform:uppercase" placeholder="K7Q2ZD"></label><label>Passenger last name<input name="l" required value="${esc(ST.last)}" placeholder="Traveller"></label><button class="btn dark">Check status</button></form><div id="stres">${ST.pnr && ST.last ? statusBody() : '<div class="empty">Enter your PNR and last name. Demo: K7Q2ZD / Traveller</div>'}</div></div>`);
}

/* ---------- cancel ticket ---------- */
function cancel(p) {
  if (!guard()) return; const u = me(); let body = '';
  if (!p) {
    const list = db.bookings.filter(b => b.userId === u.id && b.status === 'Confirmed').sort((a, b) => a.date.localeCompare(b.date));
    body = list.length ? `<div class="scroll"><table><tr><th>PNR</th><th>Flight</th><th>Date</th><th>Paid</th><th></th></tr>${list.map(b => `<tr><td><b style="font-family:var(--fm)">${b.pnr}</b></td><td>${b.no} ${b.from} to ${b.to}</td><td>${fmtD(b.date)} ${b.dep}</td><td>${inr(b.amount)}</td><td><a class="btn sm danger" href="#/cancel/${b.pnr}">Cancel</a></td></tr>`).join('')}</table></div>` : '<div class="empty">You have no active bookings to cancel.</div>';
  } else {
    const b = myBooking(p);
    if (!b) body = '<div class="empty">No booking found for this PNR under your account.</div>';
    else {
      const rc = refundCalc(b), can = b.status === 'Confirmed' && new Date(b.date + 'T' + b.dep).getTime() > Date.now();
      body = `<div class="panel"><div class="al">${logo(b.al)}<div><b>${b.no} · ${esc(apOf(b.from).city)} to ${esc(apOf(b.to).city)}</b><small>${fmtD(b.date)} · ${b.dep} · ${b.cls} · ${b.pax.length} passenger(s)</small></div><span style="margin-left:auto">${badge(b.status)}</span></div>
      ${can ? `<div class="scroll" style="margin-top:14px"><table><tr><th>Cancelled before departure</th><th>Refund of fare and taxes</th></tr>${(rc.rs || [...db.rules].sort((x, y) => y.hrs - x.hrs)).map((r, i) => `<tr class="${i === rc.idx ? 'hl' : ''}"><td>${r.hrs ? r.hrs + '+ hours' : 'Under ' + Math.min(...db.rules.map(x => x.hrs).filter(h => h > 0)) + ' hours'}</td><td>${r.pct}%</td></tr>`).join('') || ''}</table></div>
      <div class="banner"><b>You will receive ${inr(rc.amt)} (${rc.pct}%)</b><br>${rc.rule}</div><button class="btn danger" onclick="A.cancelDo('${b.pnr}')">Cancel this ticket</button>` : `<div class="banner" style="margin-top:14px">This ticket cannot be cancelled (${b.status}${b.status === 'Confirmed' ? ', flight departed' : ''}).</div>`}</div>`;
    }
  }
  app(`<div class="wrap page"><div class="sec-h"><h2>Cancel ticket</h2></div><form class="filters" onsubmit="A.pnrGo(event)"><label>Enter PNR<input name="p" maxlength="6" required value="${esc(p || '')}" style="text-transform:uppercase"></label><button class="btn dark">Find ticket</button></form>${body}</div>`);
}

/* ---------- feedback ---------- */
function feedback() {
  const u = me(), list = [...db.feedback].reverse().slice(0, 8), avg = db.feedback.length ? (db.feedback.reduce((a, f) => a + f.rating, 0) / db.feedback.length).toFixed(1) : '-';
  app(`<div class="wrap page"><div class="sec-h"><h2>Customer feedback</h2><span><b>${avg}</b> <span class="stars">★</span> from ${db.feedback.length} reviews</span></div><div class="bk"><div class="panel"><h3>Tell us about your trip</h3><form class="stack" style="margin-top:14px" onsubmit="A.fb(event)">
  ${u ? '' : '<div class="row2"><label>Your name<input name="name" required></label><label>Email<input type="email" name="email" required></label></div>'}
  <div><small>Rating</small><div class="stars-in" id="rt">${[1, 2, 3, 4, 5].map(n => `<button type="button" class="${n <= FB.rating ? 'on' : ''}" onclick="A.rate(${n})" aria-label="${n} stars">★</button>`).join('')}</div></div>
  <div class="row2"><label>Topic<select name="cat"><option>Booking experience</option><option>Payment</option><option>Flight and crew</option><option>Refund and cancellation</option><option>Website suggestion</option></select></label><label>PNR (optional)<input name="pnr" maxlength="6" style="text-transform:uppercase"></label></div>
  <label>Your feedback<textarea name="text" required maxlength="600" placeholder="What went well? What should we fix?"></textarea></label><button class="btn lg">Send feedback</button></form></div>
  <aside class="panel"><h3>Recent reviews</h3>${list.map(f => `<div class="fb"><header><b>${esc(f.name)}</b><span class="stars">${starsTxt(f.rating)}</span></header><small>${esc(f.cat)} · ${fmtD(f.date)}</small><p>${esc(f.text)}</p>${f.reply ? `<div class="reply"><b>Aurelia:</b> ${esc(f.reply)}</div>` : ''}</div>`).join('') || '<p class="muted">No reviews yet.</p>'}</aside></div></div>`);
}

/* ---------- auth ---------- */
const authBox = (t, sub, form, alt, cls = '') => app(`<div class="wrap"><div class="auth panel ${cls}"><h1>${t}</h1><p class="muted">${sub}</p>${form}<div class="alt">${alt}</div></div></div>`);
function login() { authBox('Log in', 'Welcome back. Log in to book and manage trips.', `<form class="stack" onsubmit="A.login(event,false)"><label>Email<input type="email" name="email" required autocomplete="username"></label><label>Password<input type="password" name="password" required autocomplete="current-password"></label><p class="err" id="e"></p><button class="btn lg">Log in</button></form>`, '<a href="#/forgot">Forgot password?</a><a href="#/register">Create account</a>'); }
function adminLogin() { authBox('Administrator login', 'Staff only. Manage flights, inventory, users and reports.', `<form class="stack" onsubmit="A.login(event,true)"><label>Admin email<input type="email" name="email" required autocomplete="username"></label><label>Password<input type="password" name="password" required autocomplete="current-password"></label><p class="err" id="e"></p><button class="btn dark lg">Log in to admin</button></form>`, '<a href="#/forgot">Forgot password?</a><a href="#/login">Passenger login</a>', 'staff'); }
function register() { authBox('Create account', 'Book faster and keep every itinerary in one place.', `<form class="stack" onsubmit="A.register(event)"><label>Full name<input name="name" required></label><label>Email<input type="email" name="email" required></label><label>Phone<input name="phone" inputmode="tel" pattern="[0-9+ ]{10,14}" required></label><label>Account type<select name="role"><option value="user">Traveller</option><option value="agent">Travel agent (no convenience fee)</option></select></label><label>Password (6+ characters)<input type="password" name="password" minlength="6" required></label><label>Confirm password<input type="password" name="confirm" required></label><p class="err" id="e"></p><button class="btn lg">Register</button></form>`, '<span>Already registered?</span><a href="#/login">Log in</a>'); }
function forgot() {
  const s = db.reset ? 2 : 1;
  authBox('Forgot password', s === 1 ? 'Enter your email and we will send a 6-digit code.' : 'Enter the code from the email and choose a new password.', s === 1 ? `<form class="stack" onsubmit="A.sendCode(event)"><label>Email<input type="email" name="email" required></label><p class="err" id="e"></p><button class="btn lg">Send code</button></form>` : `<form class="stack" onsubmit="A.resetPw(event)"><label>6-digit code<input name="code" inputmode="numeric" maxlength="6" required></label><label>New password<input type="password" name="password" minlength="6" required></label><p class="err" id="e"></p><button class="btn lg">Update password</button></form>`, '<a href="#/login">Back to log in</a>' + (s === 2 ? '<a href="#" onclick="A.clearReset();return false">Use another email</a>' : ''));
}

/* ---------- dashboard ---------- */
function dashboard() {
  if (!guard()) return;
  const u = me(), all = db.bookings.filter(b => b.userId === u.id).sort((a, b) => b.created.localeCompare(a.created)), t = TAB.d;
  const up = all.filter(b => b.status === 'Confirmed' && new Date(b.date + 'T' + b.dep).getTime() > Date.now()).sort((a, b) => (a.date + a.dep).localeCompare(b.date + b.dep));
  let body;
  if (t === 'trips') body = up.length ? up.map(b => { const ar = arrInfo(b), f = flt(b.fid), d = new Date(b.date + 'T00:00'); return `<div class="trip" style="--c:${alOf(b.al).color}"><div class="d"><b>${d.getDate()}</b>${d.toLocaleDateString('en-IN', { month: 'short' }).toUpperCase()}</div><div><b style="font:700 20px var(--fh)">${esc(apOf(b.from).city)} → ${esc(apOf(b.to).city)}</b><br><span class="muted">${b.no} · ${b.dep} to ${ar.t}${ar.dd ? ' (+' + ar.dd + ')' : ''} · ${b.cls} · Seats ${b.pax.map(p => p.seat).join(', ')}</span><br>${f ? badge(fst(f), fstCls(f)) : ''} <small>PNR ${b.pnr}</small></div><div class="acts"><a class="btn sm dark" href="#/ticket/${b.pnr}">Ticket</a><a class="btn sm ghost dark" href="#/print/${b.pnr}">Print</a><a class="btn sm danger" href="#/cancel/${b.pnr}">Cancel</a></div></div>`; }).join('') : '<div class="empty">No upcoming trips. <a href="#/home"><b>Search flights</b></a></div>';
  else if (t === 'all') body = all.length ? `<div class="scroll"><table><tr><th>PNR</th><th>Flight</th><th>Date</th><th>Class</th><th>Seats</th><th>Total</th><th>Status</th><th></th></tr>${all.map(b => `<tr><td><b style="font-family:var(--fm)">${b.pnr}</b></td><td>${b.no}<br><small>${b.from} to ${b.to}</small></td><td>${fmtD(b.date)}<br><small>${b.dep}</small></td><td>${b.cls}</td><td>${b.pax.map(p => p.seat).join(', ')}</td><td>${inr(b.amount)}</td><td>${badge(b.status)}</td><td><a class="btn sm dark" href="#/ticket/${b.pnr}">Ticket</a></td></tr>`).join('')}</table></div>` : '<div class="empty">No bookings yet.</div>';
  else body = `<div class="panel" style="max-width:460px"><h3>Change password</h3><form class="stack" style="margin-top:14px" onsubmit="A.changePw(event)"><label>Current password<input type="password" name="old" required></label><label>New password<input type="password" name="pw" minlength="6" required></label><label>Confirm new password<input type="password" name="pw2" required></label><p class="err" id="e"></p><button class="btn dark">Update password</button></form></div>`;
  app(`<div class="wrap page"><div class="sec-h"><h2>My tickets</h2><small>${esc(u.name)} · ${esc(u.email)}${u.role === 'agent' ? ' · Travel agent' : ''}</small></div><div class="tabs"><button class="${t === 'trips' ? 'on' : ''}" onclick="A.tab('d','trips')">Upcoming itineraries</button><button class="${t === 'all' ? 'on' : ''}" onclick="A.tab('d','all')">Booking history</button><button class="${t === 'pw' ? 'on' : ''}" onclick="A.tab('d','pw')">Change password</button></div>${body}</div>`);
}

/* ---------- admin ---------- */
const tbl = (head, rows) => `<div class="scroll"><table><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr>${rows.join('') || `<tr><td colspan="${head.length}" class="muted">Nothing here yet.</td></tr>`}</table></div>`;
function admin() {
  if (!guard('admin')) return;
  const t = TAB.a, uname = id => esc(db.users.find(u => u.id === id)?.name || 'Deleted user');
  const tabs = [['reports', 'Reports'], ['flights', 'Flight schedules'], ['inventory', 'Seat inventory'], ['bookings', 'Bookings'], ['users', 'Users'], ['feedback', 'Feedback'], ['gds', 'Airlines and GDS']];
  let body = '';
  if (t === 'reports') body = reportHTML();
  if (t === 'flights') body = `<div class="sec-h"><h3>Flight schedules</h3><button class="btn" onclick="A.flightForm()">Add flight</button></div><div class="filters"><label>Filter flights<input value="${esc(AD.q)}" oninput="A.rowf(this.value)" placeholder="Flight no, city, airline"></label></div>` + tbl(['Flight', 'Route', 'Departs', 'Duration', 'Runs', 'Seats (E/B/F)', 'Status', ''], db.flights.map(f => `<tr data-s="${f.no} ${f.from} ${f.to} ${apOf(f.from).city} ${apOf(f.to).city} ${alOf(f.al).name}"><td><div class="al">${logo(f.al)}<b>${f.no}</b></div></td><td>${f.from} to ${f.to}</td><td>${f.dep}</td><td>${dur(f.dur)}</td><td>${f.days.length === 7 ? 'Daily' : f.days.map(d => WD[d]).join(' ')}</td><td>${['Economy', 'Business', 'First'].map(c => f.classes[c]?.seats || 0).join(' / ')}</td><td>${badge(fst(f), fstCls(f))}${f.active ? '' : ' <small>hidden</small>'}</td><td><div class="acts"><button class="btn sm dark" onclick="A.flightForm('${f.id}')">Edit</button><button class="btn sm ghost" onclick="A.flightToggle('${f.id}')">${f.active ? 'Hide' : 'Show'}</button><button class="btn sm danger" onclick="A.flightDel('${f.id}')">Delete</button></div></td></tr>`));
  if (t === 'inventory') body = invHTML();
  if (t === 'bookings') body = `<div class="sec-h"><h3>All bookings</h3></div><div class="filters"><label>Filter by PNR or flight<input oninput="A.rowf(this.value)" placeholder="Type to filter"></label></div>` + tbl(['PNR', 'Account', 'Flight', 'Date', 'Class', 'Seats', 'Amount', 'Status', ''], [...db.bookings].reverse().map(b => `<tr data-s="${b.pnr} ${b.no} ${b.from} ${b.to}"><td><b style="font-family:var(--fm)">${b.pnr}</b></td><td>${uname(b.userId)}</td><td>${b.no}<br><small>${b.from} to ${b.to}</small></td><td>${fmtD(b.date)}</td><td>${b.cls}</td><td>${b.pax.map(p => p.seat).join(', ')}</td><td>${inr(b.amount)}</td><td>${badge(b.status)}</td><td><a class="btn sm dark" href="#/ticket/${b.pnr}">View</a></td></tr>`));
  if (t === 'users') body = `<div class="sec-h"><h3>User accounts</h3></div>` + tbl(['Name', 'Email', 'Phone', 'Role', 'Joined', 'Bookings', ''], db.users.map(u => `<tr><td><b>${esc(u.name)}</b></td><td>${esc(u.email)}</td><td>${esc(u.phone)}</td><td>${u.role}${u.blocked ? ' (blocked)' : ''}</td><td>${fmtD(u.created)}</td><td>${db.bookings.filter(b => b.userId === u.id).length}</td><td>${u.role === 'admin' ? '' : `<div class="acts"><button class="btn sm ghost" onclick="A.userBlock('${u.id}')">${u.blocked ? 'Unblock' : 'Block'}</button><button class="btn sm danger" onclick="A.userDel('${u.id}')">Delete</button></div>`}</td></tr>`));
  if (t === 'feedback') body = `<div class="sec-h"><h3>Customer feedback</h3></div>` + tbl(['Date', 'Customer', 'Rating', 'Topic', 'Message', 'Reply', ''], [...db.feedback].reverse().map(f => `<tr><td>${fmtD(f.date)}</td><td>${esc(f.name)}<br><small>${f.pnr ? 'PNR ' + esc(f.pnr) : ''}</small></td><td><span class="stars">${starsTxt(f.rating)}</span></td><td>${esc(f.cat)}</td><td>${esc(f.text)}</td><td>${esc(f.reply || '-')}</td><td><div class="acts"><button class="btn sm dark" onclick="A.reply('${f.id}')">Reply</button><button class="btn sm danger" onclick="A.fbDel('${f.id}')">Delete</button></div></td></tr>`));
  if (t === 'gds') body = `<div class="sec-h"><h3>Airlines and GDS feed</h3><div class="acts"><button class="btn" onclick="A.sync()">Sync GDS feed</button><button class="btn dark" onclick="A.airlineForm()">Add airline</button></div></div><p class="muted" style="margin-bottom:12px">Last sync ${fmtDT(db.gds.last)}. Demo: a sync nudges base fares by up to ±3%, as a real GDS feed would refresh rates and inventory.</p>` + tbl(['Airline', 'Code', 'Flights', 'Last synced', ''], db.airlines.map(a => `<tr><td><div class="al">${logo(a.code)}<b>${esc(a.name)}</b></div></td><td>${a.code}</td><td>${db.flights.filter(f => f.al === a.code).length}</td><td>${fmtDT(a.synced)}</td><td><button class="btn sm danger" onclick="A.airlineDel('${a.code}')">Remove</button></td></tr>`)) +
    `<div class="sec-h"><h3>Cancellation refund rules</h3></div><form class="filters" onsubmit="A.ruleAdd(event)"><label>Cancelled at least (hours before)<input type="number" name="hrs" min="0" required></label><label>Refund %<input type="number" name="pct" min="0" max="100" required></label><button class="btn dark">Add rule</button></form>` + tbl(['Hours before departure', 'Refund of fare and taxes', ''], [...db.rules].sort((a, b) => b.hrs - a.hrs).map(r => `<tr><td>${r.hrs}+</td><td>${r.pct}%</td><td><button class="btn sm danger" onclick="A.ruleDel(${r.hrs})">Delete</button></td></tr>`));
  app(`<div class="wrap page adm"><aside class="rail"><h3>Control room</h3>${tabs.map(x => `<button class="rail-b ${t === x[0] ? 'on' : ''}" onclick="A.tab('a','${x[0]}')">${x[1]}</button>`).join('')}</aside><section class="adm-main">${body}</section></div>`);
}
function invHTML() {
  const f = flt(AD.fid) || db.flights[0]; AD.fid = f.id;
  return `<div class="sec-h"><h3>Seat inventory</h3></div><div class="filters"><label>Flight<select onchange="AD.fid=this.value;admin()">${db.flights.map(x => `<option value="${x.id}" ${x.id === f.id ? 'selected' : ''}>${x.no} · ${x.from} to ${x.to} · ${x.dep}</option>`).join('')}</select></label><label>Flight date<input type="date" value="${AD.date}" onchange="AD.date=this.value;admin()"></label></div><p class="muted">Click a free seat to block it (crew, hold, maintenance). Click a blocked seat to release it. Booked seats cannot be changed here. Capacity is set in Flight schedules.</p>
  <div id="cabinAd">${cabinHTML(true)}</div>${legend(true)}`;
}
function repData() {
  const bk = db.bookings.filter(b => (!REP.from || b.created.slice(0, 10) >= REP.from) && (!REP.to || b.created.slice(0, 10) <= REP.to)), ok = bk.filter(b => b.status === 'Confirmed'), cx = bk.filter(b => b.status === 'Cancelled');
  const sum = (a, k) => a.reduce((s, b) => s + k(b), 0), grp = k => { const m = {}; ok.forEach(b => { const x = m[k(b)] ||= { n: 0, pax: 0, rev: 0 }; x.n++; x.pax += b.pax.length; x.rev += b.amount; }); return Object.entries(m).sort((a, b) => b[1].rev - a[1].rev); };
  return { bk, ok, cx, rev: sum(ok, b => b.amount), refunds: sum(cx, b => b.refund?.amt || 0), pax: sum(ok, b => b.pax.length), byAl: grp(b => b.al), byRoute: grp(b => b.from + ' to ' + b.to), byFl: grp(b => b.no) };
}
function reportHTML() {
  const r = repData(), max = Math.max(1, ...r.byAl.map(x => x[1].rev)), avg = db.feedback.length ? (db.feedback.reduce((a, f) => a + f.rating, 0) / db.feedback.length).toFixed(1) : '-';
  return `<div class="sec-h"><h3>Reports</h3></div><form class="filters no-print" onsubmit="A.report(event)"><label>Booked from<input type="date" name="from" value="${REP.from}"></label><label>Booked to<input type="date" name="to" value="${REP.to}"></label><button class="btn dark">Generate report</button><button type="button" class="btn ghost dark" onclick="print()">Print</button><button type="button" class="btn ghost dark" onclick="A.csv()">Download CSV</button></form>
  <div class="cards"><div class="stat"><small>Bookings</small><b>${r.bk.length}</b></div><div class="stat"><small>Confirmed</small><b>${r.ok.length}</b></div><div class="stat"><small>Cancelled</small><b>${r.cx.length}</b></div><div class="stat"><small>Passengers booked</small><b>${r.pax}</b></div><div class="stat"><small>Revenue</small><b>${inr(r.rev)}</b></div><div class="stat"><small>Refunds issued</small><b>${inr(r.refunds)}</b></div><div class="stat"><small>Avg rating</small><b>${avg} ★</b></div></div>
  <div class="panel"><h3>Revenue by airline</h3>${r.byAl.map(([c, x]) => `<div class="hbar"><span>${esc(alOf(c).name)}</span><i style="--c:${alOf(c).color};width:${Math.round(x.rev / max * 100)}%"></i><b>${inr(x.rev)}</b></div>`).join('') || '<p class="muted">No confirmed bookings in this period.</p>'}</div>
  <div class="sec-h" style="margin-top:22px"><h3>Routes</h3></div>${tbl(['Route', 'Bookings', 'Passengers', 'Revenue'], r.byRoute.map(([k, x]) => `<tr><td>${esc(k)}</td><td>${x.n}</td><td>${x.pax}</td><td>${inr(x.rev)}</td></tr>`))}
  <div class="sec-h"><h3>Flights</h3></div>${tbl(['Flight', 'Bookings', 'Passengers', 'Revenue'], r.byFl.map(([k, x]) => `<tr><td>${esc(k)}</td><td>${x.n}</td><td>${x.pax}</td><td>${inr(x.rev)}</td></tr>`))}`;
}

/* ---------- actions ---------- */
const fd = e => { e.preventDefault(); return Object.fromEntries(new FormData(e.target)); };
const err = m => { const e = $('#e'); if (e) e.textContent = m; };
const luhn = n => { let s = 0, d = false; for (let i = n.length - 1; i >= 0; i--) { let x = +n[i]; if (d) { x *= 2; if (x > 9) x -= 9; } s += x; d = !d; } return s % 10 === 0; };
const afterAuth = u => { const nx = sessionStorage.getItem('next'); sessionStorage.removeItem('next'); location.hash = nx || (u.role === 'admin' ? '#/admin' : '#/dashboard'); nav(); };

const A = {
  search(e) { const f = fd(e); S = { ...S, from: f.from, to: f.to, date: f.date, cls: f.cls, pax: +f.pax, al: '' }; $('#res').innerHTML = results(); },
  quick(a, b) { S.from = apLabel(a); S.to = apLabel(b); home(); },
  swap() { const f = $('.search'); [f.from.value, f.to.value] = [f.to.value, f.from.value]; },
  sort(v) { S.sort = v; $('#res').innerHTML = results(); },
  al(c) { S.al = c; $('#res').innerHTML = results(); },
  mail(id) { showMail(db.outbox.find(m => m.id === id)); },
  pick(fid, silent) {
    const f = flt(fid), u = me(), n = S.pax, nm = (u?.name || '').split(' ');
    F = { fid, cls: S.cls, date: S.date, step: 1, seats: [], mode: 'card', contact: { email: u?.email || '', phone: u?.phone || '' }, pax: Array.from({ length: n }, (_, i) => ({ title: 'Mr', first: i === 0 ? nm[0] || '' : '', last: i === 0 ? nm.slice(1).join(' ') : '', age: '', idno: '' })) };
    if (!silent) location.hash = `#/book/${fid}/${S.cls}`;
  },
  ps(i, k, v) { F.pax[i][k] = v; if (k === 'first' && F.step === 2) $('#picks').innerHTML = picksHTML(); },
  next1() {
    for (const [i, p] of F.pax.entries()) { if (!p.first.trim() || !p.last.trim()) return toast(`Enter first and last name for passenger ${i + 1}`, 'err'); if (!(+p.age >= 1 && +p.age <= 120)) return toast(`Enter a valid age for passenger ${i + 1}`, 'err'); }
    if (!/^\S+@\S+\.\S+$/.test(F.contact.email)) return toast('Enter a valid email', 'err'); if (!/^[0-9+ ]{10,14}$/.test(F.contact.phone)) return toast('Enter a valid phone number', 'err');
    F.step = 2; F.unit = 0; bookView(); window.scrollTo(0, 0);
  },
  step(n) { F.step = n; bookView(); },
  seat(id) {
    const i = F.seats.indexOf(id); if (i > -1) F.seats.splice(i, 1); else if (F.seats.length >= F.pax.length) return toast(`You are booking ${F.pax.length} seat(s). Unselect one first.`, 'err'); else F.seats.push(id);
    $('#cabin').innerHTML = cabinHTML(); $('#picks').innerHTML = picksHTML(); $('#sumbox').innerHTML = sumHTML();
  },
  auto() { const a = inv(flt(F.fid), F.date, F.cls); F.seats = [...F.seats, ...a.free.filter(s => !F.seats.includes(s))].slice(0, F.pax.length); $('#cabin').innerHTML = cabinHTML(); $('#picks').innerHTML = picksHTML(); $('#sumbox').innerHTML = sumHTML(); },
  toPay() {
    const f = flt(F.fid), a = inv(f, F.date, F.cls); F.seats = F.seats.filter(s => a.free.includes(s));
    if (F.seats.length !== F.pax.length) { $('#cabin').innerHTML = cabinHTML(); $('#picks').innerHTML = picksHTML(); return toast(`Select ${F.pax.length} available seat(s) to continue`, 'err'); }
    F.unit = price(f, F.date, F.cls); F.step = 3; location.hash = '#/pay';
  },
  pm() { const m = document.querySelector('[name=m]:checked').value; F.mode = m; $('#pcard').hidden = m !== 'card'; $('#pupi').hidden = m !== 'upi'; $('#pnet').hidden = m !== 'net'; },
  pay(e) {
    const f = fd(e); err('');
    if (f.m === 'card') {
      const n = (f.num || '').replace(/\s/g, ''), ex = (f.exp || '').match(/^(\d{2})\/(\d{2})$/);
      if (n.length !== 16 || !luhn(n)) return err('Enter a valid 16-digit card number.'); if (!f.holder.trim()) return err('Enter the name on the card.');
      if (!ex || +ex[1] < 1 || +ex[1] > 12 || new Date(2000 + +ex[2], +ex[1], 0) < new Date()) return err('Enter a valid, unexpired date.'); if (!/^\d{3,4}$/.test(f.cvv || '')) return err('Enter the 3 or 4 digit CVV.');
      F.method = 'Card ****' + n.slice(-4);
    } else if (f.m === 'upi') { if (!/^[\w.\-]{2,}@[\w]{2,}$/.test((f.upi || '').trim())) return err('Enter a valid UPI ID.'); F.method = 'UPI ' + f.upi.trim(); }
    else F.method = 'Net banking ' + f.bank;
    modal('<div style="text-align:center"><div class="spin"></div><h3>Processing payment</h3><p class="muted">Please do not close this window.</p></div>');
    setTimeout(A.finish, 1500);
  },
  finish() {
    const f = flt(F.fid), a = inv(f, F.date, F.cls), u = me();
    if (f.status === 'Cancelled' || F.seats.some(s => !a.free.includes(s))) { closeModal(); toast('A selected seat was just taken. Choose again.', 'err'); F.seats = []; F.step = 2; location.hash = `#/book/${F.fid}/${F.cls}`; return; }
    const c = F.calc, pnrNo = newPnr(), payId = uid('PAY');
    const b = { pnr: pnrNo, userId: u.id, fid: f.id, no: f.no, al: f.al, from: f.from, to: f.to, dep: f.dep, dur: f.dur, date: F.date, cls: F.cls, pax: F.pax.map((p, i) => ({ title: p.title, first: p.first.trim(), last: p.last.trim(), age: +p.age, idno: p.idno.trim(), seat: F.seats[i] })), contact: F.contact, fare: c.fare, tax: c.tax, fee: c.fee, amount: c.total, mode: F.method, payStatus: 'Paid', payId, status: 'Confirmed', created: new Date().toISOString(), refund: null };
    db.bookings.push(b); db.payments.push({ id: payId, pnr: pnrNo, userId: u.id, method: F.method, amount: b.amount, status: 'Paid', time: b.created });
    const ar = arrInfo(b);
    mail(b.contact.email, `E-ticket confirmed: PNR ${pnrNo}`, `Hi ${pname(b.pax[0])},\n\nYour flight is confirmed. Your e-ticket is below.\n\nPNR: ${pnrNo}\nFlight: ${alOf(b.al).name} ${b.no} (${f.ac})\nRoute: ${apLabel(b.from)} to ${apLabel(b.to)}\nDate: ${fmtD(b.date)}\nDeparts ${b.dep}, arrives ${ar.t}${ar.dd ? ' (+' + ar.dd + ')' : ''}\nClass: ${b.cls}   Baggage: ${f.bag}\n\nPassengers\n${b.pax.map((p, i) => `${i + 1}. ${pname(p)}  Seat ${p.seat}`).join('\n')}\n\nTotal paid: ${inr(b.amount)} (${F.method})\n\nPlease reach the airport 2 hours before departure and carry a valid photo ID.\nAurelia`, pnrNo);
    save(); F = null; closeModal(); toast('Payment successful. E-ticket sent.'); location.hash = '#/ticket/' + pnrNo;
  },
  pnrGo(e) { const f = fd(e), p = f.p.trim().toUpperCase(); location.hash = '#/cancel/' + p; },
  statusGo(e) { const f = fd(e); ST = { pnr: f.p.trim().toUpperCase(), last: f.l.trim() }; const h = '#/status/' + ST.pnr; if (location.hash === h) route(); else location.hash = h; },
  cancelDo(p) {
    const b = db.bookings.find(x => x.pnr === p); if (!b || b.status !== 'Confirmed' || !confirm(`Cancel ticket ${p}?`)) return;
    const rc = refundCalc(b); b.status = 'Cancelled'; b.refund = { pct: rc.pct, amt: rc.amt, date: new Date().toISOString() };
    const pay = db.payments.find(x => x.id === b.payId); if (pay) pay.status = 'Refunded';
    mail(b.contact.email, `Ticket cancelled: PNR ${p}`, `Your ticket ${p} (${b.no} ${b.from} to ${b.to}, ${fmtD(b.date)}) has been cancelled.\nRefund: ${inr(rc.amt)} (${rc.pct}%) to your original payment method in 5-7 working days.`, p);
    save(); toast(`Ticket cancelled. Refund ${inr(rc.amt)}`); cancel(p);
  },
  rate(n) { FB.rating = n; $('#rt').innerHTML = [1, 2, 3, 4, 5].map(i => `<button type="button" class="${i <= n ? 'on' : ''}" onclick="A.rate(${i})" aria-label="${i} stars">★</button>`).join(''); },
  fb(e) { const f = fd(e), u = me(); db.feedback.push({ id: uid('FB'), userId: u?.id || null, name: u ? u.name : f.name.trim(), pnr: (f.pnr || '').toUpperCase(), rating: FB.rating, cat: f.cat, text: f.text.trim(), date: today(), reply: '' }); save(); toast('Thank you for your feedback'); e.target.reset(); feedback(); },
  login(e, adm) {
    const f = fd(e), u = db.users.find(x => x.email === f.email.trim().toLowerCase() && x.pass === hs(f.password));
    if (!u) return err('Wrong email or password.'); if (u.blocked) return err('This account is blocked. Contact support.');
    if (adm && u.role !== 'admin') return err('This account does not have administrator access.');
    db.session = u.id; save(); toast('Logged in'); afterAuth(u);
  },
  register(e) {
    const f = fd(e), em = f.email.trim().toLowerCase();
    if (db.users.some(u => u.email === em)) return err('This email is already registered. Log in instead.'); if (f.password !== f.confirm) return err('Passwords do not match.');
    const u = { id: uid('U'), name: f.name.trim(), email: em, phone: f.phone, pass: hs(f.password), role: f.role === 'agent' ? 'agent' : 'user', blocked: false, created: today() };
    db.users.push(u); db.session = u.id; save(); toast('Account created'); afterAuth(u);
  },
  logout() { db.session = null; F = null; save(); toast('Logged out'); location.hash = '#/home'; nav(); },
  sendCode(e) {
    const f = fd(e), u = db.users.find(x => x.email === f.email.trim().toLowerCase()); if (!u) return err('No account found with that email.');
    const code = String(Math.floor(100000 + Math.random() * 900000)); db.reset = { email: u.email, code, exp: Date.now() + 15 * 60000 }; save();
    showMail(mail(u.email, 'Your Aurelia password reset code', `Hi ${u.name},\n\nYour reset code is ${code}. It expires in 15 minutes.`)); forgot();
  },
  clearReset() { db.reset = null; save(); forgot(); },
  resetPw(e) {
    const f = fd(e), r = db.reset; if (!r || Date.now() > r.exp) { db.reset = null; save(); toast('Code expired. Request a new one.', 'err'); return forgot(); }
    if (f.code.trim() !== r.code) return err('Incorrect code.');
    db.users.find(u => u.email === r.email).pass = hs(f.password); db.reset = null; save(); toast('Password updated. Log in now.'); location.hash = '#/login';
  },
  changePw(e) { const f = fd(e), u = me(); if (u.pass !== hs(f.old)) return err('Current password is wrong.'); if (f.pw !== f.pw2) return err('New passwords do not match.'); u.pass = hs(f.pw); save(); toast('Password changed'); e.target.reset(); },
  tab(g, t) { TAB[g] = t; g === 'd' ? dashboard() : admin(); },
  /* admin */
  rowf(v) { AD.q = v; v = v.toLowerCase(); document.querySelectorAll('tr[data-s]').forEach(r => r.hidden = !r.dataset.s.toLowerCase().includes(v)); },
  blk(c, id) {
    let x = db.blocks.find(b => b.fid === AD.fid && b.date === AD.date && b.cls === c); if (!x) db.blocks.push(x = { fid: AD.fid, date: AD.date, cls: c, seats: [] });
    const i = x.seats.indexOf(id); if (i > -1) x.seats.splice(i, 1); else x.seats.push(id); save(); $('#cabinAd').innerHTML = cabinHTML(true);
  },
  flightForm(id) {
    const f = id ? flt(id) : { no: '', al: db.airlines[0]?.code, from: 'MAA', to: 'DEL', dep: '08:00', dur: 120, days: [0, 1, 2, 3, 4, 5, 6], ac: 'A320', bag: '15 kg', status: 'Scheduled', delay: 0, classes: { Economy: { seats: 120, fare: 3000 }, Business: { seats: 24, fare: 8000 } } };
    const ap = v => db.airports.map(a => `<option value="${a.c}" ${a.c === v ? 'selected' : ''}>${esc(a.city)} (${a.c})</option>`).join('');
    modal(`<h3>${id ? 'Edit flight' : 'Add flight'}</h3><form class="stack" onsubmit="A.flightSave(event,'${id || ''}')"><div class="row2"><label>Airline<select name="al">${db.airlines.map(a => `<option value="${a.code}" ${a.code === f.al ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label><label>Flight number<input name="no" required value="${esc(f.no)}"></label></div>
    <div class="row2"><label>From<select name="from">${ap(f.from)}</select></label><label>To<select name="to">${ap(f.to)}</select></label></div>
    <div class="row2"><label>Departure<input type="time" name="dep" required value="${f.dep}"></label><label>Duration (minutes)<input type="number" name="dur" min="20" required value="${f.dur}"></label></div>
    <div class="row2"><label>Aircraft<input name="ac" value="${esc(f.ac)}"></label><label>Baggage<input name="bag" value="${esc(f.bag)}"></label></div>
    <div><small>Operates on</small><div class="days">${WD.map((d, i) => `<label><input type="checkbox" name="d${i}" ${f.days.includes(i) ? 'checked' : ''}>${d}</label>`).join('')}</div></div>
    <div><small>Seat inventory and base fare per class (0 seats = class not offered)</small>${CL.map(c => `<div class="row2" style="margin-top:8px"><label>${c} seats<input type="number" min="0" name="s_${c}" value="${f.classes[c]?.seats || 0}"></label><label>${c} base fare (₹)<input type="number" min="0" name="f_${c}" value="${f.classes[c]?.fare || 0}"></label></div>`).join('')}</div>
    <div class="row2"><label>Flight status<select name="status">${['Scheduled', 'Delayed', 'Cancelled'].map(s => `<option ${s === f.status ? 'selected' : ''}>${s}</option>`).join('')}</select></label><label>Delay (minutes)<input type="number" name="delay" min="0" value="${f.delay}"></label></div><p class="err" id="e"></p><button class="btn dark">Save flight</button></form>`, true);
  },
  flightSave(e, id) {
    const f = fd(e), classes = {}; CL.forEach(c => { if (+f['s_' + c] > 0) classes[c] = { seats: +f['s_' + c], fare: +f['f_' + c] }; });
    const days = [0, 1, 2, 3, 4, 5, 6].filter(i => f['d' + i]);
    if (!classes.Economy && !Object.keys(classes).length) return err('Add seats for at least one class.'); if (!days.length) return err('Select at least one operating day.'); if (f.from === f.to) return err('Origin and destination must differ.');
    const no = f.no.trim().toUpperCase(); if (db.flights.some(x => x.no === no && x.id !== id)) return err('A flight with this number exists.');
    const d = { no, al: f.al, from: f.from, to: f.to, dep: f.dep, dur: +f.dur, ac: f.ac, bag: f.bag, days, classes, status: f.status, delay: f.status === 'Delayed' ? +f.delay : 0 };
    let fl; if (id) { fl = flt(id); const was = fl.status; Object.assign(fl, d); if (d.status !== was && d.status !== 'Scheduled') A.notify(fl); } else { fl = { id: uid('F'), active: true, ...d }; db.flights.push(fl); }
    save(); closeModal(); toast('Flight saved'); admin();
  },
  notify(fl) { db.bookings.filter(b => b.fid === fl.id && b.status === 'Confirmed').forEach(b => mail(b.contact.email, `Flight ${fl.no} update: ${fst(fl)}`, `Your flight ${fl.no} on ${fmtD(b.date)} is ${fst(fl).toLowerCase()}.${fl.status === 'Cancelled' ? ' Cancel your ticket in My trips for a full refund.' : ''}`, b.pnr)); },
  flightToggle(id) { const f = flt(id); f.active = !f.active; save(); admin(); },
  flightDel(id) { const f = flt(id); if (db.bookings.some(b => b.fid === id && b.status === 'Confirmed') && !confirm('This flight has confirmed bookings. Delete anyway?')) return; if (!confirm('Delete flight ' + f.no + '?')) return; db.flights = db.flights.filter(x => x.id !== id); save(); admin(); },
  userBlock(id) { const u = db.users.find(x => x.id === id); u.blocked = !u.blocked; save(); admin(); },
  userDel(id) { if (!confirm('Delete this user account?')) return; db.users = db.users.filter(u => u.id !== id); save(); admin(); },
  reply(id) { const f = db.feedback.find(x => x.id === id); modal(`<h3>Reply to ${esc(f.name)}</h3><p class="muted">${esc(f.text)}</p><form class="stack" style="margin-top:12px" onsubmit="A.replySave(event,'${id}')"><label>Your reply<textarea name="r" required>${esc(f.reply)}</textarea></label><button class="btn dark">Post reply</button></form>`); },
  replySave(e, id) { const f = fd(e); db.feedback.find(x => x.id === id).reply = f.r.trim(); save(); closeModal(); toast('Reply posted'); admin(); },
  fbDel(id) { db.feedback = db.feedback.filter(f => f.id !== id); save(); admin(); },
  sync() { let n = 0; db.flights.forEach(f => { Object.values(f.classes).forEach(k => { k.fare = Math.max(500, Math.round(k.fare * (1 + (Math.random() * .06 - .03)) / 10) * 10); }); n++; }); const t = new Date().toISOString(); db.gds.last = t; db.airlines.forEach(a => a.synced = t); save(); toast(`GDS sync complete: ${n} flights refreshed`); admin(); },
  airlineForm() { modal(`<h3>Add airline</h3><form class="stack" onsubmit="A.airlineSave(event)"><div class="row2"><label>Code (2 letters)<input name="code" maxlength="2" required style="text-transform:uppercase"></label><label>Colour<input type="color" name="color" value="#0a6cff" style="height:44px;padding:4px"></label></div><label>Airline name<input name="name" required></label><p class="err" id="e"></p><button class="btn dark">Add airline</button></form>`); },
  airlineSave(e) { const f = fd(e), code = f.code.trim().toUpperCase(); if (code.length !== 2) return err('Use a 2-letter code.'); if (db.airlines.some(a => a.code === code)) return err('Code already exists.'); db.airlines.push({ code, name: f.name.trim(), color: f.color, synced: new Date().toISOString() }); save(); closeModal(); admin(); },
  airlineDel(c) { if (db.flights.some(f => f.al === c)) return toast('Remove or reassign this airline’s flights first', 'err'); db.airlines = db.airlines.filter(a => a.code !== c); save(); admin(); },
  ruleAdd(e) { const f = fd(e), h = +f.hrs; if (db.rules.some(r => r.hrs === h)) return toast('A rule for these hours exists', 'err'); db.rules.push({ hrs: h, pct: +f.pct }); save(); admin(); },
  ruleDel(h) { db.rules = db.rules.filter(r => r.hrs !== h); save(); admin(); },
  report(e) { const f = fd(e); REP = { from: f.from, to: f.to }; admin(); },
  csv() {
    const r = repData(), rows = [['Flight', 'Bookings', 'Passengers', 'Revenue'], ...r.byFl.map(([k, x]) => [k, x.n, x.pax, x.rev])];
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([rows.map(x => x.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')], { type: 'text/csv' })); a.download = 'aurelia-report.csv'; a.click();
  }
};
Object.assign(window, { A, closeModal, route });
route();
