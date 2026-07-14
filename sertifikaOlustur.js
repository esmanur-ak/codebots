// sertifikaOlustur.js
// Sertifika şablonunu doldurup PDF olarak üreten yardımcı fonksiyon.
//
// Performans notu: Puppeteer'da her seferinde yeni bir tarayıcı (Chromium)
// açıp kapatmak yavaştır (birkaç saniye sürebilir). Bunun yerine tarayıcıyı
// bir kere açıp açık tutuyoruz, her istekte sadece yeni bir sekme (page)
// kullanıyoruz. Bu, üretimi belirgin şekilde hızlandırır.

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const SABLON_YOLU = path.join(__dirname, 'sertifika-template.html');

let tarayiciPromise = null;

function tarayiciyiGetir() {
    if (!tarayiciPromise) {
        tarayiciPromise = puppeteer.launch({ args: ['--no-sandbox'] });
    }
    return tarayiciPromise;
}

async function sertifikaPdfUret({ ogrenciAdi, tarih, sertifikaNo }) {
    let html = fs.readFileSync(SABLON_YOLU, 'utf-8');

    html = html
        .replace('{{OGRENCI_ADI}}', ogrenciAdi)
        .replace('{{TARIH}}', tarih)
        .replace('{{SERTIFIKA_NO}}', sertifikaNo);

    const browser = await tarayiciyiGetir();
    const page = await browser.newPage();

    try {
        await page.setContent(html, { waitUntil: 'networkidle0' });

        const pdfBuffer = await page.pdf({
            landscape: true,
            format: 'A4',
            printBackground: true,
        });

        return pdfBuffer;
    } finally {
        // Tarayıcıyı değil, sadece bu isteğin sekmesini kapatıyoruz
        await page.close();
    }
}

module.exports = { sertifikaPdfUret };