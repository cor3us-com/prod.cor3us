# Çekim Programı ve Stripboard Mantığı

## Amaç

Senaryonun hikaye sırasını korurken sahneleri mekan, oyuncu, gün/gece, izin, hava, ekipman ve maliyet açısından verimli çekim günlerine paketlemek.

## Programlama öncelikleri

1. İzin ve erişim kısıtları.
2. Oyuncu/katılımcı uygunluğu ve yasal çalışma sınırları.
3. Mekan başına company move sayısını azaltma.
4. Gün/gece ve ışık sürekliliğini koruma.
5. Ses, trafik, kalabalık ve hava riskini yönetme.
6. Özel ekipman, araç, hayvan, stunt ve VFX günlerini izole etme.
7. Sayfa ve setup yükünü gerçekçi kapasitede tutma.

## Her çekim günü için minimum alanlar

- Gün kimliği ve tarih
- Ana mekan ve sahne kimlikleri
- Sayfa toplamı
- Ekip, oyuncu ve ilk çekim çağrısı
- Yemek ve wrap saati
- Ulaşım/company move penceresi
- Özel ekipman ve izin durumu
- Hava alternatifi
- Gece çalışması ve turnaround kontrolü
- Bütçe günü kodu

## Verimlilik metrikleri

- `pages_per_day`: Günlük senaryo sayfası.
- `setups_per_day`: Günlük kamera kurulumu.
- `company_moves`: Gün içi mekan değişimi.
- `cast_days`: Oyuncu/katılımcı gün sayısı.
- `night_ratio`: Gece işinin toplam içindeki oranı.
- `risk_count`: Güvenlik/izin/teknik risk sayısı.
- `contingency_minutes`: Günün beklenmeyen durum payı.

Bu metrikler hedef değil, programın aşırı sıkışık olup olmadığını kontrol etmek için kullanılır.

## Program kilitleme checklist'i

- [ ] Story lock tamamlandı.
- [ ] Tüm sahneler breakdown edildi.
- [ ] Mekan izinleri ve recce kayıtları var.
- [ ] Oyuncu/ekip uygunluğu teyitli.
- [ ] Özel ekipman ve araçlar ayrıldı.
- [ ] Gün/gece ve ses riskleri kontrol edildi.
- [ ] Ulaşım, yemek, mola ve wrap süreleri gerçekçi.
- [ ] Hava alternatifi var.
- [ ] Bütçe günleriyle program eşleşiyor.
- [ ] Call sheet üretmeye hazır.
