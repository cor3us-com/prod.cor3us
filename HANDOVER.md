# Cor3us Ready - Prodüksiyon Yönetim Merkezi - Handover Belgesi

Bu belge, projeyi devralacak olan geliştirici veya AI asistanı (örn: Cursor) için projenin genel yapısını, mevcut durumunu ve son yapılan güncellemeleri özetlemek amacıyla hazırlanmıştır.

## 📌 1. Proje Özeti
**Cor3us Ready**, kısa film ve reklam prodüksiyonları için geliştirilmiş, senaryo ayrıştırma (breakdown), bütçeleme, çekim takvimi (schedule) ve ekip yönetimini tek bir çatı altında toplayan web tabanlı bir "Prodüksiyon Yönetim Merkezi"dir. Sistem yerel veritabanı gibi davranan klasör yapılarıyla (JSON/CSV vb.) çalışır ve hafif bir backend kullanır.

## 📂 2. Dizin Yapısı ve Klasör Yönetimi
Projenin ana geliştirme ortamı iki ana dizine bölünmüştür:
* **`E:\prod.cor3us\workspace`**: Ana geliştirme dizinidir. Tüm kod değişiklikleri, testler ve GitHub push işlemleri buradan yapılmalıdır.
* **`E:\prod.cor3us\web for github`**: Yayına alınacak (deploy) temiz kopyanın tutulduğu dizindir. `workspace` içinde işler bitince dosyalar buraya kopyalanır.

### Temel Dosya ve Klasörler (`workspace` içinde):
* **`public/index.html`**: Uygulamanın tüm arayüzünü (Single Page Application) barındıran devasa ve ana frontend dosyasıdır. Bütün modüller, stiller ve temel JS logic'i burada yer alır.
* **`public/screenplay-formatter.js`**: Fountain formatındaki senaryoları ayrıştıran (parse) ve HTML/DOM elementlerine dönüştüren JS modülüdür.
* **`tools/server.mjs`**: Uygulamanın Node.js / Express arka plan (backend) sunucusudur. Dosya okuma/yazma ve API uç noktalarını sağlar.
* **`00_admin` - `09_draft`**: Prodüksiyonun temel verilerini (senaryolar, bütçe JSON'ları, CSV ayrıştırma dökümleri) tutan klasörlerdir.

## 🛠️ 3. Teknik Mimari
* **Frontend**: Saf HTML, CSS ve Vanilla JavaScript (Hiçbir framework kullanılmamaktadır, ancak modüler bir tasarım felsefesi izlenmiştir).
* **Backend**: Node.js, Express.js.
* **Veri Depolama**: JSON ve CSV dosyaları (Statik dosya sistemi, veritabanı kullanılmaz).

## 🐛 4. Son Yapılan Kritik Düzeltmeler ve Durum
1. **Frontend Çökme Hatası (Syntax Error) Çözüldü**: `public/index.html` içinde yer alan devasa `renderLowerDocTab()` asenkron fonksiyonunun sonundaki kapanış parantezi (`}`) önceki temizlik işlemleri sırasında silinmişti. Bu durum tüm sayfanın JS parse hatası vermesine ve butonların çalışmamasına sebep oluyordu. Bu hata kalıcı olarak giderildi.
2. **Proje Adı Maskelemesi**: Mevcut bir kısa filmin senaryosu ("İyi Yolculukların Olsun") sistemde örnek veri olarak kullanıldığından, projenin açık isimleri arayüzden ve `<title>` etiketlerinden temizlendi. Artık sayfa başlıkları ve logolar **"Cor3us Ready — Örnek Kısa Film — Prodüksiyon Yönetim Merkezi"** olarak genel bir maskeleme ile görünmektedir.
3. **GitHub & Senkronizasyon**: Yapılan hata düzeltmeleri ve değişiklikler `workspace` üzerinden GitHub'a push edildi. Ardından `workspace` içeriği tamamen `web for github` dizinine senkronize edildi.

## 🚀 5. Cursor İçin Sonraki Adımlar
* Uygulamayı çalıştırmak için `workspace` dizininde `node tools/server.mjs` komutunu çalıştırmanız ve tarayıcıdan `http://localhost:3000` adresine gitmeniz yeterlidir.
* UI/UX veya fonksiyon değişikliklerinde ilk bakmanız gereken yer `public/index.html`'dir. Kod bloğu oldukça büyük olduğundan fonksiyon bazlı arama yapılması önerilir (Örn: `renderLowerDocTab`, `runSmartAutoScheduler`).
* API veya veri yapısı değişiklikleri için `tools/server.mjs` incelenmelidir.

**Mevcut Durum**: Proje tamamen stabil, hatalardan arındırılmış ve geliştirilmeye hazır durumdadır. UI üzerindeki tüm butonlar ve sekme geçişleri aktif olarak çalışmaktadır.
