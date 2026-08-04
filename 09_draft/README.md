# Draft Alım ve Etki Katmanı

Bu alan, henüz üretim tablolarına işlenmemiş dosya ve bilgilerin güvenli gelen kutusudur.

## Klasörler

| Klasör | İşlev |
|---|---|
| inbox/ | İşlenecek paketler |
| receipts/ | Uygulanan paketlerin hash, çıktı ve kimlik kayıtları |
| backups/ | Her uygulamadan önce alınan ilgili tablo yedekleri |
| examples/ | Kopyalanıp düzenlenebilecek örnekler |
| schema/ | Draft paketinin makine-okunabilir sözleşmesi |

## Mekan paketi oluşturma

1. inbox/DRF-LOC-001/ gibi benzersiz bir klasör aç.
2. Örnekteki draft.json dosyasını bu klasöre kopyala.
3. Mekan fotoğraflarını aynı klasöre ekle. assets alanı yazılmamışsa desteklenen tüm görseller otomatik olarak mekan fotoğrafı kabul edilir.
4. Önce önizleme çalıştır:

       node tools/draft-ingest.mjs --package DRF-LOC-001

5. Plan doğruysa uygula:

       node tools/draft-ingest.mjs --apply --package DRF-LOC-001

## Uygulama sonucu

- Mekan kaydı 02_breakdown/location_index.csv içine eklenir veya aynı location_id üzerinden güncellenir.
- Fotoğraflar 06_assets/locations/LOC-.../photos/ altına kopyalanır.
- Fotoğraf hash ve açıklamaları mekanın assets.json indeksine eklenir.
- Bütçe satırları 04_budget/budget.csv içine eklenir veya güncellenir.
- Proje senkronizasyonu tetiklenir; bağlı tablolar ve son etki raporu güncellenir.
- Kaynak draft dosyaları silinmez veya taşınmaz.

## Güvenlik kuralları

- Varsayılan mod yalnız önizlemedir.
- Aynı içerik hash sayesinde iki kez uygulanmaz.
- Aynı adlı fakat farklı fotoğraf mevcut dosyanın üzerine yazılmaz; hash ekli yeni sürüm oluşturulur.
- Draft paketi bütçeyi APPROVED, ödemeyi PAID veya mekan iznini CONFIRMED yapamaz.
- Senaryo veya bağlantı değişiklikleri çekim/bütçe kararlarını otomatik uydurmaz; ilgili satırlar REVIEW veya NEEDS_APPROVAL durumuna alınır.

## Sürekli izleme

Tüm proje girdilerini izleyip değişiklikleri otomatik uygulamak için:

    node tools/project-sync.mjs --watch --apply

Bu komut açık kaldığı sürece draft gelen kutusu, kanonik senaryo ve bağlı CSV girdileri izlenir.
