// GameHostAdapter — oyunla onu açan ortam (Retra uygulaması / tarayıcı)
// arasındaki tek bağlantı katmanı.
//
// Uygulama (Flutter WebView) sayfayı şu adresle açar:
//   …/?app=1#access_token=…&refresh_token=…&uid=…&name=…&avatar=…&sound=0|1
//   • access/refresh token: Supabase oturumu (bakiye sunucudan okunur)
//   • uid / name / avatar: üst bilgide gösterilecek kullanıcı
//   • sound: uygulamanın ses tercihi (0 = kapalı)
// Sayfa olayları `RetraGame` JavaScript kanalıyla uygulamaya bildirir:
//   ready · open · close (sayfa kapandı) · exit (geri butonu) · win:<kristal> · lowbalance
//
// Kozmetik ödül sistemi: uygulamada henüz yetkili bir uç nokta YOK.
// `grantCosmetic` bu yüzden { supported:false } döner — sahte bağlantı kurulmaz.

export class GameHostAdapter {
  /** @returns {{ id:string, name:string, avatar:string } | null} */
  getUser() { return null; }
  /** @returns {{ music:boolean|null, sfx:boolean|null }} */
  getSoundPrefs() { return { music: null, sfx: null }; }
  /** Olay bildir: ready | open | close | win | lowbalance */
  notify(_event, _data) {}
  /** Oyunu kapat (geri dön). */
  close() {}
  /** Uygulama içinde mi? */
  get embedded() { return false; }
  /** İleride: yetkili kozmetik ödül. Şimdilik desteklenmiyor. */
  async grantCosmetic(_item) { return { supported: false }; }
}

function readHashParams(loc) {
  const out = new URLSearchParams();
  for (const raw of [loc?.search?.slice(1) ?? '', loc?.hash?.slice(1) ?? '']) {
    for (const [k, v] of new URLSearchParams(raw)) out.set(k, v);
  }
  return out;
}

/** Retra uygulaması (WebView) içinde. */
export class RetraWebViewHost extends GameHostAdapter {
  constructor(win = globalThis.window) {
    super();
    this.win = win;
    const p = readHashParams(win?.location);
    const id = (p.get('uid') ?? '').slice(0, 64);
    this.user = id ? {
      id,
      name: (p.get('name') ?? '').slice(0, 40),
      avatar: /^https:\/\//.test(p.get('avatar') ?? '') ? p.get('avatar').slice(0, 500) : '',
    } : null;
    const s = p.get('sound');
    this.sound = s === '0' ? false : s === '1' ? true : null;
  }

  get embedded() { return true; }
  getUser() { return this.user; }
  getSoundPrefs() { return { music: this.sound, sfx: this.sound }; }

  notify(event, data) {
    const msg = data == null ? event : `${event}:${data}`;
    try { this.win?.RetraGame?.postMessage(msg); } catch { /* köprü yok */ }
  }

  close() { this.notify('exit'); }
}

/** Tek başına (tarayıcıda) açıldığında. */
export class StandaloneHost extends GameHostAdapter {
  constructor(win = globalThis.window) { super(); this.win = win; }
  notify(event, data) { try { this.win?.dispatchEvent(new CustomEvent('diamondslot', { detail: { event, data } })); } catch { /* yok */ } }
  close() {
    try {
      if (this.win.history.length > 1) this.win.history.back();
      else this.win.location.href = '/';
    } catch { /* yok */ }
  }
}

export function createHost(win = globalThis.window) {
  const inApp = Boolean(win?.RetraGame) || new URLSearchParams(win?.location?.search ?? '').get('app') === '1';
  return inApp ? new RetraWebViewHost(win) : new StandaloneHost(win);
}
