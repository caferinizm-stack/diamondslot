# Retra Live · DIAMOND SLOT

5 makara × 3 satır, 20 ödeme çizgili elmas slotu. Uygulamada **gerçek
kristalle** (`profiles.crystals`) oynanır; her çevirmenin sonucu ve bakiye
**sunucuda** hesaplanır. Derleme adımı yoktur: saf ES modülleri + tek CSS.
Bütün görseller (semboller, kasa, logo, efektler) kodla çizilir; harici görsel
veya ses dosyası yoktur.

## Kurulum

1. **Sunucu:** `sql_kopyala.html` ▸ **FAZ 88: DIAMOND SLOT** bölümünü Supabase
   SQL Editor'de bir kez çalıştır (`supabase_faz88_diamond_slot.sql`).
2. **Yayın:** bu klasörün içeriğini GitHub'da **`diamondslot`** adlı depoya
   yükle, Settings ▸ Pages ▸ Branch `main` / `(root)`. Adres:
   `https://caferinizm-stack.github.io/diamondslot/`
   (başka adres kullanırsan `lib/screens/roulette_screen.dart` ▸ `kDiamondSlotUrl`).
   `tests/` ve `tools/` klasörlerini yüklemen gerekmez.
3. **Uygulama:** Şans Oyunları ▸ **Diamond Slot** kartı. Sayfa `?app=1` ile
   açılır; oturum adresin `#` kısmından gelir, sayfa okuduktan sonra siler.

`?demo=1` → sunucusuz deneme (tarayıcıda tutulan **demo kredi**; kristale
dönüşmez). Uygulama dışından, oturum olmadan açılırsa da demo çalışır ve
ekranda **DEMO KREDİ** yazar. Uygulama içinde demoya asla geçilmez.

## Kurallar

| | |
|---|---|
| Düzen | 5 makara × 3 satır, 20 sabit çizgi |
| Ödeme | soldan sağa 3/4/5 aynı sembol · `bahis × çarpan / 20` |
| WILD | yalnız 2-3-4. makara · BONUS dışında her sembolün yerine geçer |
| BONUS | 3+ (her yerde) → Kristal Sandık: bahis × 5…100 (4 BONUS ×2, 5 BONUS ×4) |
| Bahisler | 100 · 250 · 500 · 1.000 · 2.500 · 5.000 · 10.000 · 25.000 · 50.000 |
| Tavan | tek çevirmede bahis × 5.000 |
| RTP | ≈ %95 (1 milyon tur · `node tools/simulate.mjs 1000000`) |
| Büyük kazanç | ≥ 15× **DIAMOND WIN!** · ≥ 50× **MEGA DIAMOND WIN!** |

## Güvenlik

* Sonuç (makara durma noktaları, kazanç, bonus ödülü) **sunucuda**
  `diamond_spin` içinde belirlenir; makaralar yalnız bu sonuca döner.
* Bahis yalnız izinli seviyelerden olabilir; bakiye satırı kilitlenir,
  negatife düşemez.
* Her istek benzersiz bir kimlik (`p_client`) taşır: aynı istek ikinci kez
  gelirse aynı sonuç döner, bakiye değişmez. 350 ms'den hızlı çevirme reddedilir.
* Admin ▸ Şans Oyunları Gizleme'den kapatılınca çevirme sunucuda reddedilir.
* Kurallar istemci ile sunucuda aynıdır: SQL, `tools/gen-sql.mjs` ile
  `js/config/gameConfig.js`'ten **üretilir** (elle değiştirme).

## Klasör yapısı

```
index.html
css/diamond-slot.css          tüm stiller (kasa, butonlar, efektler, paneller)
js/config/gameConfig.js       TEK AYAR DOSYASI (semboller, ödemeler, süreler, ses, efekt)
js/engine/rng.js              rastgele kaynak arayüzü (kripto / tohumlu / sıralı)
js/engine/slotEngine.js       oyun motoru (şerit, tahta, çizgi, bonus, sınıf)
js/engine/bonus.js            Kristal Sandık ödül modülü
js/engine/creditManager.js    demo kredi cüzdanı (motordan ayrı)
js/engine/stats.js            geçmiş (son 10) + istatistik
js/engine/engines.js          DemoEngine / LiveEngine (sunucu) — aynı arayüz
js/game/stateMachine.js       animasyon durum makinesi + çevirme kilidi
js/render/symbols.js          MERKEZİ SVG SEMBOL KÜTÜPHANESİ (4 görünüm)
js/render/cabinet.js          kasa (altın + neon mor) ve logo
js/render/reels.js            makaralar (hızlanma, bulanıklık, sıralı duruş, yaylanma)
js/render/fx.js               arka plan atmosferi + kazanma efektleri (canvas)
js/audio/sound.js             Web Audio ile üretilen sesler ve müzik
js/host/gameHostAdapter.js    uygulama köprüsü (GameHostAdapter)
js/main.js                    akış ve arayüz
tests/                        node --test tests/*.test.mjs
tools/                        simülasyon, SQL üretici, tarayıcı kalite kontrolü
```

## Uygulama köprüsü (`RetraGame`)

Sayfa → uygulama: `ready` · `open` · `close` · `exit` (geri butonu, paneli
kapatır) · `win:<kristal>` (≥ 10.000 duyurulur) · `lowbalance`.
Uygulama → sayfa (adresin `#` kısmı): `access_token`, `refresh_token`, `uid`.
Kullanıcı adı ve fotoğrafı sunucudan (`diamond_state`) okunur.

## Testler ve kontrol

```
node --test tests/*.test.mjs        # motor, semboller, kombinasyon, kredi, tekrar engeli,
                                    # bonus, durum geçişleri, ekran uyumu (24 test)
node tools/simulate.mjs 1000000     # RTP
python3 -m http.server 8844 &       # sonra:
node tools/check-mobile.cjs         # 8 ekran boyutu: taşma, 15 sembol, SPIN, kare hızı
```

Demo'da `?demo=1&seed=<sayı>` aynı sonuçları üretir (test için).
