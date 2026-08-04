# Senaryo Otomatik Senkronizasyon Sözleşmesi

Kanonik senaryo dosyası:

    01_story/source/screenplay.fountain

PDF veya DOCX kaynak, arşiv/revizyon kanıtı olarak korunur. Otomatik üretim için senaryonun bir kez Fountain metnine normalleştirilmesi gerekir.

## Kalıcı sahne kimliği

Her sahne başlığı #SC-001# biçiminde kalıcı bir kimlikle bitmelidir:

    INT. MUTFAK - GÜNDÜZ #SC-001#

Sahnelerin sırası değişse bile kimlik değiştirilmez. Yeni sahneye yeni kimlik verilir. Silinen sahne tablolardan fiziksel olarak silinmez; REVIEW durumuna alınır.

## Prodüksiyon metadatası

Sahne başlığından sonra isteğe bağlı JSON bloğu kullanılabilir:

    /* @production
    {
      "location_id": "LOC-001",
      "cast": ["AYKUT"],
      "props": ["Telefon"],
      "estimated_screen_time_min": 1.2
    }
    */

Desteklenen ana alanlar:

- location_id, location_name, int_ext, story_time, day_night
- cast, props, wardrobe_makeup, set_dressing
- vehicles_animals, special_equipment
- Sıralı döküm CSV başlıklarında bulunan süre, güvenlik, kamera/ses ve öncelik alanları

## Etki davranışı

Senaryo değiştiğinde:

1. Sıralı döküm sahne kimlikleri üzerinden güncellenir.
2. Mekanların scene_ids ilişkisi yeniden hesaplanır.
3. Oyuncu, prop, kostüm ve diğer prodüksiyon elemanları güncellenir.
4. Bağlı shot, çekim günü ve araştırma kayıtları REVIEW durumuna alınır.
5. Bağlı bütçe satırları yeniden hesaplanır ve NEEDS_APPROVAL yapılır.
6. İnsan okunur döküm, mekan ve bütçe görünümleri yeniden üretilir.
7. Bütün etkiler 00_admin/LAST_SYNC_REPORT.md içine yazılır.

Önizleme:

    node tools/project-sync.mjs

Uygulama:

    node tools/project-sync.mjs --apply --trigger screenplay-revision
