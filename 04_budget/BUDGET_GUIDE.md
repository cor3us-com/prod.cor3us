# Kalem Kalem Bütçe Şeması

## Kategori yapısı

| Kod | Kategori | Örnek kalemler |
|---|---|---|
| `DEV` | Geliştirme | Senaryo, araştırma, danışmanlık |
| `PRE` | Ön hazırlık | Recce, casting, prova, test çekimi |
| `CREW` | Ekip | Yönetim, görüntü, ses, sanat, prodüksiyon |
| `CAST` | Oyuncu/katılımcı | Ücret, prova, ulaşım, konaklama |
| `LOC` | Mekan/izin | Kiralama, izin, güvenlik, temizlik |
| `CAM` | Kamera/ışık/grip | Gövde, lens, tripod, ışık, güç |
| `SND` | Ses | Kayıt, boom, mikrofon, yedek ses |
| `ART` | Sanat/prop/dekor | Alım, kiralama, yapım, devamlılık |
| `WARD` | Kostüm/makyaj | Kostüm, saç, makyaj, temizleme |
| `TRANS` | Ulaşım/lojistik | Araç, yakıt, park, taşıma |
| `CATER` | Yemek/mola | Ekip ve oyuncu yemekleri |
| `SAFE` | Güvenlik/sigorta | İlk yardım, risk önlemi, sigorta |
| `POST` | Post-prodüksiyon | Kurgu, ses miks, renk, altyazı |
| `DEL` | Teslim | DCP/master, festival, depolama |
| `CONT` | Kontenjan | Belirsizlik ve beklenmeyen gider |

## Hesap mantığı

```text
subtotal_try = quantity × unit_cost_try
contingency_try = subtotal_try × contingency_pct / 100
total_try = subtotal_try + contingency_try
```

Kontenjan tek bir satırda saklanabilir; aynı tutarı hem kalemlere hem toplam kontenjanına iki kez ekleme.

## Bütçe kalitesi kuralları

- Her kalem `source` veya açık varsayım içermeli.
- Teklif tarihi ve geçerlilik süresi `notes` alanına yazılmalı.
- `approval_status=APPROVED` olmadan ödeme veya satın alma yapılmaz.
- `paid_status` yalnızca gerçek ödeme kanıtıyla güncellenir.
- Mekan, ekipman, oyuncu ve izin kalemleri ilgili kimliklerle bağlanır.
- Araştırma bir maliyet varsayımını etkiliyorsa `evidence_id` eklenir.

## Bütçe özeti şablonu

| Özet | Tutar (TRY) | Durum |
|---|---:|---|
| Geliştirme + ön hazırlık | `TBD` | `TBD` |
| Çekim | `TBD` | `TBD` |
| Post-prodüksiyon | `TBD` | `TBD` |
| Teslim | `TBD` | `TBD` |
| Kontenjan | `TBD` | `TBD` |
| **Genel toplam** | `TBD` | `NEEDS_APPROVAL` |
