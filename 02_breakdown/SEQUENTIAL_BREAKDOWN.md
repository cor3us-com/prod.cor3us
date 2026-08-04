# Sıralı Döküm

Bu dosya senaryonun çekim sırasını değil, hikayenin senaryodaki sıralı akışını taşır. Çekim sırası `03_schedule/` alanında optimize edilir.

## Her sahnede cevaplanacak sorular

1. Sahne nerede ve ne zaman geçiyor?
2. Sahneye hangi karakterler, figüranlar ve hayvanlar giriyor?
3. Hangi prop, dekor, kostüm, makyaj ve araç gerekiyor?
4. Kamera, ışık, ses, VFX/SFX ve özel ekipman ihtiyacı nedir?
5. Güvenlik, izin, telif veya süre riski var mı?
6. Araştırmada hangi bulgu bu sahne kararını etkiliyor?
7. Tahmini sayfa, setup ve çekim süresi nedir?

## Öncelik kodları

- `A`: Hikaye için kritik; çekim günü kaybedilirse sahne alternatif plan ister.
- `B`: Önemli; yeniden planlanabilir.
- `C`: Esnek veya pickup kapsamı.
- `NEEDS_APPROVAL`: İzin, hak, ödeme, güvenlik veya başka karar bekliyor.

## Tahmin kuralları

- Bir senaryo sayfası yalnızca başlangıç tahminidir; diyalog yoğunluğu, oyuncu sayısı, mekan ve teknik karmaşıklıkla düzeltilir.
- `estimated_setup_min` ile `estimated_shoot_time_min` ayrı tutulur.
- Gece, çocuk/yaşlı oyuncu, hayvan, araç, kalabalık, özel efekt ve zor ses koşulları ayrıca işaretlenir.
- Çekim programına girmeden önce belirsizlikler `notes` ve `PROJECT_CONTROL.md` risk kaydına bağlanır.

## Sıralı döküm alanları

Makine-okunabilir ana dosya: `sequential_breakdown.csv`

| Alan | Açıklama |
|---|---|
| `scene_id` | Kalıcı sahne kimliği |
| `seq_no` | Senaryodaki sıralı numara |
| `scene_heading` | INT/EXT, mekan ve zaman başlığı |
| `location_id` | Mekan indeksine bağlantı |
| `cast_ids` | Oyuncu/karakter kimlikleri |
| `props` | Sahneye özgü prop listesi |
| `research_ids` | Sahne kararını etkileyen araştırmalar |
| `evidence_ids` | Araştırma kanıtları |
| `status` | Dökümün tamamlanma durumu |

## Kontrol

- [ ] Scene heading kaynak metinle eşleşiyor.
- [ ] Sayfa aralığı ve süre kaynağa bağlı.
- [ ] Mekan, oyuncu ve eleman kimlikleri mevcut.
- [ ] Araştırma ve kanıt bağlantıları var veya `NONE` yazıldı.
- [ ] Güvenlik/izin notu gözden geçirildi.
- [ ] Program ve bütçe için eksik alanlar işaretlendi.
