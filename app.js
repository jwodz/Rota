/* ROTA – aplikacja III Siedleckiej Drużyny Harcerzy */
{
const CFG = window.HARC_CONFIG || {};
const DEMO = !CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY;
const $ = s => document.querySelector(s);
const view = $('#view');
const ZASTEPY = CFG.ZASTEPY || [];
const STOPNIE = ['Chusta','Młodzik','Wywiadowca','Ćwik','Harcerz Orli','Harcerz Rzeczypospolitej'];
const stopienSelect = v => [{ value:'', label:'— bez stopnia —' }, ...STOPNIE.map(x => ({ value:x, label:x })), ...(v && !STOPNIE.includes(v) ? [{ value:v, label:v }] : [])];
const fixStopien = s => STOPNIE.find(x => norm(x) === norm(s)) || STOPNIE.find(x => norm(s).startsWith(norm(x).slice(0,4))) || s;
const ROLE = { druzynowy:'Drużynowy', przyboczny:'Przyboczny', zastepowy:'Zastępowy' };
const TABLES = ['profiles','harcerze','rozkazy','sprawnosci','proby','konspekty','ksiega','katalog','funkcje','skladki','skladki_kwota'];
const FUNKCJE = { podzastepowy:'Podzastępowy', proporcowy:'Proporcowy', apteczkowy:'Apteczkowy' };
const KATEGORIE = { 'Obozownictwo i przyroda':'#6aa84f', 'Muzyka i ekspresja':'#46bdc6', 'Sport, turystyka i krajoznawstwo':'#4a86e8', 'Sztuka i technika':'#93c47d',
  'Nauka i kultura':'#826123', 'Duch i charakter':'#999999', 'Sprawności Św. Michała Archanioła':'#111111', 'Wyczyny':'#d400d4', 'Pagony':'#38761d', 'Okazjonalne':'#e8b923' };
const BEZ_GWIAZDEK = ['Wyczyny','Pagony','Okazjonalne'];

/* ---------- pomocnicze ---------- */
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0,10); };
const fmtDate = d => d ? new Date(d.length === 10 ? d + 'T12:00' : d).toLocaleDateString('pl-PL',{day:'numeric',month:'long',year:'numeric'}) : '';
const fmtShort = d => d ? new Date(d + 'T12:00').toLocaleDateString('pl-PL',{weekday:'short',day:'numeric',month:'short'}) : '';
const hm = t => (t || '').slice(0,5);
const stars = n => n > 0 ? '★'.repeat(n) : '';
const starChip = (s, extra = '') => `<span class="bdg lv${s.poziom || 0}${s.status === 'do_zamkniecia' ? ' pend' : ''}"${extra}>${esc(s.nazwa)}${s.poziom ? ' <i>' + stars(s.poziom) + '</i>' : ''}</span>`;
const initials = n => (n || '?').trim().split(/\s+/).map(w => w[0]).slice(0,2).join('').toUpperCase();
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/ł/g,'l').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
const fullName = h => h ? `${h.imie} ${h.nazwisko}` : '—';
function toast(msg){ const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2800); }
const ICON = {
  camera:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  pen:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16zM13 7l4 4"/></svg>',
  down:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h9l4 4v14H6zM14 3v5h5M12 11v6M9.5 14.5L12 17l2.5-2.5"/></svg>',
  plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>'
};

/* =================================================================
   WARSTWA DANYCH – Supabase albo tryb demo
   ================================================================= */
let backend = null;

function supabaseBackend(){
  if (!window.supabase) throw new Error('Nie udało się wczytać biblioteki Supabase. Sprawdź połączenie z internetem.');
  // Sam adres projektu, bez dopisków typu /rest/v1/ czy ukośnika na końcu
  let url = String(CFG.SUPABASE_URL).trim();
  try { url = new URL(url).origin; } catch(e) { throw new Error('Błędny SUPABASE_URL w pliku config.js – wpisz adres w formie https://twojprojekt.supabase.co'); }
  if (!/\.supabase\.(co|in)$/.test(new URL(url).hostname)) throw new Error('SUPABASE_URL w config.js to nie adres projektu. Skopiuj „Project URL” z Supabase → Project Settings → API (np. https://abcd.supabase.co).');
  const sb = window.supabase.createClient(url, String(CFG.SUPABASE_ANON_KEY).trim());
  const chk = ({data, error}) => { if (error) throw new Error(plError(error.message)); return data; };
  const files = sb.storage.from('pliki');
  return {
    async user(){ const { data } = await sb.auth.getSession(); return data.session?.user || null; },
    async signIn(login, password){
      const email = login.includes('@') ? login : `${login}@${CFG.LOGIN_DOMAIN}`;
      chk(await sb.auth.signInWithPassword({ email: email.toLowerCase(), password }));
    },
    async signOut(){ await sb.auth.signOut(); },
    async setPassword(password){ chk(await sb.auth.updateUser({ password })); },
    async list(t){ return chk(await sb.from(t).select('*').order('created_at', {ascending:false})); },
    async insert(t, row){ return chk(await sb.from(t).insert(row).select().single()); },
    async insertMany(t, rows){ return chk(await sb.from(t).insert(rows).select()); },
    async update(t, id, patch){ return chk(await sb.from(t).update(patch).eq('id', id).select().single()); },
    async remove(t, id){ chk(await sb.from(t).delete().eq('id', id)); },
    async setSkladka(harcerz_id, rok, kwartal, wpis){
      if (wpis) chk(await sb.from('skladki').upsert({ harcerz_id, rok, kwartal, ...wpis }, { onConflict: 'harcerz_id,rok,kwartal' }));
      else chk(await sb.from('skladki').delete().match({ harcerz_id, rok, kwartal }));
    },
    async setKwotaSkladki(rok, kwota){ chk(await sb.from('skladki_kwota').upsert({ rok, kwota }, { onConflict: 'rok' })); },
    async setFunkcja(hid, funkcja){
      if (funkcja) chk(await sb.from('funkcje').upsert({ harcerz_id: hid, funkcja }));
      else chk(await sb.from('funkcje').delete().eq('harcerz_id', hid));
    },
    async upload(path, blob){ chk(await files.upload(path, blob, { upsert:true, contentType: blob.type || undefined })); return path; },
    async url(path, downloadName){ const d = chk(await files.createSignedUrl(path, 3600, downloadName ? { download: downloadName } : undefined)); return d.signedUrl; },
    async removeFile(path){ if (path) await files.remove([path]); },
    async ocr(body){
      const { data, error } = await sb.functions.invoke('przepisz-rozkaz', { body });
      if (error) {
        let msg = error.message;
        try { const j = await error.context.json(); if (j.error) msg = j.error; } catch(e) {}
        if (/Failed to send|not found/i.test(msg)) msg = 'Funkcja odczytu rozkazów nie jest jeszcze uruchomiona w Supabase (patrz instrukcja, krok 5). Zmiany możesz wprowadzić ręcznie w zakładkach.';
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
      return data;
    }
  };
}
function plError(m){
  if (/Invalid login/i.test(m)) return 'Błędny login lub hasło.';
  if (/row-level security|permission denied/i.test(m)) return 'Nie masz uprawnień do tej operacji.';
  if (/Password should be|weak/i.test(m)) return 'Hasło jest za słabe – użyj co najmniej 8 znaków.';
  if (/same_password|should be different/i.test(m)) return 'Nowe hasło musi być inne niż obecne.';
  return m;
}

function demoBackend(){
  const KEY = 'rota-demo-v4';
  let db = null;
  try { db = JSON.parse(localStorage.getItem(KEY)); } catch(e) {}
  if (!db) db = seed();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch(e) {} };
  let nextId = Date.now();
  return {
    demo: true,
    users: () => db.profiles,
    switchUser(id){ db.me = id; save(); },
    async user(){ return db.session ? { id: db.me, email: db.profiles.find(p => p.id === db.me)?.login + '@' + (CFG.LOGIN_DOMAIN || 'rota.local') } : null; },
    async signIn(login){
      await new Promise(r => setTimeout(r, 400));
      const u = db.profiles.find(p => p.login === login.split('@')[0]);
      if (!u) throw new Error('Błędny login lub hasło.');
      db.me = u.id; db.session = true; save();
    },
    async signOut(){ db.session = false; save(); },
    reset(){ try { localStorage.removeItem(KEY); } catch(e) {} location.reload(); },
    async setPassword(){ await new Promise(r => setTimeout(r, 300)); },
    async list(t){ return [...(db[t] || [])].sort((a,b) => String(b.created_at || '').localeCompare(String(a.created_at || ''))); },
    async insert(t, row){
      const r = { id: nextId++, created_at: new Date().toISOString(), ...row };
      if (['rozkazy','konspekty'].includes(t)) r.autor_id = db.me;
      if (t === 'konspekty') { const me = db.profiles.find(p => p.id === db.me); r.zastep = me.zastep; r.status = 'oczekuje'; }
      db[t].push(r); save(); return r;
    },
    async insertMany(t, rows){ const out = []; for (const r of rows) out.push(await this.insert(t, r)); return out; },
    async update(t, id, patch){
      db[t] = db[t] || [];
      const r = db[t].find(x => x.id === id);
      if (t === 'konspekty') { if (patch.status === 'zatwierdzony' && r.status !== 'zatwierdzony') { patch.zatwierdzil = db.me; patch.zatwierdzono_at = new Date().toISOString(); } if (patch.status === 'oczekuje') { patch.zatwierdzil = null; } }
      if (t === 'harcerze' && 'zastep' in patch && patch.zastep !== r.zastep) {
        db.funkcje = (db.funkcje || []).filter(x => x.harcerz_id !== id);
        db.profiles.filter(p => p.imie === `${r.imie} ${r.nazwisko}` && p.rola === 'zastepowy').forEach(p => p.zastep = patch.zastep);
      }
      Object.assign(r, patch); save(); return r;
    },
    async remove(t, id){
      db[t] = db[t].filter(x => x.id !== id);
      if (t === 'harcerze') for (const k of ['sprawnosci','proby','funkcje','skladki']) db[k] = (db[k] || []).filter(x => x.harcerz_id !== id);
      save();
    },
    async setSkladka(hid, rok, kwartal, wpis){
      db.skladki = (db.skladki || []).filter(x => !(x.harcerz_id === hid && x.rok === rok && x.kwartal === kwartal));
      if (wpis) db.skladki.push({ harcerz_id: hid, rok, kwartal, ...wpis, created_at: new Date().toISOString() });
      save();
    },
    async setKwotaSkladki(rok, kwota){ db.skladki_kwota = (db.skladki_kwota || []).filter(x => x.rok !== rok); db.skladki_kwota.push({ rok, kwota, created_at: new Date().toISOString() }); save(); },
    async setFunkcja(hid, funkcja){ db.funkcje = (db.funkcje || []).filter(x => x.harcerz_id !== hid); if (funkcja) db.funkcje.push({ harcerz_id: hid, funkcja, created_at: new Date().toISOString() }); save(); },
    async upload(path, blob){
      const url = await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); });
      db.files[path] = url; save(); return path;
    },
    async url(path){ return db.files[path] || ''; },
    async removeFile(path){ delete db.files[path]; save(); },
    async ocr(body){
      await new Promise(r => setTimeout(r, body.text ? 900 : 1800));
      const tresc = 'Rozkaz L. 5/2026\nIII Siedleckiej Drużyny Harcerzy „Rota”\nSiedlce, ' + fmtDate(today()) + '\n\n1. Zarządzenia i informacje\n1.1. Zbiórka drużyny odbędzie się w sobotę o 10:00 w harcówce.\n\n2. Przyjęcia, przeniesienia i skreślenia\n2.1. Przyjmuję do drużyny i przydzielam do zastępu Bug Kamila Nowaka.\n2.2. Przenoszę dh. Filipa Zająca z zastępu Niemen do zastępu Wisła.\n2.3. Skreślam z listy członków drużyny dh. Wiktora Pawlaka.\n\n3. Próby i stopnie\n3.1. Otwieram próbę na stopień Młodzika dh. Miłoszowi Lechowi.\n3.2. Zamykam próbę i przyznaję stopień Młodzika dh. Remigiuszowi Trubie.\n\n4. Sprawności\n4.1. Przyznaję sprawność Łącznik ★ dh. Miłoszowi Lechowi.\n4.2. Przyznaję sprawność Strażnik Ognia ★★ dh. Aleksandrowi Redoszowi.\n4.3. Przyznaję sprawność Higienista ★ dh. Kamilowi Nowakowi.\n\nCzuwaj!\nJan Wodzyński, drużynowy';
      return {
        numer: 'L. 5/2026', data: today(), tytul: 'Rozkaz drużyny L. 5/2026', tresc: body.text || tresc,
        przyjecia: [ { osoba:'Kamil Nowak', zastep:'Bug' } ],
        przeniesienia: [ { osoba:'Filip Zając', zastep:'Wisła' } ],
        skreslenia: [ { osoba:'Wiktor Pawlak' } ],
        sprawnosci: [ { osoba:'Miłosz Lech', nazwa:'Łącznik', poziom:1 }, { osoba:'Aleksander Redosz', nazwa:'Strażnik Ognia', poziom:2 }, { osoba:'Kamil Nowak', nazwa:'Higienista', poziom:1 } ],
        stopnie: [ { osoba:'Remigiusz Truba', stopien:'Młodzik' } ],
        proby: [ { osoba:'Miłosz Lech', stopien:'Młodzik' } ]
      };
    }
  };
  function seed(){
    const d = n => { const x = new Date(); x.setDate(x.getDate() + n); return x; };
    const day = n => d(n).toISOString().slice(0,10);
    const ts = n => d(n).toISOString();
    const P = (id, login, imie, rola, zastep) => ({ id, login, imie, rola, zastep, created_at: ts(-100) });
    // Katalog i harcerze: z plików demo (katalog.js, demo-dane.js) albo krótka lista przykładowa
    let kid = 2000;
    const katalog = (window.ROTA_KATALOG || []).map(k => ({ id: ++kid, ...k, created_at: ts(-200) }));
    const kat = n => katalog.find(k => k.nazwa === n);
    let hid = 100, sid = 500;
    const H = (imie, nazwisko, zastep, stopien) => ({ id: ++hid, imie, nazwisko, zastep, stopien, created_at: ts(-90) });
    const src = window.ROTA_DEMO_DANE || {
      harcerze: [['Jan','Wodzyński','Kadra','Harcerz Orli'],['Dawid','Tarasiuk','Kadra','Ćwik'],
        ['Krzysztof','Płatkowski','Wieprz','Młodzik'],['Igor','Nowicki','Wieprz','Chusta'],['Aleksander','Redosz','Niemen','Młodzik'],['Filip','Zając','Niemen','Chusta'],
        ['Remigiusz','Truba','Wisła','Chusta'],['Szymon','Mazur','Wisła',''],['Miłosz','Lech','Bug','Chusta'],['Wiktor','Pawlak','Bug','']]
        .map(([imie,nazwisko,zastep,stopien]) => ({ imie, nazwisko, zastep, stopien })),
      sprawnosci: [['Krzysztof Płatkowski','Płomień'],['Krzysztof Płatkowski','Obserwator'],['Krzysztof Płatkowski','Strażnik Ognia'],['Igor Nowicki','Higienista'],
        ['Aleksander Redosz','Lekka Stopa'],['Aleksander Redosz','Tropiciel'],['Remigiusz Truba','Sakwa'],['Remigiusz Truba','Skrzydła Św. Michała Archanioła'],
        ['Miłosz Lech','Kuchcik'],['Miłosz Lech','Łącznik','do_zamkniecia'],['Jan Wodzyński','Ogniowiec'],['Dawid Tarasiuk','Topograf'],['Szymon Mazur','Truchcik','do_zamkniecia']]
        .map(([osoba, nazwa, status]) => ({ osoba, nazwa, poziom: kat(nazwa)?.poziom ?? 1, status: status || 'przyznana' }))
    };
    const harcerze = src.harcerze.map(h => H(h.imie, h.nazwisko, h.zastep, h.stopien));
    const hidOf = osoba => harcerze.find(h => `${h.imie} ${h.nazwisko}` === osoba)?.id;
    const sprawnosci = src.sprawnosci.filter(x => hidOf(x.osoba)).map(x => ({ id: ++sid, harcerz_id: hidOf(x.osoba), nazwa: x.nazwa, poziom: x.poziom, status: x.status, data: null, created_at: ts(-60) }));
    const P1 = (osoba, stopien, dd) => hidOf(osoba) ? [{ id: 800 + dd * -1, harcerz_id: hidOf(osoba), stopien, data_otwarcia: day(dd), status:'otwarta', created_at: ts(dd) }] : [];
    return {
      me: 'u1', files: {},
      profiles: [
        P('u1','jan.wodzynski','Jan Wodzyński','druzynowy',''), P('u2','dawid.tarasiuk','Dawid Tarasiuk','przyboczny',''), P('u3','kacper.krasuski','Kacper Krasuski','przyboczny',''),
        P('u4','krzysztof.platkowski','Krzysztof Płatkowski','zastepowy','Wieprz'), P('u5','aleksander.redosz','Aleksander Redosz','zastepowy','Niemen'),
        P('u6','remigiusz.truba','Remigiusz Truba','zastepowy','Wisła'), P('u7','milosz.lech','Miłosz Lech','zastepowy','Bug')
      ],
      katalog, harcerze, sprawnosci, funkcje: [],
      skladki_kwota: [{ rok: new Date().getFullYear(), kwota: 30, created_at: ts(-300) }],
      skladki: harcerze.flatMap((h, i) => [1,2,3,4].filter(q => q <= Math.floor((new Date().getMonth()) / 3) + 1)
        .map(q => ({ harcerz_id: h.id, rok: new Date().getFullYear(), kwartal: q, kwota: (i + q) % 5 === 0 ? null : (i + q) % 7 === 0 ? 15 : 30, zwolniony: (i + q) % 5 === 0, created_at: ts(-30) }))
        .filter((x, j) => (i + j) % 4 !== 3)),
      proby: [ ...P1('Krzysztof Płatkowski','Wywiadowca',-45), ...P1('Remigiusz Truba','Młodzik',-70), ...P1('Miłosz Lech','Młodzik',-12) ],
      rozkazy: [
        { id: 901, numer:'L. 4/2026', tytul:'Rozkaz drużyny L. 4/2026', data: day(-9), autor_id:'u1', created_at: ts(-9),
          tresc:'Rozkaz L. 4/2026\nIII Siedleckiej Drużyny Harcerzy „Rota”\n\n1. Zarządzenia i informacje\n1.1. Zbiórki drużyny odbywają się w każdą sobotę o 10:00.\n1.2. Składka na biwak zimowy wynosi 80 zł – płatna do końca miesiąca.\n\n2. Próby\n2.1. Otwieram próbę na stopień Wywiadowcy dh. Olkowi Kurowi.\n\n3. Sprawności\n3.1. Przyznaję sprawność Węzłarz ★ dh. Igorowi Nowickiemu.\n\nCzuw!\nJan Wodzyński, drużynowy' }
      ],
      konspekty: [
        { id: 701, autor_id:'u4', zastep:'Wieprz', data: day(3), godz_od:'10:00', godz_do:'12:00', miejsce:'Harcówka', temat:'Azymuty i mapa', status:'oczekuje', created_at: ts(-1),
          przebieg:'10:00 Zbiórka, apel (10 min)\n10:10 Gawęda o orientacji w terenie\n10:25 Pokaz pracy z kompasem\n10:45 Gra terenowa „Skarb zastępu” – trasa na azymutach\n11:45 Krąg, podsumowanie' },
        { id: 702, autor_id:'u7', zastep:'Bug', data: day(3), godz_od:'10:00', godz_do:'12:30', miejsce:'Park Aleksandria', temat:'Pierwsza pomoc – opatrunki', status:'oczekuje', created_at: ts(-2),
          przebieg:'Pokaz opatrunku uciskowego, ćwiczenia w parach, scenki ratownicze na czas.' },
        { id: 703, autor_id:'u5', zastep:'Niemen', data: day(-4), godz_od:'10:00', godz_do:'12:00', miejsce:'Harcówka', temat:'Węzły żeglarskie', status:'zatwierdzony', zatwierdzil:'u2', zatwierdzono_at: ts(-6), created_at: ts(-8),
          przebieg:'Nauka 6 węzłów, sztafeta węzłowa, budowa noszy z lin.' }
      ],
      ksiega: [
        { id: 601, okres:'Przykładowy wpis', tytul:'Początki drużyny', kolejnosc:1, created_at: ts(-50),
          tresc:'To przykładowa karta księgi tradycji. Drużynowy i przyboczni mogą tu wpisać historię drużyny: kiedy i przez kogo została założona, skąd wzięła się nazwa „Rota”, kto był pierwszym drużynowym.' },
        { id: 602, okres:'Przykładowy wpis', tytul:'Obrzędowość i zwyczaje', kolejnosc:2, created_at: ts(-40),
          tresc:'Miejsce na opis obrzędów drużyny: ognisk, przyrzeczeń, zwyczajów obozowych, znaczenia barw i symboli z naszywki.' },
        { id: 603, okres:'Przykładowy wpis', tytul:'Lista drużynowych', kolejnosc:3, created_at: ts(-30),
          tresc:'Tu można prowadzić listę kolejnych drużynowych wraz z latami służby.' }
      ]
    };
  }
}

/* =================================================================
   STAN I UPRAWNIENIA
   ================================================================= */
const S = { user:null, me:null, data:{}, planTab:'oczekuje', planZastep:'', q:'', zastep:'', files:{} };
const isKadra = () => ['druzynowy','przyboczny'].includes(S.me?.rola);
const byId = (t, id) => S.data[t]?.find(x => String(x.id) === String(id));
const prof = id => S.data.profiles?.find(p => p.id === id);
const nameOf = id => prof(id)?.imie || 'Ktoś';
const badgesOf = hid => S.data.sprawnosci.filter(s => s.harcerz_id === hid).sort((a,b) => String(b.data).localeCompare(String(a.data)));
const probaOf = hid => S.data.proby.filter(p => p.harcerz_id === hid).sort((a,b) => (a.status === 'otwarta' ? -1 : 1) - (b.status === 'otwarta' ? -1 : 1) || String(b.data_otwarcia).localeCompare(String(a.data_otwarcia)));
const zastepOrder = z => { const i = ZASTEPY.indexOf(z); return z === 'Kadra' ? -1 : i < 0 ? 99 : i; };
// Kolejność w zastępie: drużynowy, przyboczny, zastępowy, podzastępowy, proporcowy, apteczkowy, potem reszta alfabetycznie
const RANGI = ['druzynowy','przyboczny','zastepowy','podzastepowy','proporcowy','apteczkowy'];
const rangaOf = h => {
  const p = S.data.profiles?.find(p => norm(p.imie) === norm(`${h.imie} ${h.nazwisko}`));
  const r = p ? p.rola : S.data.funkcje?.find(f => f.harcerz_id === h.id)?.funkcja;
  const i = RANGI.indexOf(r); return i < 0 ? 99 : i;
};
const cmpHarcerz = (a,b) => zastepOrder(a.zastep) - zastepOrder(b.zastep) || rangaOf(a) - rangaOf(b) || a.nazwisko.localeCompare(b.nazwisko,'pl') || a.imie.localeCompare(b.imie,'pl');

async function loadAll(){
  const res = await Promise.all(TABLES.map(t => backend.list(t)));
  TABLES.forEach((t,i) => S.data[t] = res[i]);
  S.me = prof(S.user.id) || { id: S.user.id, imie: S.user.email, rola: 'zastepowy', zastep: '' };
}
async function mutate(fn, okMsg, after){
  try { await fn(); await loadAll(); closeSheet(); render(); if (okMsg) toast(okMsg); if (after) after(); return true; }
  catch(e){ const el = $('#sheetBody .err'); if (el && !$('#sheet').hidden) el.textContent = e.message; else toast(e.message); return false; }
}

/* =================================================================
   ARKUSZ, FORMULARZE, PLIKI
   ================================================================= */
let lastFocus = null;
function openSheet(title, html){
  if ($('#sheet').hidden) lastFocus = document.activeElement;
  $('#sheetTitle').textContent = title;
  $('#sheetBody').innerHTML = html;
  $('#sheetBody').scrollTop = 0;
  $('#sheet').hidden = false;
  document.body.style.overflow = 'hidden';
  setTimeout(() => ($('#sheetBody input:not([type=checkbox]), #sheetBody textarea') || $('#sheet .sheet-head .icon-btn')).focus({ preventScroll:true }), 60);
}
function closeSheet(){ if ($('#sheet').hidden) return; $('#sheet').hidden = true; document.body.style.overflow = ''; lastFocus?.focus?.({ preventScroll:true }); }
$('#sheet').addEventListener('click', e => { if (e.target.closest('[data-close]')) closeSheet(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });

function fieldHtml(f){
  const id = 'f_' + f.name, v = f.value ?? '', req = f.required ? ' required' : '';
  let input;
  if (f.type === 'textarea') input = `<textarea id="${id}" name="${f.name}" class="${f.cls || ''}" placeholder="${esc(f.placeholder || '')}"${req}>${esc(v)}</textarea>`;
  else if (f.type === 'select') input = `<select id="${id}" name="${f.name}"${req}>${f.options.map(o => `<option value="${esc(o.value)}" ${String(o.value) === String(v) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`;
  else input = `<input id="${id}" name="${f.name}" type="${f.type || 'text'}" value="${esc(v)}" placeholder="${esc(f.placeholder || '')}"${f.list ? ` list="${f.list}"` : ''}${req} autocomplete="${f.autocomplete || 'off'}">`;
  return `<label class="field"><span>${esc(f.label)}</span>${input}</label>`;
}
const DATALISTS = `<datalist id="stopnie">${STOPNIE.map(s => `<option value="${s}">`).join('')}</datalist><datalist id="zastepy">${['Kadra', ...ZASTEPY].map(s => `<option value="${esc(s)}">`).join('')}</datalist>`;

function openForm({ title, fields, layout, submitLabel = 'Zapisz', onSubmit, onDelete, deleteLabel = 'Usuń', extra = '' }){
  const body = layout ? layout(fieldHtml) : fields.map(fieldHtml).join('');
  openSheet(title, `<form id="sheetForm" novalidate>${body}${extra}${DATALISTS}<p class="err"></p>
    <div class="form-actions">${onDelete ? `<button type="button" class="btn danger" id="delBtn">${esc(deleteLabel)}</button>` : ''}
    <button type="submit" class="btn">${esc(submitLabel)}</button></div></form>`);
  const form = $('#sheetForm');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const vals = {};
    for (const f of fields) {
      const el = form.elements[f.name];
      vals[f.name] = f.type === 'number' ? Number(el.value) : el.value.trim();
      if (f.required && vals[f.name] === '') { form.querySelector('.err').textContent = `Uzupełnij pole: ${f.label}`; el.focus(); return; }
    }
    const btn = form.querySelector('[type=submit]'); btn.disabled = true;
    try { await onSubmit(vals, form); } finally { if (document.body.contains(btn)) btn.disabled = false; }
  });
  if (onDelete) { const del = $('#delBtn'); del.onclick = () => { if (del.dataset.armed) return onDelete(); del.dataset.armed = '1'; del.textContent = 'Na pewno? Kliknij ponownie'; }; }
}

function pickFile(input, accept){
  return new Promise(res => { input.value = ''; input.accept = accept || ''; input.onchange = () => res(input.files[0] || null); input.click(); });
}
async function openFile(path, name){
  try {
    const url = await backend.url(path, name);
    if (!url) return toast('Nie znaleziono pliku');
    const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener'; if (name) a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
  } catch(e) { toast(e.message); }
}
async function fillImages(root = document){
  for (const img of root.querySelectorAll('img[data-path]')) {
    const p = img.dataset.path;
    try { S.files[p] = S.files[p] || await backend.url(p); img.src = S.files[p]; } catch(e) {}
  }
}
async function compressImage(file, max = 2000){
  let bmp;
  try { bmp = await createImageBitmap(file); }
  catch(e) { bmp = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); }); }
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.85));
  const b64 = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(',')[1]); fr.readAsDataURL(blob); });
  return { blob, b64 };
}
const ext = name => (String(name).match(/\.([a-z0-9]{1,5})$/i)?.[1] || 'bin').toLowerCase();

/* Karty do pobrania (pliki statyczne w folderze karty/) */
const cardState = {};
async function checkCards(){
  const all = [...(CFG.KARTY_SPRAWNOSCI || []), ...(CFG.KARTY_PROB || [])];
  await Promise.all(all.map(async k => {
    if (k.plik in cardState) return;
    try { const r = await fetch(k.plik, { method:'HEAD', cache:'no-store' }); cardState[k.plik] = r.ok; } catch(e) { cardState[k.plik] = false; }
  }));
}
function cardsHtml(list){
  return `<div class="dl-grid">${(list || []).map(k => cardState[k.plik] === false
    ? `<div class="dl missing" title="Dodaj plik ${esc(k.plik)}">${ICON.down}${esc(k.nazwa)}<small>plik do dodania</small></div>`
    : `<a class="dl" href="${esc(k.plik)}" download>${ICON.down}${esc(k.nazwa)}<small>Pobierz</small></a>`).join('')}</div>`;
}

/* =================================================================
   WIDOKI
   ================================================================= */
const views = { rozkazy:vRozkazy, konspekty:vKonspekty, sprawnosci:vSprawnosci, stopnie:vStopnie, lista:vLista, wiecej:vWiecej, ksiega:vKsiega, faktury:vFaktury, skladki:vSkladki, profil:vProfil };
const NAV_OF = { ksiega:'wiecej', faktury:'wiecej', skladki:'wiecej', profil:'wiecej' };
function currentTab(){ const h = location.hash.slice(1); return views[h] ? h : 'rozkazy'; }
function render(){
  if (!S.me) return;
  const tab = currentTab(), nav = NAV_OF[tab] || tab;
  document.querySelectorAll('.tabs a').forEach(a => a.dataset.tab === nav ? a.setAttribute('aria-current','page') : a.removeAttribute('aria-current'));
  view.innerHTML = views[tab]();
  fillImages(view);
}

/* ---------- ROZKAZY ---------- */
function vRozkazy(){
  const list = [...S.data.rozkazy].sort((a,b) => String(b.data).localeCompare(String(a.data)) || String(b.created_at).localeCompare(String(a.created_at)));
  return `<div class="view-head"><div><h1>Rozkazy</h1><p>Rozkazy drużynowego</p></div>
    ${isKadra() ? `<div class="head-actions"><button class="btn" data-act="order-photo">${ICON.camera}Ze zdjęcia</button><button class="btn black" data-act="order-manual">${ICON.pen}Wpisz</button></div>` : ''}</div>
    ${list.length ? list.map((r,i) => `<article class="card order ${i ? 'collapsed' : ''}">
      <div class="order-num">${esc(r.numer || 'Rozkaz')} · ${fmtDate(r.data)}</div>
      <h3>${esc(r.tytul)}</h3>
      <div class="meta">Opublikował: ${esc(nameOf(r.autor_id))}</div>
      <div class="prose">${esc(r.tresc)}</div>
      <div class="card-foot">
        <button class="linkbtn" data-act="order-toggle">${i ? 'Czytaj całość' : 'Zwiń'}</button>
        <span class="head-actions">
          ${r.zdjecie ? `<button class="btn small ghost" data-act="order-photo-view" data-id="${r.id}">Zdjęcie oryginału</button>` : ''}
          ${isKadra() ? `<button class="btn small ghost" data-act="order-edit" data-id="${r.id}">Edytuj</button>` : ''}
        </span></div></article>`).join('')
    : `<div class="empty"><strong>Brak rozkazów</strong>${isKadra() ? 'Zrób zdjęcie rozkazu, a aplikacja go przepisze.' : 'Gdy drużynowy opublikuje rozkaz, pojawi się tutaj.'}</div>`}`;
}

async function orderFromPhoto(){
  const file = await pickFile($('#photoInput'), 'image/*');
  if (!file) return;
  openSheet('Przepisuję rozkaz…', `<div class="spinner" aria-hidden="true"></div><p style="text-align:center" class="meta">Odczytuję tekst i szukam sprawności, stopni, prób, przyjęć, przeniesień i skreśleń. To potrwa kilkanaście sekund.</p>`);
  let img;
  try {
    img = await compressImage(file);
    const parsed = await backend.ocr({ image: img.b64, mediaType: 'image/jpeg', zastepy: wszystkieZastepy() });
    orderReview(parsed, img.blob);
  } catch(e) {
    openSheet('Nie udało się przepisać', `<p class="err">${esc(e.message)}</p><p class="meta">Możesz spróbować ponownie z wyraźniejszym zdjęciem albo wpisać rozkaz ręcznie (zdjęcie zostanie dołączone).</p>
      <div class="form-actions"><button class="btn black" id="retryBtn">Inne zdjęcie</button><button class="btn" id="manualBtn">Wpisz ręcznie</button></div>`);
    $('#retryBtn').onclick = orderFromPhoto;
    $('#manualBtn').onclick = () => orderReview(emptyOrder(), img?.blob || null);
  }
}
const emptyOrder = () => ({ numer: `L. ${S.data.rozkazy.length + 1}/${new Date().getFullYear()}`, data: today(), tytul: '', tresc: '' });
const wszystkieZastepy = () => ['Kadra', ...ZASTEPY, ...new Set(S.data.harcerze.map(h => h.zastep).filter(z => z && z !== 'Kadra' && !ZASTEPY.includes(z)))];
const fixZastep = z => { const n = norm(z); if (!n) return ''; return wszystkieZastepy().find(x => norm(x) === n) || wszystkieZastepy().find(x => n.startsWith(norm(x).slice(0,4)) || norm(x).startsWith(n.slice(0,4))) || z; };

function matchHarcerz(osoba){
  const n = norm(osoba); if (!n) return null;
  const parts = n.split(' ');
  let best = null, bestScore = 0, tie = false;
  for (const h of S.data.harcerze) {
    const im = norm(h.imie), na = norm(h.nazwisko);
    let s = 0;
    if (n === `${im} ${na}` || n === `${na} ${im}`) s = 10;
    else if (parts.includes(na)) s = parts.some(p => p.slice(0,3) === im.slice(0,3)) ? 6 : 3;
    else if (parts.some(p => p.length > 3 && na.length > 3 && p.slice(0,4) === na.slice(0,4))) s = parts.some(p => p.slice(0,3) === im.slice(0,3)) ? 4 : 1;
    if (s > bestScore) { best = h; bestScore = s; tie = false; } else if (s && s === bestScore) tie = true;
  }
  return bestScore >= 3 && !tie ? best.id : null;
}

/* Zmiany wykryte w rozkazie: przyjęcia, przeniesienia, sprawności, stopnie, próby, skreślenia */
function buildChanges(p){
  const przyj = (p.przyjecia || []).map((x,j) => ({ kind:'przyj', osoba:x.osoba, zastep: fixZastep(x.zastep), key:'n' + j }));
  const nowy = osoba => przyj.find(c => norm(c.osoba) === norm(osoba))?.key || null;
  const who = osoba => matchHarcerz(osoba) ?? nowy(osoba);
  return [
    ...przyj,
    ...(p.przeniesienia || []).map(x => ({ kind:'przen', osoba:x.osoba, zastep: fixZastep(x.zastep), hid: matchHarcerz(x.osoba) })),
    ...(p.sprawnosci || []).map(x => { const k = matchKatalog(x.nazwa); return { kind:'spr', osoba:x.osoba, nazwa: k ? k.nazwa : x.nazwa, poziom: k ? k.poziom : Math.min(3, Math.max(1, Number(x.poziom) || 1)), inKat: !!k, hid: who(x.osoba) }; }),
    ...(p.stopnie || []).map(x => ({ kind:'stop', osoba:x.osoba, stopien: fixStopien(x.stopien), hid: who(x.osoba) })),
    ...(p.proby || []).map(x => ({ kind:'proba', osoba:x.osoba, stopien: fixStopien(x.stopien), hid: who(x.osoba) })),
    ...(p.skreslenia || []).map(x => ({ kind:'skresl', osoba:x.osoba, hid: matchHarcerz(x.osoba) }))
  ];
}
function changesHtml(changes){
  if (!changes.length) return `<p class="meta">Nie wykryto zmian dotyczących harcerzy. Jeśli rozkaz je zawiera, popraw treść i stuknij „Wykryj zmiany z treści”.</p>`;
  const przyj = changes.filter(c => c.kind === 'przyj');
  const harcOpts = (hid, withNew = true) => `<option value="">— wybierz harcerza —</option>`
    + (withNew ? przyj.map(c => `<option value="${c.key}" ${c.key === hid ? 'selected' : ''}>Nowy: ${esc(c.osoba)}</option>`).join('') : '')
    + [...S.data.harcerze].sort((a,b) => a.nazwisko.localeCompare(b.nazwisko,'pl'))
      .map(h => `<option value="${h.id}" ${h.id === hid ? 'selected' : ''}>${esc(h.nazwisko + ' ' + h.imie)}${h.zastep ? ' (' + esc(h.zastep) + ')' : ''}</option>`).join('');
  const zOpts = z => `<option value="">— wybierz zastęp —</option>` + [...new Set([...wszystkieZastepy(), ...(z ? [z] : [])])].map(x => `<option ${x === z ? 'selected' : ''}>${esc(x)}</option>`).join('');
  const LABEL = {
    przyj: c => `Przyjęcie do drużyny`,
    przen: c => `Przeniesienie do zastępu`,
    skresl: c => `<span style="color:var(--red-ink)">Skreślenie z listy harcerzy</span>`,
    spr: c => `Sprawność: ${esc(c.nazwa)} <span class="stars">${stars(c.poziom)}</span>${c.inKat ? '' : ' <span class="pill">spoza katalogu</span>'}`,
    stop: c => `Stopień: ${esc(c.stopien)}`,
    proba: c => `Otwarcie próby: ${esc(c.stopien)}`
  };
  const ok = c => c.kind === 'przyj' ? (c.osoba && c.osoba.trim().includes(' ')) : (c.kind === 'przen' ? c.hid && c.zastep : !!c.hid);
  return `<p class="meta" style="margin-top:-4px">Zaznaczone zmiany wejdą w życie po publikacji – w listach harcerzy, sprawnościach i stopniach. Sprawdź dopasowania.</p>
    ${changes.map((c,i) => {
      const found = c.kind === 'przyj' || c.hid;
      const pendNote = c.kind === 'spr' && typeof c.hid === 'number' && S.data.sprawnosci.some(x => x.harcerz_id === c.hid && x.status === 'do_zamkniecia' && norm(x.nazwa) === norm(c.nazwa)) ? ' – <b>zamknie oczekującą sprawność</b>' : '';
      const controls = c.kind === 'przyj'
        ? `<div class="two" style="margin-top:6px"><input id="chn${i}" value="${esc(c.osoba)}" aria-label="Imię i nazwisko"><select id="chz${i}" aria-label="Zastęp">${zOpts(c.zastep)}</select></div>`
        : c.kind === 'przen'
        ? `<select id="chh${i}" aria-label="Harcerz">${harcOpts(c.hid, false)}</select><select id="chz${i}" aria-label="Nowy zastęp">${zOpts(c.zastep)}</select>`
        : `<select id="chh${i}" aria-label="Harcerz">${harcOpts(c.hid, c.kind !== 'skresl')}</select>`;
      return `<div class="change${c.kind === 'skresl' ? ' danger' : ''}"><input type="checkbox" id="ch${i}" ${ok(c) ? 'checked' : ''} aria-label="Wprowadź zmianę">
        <div><label for="ch${i}" class="what">${LABEL[c.kind](c)}</label>
        <div class="meta">W rozkazie: ${esc(c.osoba)}${c.zastep && c.kind !== 'spr' ? ' → ' + esc(c.zastep) : ''}${found ? '' : ' – <b style="color:var(--red-ink)">nie znaleziono na liście harcerzy</b>'}${pendNote}${c.kind === 'skresl' ? ' – usuwa też jego sprawności, próby i funkcję' : ''}</div>
        ${controls}</div></div>`;
    }).join('')}`;
}

function orderReview(p, blob){
  let changes = buildChanges(p);
  const previewUrl = blob ? URL.createObjectURL(blob) : '';
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(p.data || '') ? p.data : today();
  const tytul = p.tytul || (p.numer ? `Rozkaz drużyny ${p.numer}` : '');
  openForm({
    title: blob && (p.tresc || p.tytul) ? 'Sprawdź przepisany rozkaz' : 'Nowy rozkaz',
    fields: [
      { name:'numer', label:'Numer', value:p.numer },
      { name:'data', label:'Data', type:'date', value: dateOk, required:true },
      { name:'tytul', label:'Tytuł', value: tytul, required:true },
      { name:'tresc', label:'Treść rozkazu', type:'textarea', value:p.tresc, required:true }
    ],
    layout: F => `${blob ? `<details style="margin-bottom:14px"><summary class="linkbtn" style="cursor:pointer">Pokaż zdjęcie</summary><img class="photo-prev" src="${previewUrl}" alt="Zdjęcie rozkazu"></details>` : ''}
      <div class="two">${F({ name:'numer', label:'Numer', value:p.numer })}${F({ name:'data', label:'Data', type:'date', value: dateOk })}</div>
      ${F({ name:'tytul', label:'Tytuł', value: tytul, placeholder:'np. Rozkaz drużyny L. 5/2026' })}
      ${F({ name:'tresc', label:'Treść rozkazu – popraw ewentualne błędy', type:'textarea', cls:'tall', value:p.tresc })}`,
    extra: `<div class="section-title">Zmiany do wprowadzenia</div><div id="changesBox">${changesHtml(changes)}</div>
      <button type="button" class="btn black wide" id="detectBtn" style="margin:10px 0 4px">Wykryj zmiany z treści</button>`,
    submitLabel: 'Opublikuj rozkaz',
    onSubmit: async (v, form) => {
      const err = form.querySelector('.err');
      changes.forEach((c,i) => {
        c.on = form.querySelector('#ch' + i).checked;
        const hv = form.querySelector('#chh' + i)?.value || '';
        c.hidVal = hv.startsWith('n') ? hv : (Number(hv) || null);
        if (form.querySelector('#chz' + i)) c.zastep = form.querySelector('#chz' + i).value;
        if (form.querySelector('#chn' + i)) c.osoba = form.querySelector('#chn' + i).value.trim();
      });
      for (const c of changes.filter(c => c.on)) {
        if (c.kind === 'przyj' && !/\S+\s+\S+/.test(c.osoba)) { err.textContent = `Podaj imię i nazwisko przyjmowanego harcerza.`; return; }
        if (c.kind !== 'przyj' && !c.hidVal) { err.textContent = `Wybierz harcerza dla: ${c.osoba} albo odznacz tę zmianę.`; return; }
        if (c.kind === 'przen' && !c.zastep) { err.textContent = `Wybierz zastęp dla przeniesienia: ${c.osoba}.`; return; }
        if (c.kind !== 'przyj' && String(c.hidVal).startsWith('n') && !changes.find(x => x.key === c.hidVal && x.on)) { err.textContent = `Zaznacz też przyjęcie osoby: ${c.osoba}.`; return; }
      }
      let applied = 0;
      await mutate(async () => {
        const row = { numer:v.numer, data:v.data, tytul:v.tytul, tresc:v.tresc };
        if (blob) { try { row.zdjecie = await backend.upload(`rozkazy/${Date.now()}.jpg`, blob); } catch(e) {} }
        const r = await backend.insert('rozkazy', row);
        const nowi = {};
        const hidOf = c => typeof c.hidVal === 'string' ? nowi[c.hidVal] : c.hidVal;
        const on = k => changes.filter(c => c.on && c.kind === k);
        for (const c of on('przyj')) {
          const [imie, ...rest] = c.osoba.split(/\s+/);
          const h = await backend.insert('harcerze', { imie, nazwisko: rest.join(' '), zastep: c.zastep || '', stopien: '' });
          nowi[c.key] = h.id; applied++;
        }
        for (const c of on('przen')) { await backend.update('harcerze', hidOf(c), { zastep: c.zastep }); applied++; }
        for (const c of on('spr')) {
          const hid = hidOf(c), ex = S.data.sprawnosci.find(x => x.harcerz_id === hid && norm(x.nazwa) === norm(c.nazwa));
          if (ex) await backend.update('sprawnosci', ex.id, { status:'przyznana', data:v.data, rozkaz_id:r.id });
          else await backend.insert('sprawnosci', { harcerz_id:hid, nazwa:c.nazwa, poziom:c.poziom, status:'przyznana', data:v.data, rozkaz_id:r.id });
          applied++;
        }
        for (const c of on('stop')) {
          const hid = hidOf(c);
          await backend.update('harcerze', hid, { stopien:c.stopien });
          for (const pr of S.data.proby.filter(x => x.harcerz_id === hid && x.status === 'otwarta' && norm(x.stopien) === norm(c.stopien)))
            await backend.update('proby', pr.id, { status:'zamknieta' });
          applied++;
        }
        for (const c of on('proba')) { await backend.insert('proby', { harcerz_id:hidOf(c), stopien:c.stopien, data_otwarcia:v.data, status:'otwarta', rozkaz_id:r.id }); applied++; }
        for (const c of on('skresl')) { await usunHarcerza(hidOf(c)); applied++; }
      }, null, () => toast(applied ? `Opublikowano rozkaz i wprowadzono zmian: ${applied}` : 'Opublikowano rozkaz'));
    }
  });
  $('#detectBtn').onclick = async () => {
    const btn = $('#detectBtn'), text = $('#f_tresc').value.trim(), err = $('#sheetForm .err');
    if (!text) { err.textContent = 'Najpierw wpisz treść rozkazu.'; return; }
    btn.disabled = true; btn.textContent = 'Analizuję treść…'; err.textContent = '';
    try {
      const res = await backend.ocr({ text, zastepy: wszystkieZastepy() });
      changes = buildChanges(res);
      $('#changesBox').innerHTML = changesHtml(changes);
      if (!$('#f_numer').value && res.numer) $('#f_numer').value = res.numer;
      if (!$('#f_tytul').value && res.tytul) $('#f_tytul').value = res.tytul;
      toast(changes.length ? `Wykryto zmian: ${changes.length}` : 'Nie wykryto zmian');
    } catch(e) { err.textContent = e.message; }
    btn.disabled = false; btn.textContent = 'Wykryj zmiany z treści';
  };
}

/* Usunięcie harcerza: znika z listy, księgi sprawności i stopni (baza kasuje jego sprawności, próby i funkcję) */
async function usunHarcerza(hid){
  for (const pr of S.data.proby.filter(x => x.harcerz_id === hid && x.plik)) { try { await backend.removeFile(pr.plik); } catch(e) {} }
  await backend.remove('harcerze', hid);
}
function orderEdit(r){
  openForm({
    title: 'Edytuj rozkaz',
    fields: [
      { name:'numer', label:'Numer', value:r.numer }, { name:'data', label:'Data', type:'date', value:r.data, required:true },
      { name:'tytul', label:'Tytuł', value:r.tytul, required:true }, { name:'tresc', label:'Treść', type:'textarea', cls:'tall', value:r.tresc, required:true }
    ],
    extra: `<p class="meta">Edycja tekstu nie zmienia już wprowadzonych sprawności i stopni – te poprawisz w ich zakładkach.</p>`,
    onSubmit: v => mutate(() => backend.update('rozkazy', r.id, v), 'Zapisano rozkaz'),
    onDelete: () => mutate(async () => { await backend.remove('rozkazy', r.id); await backend.removeFile(r.zdjecie); }, 'Usunięto rozkaz')
  });
}

/* ---------- KONSPEKTY ---------- */
function vKonspekty(){
  const all = S.data.konspekty.filter(k => !S.planZastep || k.zastep === S.planZastep);
  const pend = all.filter(k => k.status === 'oczekuje').sort((a,b) => String(a.data).localeCompare(String(b.data)));
  const ok = all.filter(k => k.status === 'zatwierdzony').sort((a,b) => String(b.data).localeCompare(String(a.data)));
  const list = S.planTab === 'oczekuje' ? pend : ok;
  const canAdd = S.me.rola === 'zastepowy';
  return `<div class="view-head"><div><h1>Konspekty</h1><p>${isKadra() ? 'Plany zbiórek zastępów do zatwierdzenia' : 'Plany zbiórek zastępów'}</p></div>
    ${canAdd ? `<button class="btn" data-act="plan-new">${ICON.plus}Nowy konspekt</button>` : ''}</div>
    <div class="seg" role="group" aria-label="Status">
      <button data-act="plan-tab" data-v="oczekuje" aria-pressed="${S.planTab === 'oczekuje'}">Do zatwierdzenia (${pend.length})</button>
      <button data-act="plan-tab" data-v="zatwierdzony" aria-pressed="${S.planTab !== 'oczekuje'}">Zatwierdzone (${ok.length})</button></div>
    <div class="filters"><select id="planZastep" aria-label="Zastęp"><option value="">Wszystkie zastępy</option>${ZASTEPY.map(z => `<option ${z === S.planZastep ? 'selected' : ''}>${esc(z)}</option>`).join('')}</select></div>
    ${list.length ? list.map(k => `<article class="card tap plan" data-act="plan-open" data-id="${k.id}" tabindex="0" role="button">
      <div class="when">${fmtShort(k.data)} · <span class="nowrap">${hm(k.godz_od)}–${hm(k.godz_do)}</span></div>
      <h3>${esc(k.temat)}</h3>
      <div class="meta">${esc(k.miejsce)}${k.miejsce ? ' · ' : ''}Zastęp ${esc(k.zastep || '—')} · ${esc(nameOf(k.autor_id))}</div>
      <div style="margin-top:8px">${k.status === 'zatwierdzony' ? `<span class="pill ok">Zatwierdzony</span>` : `<span class="pill wait">Czeka na zatwierdzenie</span>`}
      ${k.autor_id === S.me.id ? ' <span class="pill">Twój</span>' : ''}</div></article>`).join('')
    : `<div class="empty"><strong>${S.planTab === 'oczekuje' ? 'Nic nie czeka na zatwierdzenie' : 'Brak zatwierdzonych konspektów'}</strong>${canAdd && S.planTab === 'oczekuje' ? 'Dodaj konspekt najbliższej zbiórki zastępu.' : ''}</div>`}`;
}
function planText(k){ return `${k.temat}\nZastęp ${k.zastep} – ${nameOf(k.autor_id)}\n${fmtDate(k.data)}, ${hm(k.godz_od)}–${hm(k.godz_do)}\nMiejsce: ${k.miejsce}\n\nPRZEBIEG:\n${k.przebieg}`; }
function planOpen(k){
  const mine = k.autor_id === S.me.id, pending = k.status === 'oczekuje';
  openSheet(k.temat, `
    <div style="margin-bottom:10px">${pending ? '<span class="pill wait">Czeka na zatwierdzenie</span>' : `<span class="pill ok">Zatwierdzony</span> <span class="meta">przez ${esc(nameOf(k.zatwierdzil))}</span>`}</div>
    <div class="detail-grid">
      <div><b>Data</b>${fmtDate(k.data)}</div><div><b>Godziny</b>${hm(k.godz_od)}–${hm(k.godz_do)}</div>
      <div><b>Miejsce</b>${esc(k.miejsce || '—')}</div><div><b>Zastęp</b>${esc(k.zastep || '—')} · ${esc(nameOf(k.autor_id))}</div></div>
    <div class="field"><span>Przebieg zbiórki</span><div class="prose card" style="margin:0">${esc(k.przebieg || '—')}</div></div>
    <div class="form-actions">
      <button class="btn ghost" id="copyPlan">Kopiuj tekst</button>
      ${mine && pending ? `<button class="btn black" id="editPlan">Edytuj</button>` : ''}
      ${isKadra() ? (pending ? `<button class="btn" id="approvePlan">Zatwierdź</button>` : `<button class="btn black" id="unapprovePlan">Cofnij zatwierdzenie</button>`) : ''}
    </div>
    ${(mine && pending) || isKadra() ? `<button class="btn danger wide" style="margin-top:10px" id="delPlan">Usuń konspekt</button>` : ''}
    ${mine && !pending ? `<p class="meta" style="margin-top:12px">Zatwierdzonego konspektu nie można już edytować. Jeśli trzeba coś zmienić, poproś kadrę o cofnięcie zatwierdzenia.</p>` : ''}`);
  $('#copyPlan').onclick = async () => { try { await navigator.clipboard.writeText(planText(k)); toast('Skopiowano konspekt'); } catch(e) { toast('Nie udało się skopiować'); } };
  if ($('#editPlan')) $('#editPlan').onclick = () => planForm(k);
  if ($('#approvePlan')) $('#approvePlan').onclick = () => mutate(() => backend.update('konspekty', k.id, { status:'zatwierdzony' }), 'Zatwierdzono konspekt');
  if ($('#unapprovePlan')) $('#unapprovePlan').onclick = () => mutate(() => backend.update('konspekty', k.id, { status:'oczekuje' }), 'Cofnięto zatwierdzenie');
  const del = $('#delPlan');
  if (del) del.onclick = () => { if (!del.dataset.armed) { del.dataset.armed = 1; del.textContent = 'Na pewno? Kliknij ponownie'; return; } mutate(() => backend.remove('konspekty', k.id), 'Usunięto konspekt'); };
}
function planForm(k){
  const fields = [
    { name:'data', label:'Data zbiórki', type:'date', value:k?.data ?? '', required:true },
    { name:'godz_od', label:'Początek', type:'time', value:hm(k?.godz_od) || '10:00', required:true },
    { name:'godz_do', label:'Koniec', type:'time', value:hm(k?.godz_do) || '12:00', required:true },
    { name:'miejsce', label:'Miejsce zbiórki', value:k?.miejsce, required:true, placeholder:'np. Harcówka' },
    { name:'temat', label:'Temat', value:k?.temat, required:true, placeholder:'np. Terenoznawstwo – azymuty' },
    { name:'przebieg', label:'Przebieg zbiórki', type:'textarea', cls:'tall', value:k?.przebieg ?? '', required:true, placeholder:'Opisz punkt po punkcie, co będzie się działo na zbiórce…' }
  ];
  openForm({
    title: k ? 'Edytuj konspekt' : 'Nowy konspekt',
    fields,
    layout: F => `<div class="three">${F(fields[0])}${F(fields[1])}${F(fields[2])}</div>${F(fields[3])}${F(fields[4])}${F(fields[5])}`,
    submitLabel: k ? 'Zapisz zmiany' : 'Opublikuj konspekt',
    onSubmit: async (v, form) => {
      if (v.godz_do <= v.godz_od) { form.querySelector('.err').textContent = 'Godzina zakończenia musi być późniejsza niż rozpoczęcia.'; return; }
      S.planTab = 'oczekuje';
      await mutate(() => k ? backend.update('konspekty', k.id, v) : backend.insert('konspekty', v), k ? 'Zapisano konspekt' : 'Opublikowano – czeka na zatwierdzenie');
    }
  });
}

/* ---------- KSIĘGA SPRAWNOŚCI ---------- */
const katOf = nazwa => S.data.katalog.find(k => norm(k.nazwa) === norm(nazwa));
const katalogSorted = () => [...S.data.katalog].sort((a,b) => (a.kolejnosc - b.kolejnosc) || a.nazwa.localeCompare(b.nazwa,'pl'));
function katalogTree(){
  const tree = new Map();
  for (const k of katalogSorted()) {
    if (!tree.has(k.kategoria)) tree.set(k.kategoria, new Map());
    const g = tree.get(k.kategoria);
    if (!g.has(k.galaz)) g.set(k.galaz, []);
    g.get(k.galaz).push(k);
  }
  return tree;
}
function matchKatalog(nazwa){
  const n = norm(nazwa); if (!n) return null;
  const exact = S.data.katalog.find(k => norm(k.nazwa) === n);
  if (exact) return exact;
  const pre = S.data.katalog.filter(k => n.length > 4 && norm(k.nazwa).startsWith(n.slice(0,5)));
  return pre.length === 1 ? pre[0] : null;
}
function harcerzeFiltered(){
  const q = norm(S.q);
  return S.data.harcerze.filter(h => (!q || norm(fullName(h)).includes(q)) && (!S.zastep || h.zastep === S.zastep))
    .sort(cmpHarcerz);
}
function filtersHtml(){
  const zs = ['Kadra', ...ZASTEPY, ...new Set(S.data.harcerze.map(h => h.zastep).filter(z => z && z !== 'Kadra' && !ZASTEPY.includes(z)))];
  return `<div class="filters"><input type="search" id="qSearch" placeholder="Szukaj harcerza…" value="${esc(S.q)}" aria-label="Szukaj harcerza">
    <select id="qZastep" aria-label="Zastęp"><option value="">Wszystkie zastępy</option>${zs.map(z => `<option ${z === S.zastep ? 'selected' : ''}>${esc(z)}</option>`).join('')}</select></div>`;
}
const zastepLabel = z => z === 'Kadra' ? 'Kadra' : z ? 'Zastęp ' + z : 'Bez zastępu';
function grouped(list, rowFn){
  let html = '', g = null;
  for (const h of list) { if (h.zastep !== g) { g = h.zastep; html += `<div class="group-title">${esc(zastepLabel(g))}</div>`; } html += rowFn(h); }
  return html || `<div class="empty"><strong>Nikogo nie znaleziono</strong>${S.data.harcerze.length ? 'Zmień wyszukiwanie lub filtr.' : (isKadra() ? 'Dodaj pierwszego harcerza.' : '')}</div>`;
}
const countStars = list => [1,2,3].map(n => list.filter(s => s.poziom === n && s.status !== 'do_zamkniecia').length);

function vSprawnosci(){
  const mode = S.ksMode === 'katalog' ? 'katalog' : 'harcerze';
  const seg = `<div class="seg" role="group" aria-label="Widok księgi">
    ${[['harcerze','Harcerze'],['katalog','Katalog']].map(([v,l]) => `<button data-act="ks-mode" data-v="${v}" aria-pressed="${mode === v}">${l}</button>`).join('')}</div>`;
  const head = `<div class="view-head"><div><h1>Księga sprawności</h1><p>${S.data.harcerze.length} harcerzy · ${S.data.sprawnosci.filter(s => s.status !== 'do_zamkniecia').length} zdobytych sprawności</p></div>
    ${isKadra() && mode === 'katalog' ? `<button class="btn" data-act="kat-new">${ICON.plus}Do katalogu</button>` : ''}</div>`;
  if (mode === 'katalog') return head + seg + ksKatalog();
  return head + seg + `<details class="cards-box"><summary class="section-title" style="cursor:pointer;margin-top:0">Karty sprawności do pobrania</summary>${cardsHtml(CFG.KARTY_SPRAWNOSCI)}</details>`
    + filtersHtml() + grouped(harcerzeFiltered(), h => {
      const b = badgesOf(h.id), [c1,c2,c3] = countStars(b);
      return `<article class="card tap person" data-act="badges" data-id="${h.id}" tabindex="0" role="button">
        <div class="avatar">${esc(initials(fullName(h)))}</div>
        <div><h3>${esc(fullName(h))}</h3><div class="meta">${esc(h.stopien || 'bez stopnia')} · <span class="nowrap">★ ${c1}</span> · <span class="nowrap">★★ ${c2}</span> · <span class="nowrap">★★★ ${c3}</span></div></div>
        <div class="count">${b.filter(s => s.status !== 'do_zamkniecia').length}<small>sprawności</small></div></article>`;
    });
}

/* Katalog wszystkich sprawności */
function ksKatalog(){
  const q = norm(S.kq || '');
  const holders = nazwa => S.data.sprawnosci.filter(s => norm(s.nazwa) === norm(nazwa) && s.status !== 'do_zamkniecia').length;
  let html = `<div class="filters"><input type="search" id="kqSearch" placeholder="Szukaj sprawności…" value="${esc(S.kq || '')}" aria-label="Szukaj sprawności"></div>`;
  let any = false;
  for (const [kat, gal] of katalogTree()) {
    let inner = '';
    for (const [g, items] of gal) {
      const its = items.filter(k => !q || norm(k.nazwa).includes(q) || norm(g).includes(q));
      if (!its.length) continue;
      inner += `<div class="branch"><div class="branch-name">${esc(g)}</div><div class="chips">${its.map(k =>
        `<button class="bdg lv${k.poziom || 0}" data-act="kat-open" data-id="${k.id}">${esc(k.nazwa)}${k.poziom ? ' <i>' + stars(k.poziom) + '</i>' : ''} <small>${holders(k.nazwa) || ''}</small></button>`).join('')}</div></div>`;
    }
    if (!inner) continue; any = true;
    html += `<section class="kat-sec" style="--c:${KATEGORIE[kat] || '#777'}"><h3 class="kat-title">${esc(kat)}</h3>${inner}</section>`;
  }
  return html + (any ? '' : `<div class="empty"><strong>Brak wyników</strong>${S.data.katalog.length ? '' : 'Katalog jest pusty – uruchom plik ksiega_sprawnosci.sql.'}</div>`);
}
function katOpen(id){
  const k = byId('katalog', id); if (!k) return;
  const who = S.data.sprawnosci.filter(s => norm(s.nazwa) === norm(k.nazwa)).map(s => ({ s, h: byId('harcerze', s.harcerz_id) })).filter(x => x.h)
    .sort((a,b) => cmpHarcerz(a.h, b.h));
  openSheet(k.nazwa, `<div class="meta">${esc(k.kategoria)} · ${esc(k.galaz)}${k.poziom ? ` · <span class="stars">${stars(k.poziom)}</span>` : ''}</div>
    <div class="section-title">Zdobyli (${who.filter(x => x.s.status !== 'do_zamkniecia').length})</div>
    ${who.length ? who.map(({s,h}) => `<div class="row"><div><b>${esc(fullName(h))}</b><div class="meta">${esc(zastepLabel(h.zastep))}${s.data ? ' · ' + fmtDate(s.data) : ''}</div></div>
      ${s.status === 'do_zamkniecia' ? '<span class="bdg lv1 pend">do zamknięcia</span>' : ''}</div>`).join('') : '<p class="meta">Nikt jeszcze nie zdobył tej sprawności.</p>'}
    ${isKadra() ? `<button class="btn ghost wide" style="margin-top:14px" data-act="kat-edit" data-id="${k.id}">Edytuj pozycję katalogu</button>` : ''}`);
}
function katForm(k){
  const kats = [...new Set([...Object.keys(KATEGORIE), ...S.data.katalog.map(x => x.kategoria)])];
  const gal = [...new Set(S.data.katalog.map(x => x.galaz))].sort((a,b) => a.localeCompare(b,'pl'));
  openForm({
    title: k ? 'Edytuj pozycję katalogu' : 'Nowa sprawność w katalogu',
    fields: [
      { name:'nazwa', label:'Nazwa sprawności', value:k?.nazwa, required:true },
      { name:'kategoria', label:'Kategoria', type:'select', value:k?.kategoria ?? kats[0], options: kats.map(x => ({ value:x, label:x })) },
      { name:'galaz', label:'Ścieżka (np. Rozpalanie Ognia)', value:k?.galaz, list:'galezie', required:true },
      { name:'poziom', label:'Gwiazdki', type:'select', value:k?.poziom ?? 1, options:[{value:1,label:'★'},{value:2,label:'★★'},{value:3,label:'★★★'},{value:'',label:'bez gwiazdek (wyczyn, pagon, okazjonalna)'}] }
    ],
    extra: `<datalist id="galezie">${gal.map(g => `<option value="${esc(g)}">`).join('')}</datalist>`,
    onSubmit: v => { v.poziom = v.poziom ? Number(v.poziom) : null; if (!k) v.kolejnosc = Math.max(0, ...S.data.katalog.filter(x => x.galaz === v.galaz).map(x => x.kolejnosc)) + 1;
      return mutate(() => k ? backend.update('katalog', k.id, v) : backend.insert('katalog', v), 'Zapisano w katalogu'); },
    onDelete: k && (() => mutate(() => backend.remove('katalog', k.id), 'Usunięto z katalogu'))
  });
}

/* Karta harcerza w księdze: tylko kategorie, w których ma sprawności */
function badgesOpen(hid){
  const h = byId('harcerze', hid); if (!h) return;
  const b = badgesOf(h.id), k = isKadra();
  const order = katalogSorted();
  const pos = s => { const i = order.findIndex(x => norm(x.nazwa) === norm(s.nazwa)); return i < 0 ? 1e6 : i; };
  const groups = new Map();
  for (const s of [...b].sort((x,y) => pos(x) - pos(y))) {
    const kat = katOf(s.nazwa)?.kategoria || 'Inne';
    if (!groups.has(kat)) groups.set(kat, []);
    groups.get(kat).push(s);
  }
  const chip = s => k ? `<button class="bdg lv${s.poziom || 0}${s.status === 'do_zamkniecia' ? ' pend' : ''}" data-act="badge-edit" data-id="${s.id}">${esc(s.nazwa)}${s.poziom ? ' <i>' + stars(s.poziom) + '</i>' : ''}</button>` : starChip(s);
  const pend = b.filter(s => s.status === 'do_zamkniecia').length;
  const [c1,c2,c3] = countStars(b);
  openSheet(fullName(h), `<div class="meta">${esc(zastepLabel(h.zastep))} · ${esc(h.stopien || 'bez stopnia')} · ★ ${c1} · ★★ ${c2} · ★★★ ${c3}</div>
    ${k ? `<button class="btn wide" style="margin:14px 0 4px" data-act="badge-add" data-id="${h.id}">${ICON.plus}Dodaj sprawności</button>` : ''}
    ${pend ? `<p class="meta">Sprawności w przerywanej ramce czekają na zamknięcie rozkazem (${pend}).</p>` : ''}
    ${groups.size ? [...groups].map(([kat, list]) => `<section class="kat-sec" style="--c:${KATEGORIE[kat] || '#777'}">
      <h3 class="kat-title">${esc(kat)} <span class="meta" style="font-family:inherit">(${list.length})</span></h3><div class="chips">${list.map(chip).join('')}</div></section>`).join('')
      : '<p class="meta" style="margin-top:14px">Ten harcerz nie ma jeszcze sprawności.</p>'}`);
}
/* Dodawanie wielu sprawności naraz: zaznaczasz w katalogu i zapisujesz jednym przyciskiem */
function badgeMultiForm(hid){
  const h = byId('harcerze', hid); if (!h) return;
  const ma = new Set(badgesOf(h.id).map(s => norm(s.nazwa)));
  let lista = '';
  for (const [kat, gal] of katalogTree()) {
    const items = [...gal.values()].flat();
    lista += `<section class="ms-kat" style="--c:${KATEGORIE[kat] || '#777'}"><h3 class="kat-title">${esc(kat)}</h3>${items.map(i => {
      const owned = ma.has(norm(i.nazwa));
      return `<label class="ms-item${owned ? ' owned' : ''}" data-q="${esc(norm(i.nazwa + ' ' + i.galaz))}">
        <input type="checkbox" value="${i.id}" ${owned ? 'disabled' : ''}>
        <span><b>${esc(i.nazwa)}</b> ${i.poziom ? `<span class="stars">${stars(i.poziom)}</span>` : ''}<small>${i.galaz !== kat ? esc(i.galaz) : ''}${owned ? (i.galaz !== kat ? ' · ' : '') + 'już ma' : ''}</small></span></label>`;
    }).join('')}</section>`;
  }
  openSheet(`Dodaj sprawności: ${fullName(h)}`, `<form id="msForm" novalidate>
    <input type="search" id="msSearch" placeholder="Szukaj sprawności lub ścieżki…" aria-label="Szukaj sprawności" style="margin-bottom:10px">
    <div class="ms-list">${lista || '<p class="meta">Katalog jest pusty.</p>'}</div>
    <details class="ms-custom"><summary class="linkbtn" style="cursor:pointer">+ Sprawność spoza katalogu</summary>
      <div class="two" style="margin-top:8px">${fieldHtml({ name:'c_nazwa', label:'Nazwa', placeholder:'np. Jerycho 2027' })}${fieldHtml({ name:'c_poziom', label:'Gwiazdki', type:'select', value:1, options:[{value:1,label:'★'},{value:2,label:'★★'},{value:3,label:'★★★'},{value:'',label:'bez gwiazdek'}] })}</div></details>
    <div class="two" style="margin-top:12px">
      ${fieldHtml({ name:'status', label:'Status', type:'select', value:'przyznana', options:[{value:'przyznana',label:'Przyznana'},{value:'do_zamkniecia',label:'Do zamknięcia rozkazem'}] })}
      ${fieldHtml({ name:'data', label:'Data (opcjonalnie)', type:'date', value: today() })}</div>
    <p class="err"></p>
    <div class="ms-bar"><button type="submit" class="btn wide" id="msSubmit" disabled>Zaznacz sprawności</button></div></form>`);
  const form = $('#msForm'), btn = $('#msSubmit');
  const ile = () => form.querySelectorAll('.ms-list input:checked').length + (form.elements.c_nazwa.value.trim() ? 1 : 0);
  const odswiez = () => { const n = ile(); btn.disabled = !n; btn.textContent = n ? `Dodaj zaznaczone (${n})` : 'Zaznacz sprawności'; };
  form.addEventListener('change', odswiez);
  form.elements.c_nazwa.addEventListener('input', odswiez);
  $('#msSearch').addEventListener('input', e => {
    const q = norm(e.target.value);
    form.querySelectorAll('.ms-item').forEach(el => el.hidden = !!q && !el.dataset.q.includes(q));
    form.querySelectorAll('.ms-kat').forEach(sec => sec.hidden = ![...sec.querySelectorAll('.ms-item')].some(el => !el.hidden));
  });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const status = form.elements.status.value, data = form.elements.data.value || null;
    const rows = [...form.querySelectorAll('.ms-list input:checked')].map(c => byId('katalog', c.value)).filter(Boolean)
      .map(k => ({ harcerz_id: h.id, nazwa: k.nazwa, poziom: k.poziom, status, data }));
    const cn = form.elements.c_nazwa.value.trim();
    if (cn) {
      if (ma.has(norm(cn)) || rows.some(r => norm(r.nazwa) === norm(cn))) { form.querySelector('.err').textContent = 'Ten harcerz ma już sprawność o tej nazwie.'; return; }
      rows.push({ harcerz_id: h.id, nazwa: cn, poziom: form.elements.c_poziom.value ? Number(form.elements.c_poziom.value) : null, status, data });
    }
    if (!rows.length) return;
    btn.disabled = true; btn.textContent = 'Zapisuję…';
    const ok = await mutate(() => backend.insertMany('sprawnosci', rows), `Dodano sprawności: ${rows.length}`, () => badgesOpen(h.id));
    if (!ok) odswiez();
  });
}

function badgeForm(hid, s, preset){
  const items = katalogSorted();
  const cur = s ? katOf(s.nazwa) : preset;
  const opts = [{ value:'', label:'— inna, spoza katalogu —' }];
  const byKat = new Map(); items.forEach(i => { if (!byKat.has(i.kategoria)) byKat.set(i.kategoria, []); byKat.get(i.kategoria).push(i); });
  const select = `<label class="field"><span>Sprawność z księgi</span><select id="f_kat" name="kat">${opts.map(o => `<option value="">${o.label}</option>`).join('')}
    ${[...byKat].map(([kat, its]) => `<optgroup label="${esc(kat)}">${its.map(i => `<option value="${i.id}" ${cur && cur.id === i.id ? 'selected' : ''}>${esc(i.galaz !== kat ? i.galaz + ' – ' : '')}${esc(i.nazwa)} ${stars(i.poziom)}</option>`).join('')}</optgroup>`).join('')}</select></label>`;
  const fields = [
    { name:'kat', label:'Sprawność z księgi' },
    { name:'nazwa', label:'Nazwa (gdy spoza katalogu)', value: cur ? '' : s?.nazwa },
    { name:'poziom', label:'Gwiazdki (gdy spoza katalogu)', type:'select', value: s?.poziom ?? 1, options:[{value:1,label:'★'},{value:2,label:'★★'},{value:3,label:'★★★'},{value:'',label:'bez gwiazdek'}] },
    { name:'status', label:'Status', type:'select', value: s?.status ?? 'przyznana', options:[{value:'przyznana',label:'Przyznana (zamknięta rozkazem)'},{value:'do_zamkniecia',label:'Do zamknięcia rozkazem'}] },
    { name:'data', label:'Data przyznania (opcjonalnie)', type:'date', value: s ? (s.data || '') : today() }
  ];
  openForm({
    title: s ? 'Edytuj sprawność' : `Sprawność: ${fullName(byId('harcerze', hid))}`,
    fields,
    layout: F => `${select}<div id="customBox" ${cur ? 'hidden' : ''}><div class="two">${F(fields[1])}${F(fields[2])}</div></div><div class="two">${F(fields[3])}${F(fields[4])}</div>`,
    onSubmit: (v, form) => {
      const it = v.kat ? byId('katalog', v.kat) : null;
      const row = { nazwa: it ? it.nazwa : v.nazwa, poziom: it ? it.poziom : (v.poziom ? Number(v.poziom) : null), status: v.status, data: v.data || null };
      if (!row.nazwa) { form.querySelector('.err').textContent = 'Wybierz sprawność z księgi albo wpisz nazwę.'; return; }
      if (!s && badgesOf(hid).some(x => norm(x.nazwa) === norm(row.nazwa))) { form.querySelector('.err').textContent = 'Ten harcerz ma już tę sprawność.'; return; }
      return mutate(() => s ? backend.update('sprawnosci', s.id, row) : backend.insert('sprawnosci', { ...row, harcerz_id: hid }), 'Zapisano sprawność', () => badgesOpen(hid));
    },
    onDelete: s && (() => mutate(() => backend.remove('sprawnosci', s.id), 'Usunięto sprawność', () => badgesOpen(hid)))
  });
  $('#f_kat').onchange = e => { $('#customBox').hidden = !!e.target.value; };
}

/* ---------- LISTA HARCERZY ---------- */
const funkcjaOf = h => {
  const p = S.data.profiles.find(p => norm(p.imie) === norm(fullName(h)));
  if (p) return { label: ROLE[p.rola], fixed: true };
  const f = S.data.funkcje.find(x => x.harcerz_id === h.id);
  return f ? { label: FUNKCJE[f.funkcja], key: f.funkcja } : null;
};
const mozeUstalacFunkcje = h => isKadra() || (S.me.rola === 'zastepowy' && S.me.zastep && h.zastep === S.me.zastep);
function vLista(){
  const k = isKadra();
  const list = S.data.harcerze.filter(h => k ? (!S.listaZastep || h.zastep === S.listaZastep) : (S.me.zastep && h.zastep === S.me.zastep))
    .sort(cmpHarcerz);
  const zs = ['Kadra', ...ZASTEPY, ...new Set(S.data.harcerze.map(h => h.zastep).filter(z => z && z !== 'Kadra' && !ZASTEPY.includes(z)))];
  let body = '', g = null;
  for (const h of list) {
    if (h.zastep !== g) { if (g !== null) body += '</div>'; g = h.zastep; body += `<div class="group-title">${esc(zastepLabel(g))}</div><div class="card roster">`; }
    const f = funkcjaOf(h), edit = k || (mozeUstalacFunkcje(h) && !f?.fixed);
    const zg = !!h.zgoda_zhr;
    body += `<div class="roster-row${edit ? ' tap' : ''}" ${edit ? `data-act="lista-open" data-id="${h.id}" tabindex="0" role="button"` : ''}>
      <span class="r-name">${esc(fullName(h))}</span><span class="r-rank">${esc(h.stopien || '—')}</span>
      <span class="r-fun">${f ? `<span class="pill ${f.fixed ? 'gold' : ''}">${esc(f.label)}</span>` : (mozeUstalacFunkcje(h) ? '<span class="meta">+ funkcja</span>' : '')}</span>
      <span class="r-zg">${k ? `<button class="zg ${zg ? 'tak' : 'nie'}" data-act="zgoda" data-id="${h.id}" aria-pressed="${zg}" aria-label="Zgoda ZHR: ${zg ? 'tak' : 'nie'} – kliknij, by zmienić"><i class="zg-l">Zgoda ZHR: </i>${zg ? 'Tak' : 'Nie'}</button>`
        : `<span class="zg ${zg ? 'tak' : 'nie'}"><i class="zg-l">Zgoda ZHR: </i>${zg ? 'Tak' : 'Nie'}</span>`}</span></div>`;
  }
  if (g !== null) body += '</div>';
  return `<div class="view-head"><div><h1>Lista harcerzy</h1><p>${k ? 'Cała drużyna' : (S.me.zastep ? 'Zastęp ' + esc(S.me.zastep) : 'Brak przypisanego zastępu')}</p></div>
    ${k ? `<button class="btn" data-act="harcerz-new">${ICON.plus}Dodaj harcerza</button>` : ''}</div>
    ${k ? `<div class="filters"><select id="listaZastep" aria-label="Zastęp"><option value="">Wszystkie zastępy</option>${zs.map(z => `<option ${z === S.listaZastep ? 'selected' : ''}>${esc(z)}</option>`).join('')}</select></div>` : ''}
    ${list.length ? `<p class="meta">Zgody ZHR: <b>${list.filter(h => h.zgoda_zhr).length} z ${list.length}</b>${k ? ' – stuknij Tak/Nie, żeby zmienić' : ''}</p>` : ''}
    <div class="roster-head"><span>Imię i nazwisko</span><span>Stopień</span><span>Funkcja</span><span>Zgoda ZHR</span></div>
    ${body || `<div class="empty"><strong>Brak harcerzy</strong>${k ? 'Dodaj pierwszego harcerza.' : ''}</div>`}
    ${!k && list.length ? '<p class="meta">Stuknij harcerza, żeby ustalić jego funkcję w zastępie.</p>' : ''}`;
}
function listaOpen(hid){
  const h = byId('harcerze', hid); if (!h) return;
  const k = isKadra(), fx = funkcjaOf(h), f = S.data.funkcje.find(x => x.harcerz_id === h.id);
  const nSpr = badgesOf(h.id).length, nPr = probaOf(h.id).length;
  const fields = fx?.fixed ? [] : [{ name:'funkcja', label:'Funkcja w zastępie', type:'select', value: f?.funkcja ?? '',
    options: [{ value:'', label:'— brak funkcji —' }, ...Object.entries(FUNKCJE).map(([value,label]) => ({ value, label }))] }];
  openForm({
    title: fullName(h),
    fields,
    layout: F => `<p class="meta" style="margin-top:0">${esc(zastepLabel(h.zastep))} · ${esc(h.stopien || 'bez stopnia')}${fx?.fixed ? ' · ' + esc(fx.label) : ''}</p>${fields.map(F).join('')}`,
    extra: k ? `<button type="button" class="btn ghost wide" data-act="harcerz-edit" data-id="${h.id}" style="margin-bottom:10px">Zmień imię, nazwisko, zastęp lub stopień</button>
      <p class="meta">Usunięcie harcerza skasuje też jego sprawności (${nSpr}) i próby (${nPr}) – zniknie z księgi sprawności i stopni.</p>` : '',
    submitLabel: fields.length ? 'Zapisz funkcję' : 'Zamknij',
    deleteLabel: 'Usuń harcerza',
    onSubmit: v => fields.length ? mutate(() => backend.setFunkcja(h.id, v.funkcja), v.funkcja ? 'Ustawiono funkcję' : 'Usunięto funkcję') : closeSheet(),
    onDelete: k ? (() => mutate(() => usunHarcerza(h.id), `Usunięto: ${fullName(h)}`)) : null
  });
}

/* ---------- STOPNIE ---------- */
function vStopnie(){
  return `<div class="view-head"><div><h1>Stopnie</h1><p>Stopnie harcerzy i otwarte próby</p></div>
</div>
    <div class="section-title">Puste karty prób do pobrania</div>${cardsHtml(CFG.KARTY_PROB)}
    <div class="section-title">Harcerze</div>${filtersHtml()}
    ${grouped(harcerzeFiltered(), h => { const p = probaOf(h.id)[0], open = p && p.status === 'otwarta'; return `<article class="card rank-row">
      <div><div style="font-weight:700">${esc(fullName(h))}</div><div class="rank" style="color:var(--gold-ink)">${esc(h.stopien || 'bez stopnia')}</div></div>
      <div class="proba-col meta">${open ? `Próba: <b>${esc(p.stopien)}</b><br>od ${fmtDate(p.data_otwarcia)}` : 'Brak otwartej próby'}</div>
      <div class="head-actions" style="justify-content:flex-end">
        ${open && p.plik ? `<button class="btn small black" data-act="proba-download" data-id="${p.id}">Karta</button>` : ''}
        <button class="btn small ghost" data-act="harcerz-open" data-id="${h.id}">${isKadra() ? 'Edytuj' : 'Szczegóły'}</button></div></article>`; })}`;
}
function harcerzOpen(hid){
  const h = byId('harcerze', hid); if (!h) return;
  const pr = probaOf(h.id), k = isKadra();
  openSheet(fullName(h), `<div class="detail-grid"><div><b>Stopień</b>${esc(h.stopien || 'bez stopnia')}</div><div><b>Zastęp</b>${esc(h.zastep || '—')}</div></div>
    ${k ? `<button class="btn ghost wide" data-act="harcerz-edit" data-id="${h.id}">Zmień dane lub stopień</button>` : ''}
    <div class="section-title">Próby</div>
    ${pr.length ? pr.map(p => `<div class="row"><div><b>${esc(p.stopien)}</b> ${p.status === 'otwarta' ? '<span class="pill wait">otwarta</span>' : '<span class="pill ok">zamknięta</span>'}
        <div class="meta">otwarta ${fmtDate(p.data_otwarcia)}${p.plik ? ' · karta: ' + esc(p.plik_nazwa || 'plik') : ' · brak karty'}</div></div>
      <div class="head-actions">${p.plik ? `<button class="btn small black" data-act="proba-download" data-id="${p.id}">Pobierz</button>` : ''}
        ${k ? `<button class="btn small ghost" data-act="proba-edit" data-id="${p.id}">Edytuj</button>` : ''}</div></div>`).join('') : '<p class="meta">Brak prób.</p>'}
    ${k ? `<button class="btn wide" style="margin-top:14px" data-act="proba-new" data-id="${h.id}">${ICON.plus}Otwórz próbę</button>` : ''}`);
}
function harcerzForm(h){
  openForm({
    title: h ? 'Dane harcerza' : 'Nowy harcerz',
    fields: [
      { name:'imie', label:'Imię', value:h?.imie, required:true }, { name:'nazwisko', label:'Nazwisko', value:h?.nazwisko, required:true },
      { name:'zastep', label:'Zastęp', value:h?.zastep ?? S.zastep, list:'zastepy', placeholder:'np. Wieprz' },
      { name:'stopien', label:'Stopień', type:'select', value:h?.stopien ?? '', options: stopienSelect(h?.stopien) }
    ],
    layout: F => `<div class="two">${F({ name:'imie', label:'Imię', value:h?.imie })}${F({ name:'nazwisko', label:'Nazwisko', value:h?.nazwisko })}</div>
      <div class="two">${F({ name:'zastep', label:'Zastęp', value:h?.zastep ?? S.zastep, list:'zastepy', placeholder:'np. Wieprz' })}${F({ name:'stopien', label:'Stopień', type:'select', value:h?.stopien ?? '', options: stopienSelect(h?.stopien) })}</div>`,
    onSubmit: v => mutate(() => h ? backend.update('harcerze', h.id, v) : backend.insert('harcerze', v), h ? 'Zapisano' : 'Dodano harcerza', h && currentTab() === 'stopnie' ? () => harcerzOpen(h.id) : null),
    onDelete: h && (() => mutate(() => usunHarcerza(h.id), 'Usunięto harcerza')),
    deleteLabel: 'Usuń harcerza'
  });
}
const nextStopien = hid => { const i = STOPNIE.indexOf(byId('harcerze', hid)?.stopien); return STOPNIE[Math.min(STOPNIE.length - 1, i + 1)]; };
function probaForm(hid, p){
  let file = null;
  openForm({
    title: p ? 'Edytuj próbę' : `Nowa próba: ${fullName(byId('harcerze', hid))}`,
    fields: [
      { name:'stopien', label:'Próba na stopień', type:'select', value:p?.stopien ?? nextStopien(hid), options: stopienSelect(p?.stopien).slice(1), required:true },
      { name:'data_otwarcia', label:'Data otwarcia', type:'date', value:p?.data_otwarcia ?? today(), required:true },
      { name:'status', label:'Status', type:'select', value:p?.status ?? 'otwarta', options:[{value:'otwarta',label:'Otwarta'},{value:'zamknieta',label:'Zamknięta'}] }
    ],
    extra: `<div class="field"><span>Karta próby (PDF, zdjęcie, Word)</span>
      <div class="card" style="margin:0;display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span id="fileName" class="meta" style="flex:1">${p?.plik ? esc(p.plik_nazwa || 'karta') : 'Nie dodano pliku'}</span>
      <button type="button" class="btn small black" id="pickCard">${p?.plik ? 'Podmień plik' : 'Wybierz plik'}</button></div></div>`,
    onSubmit: v => mutate(async () => {
      const row = p ? await backend.update('proby', p.id, v) : await backend.insert('proby', { ...v, harcerz_id:hid });
      if (file) {
        const path = await backend.upload(`proby/${hid}/${row.id}-${Date.now()}.${ext(file.name)}`, file);
        await backend.update('proby', row.id, { plik:path, plik_nazwa:file.name });
        if (p?.plik && p.plik !== path) await backend.removeFile(p.plik);
      }
      const stop = v.status === 'zamknieta' && (!p || p.status !== 'zamknieta');
      if (stop) await backend.update('harcerze', hid, { stopien: v.stopien });
    }, 'Zapisano próbę', () => harcerzOpen(hid)),
    onDelete: p && (() => mutate(async () => { await backend.remove('proby', p.id); await backend.removeFile(p.plik); }, 'Usunięto próbę', () => harcerzOpen(hid)))
  });
  $('#pickCard').onclick = async () => { const f = await pickFile($('#fileInput'), 'image/*,.pdf,.doc,.docx,.odt'); if (f) { file = f; $('#fileName').textContent = f.name; } };
  if (!p) $('#sheetForm').insertAdjacentHTML('afterbegin', `<p class="meta" style="margin-top:0">Gdy zmienisz status na „Zamknięta”, harcerz automatycznie dostanie ten stopień.</p>`);
}

/* ---------- WIĘCEJ ---------- */
function vWiecej(){
  const item = (href, icon, t, s) => `<a class="card tap" href="#${href}"><svg viewBox="0 0 24 24">${icon}</svg><div><b>${t}</b><span>${s}</span></div></a>`;
  return `<div class="view-head"><div><h1>Więcej</h1></div></div><nav class="menu">
    ${item('ksiega','<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11"/>','Księga tradycji','Historia i obrzędowość drużyny')}
    ${isDruzynowy() ? item('skladki','<circle cx="12" cy="12" r="8.5"/><path d="M14.8 9.2c-.6-.9-1.6-1.3-2.8-1.3-1.6 0-2.8.8-2.8 2s1.1 1.7 2.8 2.1c1.7.4 2.9.9 2.9 2.2s-1.3 2.1-2.9 2.1c-1.3 0-2.4-.5-3-1.4M12 6v1.9M12 16.3V18"/>','Składki','Wpłaty harcerzy za kwartały – tylko drużynowy') : ''}
    ${isKadra() ? item('faktury','<path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3"/>','Faktury','Rozliczenia drużyny – tylko kadra') : ''}
    ${item('profil','<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0"/>','Profil i hasło', esc(S.me.imie) + ' · ' + esc(ROLE[S.me.rola] || ''))}</nav>`;
}

/* ---------- KSIĘGA TRADYCJI ---------- */
function vKsiega(){
  const list = [...S.data.ksiega].sort((a,b) => (a.kolejnosc - b.kolejnosc) || String(a.created_at).localeCompare(String(b.created_at)));
  return `<div class="view-head"><div><h1>Księga tradycji</h1><p>${esc(CFG.NAZWA_DRUZYNY || '')}</p></div>
    ${isKadra() ? `<button class="btn" data-act="ksiega-new">${ICON.plus}Nowa karta</button>` : ''}</div>
    ${list.length ? list.map(e => `<article class="book">
      ${e.okres ? `<div class="okres">${esc(e.okres)}</div>` : ''}<h3>${esc(e.tytul)}</h3>
      ${e.zdjecie ? `<img data-path="${esc(e.zdjecie)}" alt="${esc(e.tytul)}">` : ''}
      <div class="prose">${esc(e.tresc)}</div>
      ${isKadra() ? `<div class="card-foot"><span></span><button class="btn small ghost" data-act="ksiega-edit" data-id="${e.id}">Edytuj</button></div>` : ''}</article>`).join('')
    : `<div class="empty"><strong>Księga jest pusta</strong>${isKadra() ? 'Dodaj pierwszą kartę historii drużyny.' : ''}</div>`}`;
}
function ksiegaForm(e){
  let file = null, removePhoto = false;
  const maxK = Math.max(0, ...S.data.ksiega.map(x => x.kolejnosc || 0));
  openForm({
    title: e ? 'Edytuj kartę księgi' : 'Nowa karta księgi',
    fields: [
      { name:'tytul', label:'Tytuł', value:e?.tytul, required:true, placeholder:'np. Obóz w Bieszczadach' },
      { name:'okres', label:'Rok lub okres', value:e?.okres, placeholder:'np. Lato 2025' },
      { name:'kolejnosc', label:'Kolejność (mniejsza = wyżej)', type:'number', value:e?.kolejnosc ?? maxK + 1 },
      { name:'tresc', label:'Treść', type:'textarea', cls:'tall', value:e?.tresc }
    ],
    layout: F => `${F({ name:'tytul', label:'Tytuł', value:e?.tytul, placeholder:'np. Obóz w Bieszczadach' })}
      <div class="two">${F({ name:'okres', label:'Rok lub okres', value:e?.okres, placeholder:'np. Lato 2025' })}${F({ name:'kolejnosc', label:'Kolejność', type:'number', value:e?.kolejnosc ?? maxK + 1 })}</div>
      ${F({ name:'tresc', label:'Treść', type:'textarea', cls:'tall', value:e?.tresc })}`,
    extra: `<div class="field"><span>Zdjęcie</span><div class="card" style="margin:0;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      <span id="photoName" class="meta" style="flex:1">${e?.zdjecie ? 'Dodano zdjęcie' : 'Brak zdjęcia'}</span>
      ${e?.zdjecie ? `<button type="button" class="btn small ghost" id="rmPhoto">Usuń</button>` : ''}
      <button type="button" class="btn small black" id="pickPhoto">Wybierz zdjęcie</button></div></div>`,
    onSubmit: v => mutate(async () => {
      v.kolejnosc = Number(v.kolejnosc) || 0;
      const row = e ? await backend.update('ksiega', e.id, v) : await backend.insert('ksiega', v);
      if (file) {
        const { blob } = await compressImage(file, 1600);
        const path = await backend.upload(`ksiega/${row.id}-${Date.now()}.jpg`, blob);
        await backend.update('ksiega', row.id, { zdjecie:path });
        if (e?.zdjecie) await backend.removeFile(e.zdjecie);
      } else if (removePhoto && e?.zdjecie) { await backend.update('ksiega', e.id, { zdjecie:null }); await backend.removeFile(e.zdjecie); }
    }, 'Zapisano kartę księgi'),
    onDelete: e && (() => mutate(async () => { await backend.remove('ksiega', e.id); await backend.removeFile(e.zdjecie); }, 'Usunięto kartę'))
  });
  $('#pickPhoto').onclick = async () => { const f = await pickFile($('#photoInput'), 'image/*'); if (f) { file = f; $('#photoName').textContent = f.name; } };
  if ($('#rmPhoto')) $('#rmPhoto').onclick = () => { removePhoto = true; file = null; $('#photoName').textContent = 'Zdjęcie zostanie usunięte'; };
}

/* ---------- SKŁADKI (tylko drużynowy) ---------- */
const isDruzynowy = () => S.me?.rola === 'druzynowy';
const zl = n => (Math.round(n * 100) / 100).toLocaleString('pl-PL', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }) + ' zł';
const skRok = () => S.skRok || new Date().getFullYear();
const skKwota = () => Number(S.data.skladki_kwota.find(x => x.rok === skRok())?.kwota || 0);
const skWpis = (hid, q) => S.data.skladki.find(x => x.harcerz_id === hid && x.rok === skRok() && x.kwartal === q);
const skZostalo = hid => { const fee = skKwota(); let r = 0; for (let q = 1; q <= 4; q++) { const w = skWpis(hid, q); if (w?.zwolniony) continue; r += Math.max(0, fee - Number(w?.kwota || 0)); } return r; };
const skStan = (w, fee) => !w || (w.kwota == null && !w.zwolniony) ? 'pusta' : w.zwolniony ? 'zw' : Number(w.kwota) >= fee ? 'ok' : 'czesc';
const skVal = w => !w ? '' : w.zwolniony ? '-' : w.kwota == null ? '' : String(Number(w.kwota)).replace('.', ',');

function vSkladki(){
  if (!isDruzynowy()) return `<div class="empty"><strong>Brak dostępu</strong>Składki prowadzi drużynowy.</div>`;
  const fee = skKwota(), rok = skRok();
  const list = [...S.data.harcerze].sort(cmpHarcerz);
  let html = '', g = null, sumG = 0;
  const closeGroup = () => `<div class="sk-foot"><span>Do zapłaty w zastępie</span><b data-gsum="${esc(g)}">${zl(sumG)}</b></div></div>`;
  for (const h of list) {
    if (h.zastep !== g) { if (g !== null) html += closeGroup(); g = h.zastep; sumG = 0;
      html += `<div class="group-title">${esc(zastepLabel(g))}</div><div class="card sk-card"><div class="sk-row sk-head"><span>Imię i nazwisko</span><span>I</span><span>II</span><span>III</span><span>IV</span><span>Zostało</span></div>`; }
    const rest = skZostalo(h.id); sumG += rest;
    html += `<div class="sk-row" data-hid="${h.id}" data-z="${esc(h.zastep)}"><span class="sk-name">${esc(fullName(h))}</span>
      ${[1,2,3,4].map(q => { const w = skWpis(h.id, q); return `<input class="sk-in ${skStan(w, fee)}" data-hid="${h.id}" data-q="${q}" value="${esc(skVal(w))}" inputmode="decimal" autocomplete="off" aria-label="${esc(fullName(h))} – kwartał ${q}">`; }).join('')}
      <b class="sk-rest ${rest ? 'due' : 'paid'}">${zl(rest)}</b></div>`;
  }
  if (g !== null) html += closeGroup();
  const total = list.reduce((a,h) => a + skZostalo(h.id), 0);
  const zebrano = S.data.skladki.filter(x => x.rok === rok && list.some(h => h.id === x.harcerz_id)).reduce((a,x) => a + Number(x.kwota || 0), 0);
  return `<div class="view-head sk-top"><div><h1>Składki</h1>
      <div class="sk-year"><button class="icon-btn" data-act="sk-rok" data-v="-1" aria-label="Poprzedni rok">‹</button><b>${rok}</b><button class="icon-btn" data-act="sk-rok" data-v="1" aria-label="Następny rok">›</button></div></div>
    <label class="sk-fee"><span>Składka za kwartał</span><span class="sk-fee-in"><input id="skFee" value="${fee ? String(fee).replace('.', ',') : ''}" inputmode="decimal" placeholder="0"> zł</span></label></div>
    <div class="sk-sum"><div><span>Zebrano w ${rok}</span><b id="skZebrano">${zl(zebrano)}</b></div><div class="due"><span>Zostało do zapłaty</span><b id="skTotal">${zl(total)}</b></div></div>
    <p class="meta">Wpisz kwotę wpłaconą w danym kwartale. Puste pola są na czerwono. Wpisz <b>-</b>, gdy harcerz jest zwolniony z kwartału.</p>
    ${fee ? '' : '<p class="err">Najpierw wpisz w prawym górnym rogu kwotę składki za kwartał.</p>'}
    ${html || `<div class="empty"><strong>Brak harcerzy</strong>Dodaj harcerzy w zakładce Harcerze.</div>`}`;
}
function skOdswiezSumy(){
  const fee = skKwota(), rok = skRok(), sums = {};
  document.querySelectorAll('.sk-row[data-hid]').forEach(r => {
    const hid = Number(r.dataset.hid), rest = skZostalo(hid);
    const b = r.querySelector('.sk-rest'); b.textContent = zl(rest); b.className = 'sk-rest ' + (rest ? 'due' : 'paid');
    r.querySelectorAll('.sk-in').forEach(i => { i.className = 'sk-in ' + skStan(skWpis(hid, Number(i.dataset.q)), fee); });
    sums[r.dataset.z] = (sums[r.dataset.z] || 0) + rest;
  });
  document.querySelectorAll('[data-gsum]').forEach(el => el.textContent = zl(sums[el.dataset.gsum] || 0));
  const ids = new Set(S.data.harcerze.map(h => h.id));
  $('#skTotal').textContent = zl(S.data.harcerze.reduce((a,h) => a + skZostalo(h.id), 0));
  $('#skZebrano').textContent = zl(S.data.skladki.filter(x => x.rok === rok && ids.has(x.harcerz_id)).reduce((a,x) => a + Number(x.kwota || 0), 0));
}
async function skZapisz(input){
  const hid = Number(input.dataset.hid), q = Number(input.dataset.q), raw = input.value.trim(), rok = skRok();
  let wpis = null;
  if (raw === '-' || raw === '–' || raw === '—') wpis = { kwota: null, zwolniony: true };
  else if (raw !== '') {
    const n = Number(raw.replace(/\s|zł/g, '').replace(',', '.'));
    if (!isFinite(n) || n < 0) { toast('Wpisz kwotę (np. 30) albo „-” dla zwolnienia'); input.value = skVal(skWpis(hid, q)); return; }
    wpis = { kwota: n, zwolniony: false };
  }
  const old = skWpis(hid, q);
  S.data.skladki = S.data.skladki.filter(x => x !== old);
  if (wpis) S.data.skladki.push({ harcerz_id: hid, rok, kwartal: q, ...wpis });
  input.value = skVal(wpis && { ...wpis });
  skOdswiezSumy();
  try { await backend.setSkladka(hid, rok, q, wpis); }
  catch(e) { toast('Nie zapisano: ' + e.message); S.data.skladki = S.data.skladki.filter(x => !(x.harcerz_id === hid && x.rok === rok && x.kwartal === q)); if (old) S.data.skladki.push(old); input.value = skVal(old); skOdswiezSumy(); }
}
async function skZapiszKwote(input){
  const raw = input.value.trim(), n = raw === '' ? 0 : Number(raw.replace(/\s|zł/g, '').replace(',', '.'));
  if (!isFinite(n) || n < 0) { toast('Wpisz poprawną kwotę'); return; }
  try { await backend.setKwotaSkladki(skRok(), n); await loadAll(); render(); toast('Zapisano kwotę składki'); } catch(e) { toast(e.message); }
}

/* ---------- FAKTURY ---------- */
function vFaktury(){
  if (!isKadra()) return `<div class="empty"><strong>Brak dostępu</strong>Faktury widzą tylko drużynowy i przyboczni.</div>`;
  return `<div class="view-head"><div><h1>Faktury</h1><p>Rozliczenia drużyny – widoczne tylko dla kadry</p></div></div>
    <div class="empty"><strong>Moduł w przygotowaniu</strong>Tu podłączymy program do rozliczania faktur.</div>`;
}

/* ---------- PROFIL ---------- */
let installEvt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; if (currentTab() === 'profil') render(); });
function vProfil(){
  const m = S.me, ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  return `<div class="view-head"><div><h1>Profil</h1></div></div>
    <div class="card"><div class="person" style="grid-template-columns:44px minmax(0,1fr)"><div class="avatar">${esc(initials(m.imie))}</div>
      <div><h3>${esc(m.imie)}</h3><div class="meta">${esc(ROLE[m.rola] || m.rola)}${m.zastep ? ' · zastęp ' + esc(m.zastep) : ''}</div><div class="meta">Login: ${esc((S.user.email || '').split('@')[0])}</div></div></div></div>
    <form class="card" id="passForm"><h3 style="font-size:19px;margin-bottom:12px">Zmień hasło</h3>
      ${fieldHtml({ name:'p1', label:'Nowe hasło (min. 8 znaków)', type:'password', autocomplete:'new-password' })}
      ${fieldHtml({ name:'p2', label:'Powtórz nowe hasło', type:'password', autocomplete:'new-password' })}
      <p class="err"></p><button class="btn wide">Zmień hasło</button></form>
    ${standalone ? '' : `<div class="card"><h3 style="font-size:19px">Zainstaluj na telefonie</h3>
      ${installEvt ? `<p class="meta">Dodaj aplikację do ekranu głównego.</p><button class="btn black wide" data-act="install">Zainstaluj aplikację</button>`
      : `<p class="meta" style="margin-bottom:0">${ios ? 'W Safari stuknij <b>Udostępnij</b> (kwadrat ze strzałką), a potem <b>Do ekranu początkowego</b>.' : 'W Chrome otwórz menu <b>⋮</b> i wybierz <b>Zainstaluj aplikację</b> albo <b>Dodaj do ekranu głównego</b>.'}</p>`}</div>`}
    ${backend.demo ? `<div class="card"><h3 style="font-size:19px">Tryb demo</h3><p class="meta">Zaloguj się jako inna osoba, żeby zobaczyć aplikację z jej uprawnieniami.</p>
      <select id="demoUser" aria-label="Konto demo">${backend.users().map(u => `<option value="${u.id}" ${u.id === m.id ? 'selected' : ''}>${esc(u.imie)} – ${esc(ROLE[u.rola])}${u.zastep ? ' ' + esc(u.zastep) : ''}</option>`).join('')}</select></div>` : ''}
    <button class="btn danger wide" data-act="logout" style="margin-top:6px">Wyloguj się</button>
    ${backend.demo ? `<button class="btn ghost wide" data-act="demo-reset" style="margin-top:10px">Przywróć dane demo</button>` : ''}`;
}

/* =================================================================
   LOGOWANIE
   ================================================================= */
function vAuth(){
  document.body.classList.add('auth-mode');
  $('#tabs').hidden = true;
  view.innerHTML = `<section class="login">
    <div class="login-card">
      <div class="login-crest"><span class="ring r1"></span><span class="ring r2"></span><span class="ring r3"></span><img src="logo.png" alt="Logo drużyny Rota"></div>
      <p class="login-kicker">III Siedlecka Drużyna Harcerzy</p>
      <h1 class="login-title">Rota</h1>
      <form id="authForm" novalidate autocomplete="on">
        <label class="lf"><span>Login</span>
          <span class="lf-in"><svg viewBox="0 0 24 24"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0"/></svg>
          <input name="login" id="loginIn" placeholder="np. jan.wodzynski" autocomplete="username" autocapitalize="none" spellcheck="false"></span></label>
        <label class="lf"><span>Hasło</span>
          <span class="lf-in"><svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>
          <input name="password" id="passIn" type="password" placeholder="••••••••" autocomplete="current-password">
          <button type="button" class="lf-eye" id="eyeBtn" aria-label="Pokaż hasło">Pokaż</button></span></label>
        <p class="err" role="alert"></p>
        <button class="btn wide login-btn">Zaloguj się</button>
      </form>
      ${backend.demo ? `<div class="login-demo"><b>Tryb demo</b> – wybierz konto, hasło może być dowolne:
        <div class="chips">${backend.users().map(u => `<button type="button" class="bdg lv0" data-login="${esc(u.login)}">${esc(u.imie.split(' ')[0])} · ${esc(ROLE[u.rola])}${u.zastep ? ' ' + esc(u.zastep) : ''}</button>`).join('')}</div></div>`
        : `<p class="login-foot">Nie pamiętasz hasła? Poproś drużynowego o zresetowanie.</p>`}
    </div>
    <p class="login-motto">Czuwaj!</p>
  </section>`;
  const f = $('#authForm');
  $('#eyeBtn').onclick = () => { const pi = $('#passIn'), show = pi.type === 'password'; pi.type = show ? 'text' : 'password'; $('#eyeBtn').textContent = show ? 'Ukryj' : 'Pokaż'; $('#eyeBtn').setAttribute('aria-label', show ? 'Ukryj hasło' : 'Pokaż hasło'); };
  view.querySelectorAll('[data-login]').forEach(b => b.onclick = () => { $('#loginIn').value = b.dataset.login; $('#passIn').value = 'demo'; $('#passIn').focus(); });
  f.onsubmit = async e => {
    e.preventDefault();
    const login = f.login.value.trim().toLowerCase(), password = f.password.value, err = f.querySelector('.err');
    if (!login || !password) { err.textContent = 'Podaj login i hasło.'; return; }
    const btn = f.querySelector('.login-btn'); btn.disabled = true; btn.textContent = 'Logowanie…'; err.textContent = '';
    try { await backend.signIn(login, password); await start(); }
    catch(ex) { err.textContent = ex.message; btn.disabled = false; btn.textContent = 'Zaloguj się'; }
  };
}

/* =================================================================
   AKCJE
   ================================================================= */
const actions = {
  'order-photo': () => orderFromPhoto(),
  'order-manual': () => orderReview(emptyOrder(), null),
  'order-edit': id => orderEdit(byId('rozkazy', id)),
  'order-toggle': (id, el) => { const c = el.closest('.order'); c.classList.toggle('collapsed'); el.textContent = c.classList.contains('collapsed') ? 'Czytaj całość' : 'Zwiń'; },
  'order-photo-view': id => { const r = byId('rozkazy', id); openFile(r.zdjecie, `rozkaz-${(r.numer || r.id).replace(/[^\w-]+/g,'_')}.jpg`); },
  'plan-new': () => planForm(),
  'plan-open': id => planOpen(byId('konspekty', id)),
  'plan-tab': (id, el) => { S.planTab = el.dataset.v; render(); },
  'badges': id => badgesOpen(Number(id)),
  'badge-add': id => badgeMultiForm(Number(id)),
  'badge-edit': id => { const s = byId('sprawnosci', id); badgeForm(s.harcerz_id, s); },
  'badge-quick': (id, el) => badgeForm(Number(id), null, byId('katalog', el.dataset.k)),
  'ks-mode': (id, el) => { S.ksMode = el.dataset.v; render(); },
  'kat-open': id => katOpen(id),
  'lista-open': id => listaOpen(Number(id)),
  'zgoda': async (id, el) => {
    const h = byId('harcerze', id); if (!h || !isKadra()) return;
    const nowa = !h.zgoda_zhr; el.disabled = true;
    try { await backend.update('harcerze', h.id, { zgoda_zhr: nowa }); h.zgoda_zhr = nowa; render(); toast(`${fullName(h)}: zgoda ZHR – ${nowa ? 'tak' : 'nie'}`); }
    catch(e) { el.disabled = false; toast(e.message); }
  },
  'kat-new': () => katForm(),
  'kat-edit': id => katForm(byId('katalog', id)),
  'harcerz-new': () => harcerzForm(),
  'harcerz-open': id => harcerzOpen(Number(id)),
  'harcerz-edit': id => harcerzForm(byId('harcerze', id)),
  'proba-new': id => probaForm(Number(id)),
  'proba-edit': id => { const p = byId('proby', id); probaForm(p.harcerz_id, p); },
  'proba-download': id => { const p = byId('proby', id); openFile(p.plik, p.plik_nazwa); },
  'ksiega-new': () => ksiegaForm(),
  'ksiega-edit': id => ksiegaForm(byId('ksiega', id)),
  'install': async () => { if (!installEvt) return; installEvt.prompt(); await installEvt.userChoice; installEvt = null; render(); },
  'logout': async () => { await backend.signOut(); S.user = S.me = null; closeSheet(); vAuth(); window.scrollTo(0,0); },
  'demo-reset': () => backend.reset(),
  'sk-rok': (id, el) => { S.skRok = skRok() + Number(el.dataset.v); render(); },
};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const fn = actions[el.dataset.act]; if (fn) { e.preventDefault(); fn(el.dataset.id, el); }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.matches('.sk-in, #skFee')) { e.preventDefault(); e.target.blur(); return; }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role=button][data-act]')) { e.preventDefault(); e.target.click(); }
});
document.addEventListener('input', e => {
  for (const [id, key] of [['qSearch','q'], ['kqSearch','kq']]) if (e.target.id === id) { S[key] = e.target.value; const pos = e.target.selectionStart; render(); const s = $('#' + id); s.focus(); s.setSelectionRange(pos, pos); }
});
document.addEventListener('change', async e => {
  if (e.target.classList?.contains('sk-in')) return skZapisz(e.target);
  if (e.target.id === 'skFee') return skZapiszKwote(e.target);
  if (e.target.id === 'qZastep') { S.zastep = e.target.value; render(); }
  if (e.target.id === 'planZastep') { S.planZastep = e.target.value; render(); }
  if (e.target.id === 'listaZastep') { S.listaZastep = e.target.value; render(); }
  if (e.target.id === 'demoUser') { backend.switchUser(e.target.value); S.user = await backend.user(); await loadAll(); render(); toast('Zalogowano jako ' + S.me.imie); }
});
document.addEventListener('submit', async e => {
  if (e.target.id !== 'passForm') return;
  e.preventDefault();
  const f = e.target, err = f.querySelector('.err'); err.textContent = '';
  if (f.p1.value.length < 8) { err.textContent = 'Hasło musi mieć co najmniej 8 znaków.'; return; }
  if (f.p1.value !== f.p2.value) { err.textContent = 'Hasła nie są takie same.'; return; }
  try { await backend.setPassword(f.p1.value); f.reset(); toast('Hasło zmienione'); } catch(ex) { err.textContent = ex.message; }
});
window.addEventListener('hashchange', () => { closeSheet(); render(); window.scrollTo(0,0); });
$('#refreshBtn').onclick = async () => { if (!S.user) return; try { await loadAll(); render(); toast('Odświeżono'); } catch(e) { toast(e.message); } };

/* =================================================================
   START
   ================================================================= */
async function start(){
  S.user = await backend.user();
  if (!S.user) return vAuth();
  await loadAll();
  document.body.classList.remove('auth-mode');
  $('#tabs').hidden = false;
  render();
  checkCards().then(() => { if (['sprawnosci','stopnie'].includes(currentTab())) render(); });
}
$('#teamName').textContent = CFG.NAZWA_DRUZYNY || '';
if (DEMO) $('#demoBar').hidden = false;
const loadScript = src => new Promise(res => { const sc = document.createElement('script'); sc.src = src; sc.onload = sc.onerror = () => res(); document.head.appendChild(sc); });
(async () => {
  if (DEMO) { await loadScript('katalog.js'); await loadScript('demo-dane.js'); }
  backend = DEMO ? demoBackend() : supabaseBackend();
  await start();
})().catch(e => { view.innerHTML = `<div class="empty"><strong>Coś poszło nie tak</strong>${esc(e.message)}</div>`; });

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  try { navigator.serviceWorker.register('sw.js').catch(() => {}); } catch(e) {}
}
}
