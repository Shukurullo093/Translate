const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const uuid = require('uuid'); // agar hali qo‘shilmagan bo‘lsa
const db = require('./db');

const app = express();
const PORT = 3000;

// Data papkasini yaratish
const dataDir = path.join(__dirname, 'data');
const usersFile = path.join(dataDir, 'users.json');
const facesDir = path.join(dataDir, 'faces');
const historyPath = path.join(dataDir, 'history');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
if (!fs.existsSync(facesDir)) fs.mkdirSync(facesDir);
if (!fs.existsSync(historyPath)) fs.mkdirSync(historyPath);
if (!fs.existsSync(usersFile)) fs.writeFileSync(usersFile, '[]');

// Fayl saqlash sozlamalari
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'public', 'uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// Middleware
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use('/faces', express.static(path.join(__dirname, 'data/faces')));

// Foydalanuvchilarni o'qish
function getUsers() {

  return JSON.parse(fs.readFileSync(usersFile));
}

// // Foydalanuvchini saqlash
// function saveUser(user) {
//   const users = getUsers();
//   users.push(user);
//   fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
// }

async function getFaceDescriptor(img){
  const detection = await faceapi.detectSingleFace(img)
        .withFaceLandmarks()
        .withFaceDescriptor();
  return detection.descriptor;
}

// API endpointlari
app.post('/api/register', upload.single('photo'), (req, res) => {
  try {
    const userId = uuidv4();
    const { firstName, lastName, userRank, faceEncoding } = req.body;
    const photo = req.file.filename;
    // const faceDescriptor = getFaceDescriptor(photo);
    const imagePath = `/uploads/${req.file.filename}`;
    
    if (!firstName || !faceEncoding || !req.file) {
      return res.status(400).json({ message: 'Name, faceEncoding, and image are required' });
    }

    let encodingArray;
    try {
      encodingArray = JSON.parse(faceEncoding); // JSON string to array
    } catch {
      return res.status(400).json({ message: 'faceEncoding must be a valid JSON array' });
    }
    // console.log(encodingArray.length, 'ok');
    // const newUser = {
    //   id: userId,
    //   firstName,
    //   lastName,
    //   userRank: userRank,
    //   photo,
    //   created_at: new Date(),
    //   faceDescriptor: null // Keyinroq to'ldiriladi
    // };
    
    // saveUser(newUser);
    const createdAt = new Date().toISOString();
    // console.log(createdAt);
    const stmt = db.prepare(
      `INSERT INTO users (id, firstname, lastname, label, faceEncoding, imagePath, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)`);
    stmt.run(userId, firstName, lastName, userRank, JSON.stringify(encodingArray), imagePath, createdAt);

    res.json({ success: true, userId, userPhoto: photo });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

function euclideanDistance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

const THRESHOLD = 0.5; // max masofa

app.post('/api/users/login', express.json(), (req, res) => {
  const { faceEncoding } = req.body;
  // console.log(faceEncoding);
  if (!faceEncoding || !Array.isArray(faceEncoding)) {
    return res.status(400).json({ message: 'Invalid faceEncoding' });
  }

  const users = db.prepare('SELECT id, firstname, faceEncoding FROM users').all();

  for (const user of users) {
    const dbEncoding = JSON.parse(user.faceEncoding);
    const distance = euclideanDistance(faceEncoding, dbEncoding);

    if (distance < THRESHOLD) {
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60 * 1000).toISOString();

      // Oxirgi 1 daqiqa ichida foydalanuvchi login qilganmi?
      const recentLogin = db.prepare(`
        SELECT id FROM history 
        WHERE userId = ? AND timestamp > ?
        ORDER BY timestamp DESC LIMIT 1
      `).get(user.id, oneMinuteAgo);

      if (!recentLogin) {
        db.prepare(`
          INSERT INTO history (id, userId, timestamp)
          VALUES (?, ?, ?)
        `).run(uuid.v4(), user.id, now.toISOString());
      }

      return res.json({ message: 'Login successful', id: user.id, name: user.firstname });
    }
  }

  res.status(401).json({ message: 'User not recognized' });
});

// Face descriptor ni saqlash
app.post('/api/save-face', express.json(), (req, res) => {
  const { userId, descriptor } = req.body;
  
  try {
    const users = getUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    
    if (userIndex === -1) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Descriptorni alohida faylga saqlaymiz
    const descriptorFile = path.join(facesDir, `${userId}.json`);
    fs.writeFileSync(descriptorFile, JSON.stringify(descriptor));
    
    // User ma'lumotlarini yangilaymiz
    users[userIndex].faceDescriptor = descriptorFile;
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Barcha foydalanuvchilarni olish
app.get('/api/users', (req, res) => {
  try {
    const users = db.prepare('SELECT id, firstname, lastname, label, imagePath, createdAt FROM users').all();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Barcha foydalanuvchilarni olish
app.get('/api/users/face', (req, res) => {
  try {
    const users = db.prepare('SELECT id, faceEncoding FROM users').all();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ID bo'yicha foydalanuvchi
app.get('/api/users/:id', (req, res) => {
  try {
    const users = getUsers();
    const user = users.find(u => u.id === req.params.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Agar descriptor mavjud bo'lsa, uni o'qib olamiz
    if (user.faceDescriptor && fs.existsSync(user.faceDescriptor)) {
      user.faceDescriptor = JSON.parse(fs.readFileSync(user.faceDescriptor));
    }
    
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Id bo'yicha o'chirish
app.delete('/api/users/:id', (req, res) => {
  const stmt = db.prepare('DELETE FROM users WHERE id = ?');
  const result = stmt.run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ message: 'User not found' });
  res.json({ message: 'Hodim o\'chirildi' });
});

app.get('/api/login/history', (req, res) => {
  const history = db.prepare(`
    SELECT h.id, h.timestamp, u.firstname, u.lastname, u.label, u.imagePath
    FROM history h
    JOIN users u ON u.id = h.userId
    ORDER BY h.timestamp DESC
  `).all();

  res.json(history);
});


const filePath = path.join(historyPath, 'data.json');
// login tarixini saqlash
app.post('/save-json', (req, res) => {
  const { user_id } = req.body;

  if (!user_id) {
    return res.status(400).json({ success: false, message: "user_id talab qilinadi" });
  }

  const newData = {
    id: uuidv4(), // UUID avtomatik hosil bo‘ladi
    user_id,
    created_date: new Date().toISOString()
  };

  // Eski fayldan o‘qib, yangi yozuv qo‘shamiz
  fs.readFile(filePath, 'utf8', (err, data) => {
    let json = [];
    if (!err && data) {
      try {
        json = JSON.parse(data);
      } catch (parseErr) {
        console.error("JSON parse xatolik:", parseErr);
      }
    }

    json.push(newData);

    fs.writeFile(filePath, JSON.stringify(json, null, 2), (writeErr) => {
      if (writeErr) {
        console.error("Yozishda xatolik:", writeErr);
        return res.status(500).json({ success: false, message: "Faylga yozib bo‘lmadi" });
      }

      res.json({ success: true, message: "Ma’lumot saqlandi", data: newData });
    });
  });
});

// login tarixini olish
app.get('/history', (req, res) => {
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error("❌ Fayl o‘qishda xatolik:", err);
      return res.status(500).json({ success: false, message: "Fayl o‘qilmadi" });
    }

    try {
      const jsonData = JSON.parse(data);

      // DESC tartibda sort qilish (so‘nggi yozuvlar yuqorida bo‘ladi)
      const sortedData = jsonData.sort((a, b) => {
        return new Date(b.created_date) - new Date(a.created_date);
      });

      res.json({ success: true, data: sortedData });
    } catch (parseErr) {
      console.error("❌ JSON parse xatolik:", parseErr);
      res.status(500).json({ success: false, message: "JSON noto‘g‘ri formatda" });
    }
  });
});

// Serverni ishga tushirish
app.listen(PORT, () => {
  console.log(`Server http://localhost:${PORT} portda ishga tushdi`);
});