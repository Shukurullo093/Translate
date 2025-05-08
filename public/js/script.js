
window.addEventListener('load', async () => {
    const users = await getUsers(); 
    generateUserTable(users);
});

function generateUserTable(users) {
    // console.log(users);
    const table = document.getElementById('user-table');
    table.innerHTML = ''; 
  
    const thead = table.createTHead();
    const headerRow = thead.insertRow();
    ['ID', 'Ism', 'Familiya', 'Lavozim', 'Rasm', 'Vaqt'].forEach(text => {
      const th = document.createElement('th');
      th.textContent = text;
      headerRow.appendChild(th);
    });
  
    // Create table body
    const tbody = table.createTBody();
  
    let id=1;
    users.forEach(user =>{
      const row = tbody.insertRow();
        // console.log(user);
      // ID
      row.insertCell().textContent = id; //user.id
      id++;
  
      // First Name
      row.insertCell().textContent = user.firstName;
  
      // Last Name
      row.insertCell().textContent = user.lastName;

      // Rank
      row.insertCell().textContent = user.userRank;
  
      // Photo (as an image element)
    //   const photoPath = user.faceDescriptor.split('data')[0]
      const photoCell = row.insertCell();
      const img = document.createElement('img');
      img.src = `/uploads/${user.photo}`; 
      img.alt = 'User Photo';
      img.width = 80;
      photoCell.appendChild(img);
  
      // user created at
        const date = new Date(user.created_at);
        const formatted = date.toLocaleString('uz-UZ', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        });
      row.insertCell().textContent = formatted;
    });
}

async function getUsers() {
    const response = await fetch('/api/users');
    const users = await response.json(); 
    return users;
}

// Model fayllarini yuklash
async function loadModels() {
    try {
      // Model fayllarining manzilini ko'rsatamiz
      const modelPath = '/models';
      
      // Kerakli modellarni yuklaymiz
      await faceapi.nets.ssdMobilenetv1.loadFromUri(modelPath);
      await faceapi.nets.faceLandmark68Net.loadFromUri(modelPath);
      await faceapi.nets.faceRecognitionNet.loadFromUri(modelPath);
      console.log('localhostdan yuklanmoqda');

        // const modelUrl = 'https://justadudewhohacks.github.io/face-api.js/models';
        
        // await faceapi.nets.ssdMobilenetv1.loadFromUri(modelUrl);
        // await faceapi.nets.faceLandmark68Net.loadFromUri(modelUrl);
        // await faceapi.nets.faceRecognitionNet.loadFromUri(modelUrl);
      
      console.log("Modellar muvaffaqiyatli yuklandi");
      return true;
    } catch (error) {
      console.error("Modellarni yuklashda xatolik:", error);
      return false;
    }
}
  
// Dastur ishga tushganda modellarni yuklaymiz
document.addEventListener('DOMContentLoaded', async () => {
    const modelsLoaded = await loadModels();

    if (!modelsLoaded) {
        alert("Yuzni tanish modellari yuklanmadi. Iltimos, konsolni tekshiring.");
        return;
    }

    // Qolgan dastur logikasi...
});

// Ro'yxatdan o'tishdan keyin yuz descriptorni saqlash
async function saveFaceDescriptor(userId, userPhoto) {
    // console.log(userPhoto.files[0].name);
    const img = await faceapi.fetchImage(`/uploads/${userPhoto}`);
    // console.log("Yuzni aniqlash jarayoni boshlandi");
    // console.log(img.src);
    const detection = await faceapi.detectSingleFace(img)
        .withFaceLandmarks()
        .withFaceDescriptor();
    
    // const descriptor = detection.descriptor;
    // console.log("Descriptor length:", descriptor.length);

    if (detection) {
        try {
            const response = await fetch('/api/save-face', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: userId,
                    descriptor: Array.from(detection.descriptor) 
                })
            });
            
            const data = await response.json();
            if (data.success) {
                console.log("Yuz descriptori muvaffaqiyatli saqlandi");
            }
        } catch (error) {
            console.error("Descriptor saqlashda xatolik:", error);
        }
    }
}
  
// Ro'yxatdan o'tish formasi
document.getElementById('saveBtn').addEventListener('click', async () => {
    // e.preventDefault();
    const firstName = document.getElementById('firstName').value;
    const lastName = document.getElementById('lastName').value;
    const userRank = document.getElementById('userRank').value;
    const photoFile = document.getElementById('userPhoto').files[0];

    const formData = new FormData();
    formData.append('firstName', firstName);
    formData.append('lastName', lastName);
    formData.append('userRank', userRank);
    formData.append('photo', photoFile);

    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            console.log("Ro'yxatdan muvaffaqiyatli o'tdingiz!");
            // console.log(data.userPhoto);
            await saveFaceDescriptor(data.userId, data.userPhoto);
            const modal = new bootstrap.Modal(document.getElementById('myModal'));
            modal.hide();
            var table = document.getElementById("user-table");
            var row = table.insertRow(table.rows.length);
            var cell1 = row.insertCell(0);
            var cell2 = row.insertCell(1);
            var cell3 = row.insertCell(2);
            var cell4 = row.insertCell(3);
            var cell5 = row.insertCell(4);
            var cell6 = row.insertCell(5);

            cell1.textContent = table.rows.length - 1;
            cell2.textContent = firstName;
            cell3.textContent = lastName;
            cell4.textContent = userRank;
            const img = document.createElement('img');
            img.src = `/uploads/${data.userPhoto}`; 
            img.alt = 'User Photo';
            img.width = 80;
            cell5.appendChild(img);
            const date = new Date();
            const formatted = date.toLocaleString('uz-UZ', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
            });
            cell6.textContent = formatted;
            
        }
    } catch (error) {
        console.error('Xatolik:', error);
    }
});
  
// FaceMatcher ni yaratish
async function createFaceMatcher() {
    const users = await fetch('/api/users').then(res => res.json());
    const labeledDescriptors = [];

    for (const user of users) {
        if (user.faceDescriptor) {
            const descriptor = new Float32Array(user.faceDescriptor);
            labeledDescriptors.push(
                new faceapi.LabeledFaceDescriptors(
                    user.id, 
                    [descriptor]
                )
            );
        }
    }

    return new faceapi.FaceMatcher(labeledDescriptors);
}

function showMessage(message, type) {
    const toastElement = document.getElementById('liveToast');
    const toast = new bootstrap.Toast(toastElement);
    document.getElementsByClassName('toast-body').innerHTML = message;
    toast.show();

    switch(type){
        case 'error':
            
    }
}