require('dotenv').config(); // .env dosyasındaki değişkenleri yükler
const mysql = require('mysql2');

// Bağlantı ayarlarını yapılandırıyoruz
const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 3306,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// Eğer bağlantı lokal değilse (yani Render/Aiven ise) SSL ekle
if (process.env.DB_HOST && !process.env.DB_HOST.includes('127.0.0.1') && !process.env.DB_HOST.includes('localhost')) {
    dbConfig.ssl = { rejectUnauthorized: false };
}

// Veri tabanı bağlantı havuzunu (Pool) oluşturuyoruz
const pool = mysql.createPool(dbConfig);

// Diğer dosyalar da bu bağlantıyı kullanabilsin diye dışa aktarıyoruz
module.exports = pool.promise();