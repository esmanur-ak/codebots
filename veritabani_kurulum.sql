-- CodeBots Veritabanı Kurulum Scripti (XAMPP MySQL)
-- Bu scripti phpMyAdmin veya MySQL komut satırından çalıştırın

CREATE DATABASE IF NOT EXISTS codebots CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE codebots;

-- Kullanıcılar (Veliler) Tablosu
CREATE TABLE IF NOT EXISTS kullanicilar (
    id INT AUTO_INCREMENT PRIMARY KEY,
    veli_ad_soyad VARCHAR(255) NOT NULL,
    ogrenci_ad_soyad VARCHAR(255) NOT NULL,
    eposta VARCHAR(255) NOT NULL UNIQUE,
    sifre VARCHAR(255) NOT NULL,
    sertifika_hazir TINYINT(1) DEFAULT 0,
    olusturulma_tarihi TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Kurslar Tablosu
CREATE TABLE IF NOT EXISTS kurslar (
    id INT AUTO_INCREMENT PRIMARY KEY,
    baslik VARCHAR(255) NOT NULL,
    hedef_yas VARCHAR(100),
    aciklama TEXT,
    resim VARCHAR(500),
    olusturulma_tarihi TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Referanslar (İş Birlikleri) Tablosu
CREATE TABLE IF NOT EXISTS referanslar (
    id INT AUTO_INCREMENT PRIMARY KEY,
    kurum_adi VARCHAR(255) NOT NULL,
    kategori VARCHAR(100),
    baslik VARCHAR(255),
    aciklama TEXT,
    gorsel VARCHAR(500),
    olusturulma_tarihi TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Mesajlar Tablosu
CREATE TABLE IF NOT EXISTS mesajlar (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ad_soyad VARCHAR(255) NOT NULL,
    eposta VARCHAR(255),
    konu VARCHAR(255),
    mesaj TEXT,
    okundu_mu TINYINT(1) DEFAULT 0,
    olusturulma_tarihi TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
