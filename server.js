const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

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

// Foydalanuvchini saqlash
function saveUser(user) {
  const users = getUsers();
  users.push(user);
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
}

// API endpointlari
app.post('/api/register', upload.single('photo'), (req, res) => {
  try {
    const { firstName, lastName, userRank } = req.body;
    const photo = req.file.filename;
    const userId = uuidv4();
    
    const newUser = {
      id: userId,
      firstName,
      lastName,
      userRank: userRank,
      photo,
      created_at: new Date(),
      faceDescriptor: null // Keyinroq to'ldiriladi
    };
    
    saveUser(newUser);
    res.json({ success: true, userId, userPhoto: photo });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
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
    const users = getUsers();
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