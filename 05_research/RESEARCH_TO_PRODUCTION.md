# Araştırma ve Veri Bulgularını Prodüksiyona Bağlama

Araştırma klasörü fikir deposu değil, üretim kararlarına bağlanan kanıt alanıdır.

## Araştırma kaydı için minimum standart

Her `RES-###` kaydı şu soruları cevaplamalı:

- Hangi soruya cevap arıyoruz?
- Bulguyu hangi sahne, mekan veya prodüksiyon kararı kullanacak?
- Kaynak nedir ve ne zaman erişildi?
- Bulgunun güvenilirliği ve sınırı nedir?
- Bu bulgu bütçe, güvenlik, izin, kamera/ses veya sanat kararını değiştiriyor mu?

## Üretim etkisi kodları

| Kod | Üretim alanı | Örnek çıktı |
|---|---|---|
| `STORY` | Hikaye/karakter/diyalog | Sahne davranışı, terim, replik notu |
| `LOCATION` | Mekan/çevre | Recce kontrolü, izin, ulaşım, ses |
| `DESIGN` | Sanat/prop/kostüm | Dönem, renk, malzeme, devamlılık |
| `CAMERA_SOUND` | Görüntü/ses | Kadraj, ışık, mikrofon, gürültü planı |
| `SAFETY_LEGAL` | Güvenlik/hak/izin | Risk kaydı, release, telif kontrolü |
| `BUDGET` | Maliyet | Teklif varsayımı, tasarruf veya ek kalem |
| `AUDIENCE_DELIVERY` | Festival/platform | Süre, altyazı, master, metadata |

## Bulgudan prodüksiyon satırına geçiş

```text
RES-001 -> EVD-001 -> SC-003 -> LOC-002 -> BUD-014 -> DEC-005
```

Bu zincir, bir bulgunun yalnızca not olarak kalmadığını; sahne, mekan, bütçe ve karara dönüştüğünü gösterir.

## Kanıt güveni

- `HIGH`: Birincil/kurumsal veya birden çok bağımsız kaynakla doğrulanmış.
- `MEDIUM`: Güvenilir tek kaynak veya bağlamı sınırlı veri.
- `LOW`: Hipotez, ikincil aktarım veya doğrulanması gereken iddia.
- `UNVERIFIED`: Üretim kararı için kullanılmaz; yalnızca araştırma kuyruğunda kalır.

## Hak ve gizlilik

- Kaynağın telif/yeniden kullanım durumu `rights_status` ile yazılır.
- Kişisel veri, özel mesaj, müşteri bilgisi veya erişim bilgisi araştırma tablosuna kopyalanmaz.
- Alıntı gerekiyorsa kısa, amaca uygun ve kaynağa bağlı tutulur.
- Bir araştırma bulgusu sahnede gerçek kişi/kurum/olay iddiası yaratıyorsa hukuki/etik inceleme kapısı açılır.
