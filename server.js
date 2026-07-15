const express = require('express');
const session = require('express-session');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const { sertifikaPdfUret } = require('./sertifikaOlustur');

const app = express();
const PORT = process.env.PORT || 3000;

// Görsellerin kaydedileceği klasörü oluşturuyoruz (yoksa)
const uploadDir = path.join(__dirname, 'uploads', 'referanslar');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uzanti = path.extname(file.originalname);
        cb(null, 'ref-' + Date.now() + uzanti);
    }
});
const upload = multer({ storage: storage });

// Yüklenen görsellerin tarayıcıdan erişilebilir olması için
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Gelen JSON / form verilerini okuyabilmek için middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));
app.use(session({
    secret: 'codebots-gizli-anahtar-2026',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 4 }
}));

// MySQL Veri Tabanı Bağlantısı
const db = require('./db');

// Veritabanı bağlantısını test et (Havuz yapısına uygun test)
db.query('SELECT 1')
    .then(() => {
        console.log('🚀 MySQL Veri Tabanına Başarıyla Bağlanıldı!');
    })
    .catch((err) => {
        console.error('MySQL bağlantı hatası:', err);
    });

// ==========================================
// VELİ GİRİŞ & KAYIT API YOLLARI
// ==========================================

// 1. Veli Kayıt Noktası (POST)
app.post('/api/kayit', (req, res) => {
    const { veli_adi, ogrenci_adi, e_posta, sifre } = req.body;

    const kontrolSql = 'SELECT * FROM kullanicilar WHERE e_posta = ?';
    db.query(kontrolSql, [e_posta], (err, results) => {
        if (err) return res.status(500).json({ error: 'Veri tabanı hatası' });

        if (results.length > 0) {
            return res.status(400).json({ error: 'Bu e-posta adresiyle zaten bir hesap var!' });
        }

        const sql = 'INSERT INTO kullanicilar (veli_adi, ogrenci_adi, e_posta, sifre) VALUES (?, ?, ?, ?)';
        db.query(sql, [veli_adi, ogrenci_adi, e_posta, sifre], (err, result) => {
            if (err) {
                console.error('Kayıt esnasında hata:', err);
                return res.status(500).json({ error: 'Kayıt yapılamadı.' });
            }
            res.status(201).json({ message: 'Hesabınız başarıyla oluşturuldu!' });
        });
    });
});

// 2. Veli Giriş Noktası (POST)
app.post('/api/giris', (req, res) => {
    const { e_posta, sifre } = req.body;

    const sql = 'SELECT * FROM kullanicilar WHERE e_posta = ? AND sifre = ?';
    db.query(sql, [e_posta, sifre], (err, results) => {
        if (err) return res.status(500).json({ error: 'Veri tabanı hatası' });

        if (results.length === 0) {
            return res.status(401).json({ error: 'E-posta veya şifre hatalı!' });
        }

        const kullanici = results[0];
        res.json({
            message: 'Giriş başarılı!',
            id: kullanici.id,
            veli_adi: kullanici.veli_adi,
            ogrenci_adi: kullanici.ogrenci_adi
        });
    });
});

// ==========================================
// ADMIN PANELİ ŞİFRE KORUMASI
// ==========================================

// ⚠️ Bu şifreyi mutlaka kendi belirleyeceğiniz bir şeyle değiştirin!
const ADMIN_KULLANICI_ADI = 'elifgök';
const ADMIN_SIFRESI = '1mühendis3';

function adminSayfaKontrol(req, res, next) {
    if (req.session && req.session.adminGirisYapti) {
        next();
    } else {
        res.redirect('/admin-giris.html');
    }
}

function adminApiKontrol(req, res, next) {
    if (req.session && req.session.adminGirisYapti) {
        next();
    } else {
        res.status(401).json({ error: 'Yetkisiz erişim. Lütfen giriş yapın.' });
    }
}

app.post('/api/admin/giris', (req, res) => {
    const { kullaniciAdi, sifre } = req.body;
    if (kullaniciAdi === ADMIN_KULLANICI_ADI && sifre === ADMIN_SIFRESI) {
        req.session.adminGirisYapti = true;
        res.json({ basarili: true });
    } else {
        res.status(401).json({ error: 'Kullanıcı adı veya şifre yanlış' });
    }
});

app.post('/api/admin/cikis', (req, res) => {
    req.session.destroy(() => {
        res.json({ basarili: true });
    });
});

app.get('/admin', adminSayfaKontrol, (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-korumali', 'admin.html'));
});

// Admin panelinin velileri görebilmesi için gereken yol
app.get('/api/admin/kullanicilar', adminApiKontrol, (req, res) => {
    const sql = 'SELECT id, veli_adi, ogrenci_adi, e_posta, sertifika_durumu FROM kullanicilar ORDER BY id DESC'
    db.query(sql, (err, results) => {
        if (err) {
            console.error('Veliler çekilirken hata:', err);
            return res.status(500).json({ error: 'Veri tabanı hatası' });
        }
        res.json(results);
    });
});

// ==========================================
// SERTİFİKA TANIMLAMA API YOLU
// ==========================================

app.post('/api/admin/sertifika-ekle', adminApiKontrol, async (req, res) => {
    const { kullanici_id } = req.body;

    // 1. Önce öğrencinin gerçek adını veritabanından çekiyoruz
    const sql = 'SELECT * FROM kullanicilar WHERE id = ?';
    db.query(sql, [kullanici_id], async (err, results) => {
        if (err) {
            console.error('Kullanıcı aranırken hata:', err);
            return res.status(500).json({ error: 'Veri tabanı hatası' });
        }
        if (results.length === 0) {
            return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
        }

        const kullanici = results[0];

        // 2. Sertifika no ve tarih oluşturuyoruz
        const yil = new Date().getFullYear();
        const sertifikaNo = `CB-${yil}-${String(kullanici.id).padStart(4, '0')}`;
        const tarih = new Date().toLocaleDateString('tr-TR');

        try {
            // 3. PDF'i üretiyoruz (isim + tarih otomatik yerleşiyor)
            const pdfBuffer = await sertifikaPdfUret({
                ogrenciAdi: kullanici.ogrenci_adi,
                tarih,
                sertifikaNo,
            });

            // 4. Sertifikalar klasörüne kaydediyoruz
            const sertifikaKlasoru = path.join(__dirname, 'uploads', 'sertifikalar');
            if (!fs.existsSync(sertifikaKlasoru)) {
                fs.mkdirSync(sertifikaKlasoru, { recursive: true });
            }
            const dosyaAdi = `sertifika-${kullanici.id}.pdf`;
            fs.writeFileSync(path.join(sertifikaKlasoru, dosyaAdi), pdfBuffer);

            const sertifikaUrl = `/uploads/sertifikalar/${dosyaAdi}`;

            // 5. Veritabanını güncelliyoruz
            const guncelleSql = `
                UPDATE kullanicilar
                SET sertifika_no = ?, sertifika_tarihi = ?, sertifika_durumu = 1
                WHERE id = ?
            `;
            db.query(guncelleSql, [sertifikaNo, tarih, kullanici.id], (err2) => {
                if (err2) {
                    console.error('Sertifika bilgisi kaydedilirken hata:', err2);
                    return res.status(500).json({ error: 'Veri tabanı güncellenemedi' });
                }
                res.json({
                    message: 'Sertifika başarıyla oluşturuldu ve tanımlandı!',
                    sertifikaUrl,
                });
            });
        } catch (pdfHata) {
            console.error('Sertifika PDF oluşturulurken hata:', pdfHata);
            res.status(500).json({ error: 'Sertifika oluşturulamadı' });
        }
    });
});

// Öğrencinin sertifika durumunu sorgulamak için (veli/öğrenci panelinde kullanılır)
app.get('/api/sertifika-durumu/:id', (req, res) => {
    const { id } = req.params;
    const sql = 'SELECT sertifika_durumu, sertifika_no, sertifika_tarihi FROM kullanicilar WHERE id = ?';
    db.query(sql, [id], (err, results) => {
        if (err) {
            console.error('Sertifika durumu sorgulanırken hata:', err);
            return res.status(500).json({ error: 'Veri tabanı hatası' });
        }
        if (results.length === 0) {
            return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
        }

        const kullanici = results[0];
        res.json({
            hazir: kullanici.sertifika_durumu === 1,
            sertifikaNo: kullanici.sertifika_no,
            tarih: kullanici.sertifika_tarihi,
            sertifikaUrl: kullanici.sertifika_durumu === 1
                ? `/uploads/sertifikalar/sertifika-${id}.pdf`
                : null
        });
    });
});

// ==========================================
// KURSLAR API YOLLARI (TAM SİSTEM - CRUD)
// ==========================================

app.get('/api/kurslar', (req, res) => {
    const sql = 'SELECT * FROM kurslar';
    db.query(sql, (err, results) => {
        if (err) {
            console.error('Kurslar çekilirken hata oluştu:', err);
            return res.status(500).json({ error: 'Veri tabanı hatası' });
        }
        res.json(results);
    });
});

app.post('/api/kurslar', (req, res) => {
    const { kurs_adi, yas_grubu, aciklama } = req.body;
    const adi = kurs_adi || req.body.kursAdi || req.body.kurs_adi;
    const yas = yas_grubu || req.body.yasGrubu || req.body.yas_grubu;
    const icerik = aciklama || req.body.aciklama;

    const sql = 'INSERT INTO kurslar (kurs_adi, yas_grubu, aciklama) VALUES (?, ?, ?)';
    db.query(sql, [adi, yas, icerik], (err, result) => {
        if (err) {
            console.error('Veri tabanına kurs eklenirken hata oluştu:', err);
            return res.status(500).json({ error: 'Veri tabanı hatası' });
        }
        res.status(201).json({ message: 'Kurs başarıyla eklendi', id: result.insertId });
    });
});

app.put('/api/kurslar/:id', (req, res) => {
    const { id } = req.params;
    const { kurs_adi, yas_grubu, aciklama } = req.body;
    const adi = kurs_adi || req.body.kursAdi || req.body.kurs_adi;
    const yas = yas_grubu || req.body.yasGrubu || req.body.yas_grubu;
    const icerik = aciklama || req.body.aciklama;

    const sql = 'UPDATE kurslar SET kurs_adi = ?, yas_grubu = ?, aciklama = ? WHERE id = ?';
    db.query(sql, [adi, yas, icerik, id], (err, result) => {
        if (err) {
            console.error('Kurs güncellenirken hata oluştu:', err);
            return res.status(500).json({ error: 'Veri tabanı hatası' });
        }
        res.json({ message: 'Kurs başarıyla güncellendi.' });
    });
});

app.delete('/api/kurslar/:id', (req, res) => {
    const { id } = req.params;
    const sql = 'DELETE FROM kurslar WHERE id = ?';
    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error('Kurs silinirken hata oluştu:', err);
            return res.status(500).json({ error: 'Veri tabanı hatası' });
        }
        res.json({ message: 'Kurs başarıyla silindi.' });
    });
});

// ==========================================
// REFERANSLAR (İŞ BİRLİKLERİ) API YOLLARI
// ==========================================

app.get('/api/referanslar', (req, res) => {
    const sql = 'SELECT * FROM referanslar ORDER BY id DESC';
    db.query(sql, (err, results) => {
        if (err) {
            console.error('Referanslar çekilirken hata oluştu:', err);
            return res.status(500).json({ error: 'Veri tabanı hatası' });
        }
        res.json(results);
    });
});

app.post('/api/referanslar', upload.single('gorsel'), (req, res) => {
    const { kurum_adi, kategori, baslik, aciklama } = req.body;

    if (!req.file) {
        return res.status(400).json({ error: 'Görsel yüklenmedi.' });
    }

    const gorselYolu = '/uploads/referanslar/' + req.file.filename;

    const sql = 'INSERT INTO referanslar (kurum_adi, kategori, baslik, aciklama, gorsel) VALUES (?, ?, ?, ?, ?)';
    db.query(sql, [kurum_adi, kategori, baslik, aciklama, gorselYolu], (err, result) => {
        if (err) {
            console.error('Referans eklenirken hata oluştu:', err);
            return res.status(500).json({ error: 'Veri tabanı hatası' });
        }
        res.status(201).json({ message: 'İş birliği başarıyla eklendi', id: result.insertId });
    });
});

app.put('/api/referanslar/:id', upload.single('gorsel'), (req, res) => {
    const { id } = req.params;
    const { kurum_adi, kategori, baslik, aciklama } = req.body;

    if (req.file) {
        const gorselYolu = '/uploads/referanslar/' + req.file.filename;
        const sql = 'UPDATE referanslar SET kurum_adi = ?, kategori = ?, baslik = ?, aciklama = ?, gorsel = ? WHERE id = ?';
        db.query(sql, [kurum_adi, kategori, baslik, aciklama, gorselYolu, id], (err, result) => {
            if (err) {
                console.error('Referans güncellenirken hata oluştu:', err);
                return res.status(500).json({ error: 'Veri tabanı hatası' });
            }
            res.json({ message: 'İş birliği başarıyla güncellendi.' });
        });
    } else {
        const sql = 'UPDATE referanslar SET kurum_adi = ?, kategori = ?, baslik = ?, aciklama = ? WHERE id = ?';
        db.query(sql, [kurum_adi, kategori, baslik, aciklama, id], (err, result) => {
            if (err) {
                console.error('Referans güncellenirken hata oluştu:', err);
                return res.status(500).json({ error: 'Veri tabanı hatası' });
            }
            res.json({ message: 'İş birliği başarıyla güncellendi.' });
        });
    }
});

app.delete('/api/referanslar/:id', (req, res) => {
    const { id } = req.params;
    const sql = 'DELETE FROM referanslar WHERE id = ?';
    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error('Referans silinirken hata oluştu:', err);
            return res.status(500).json({ error: 'Veri tabanı hatası' });
        }
        res.json({ message: 'İş birliği başarıyla silindi.' });
    });
});

// ==========================================
// MESAJLAR API YOLLARI
// ==========================================

app.post('/api/mesajlar', (req, res) => {
    const { ad_soyad, e_posta, konu, mesaj } = req.body;
    const sql = 'INSERT INTO mesajlar (ad_soyad, e_posta, konu, mesaj) VALUES (?, ?, ?, ?)';
    db.query(sql, [ad_soyad, e_posta, konu, mesaj], (err, result) => {
        if (err) {
            console.error('Mesaj kaydedilirken hata oluştu:', err);
            return res.status(500).json({ error: 'Veri tabanı hatası' });
        }
        res.status(200).json({ message: 'Mesaj başarıyla kaydedildi!' });
    });
});

app.get('/api/mesajlar', (req, res) => {
    const sql = 'SELECT * FROM mesajlar ORDER BY tarih DESC';
    db.query(sql, (err, results) => {
        if (err) {
            console.error('Mesajlar çekilirken hata oluştu:', err);
            return res.status(500).json({ error: 'Veri tabanı hatası' });
        }
        res.json(results);
    });
});

app.delete('/api/mesajlar/:id', (req, res) => {
    const { id } = req.params;
    const sql = 'DELETE FROM mesajlar WHERE id = ?';
    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error('Mesaj silinirken hata oluştu:', err);
            return res.status(500).json({ error: 'Veri tabanı hatası' });
        }
        res.json({ message: 'Mesaj başarıyla silindi.' });
    });
});

// ==========================================
// (Eski) FORM TABANLI GİRİŞ ROTASI
// ==========================================
app.post('/giris-yap', (req, res) => {
    const { ogrenci_ad_soyad } = req.body;

    // Not: Bu rota şu anda kullanılmıyor gibi görünüyor (asıl giriş akışı /api/giris + sessionStorage).
    // Yine de bozuk kalmasın diye değişken adı hatası düzeltildi.
    const sertifikaDurumu = "false";

    res.cookie('aktif_ogrenci', ogrenci_ad_soyad);
    res.cookie('sertifika_onay', sertifikaDurumu);

    res.redirect('/');
});

// Sunucuyu başlat
app.listen(PORT, () => {
    console.log(`Sunucu http://localhost:${PORT} adresinde tıkır tıkır çalışıyor!`);
});