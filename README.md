# Saha Defteri

Kisisel saha muhendisligi takip uygulamasi.

## Ne ise yarar?

- Santiye listesi tutar.
- Gunluk saha raporu kaydeder.
- Beton, demir ve diger malzeme siparislerini takip eder.
- Sorun ve eksik listesi olusturur.
- Veriyi tarayicida saklar ve JSON/CSV olarak disari aktarir.

## Nasil acilir?

Bu klasordeki `index.html` dosyasini tarayicida acman yeterli.

Yerel sunucu ile acmak istersen:

```bash
python3 -m http.server 4173
```

Sonra tarayicidan:

```text
http://127.0.0.1:4173/
```

## GitHub Pages ile yayinlama fikri

1. GitHub'da yeni bir repository olustur.
2. Bu dosyalari repository'ye yukle.
3. Repository ayarlarindan Pages bolumunu ac.
4. Source olarak `main` branch ve root klasoru sec.
5. GitHub sana yayin linki verir.

## Google Sheets baglantisi

Bu uygulama su tablo ID'si icin hazirlandi:

```text
1xfp9vUbdJpq39P1fZgYVb5rHqGr5b9HPKfujuai4YaM
```

Baglamak icin:

1. Google Sheets dosyasinda `Uzantilar > Apps Script` bolumunu ac.
2. `apps-script/Code.gs` dosyasindaki kodu Apps Script editorune yapistir.
3. `Deploy > New deployment` sec.
4. Type olarak `Web app` sec.
5. Execute as: `Me`, Who has access: `Anyone` veya sadece kendi hesabina uygun secenek.
6. Deploy sonrasinda verilen `/exec` ile biten URL'yi uygulamadaki `Sheets` ekranina yapistir.
7. `Sheets'e Gonder` veya `Sheets'ten Cek` butonunu kullan.

Kodda degisiklik yaparsan Apps Script'te tekrar `Deploy > Manage deployments > Edit > New version > Deploy` yapman gerekir.

Baglanti kaydedildikten sonra yeni kayit eklediginde ilgili Sheets sayfasina tek satir olarak yazar. Bu islem icin ek bir butona basmak gerekmez.

Apps Script web app URL'sini test etmek icin:

```text
WEB_APP_URL?action=ping
WEB_APP_URL?action=testAppend
```

`testAppend`, `Santiyeler` sayfasina test satiri eklemelidir.

## Sonraki gelistirmeler

- Fotoğraf ekleme
- PDF gunluk rapor alma
- Google Sheets veya Firebase ile kalici veri
- Mobil ana ekran kisayolu
- Hakediş ve puantaj modulu
