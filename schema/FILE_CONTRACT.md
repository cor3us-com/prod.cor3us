# Dosya Sözleşmesi

## İnsan okunur belgeler

Markdown dosyaları karar, açıklama, varsayım ve kontrol listesi içindir. Bu dosyalardaki `TBD`, `ASSUMPTION` ve `NEEDS_APPROVAL` ifadeleri üretim gerçeği olarak yorumlanmaz.

## Tablo dosyaları

CSV dosyaları noktalı virgül (`;`) ayırıcı kullanır. Türkçe Excel kurulumlarında bu ayırıcı daha güvenli çalışır. Başlıklar makine-okunabilir ASCII alan adlarıdır; açıklamalar Markdown belgelerindedir.

## JSON sözleşmesi

`production-data-model.json` kimlik desenlerini, kaynak dosyalarını, ilişkileri ve doğrulama kurallarını tanımlar. Yeni bir tablo eklenirse önce bu dosyaya birincil anahtar ve ilişkisi eklenir.

## Güncelleme düzeni

1. Kaynağı değiştir.
2. Bağlantılı kimlikleri kontrol et.
3. Döküm ve programı güncelle.
4. Bütçe etkisini işaretle.
5. Araştırma/kanıt bağını koru.
6. Proje kontrolündeki revizyon ve karar kaydını güncelle.
