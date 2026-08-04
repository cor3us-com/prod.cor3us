# Senaryo Kabul ve Revizyon Kaydı

Bu dosya, üretim dökümünün hangi senaryo sürümüne dayandığını kanıtlar.

## Kaynak kaydı

| Alan | Değer |
|---|---|
| Kaynak dosya | `screenplay.fountain` |
| Kaynak yolu | `01_story/source/screenplay.fountain` |
| Kaynak türü | Fountain formatı (düz metin) |
| Revizyon etiketi | `v007` |
| Alınma tarihi | `2026-08-03` |
| Sayfa sayısı | `~20 (678 satır, 9 sahne)` |
| Dil | `Türkçe` |
| Film adı | `İYİ YOLCULUKLARIN OLSUN (NEFS)` |
| Hak/izin durumu | `NEEDS_APPROVAL — telif ve kullanım hakları netleştirilmeli` |
| Kaynak hash/referansı | `Source version: Redakte Edilmiş Kanonik Sürüm (v002)` |

## Story özeti

- Logline: Kocasının cinsel saldırısından kurtulan bir avukat kadın, hem kendi acısıyla hem de adaletsizlikle yüzleşirken geçmişinden gelen bir mesajla sınanır.
- Kısa sinopsis: Yıldız ve Cem'in evinde gece yaşanan şiddet olayının ardından avukat Özgü, hem mesleki yükü hem de kendisine ait gizli bir travmayı taşıyarak benzin istasyonuna doğru bir yolculuğa çıkar. Yolculuk boyunca içsel bir hesaplaşma yaşar; final sahnede geçmişinden gelen bir not onu dönüştürür.
- Tür ve ton: Gerilim / Dram; ağır, içe dönük, simgeci
- Hedef izleyici / gösterim: Festival (kısa film kategorisi), sanat sineması
- Tahmini final süre: `~15–20 dakika`
- Ana karakterler: ÖZGÜ (başrol/avukat), CEM (şüpheli), YILDIZ (mağdur), EMİN (Wing Chun ustası), HANDE (istasyon çalışanı), DEDE (market sahibi / Muhammed Cangören), DÖVMELİ (motorlu saldırgan), KAPÜŞONLU GÖLGE
- Ana çatışma: Adaleti temsil eden bir kadının kendi adaletsizliğiyle ve geçmişiyle yüzleşmesi
- Tematik notlar: Adaletsizlik, kadın bedeni üzerindeki şiddet ve direnç, geçmişten gelen af / anlam, nefs kavramı

## Döküm kuralları

- Her scene heading ayrı bir `SC-###` kimliği alır.
- Aynı mekanın farklı zaman veya ışık koşulları ayrı sahne kaydı olarak korunur.
- Sayfa aralıkları kaynak senaryoya göre yazılır; tahmin olarak işaretlenmez.
- Revizyon değişikliği, sahne kimliğini gereksiz yere yeniden numaralandırmaz.
- Bölünen sahne için eski kimlik kapatılır, yeni kimlikler `parent_scene_id` ile bağlanır.
- Metinde olmayan prodüksiyon unsurları `ASSUMPTION` olarak tutulur.

## Kabul kontrol listesi

- [x] Dosya açılıyor ve okunabilir.
- [x] Revizyon adı ve tarih okunuyor. (`v007 / 2026-08-03`)
- [x] Scene heading biçimi tespit edildi. (`INT./EXT. MEKAN - GÜNDÜZ/GECE`)
- [x] Karakter listesi çıkarıldı. (8 karakter — bkz. Story özeti)
- [x] Mekan listesi çıkarıldı. (5 mekan, `location_index.csv`)
- [x] Özel prop, kostüm, araç, hayvan ve efektler çıkarıldı. (`elements_breakdown.csv`)
- [ ] Telif/hak/release belirsizlikleri kaydedildi. (`NEEDS_APPROVAL`)
- [ ] Senaryo `Story lock` için onaya hazır.

## Revizyon geçmişi

| Revizyon | Tarih | Değişiklik | Döküme etkisi | Onay |
|---|---|---|---|---|
| `v001` | `2026-08-03` | Sistem kurulum testi — örnek senaryo ile oluşturuldu | Yok (arşiv) | `ARCHIVED` |
| `v002` | `2026-08-03` | Gerçek senaryo ilk içe aktarma (Redakte Edilmiş Kanonik Sürüm) | İlk döküm tabanı | `ACCEPTED` |
| `v003` | `2026-08-03` | Revizyon / metaveri güncellemesi | Küçük güncelleme | `ACCEPTED` |
| `v004` | `2026-08-03` | Sahne metadata bloğu iyileştirme | Küçük güncelleme | `ACCEPTED` |
| `v005` | `2026-08-03` | Sahne metadata tamamlama | Küçük güncelleme | `ACCEPTED` |
| `v006` | `2026-08-03` | Detay düzeltmeleri | Küçük güncelleme | `ACCEPTED` |
| `v007` | `2026-08-03` | Kanonik sürüm — ÇEKİM TABANLI VERSİYON | Aktif döküm tabanı | `ACTIVE` |
