# Döküm Bağlantı Rehberi

## Bir sahneden hangi dosyalara gidilir?

```text
SC-001
 ├─ LOC-001  -> location_index.csv
 ├─ EL-001   -> elements_breakdown.csv
 ├─ SH-001   -> shot_list.csv
 ├─ RES-001  -> research_log.csv
 ├─ EVD-001  -> evidence_register.csv
 ├─ DAY-001  -> shooting_schedule.csv
 └─ BUD-001  -> budget.csv
```

## Doldurma sırası

1. Önce sahne ve sayfa aralığı.
2. Sonra mekan ve zaman koşulu.
3. Ardından oyuncu/figüran ve prodüksiyon elemanları.
4. Teknik ihtiyaçlar ve güvenlik.
5. Araştırma/kanıt bağlantısı.
6. Setup ve çekim süresi tahmini.
7. Shot list ve program bağlantısı.

## Tutarlılık kontrolleri

- `scene_id` her tabloda aynı formatta olmalı.
- `location_id` location index'te yoksa program kilitlenmez.
- `research_id` research log'ta, `evidence_id` evidence register'da bulunmalı.
- Bir sahnede `night_work=YES` varsa programda gece ve ekip turnaround kontrolü yapılmalı.
- `special_equipment`, `vehicles_animals` veya `stunts_safety` doluysa bütçe ve risk kaydı olmalı.
- `permission_status` `PENDING` veya `UNKNOWN` ise `NEEDS_APPROVAL` kullanılır.
