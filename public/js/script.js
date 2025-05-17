
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
    ['ID', 'Ism', 'Familiya', 'Lavozim', 'Rasm', 'Vaqt', ''].forEach(text => {
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
      row.insertCell().textContent = user.firstname;
  
      // Last Name
      row.insertCell().textContent = user.lastname;

      // Rank
      row.insertCell().innerHTML = `<span class='bg-success text-light py-1 px-2 rounded'>${user.label}</span>`;
  
      // Photo (as an image element)
    //   const photoPath = user.faceDescriptor.split('data')[0]
      const photoCell = row.insertCell();
      const img = document.createElement('img');
      img.src = `/uploads/${user.imagePath.split('/').pop()}`; 
      img.alt = 'User Photo';
      img.width = 80;
      img.style.borderRadius = '10px';
      photoCell.appendChild(img);
  
      // user created at
        const date = new Date(user.createdAt);
        const formatted = date.toLocaleString('uz-UZ', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        });
      row.insertCell().textContent = formatted;
      const action = row.insertCell();
      action.innerHTML = `<button type="button" class="btn btn-primary"><i class="bi bi-pencil-square"></i></button>
        <button type="button" class="btn btn-danger" onclick='userDelete(this)' data-user-id='${user.id}'><i class="bi bi-trash"></i></button>`;
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

document.getElementById('userPhoto').addEventListener('change', async function() {
  const file = this.files[0];
  if (!file) return;

  const img = document.getElementById('preview');
  img.src = URL.createObjectURL(file);

//   img.onload = async () => {
//     const detection = await faceapi
//       .detectSingleFace(img)
//       .withFaceLandmarks()
//       .withFaceDescriptor();

//     if (!detection) return alert("Yuz topilmadi!");

//     const faceEncoding = Array.from(detection.descriptor);
//     // console.log(faceEncoding);
//   };
});

// Ro'yxatdan o'tish formasi
document.getElementById('saveBtn').addEventListener('click', async () => {
    // e.preventDefault();
    let firstName = document.getElementById('firstName').value;
    firstName = capitalize(firstName);
    let lastName = document.getElementById('lastName').value;
    lastName = capitalize(lastName);
    const userRank = document.getElementById('userRank').value;
    const photoFile = document.getElementById('userPhoto').files[0];

    // const img = await faceapi.fetchImage(photoFile);
    const detections = await faceapi.detectSingleFace(document.getElementById('preview'))
        .withFaceLandmarks()
        .withFaceDescriptor();
    if (!detections) return alert('Yuz topilmadi.');

    const faceEncoding = Array.from(detections.descriptor);
    // console.log(faceEncoding);

    const formData = new FormData();
    formData.append('firstName', firstName);
    formData.append('lastName', lastName);
    formData.append('userRank', userRank);
    formData.append('faceEncoding', JSON.stringify(faceEncoding));
    formData.append('photo', photoFile);

    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('successMsg').style.display = 'block';
            setTimeout(()=>{ 
                document.getElementById('successMsg').style.display = 'none'; 
                document.getElementById('registrationForm').reset();
            }, 5000);

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
            cell4.innerHTML = `<span class='bg-success text-light py-1 px-2 rounded'>${userRank}</span>`;
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
            row.insertCell(6).innerHTML = `<button type="button" class="btn btn-primary"><i class="bi bi-pencil-square"></i></button>
                <button type="button" class="btn btn-danger"><i class="bi bi-trash"></i></button>`
            
        }
    } catch (error) {
        console.error('Xatolik:', error);
        document.getElementById('errorMsg').style.display = 'block';
        setTimeout(()=>{ 
            document.getElementById('errorMsg').style.display = 'none'; 
            // document.getElementById('registrationForm').reset();
        }, 5000);
    }
});

async function userDelete(btn) {
    const response = await fetch(`/api/users/${btn.getAttribute('data-user-id')}`, {
            method: 'DELETE'
        });
        
    const data = await response.json(); 
    if(response.ok){
        alert('Hodim o\'chirildi');
        const users = await getUsers(); 
        generateUserTable(users);
    }
}
  
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

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const startCamera = document.getElementById("startCamera");
const takePhoto = document.getElementById("takePhoto");
const countdownEl = document.getElementById("countdown");

let stream;

startCamera.addEventListener("click", async () => {
    try {
        startCamera.attributes.disabled = true;
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
    } catch (err) {
        alert("Kamera ishlamadi: " + err.message);
    }
});

takePhoto.addEventListener("click", () => {
    let countdown = 5;
    countdownEl.style.display = 'block';
    countdownEl.textContent = countdown;

    const interval = setInterval(() => {
        countdown--;
        countdownEl.textContent = countdown;

        if (countdown === 0) {
            clearInterval(interval);
            countdownEl.textContent = "";

            // Rasmni olish
            const context = canvas.getContext("2d");
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            context.drawImage(video, 0, 0, canvas.width, canvas.height);

            // Kamerani o‘chirish
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
                video.srcObject = null;
            }

            // Video o‘rniga canvas ko‘rsatish
            countdownEl.style.display = 'none'
            video.style.display = "none";
            canvas.style.display = "block";
        }
    }, 1000);
});

document.getElementById('cameraModalBtn').addEventListener('click', async () => {
    // e.preventDefault();
    const firstName = document.getElementById('cfirstName').value;
    const lastName = document.getElementById('clastName').value;
    const userRank = document.getElementById('cuserRank').value;
    const photoFile = dataURLtoFile(canvas.toDataURL("image/png"), 'userphoto.png');
    
    const img = document.getElementById('preview');
    img.src = URL.createObjectURL(photoFile);

    const detections = await faceapi.detectSingleFace(document.getElementById('preview'))
        .withFaceLandmarks()
        .withFaceDescriptor();
    if (!detections) return alert('Yuz topilmadi.');
    const faceEncoding = Array.from(detections.descriptor);

    const formData = new FormData();
    formData.append('firstName', firstName);
    formData.append('lastName', lastName);
    formData.append('userRank', userRank);
    formData.append('faceEncoding', JSON.stringify(faceEncoding));
    formData.append('photo', photoFile);

    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('successMsg1').style.display = 'block';
            setTimeout(()=>{ 
                document.getElementById('successMsg1').style.display = 'none'; 
                document.getElementById('registrationForm1').reset();
            }, 5000);

            const modal = new bootstrap.Modal(document.getElementById('cameraModal'));
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
            cell4.innerHTML = `<span class='bg-success text-light py-1 px-2 rounded'>${userRank}</span>`;
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
            row.insertCell(6).innerHTML = `<button type="button" class="btn btn-primary"><i class="bi bi-pencil-square"></i></button>
                <button type="button" class="btn btn-danger"><i class="bi bi-trash"></i></button>`
        }
    } catch (error) {
        console.error('Xatolik:', error);
    }
});

function dataURLtoFile(dataurl, filename) {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }

  return new File([u8arr], filename, { type: mime });
}

function capitalize(str) {
  if (!str) {
    return "";
  }
  return str.charAt(0).toUpperCase() + str.slice(1);
}