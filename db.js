require('dotenv').config(); // .env dosyasındaki değişkenleri yükler
const mysql = require('mysql2');

// Veri tabanı bağlantı havuzunu (Pool) oluşturuyoruz
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 3306,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: {
        rejectUnauthorized: false // Bulut veritabanına SSL ile güvenli bağlanmak için şarttır
    }
});

// Diğer dosyalar da bu bağlantıyı kullanabilsin diye dışa aktarıyoruz
module.exports = pool.promise();