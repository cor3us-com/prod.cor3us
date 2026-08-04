# Kısa Film Üretim Alanı

Bu klasör, kısa filmi senaryo kaynağından çekim ve teslim aşamasına taşıyan çalışma alanıdır.

## Mevcut durum

- **Şablon durumu:** Hazır üretim paketi oluşturuldu.
- **Kaynak senaryo:** Henüz `01_story/source/` altında değil.
- **Üretim gerçeği:** Sahne, karakter, mekan, tarih ve bütçe rakamları kaynak senaryo ve doğrulanmış araştırma gelmeden doldurulmaz.
- **Çalışma sınırı:** Bu paket yalnızca `E:\CODEX\kisa-film` altında tutulur.

## Kullanım sırası

1. Orijinal senaryoyu ve revizyon bilgisini `01_story/source/` altına koy.
2. `01_story/SCREENPLAY_INTAKE.md` içindeki kaynak kaydını doldur.
3. Her sahneye kalıcı `SC-001` biçiminde bir kimlik ver.
4. `02_breakdown/sequential_breakdown.csv` dosyasını sahne sahne doldur.
5. Aynı sahneleri `02_breakdown/location_index.csv`, `elements_breakdown.csv` ve `shot_list.csv` ile bağla.
6. Mekan, oyuncu, ekip ve ekipman uygunluklarına göre `03_schedule/` alanında stripboard ve çekim programını kur.
7. `04_budget/budget.csv` kalemlerini kanıt/kaynak alanlarıyla doldur.
8. Araştırma bulgularını `05_research/` altında kanıta bağla; her bulgunun hangi sahne veya prodüksiyon kararını etkilediğini yaz.
9. `schema/production-data-model.json` içindeki ilişkileri koru; dosya adlarını ve kimlikleri keyfi değiştirme.

## Kaynak gerçeği ve varsayım kuralı

- Senaryoda olmayan bir sahne, karakter, mekan veya ihtiyaç üretim gerçeği olarak eklenmez.
- Varsayım gerekiyorsa `TBD`, `ASSUMPTION` veya `NEEDS_APPROVAL` ile işaretlenir.
- Araştırma bulgusu, kaynak ve erişim tarihi olmadan kesin bilgi sayılmaz.
- Bütçe satırı, fiyat kaynağı veya açık varsayım olmadan kesin toplam olarak sunulmaz.
- İzin, telif, sözleşme, ödeme, sigorta, tehlikeli çekim ve kamuya açık prodüksiyon kararları onay kapısından geçer.

## Klasör haritası

| Alan | Amaç |
|---|---|
| `00_admin/` | Proje kontrolü, kararlar, varsayımlar ve onay kapıları |
| `01_story/` | Senaryo kaynağı, revizyon ve metin kabul kaydı |
| `02_breakdown/` | Sıralı döküm, mekan indeksi, elemanlar ve shot list |
| `03_schedule/` | Stripboard mantığı, çekim programı ve call sheet şablonu |
| `04_budget/` | Kalem kalem bütçe, varsayım ve maliyet kanıtı |
| `05_research/` | Araştırma soruları, bulgular, kanıtlar ve üretim etkisi |
| `06_assets/` | Mekan, izin/release ve görsel referans varlıkları |
| `07_post/` | Kurgu, ses, renk, altyazı ve teslim kontrolü |
| `08_delivery/` | Festival/platform teslim paketleri |
| `schema/` | Ortak kimlikler, ilişkiler ve doğrulama kuralları |

## Otomasyon Komutları

Sistemdeki senkronizasyon, draft alımı ve sürüm kontrolü komutları:

| Komut | Açıklama |
|---|---|
| `npm start` / `npm run ui` | Temsili ve görsel web arayüzünü (Web Dashboard) `http://localhost:3000` adresinde başlatır. |
| `npm run sync:preview` | Mevcut senaryo ve tablolardaki değişikliklerin etki önizlemesini gösterir. |
| `npm run sync:apply` | Senaryo ve tablolardaki değişiklikleri işler, sürümleri kilitler ve etki raporunu (`LAST_SYNC_REPORT.md`) üretir. |
| `npm run sync:example` | Örnek senaryo (`01_story/examples/screenplay.fountain`) üzerinde önizleme yapar. |
| `npm run draft:preview` | `09_draft/inbox/` içindeki gelen draft paketlerinin önizlemesini üretir. |
| `npm run draft:apply` | Gelen tüm draft paketlerini işler, mekân/bütçe tablolarına yansıtır ve proje senkronizasyonunu tetikler. |
| `npm run draft:example` | Örnek mekan paketini (`09_draft/examples/location-package/draft.json`) önizler. |
| `npm run project:watch` | Dosyaları ve inbox klasörünü sürekli izler; değişiklik olunca otomatik işler. |

## İlk eksik girdiler

Gerçek üretim planını doldurmak için gereken minimum bilgiler:

- Senaryonun son revizyonu veya e-posta eki (`01_story/source/screenplay.fountain` klasörüne yerleştirilecek)
- Hedef film süresi ve hedef teslim tarihi
- Yönetmen/producer kararı ve mevcut ekip
- Oyuncu/katılımcı durumu
- Mekan adayları ve çekim izinleri
- Tahmini çekim günü sayısı
- Kamera/ses/ışık ekipmanının mevcut olup olmadığı
- Araştırma notları, kaynaklar ve varsa görsel referanslar

