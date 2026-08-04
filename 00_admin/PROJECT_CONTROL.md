# Proje Kontrol Kartı

## Kimlik

| Alan | Değer |
|---|---|
| Proje ID | `PRJ-001` |
| Çalışma adı | `İYİ YOLCULUKLARIN OLSUN (NEFS)` |
| Format | Kısa film |
| Dil | `Türkçe` |
| Hedef süre | `~15–20 dakika (9 sahne, tahmini)` |
| Hedef teslim | `TBD` |
| Senaryo revizyonu | `v007 (2026-08-03)` |
| Üretim durumu | `DRAFT / SOURCE_IMPORTED` |
| Son kontrol | `2026-08-04` |
| Proje sahibi | Koray |

## Kontrol ilkeleri

1. Kaynak senaryo gelmeden sahne içeriği uydurulmaz.
2. Her üretim kararı bir sahne, araştırma, kanıt veya açık varsayıma bağlanır.
3. Dosya adları ve kimlikler revizyonlar arasında korunur.
4. Bütçe tahmini ile onaylanmış harcama ayrı tutulur.
5. İzin, telif, release, sigorta, ödeme, güvenlik ve kamuya açık çekim kararları açık onay gerektirir.
6. Kişisel iletişim bilgileri yalnızca gerekli dosyada tutulur; araştırma notlarına kopyalanmaz.

## Varsayım ve açık karar kaydı

| ID | Konu | Varsayım / soru | Etkilenen alan | Sahibi | Son tarih | Durum |
|---|---|---|---|---|---|---|
| `DEC-001` | Kaynak senaryo | v007 çekilecek sürüm olarak belirlendi | Story / breakdown | Koray | `2026-08-04` | `RESOLVED` |
| `DEC-002` | Hedef süre | Final film süresi nedir? | Schedule / budget | Koray | `TBD` | `OPEN` |
| `DEC-003` | Çekim ölçeği | Minimum ekip mi, tam ekip mi? | Budget / schedule | Koray | `TBD` | `OPEN` |

## Risk kaydı

| ID | Risk | Olasılık | Etki | Önlem | Tetikleyici | Sahibi | Durum |
|---|---|---|---|---|---|---|---|
| `RSK-001` | Kaynak senaryo revizyonu belirsiz | Düşük | Yüksek | v007 belirlendi; program kilitleme için story lock onayı bekleniyor | Yeni revizyon gelmesi | Koray | `MITIGATED` |
| `RSK-002` | Mekan izin/erişim belirsiz | Orta | Yüksek | Recce ve izin kanıtı | Erişim teyitsizliği | Producer | `OPEN` |
| `RSK-003` | Bütçe fiyatları doğrulanmamış | Orta | Yüksek | Her satıra kaynak ve tarih | Teklif süresinin geçmesi | Producer | `OPEN` |

## Onay kapıları

| Kapı | Çıkış kriteri | Onay gerektiren konu |
|---|---|---|
| Story lock | Kaynak dosya, revizyon ve sayfa numarası kayıtlı | Senaryo değişikliği |
| Breakdown lock | Tüm sahneler ve elemanlar kimlikli | Eksik sahne/eleman |
| Location lock | İzin, erişim, ses/elektrik/ulaşım teyitli | Mekan kullanımı |
| Budget approval | Toplam, belirsizlik ve kontenjan görünür | Para harcama |
| Shoot go/no-go | Ekip, oyuncu, güvenlik ve call sheet hazır | Çekime başlama |
| Delivery QC | Haklar, teknik teslim ve yedekler kontrol edilmiş | Yayın/festival teslimi |
