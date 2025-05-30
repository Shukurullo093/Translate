
async function loadModels() {
    try {
        const modelUrl = '/models';
        
        await faceapi.nets.ssdMobilenetv1.loadFromUri(modelUrl);
        await faceapi.nets.faceLandmark68Net.loadFromUri(modelUrl);
        await faceapi.nets.faceRecognitionNet.loadFromUri(modelUrl);
      
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
        console.log("Yuzni tanish modellari yuklanmadi. Iltimos, konsolni tekshiring.");
        return;
    }

    // Login tugmasi uchun yuzni aniqlash funksiyasi
    async function startFaceRecognition() {
        const startBtn = document.getElementById('start-recognition');
        try {
            startBtn.disabled = true;
            startBtn.textContent = "Ishga tushirilmoqda...";
            
            // 1. Modellarni yuklash
            if (!faceapi.nets.ssdMobilenetv1.params) {
                await loadModels();
            }
            
            // 2. Kamerani ishga tushirish
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { width: 400, height: 400 } 
            });
            video.srcObject = stream;
            video.play();
            
            // 3. Video yuklanishini kutish
            await new Promise((resolve) => {
                video.onloadeddata = () => {
                    // console.log("Video yuklandi");
                    resolve();
                };
                // 5 soniyadan keyin timeout
                setTimeout(() => {
                    if (video.readyState < 2) {
                        throw new Error("Video yuklash vaqti tugadi");
                    }
                }, 5000);
            });
            
            // 4. Canvas yaratish
            const canvas = faceapi.createCanvasFromMedia(video);
            document.getElementById('video-container').appendChild(canvas);
            faceapi.matchDimensions(canvas, { 
                width: video.width, 
                height: video.height
            });
            
            // 5. Foydalanuvchilarni yuklash
            const users = await fetch('/api/users/face').then(res => res.json());
            // console.log(users);

            async function createFaceMatcher(users) {
                // Filter users with descriptors and fetch them in parallel
                const descriptorPromises = users
                    // .filter(user => user.faceDescriptor)
                    .map((user) => {
                        // console.log(user.faceEncoding.length);
                        // const response = await fetch('/faces/' + user.faceDescriptor.split('/').pop());  // Faxriddin akada xato bor replace('/', '\\')
                        // const array = await response.json();
                        // const descriptor = new Float32Array(array); // Convert to Float32Array
                        return new faceapi.LabeledFaceDescriptors(
                            user.id,
                            [new Float32Array(user.faceEncoding)] // Wrap in array (can add multiple descriptors per user)
                        );
                    });

                // console.log(descriptorPromises);
            
                // Wait for all fetches to complete
                const labeledDescriptors = await Promise.all(descriptorPromises);
                return new faceapi.FaceMatcher(labeledDescriptors);
            }
            const faceMatcher = await createFaceMatcher(users);
            // console.log(faceMatcher);

            // const labeledDescriptors = users
            //     .filter(user => user.faceDescriptor)
            //     .map(user => {
            //         // console.log(user.faceDescriptor);
            //         // console.log([new Float32Array(user.faceDescriptor)].length);
            //         const response = fetch('/faces/' + user.faceDescriptor.split('/').pop());
            //         const array = response.json();
            //         const descriptor = new Float32Array(array);
            //         new faceapi.LabeledFaceDescriptors(
            //             user.id, 
            //             [descriptor]
            //         )
            //         // fetch('/faces/' + user.faceDescriptor.split('/').pop())
            //         //     .then(res => res.json())
            //         //     .then(array => {
            //         //         const descriptor = new Float32Array(array); // Required by face-api.js
            //         //         // console.log(descriptor.length); // Should be 128                            
            //         //     }); 
            //     });
            
            // const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors);
            // console.log(faceMatcher);

            // faceMatcher._labeledDescriptors.forEach((ld) => {
            //     console.log(`Label: ${ld.label}, Descriptor Length: ${ld.descriptors[0].length}`);
            // });
            
            // 6. Yuzni aniqlash jarayoni
            
            const detectFaces = async () => {
                const detections = await faceapi.detectAllFaces(video)
                    .withFaceLandmarks()
                    .withFaceDescriptors();
                    
                // canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
                // const resizedDetections = faceapi.resizeResults(detections, {
                //     width: video.width,
                //     height: video.height
                // });
                
                // faceapi.draw.drawDetections(canvas, resizedDetections);
                // console.log(detections.length);
                async function getUserById(userId) {
                    try {
                      const response = await fetch(`/api/users/${userId}`);
                      
                      if (!response.ok) {
                        throw new Error(`HTTP xato! Status: ${response.status}`);
                      }
                      
                      const user = await response.json();
                    //   console.log("Foydalanuvchi ma'lumotlari:", user);
                      return user;
                    } catch (error) {
                      console.error("So'rovda xato:", error);
                      throw error;
                    }
                }

                if (detections.length > 0) {
                    // console.log(detections[0].descriptor.length);
                    
                    // const bestMatch = faceapi.euclideanDistance(storedDescriptor, newDescriptor);
                    const bestMatch = faceMatcher.findBestMatch(detections[0].descriptor);
                    // console.log(bestMatch);
                    if (bestMatch.label !== 'unknown') {
                        // console.log(bestMatch)
                        // const userId = "user_987"; // Bu qiymatni forma orqali olish mumkin

                        fetch("/save-json", {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json"
                                },
                                body: JSON.stringify({
                                    user_id: bestMatch.label
                                })
                            })
                            .then(response => response.json())
                            .then(data => {
                            if (data.success) {
                                console.log("✅ Ma’lumot saqlandi:", data.data);
                            } else {
                                console.warn("⚠️ Server xabari:", data.message);
                            }
                            })
                            .catch(error => {
                            console.error("❌ Xatolik yuz berdi:", error);
                        });

                        getUserById(bestMatch.label)
                            .then(user => {
                                // console.log("Foydalanuvchi ID:", user.id);
                                // console.log("Foydalanuvchi ismi:", user.firstName);
                                document.getElementById('fullname').innerText = user.firstName + ' ' + user.lastName;
                                document.getElementById('user-rank').innerText = user.userRank;
                                // console.log("Foydalanuvchi rasmi:", user.photo);
                                document.getElementById('user-photo').src = '/uploads/' + user.photo;
                                // console.log("Foydalanuvchi rasmi:", user.photo);
                                // console.log("Foydalanuvchi familiyasi:", user.lastName);
                                // console.log("Foydalanuvchi lavozimi:", user.userRank);
                                
                            // Ma'lumotlar bilan ishlash
                            // if (user.faceDescriptor) {
                            //     const descriptor = new Float32Array(user.faceDescriptor);
                            //     console.log("Face descriptor:", descriptor);
                            // }
                            });
                        const modal = new bootstrap.Modal(document.getElementById('myModal'));
                        modal.show();

                        // console.log(bestMatch.label);
                        // Topildi - jarayonni to'xtatish
                        stream.getTracks().forEach(track => track.stop());
                        canvas.remove();
                        // showUserInfo(bestMatch.label);
                        return;
                    }
                }
                
                requestAnimationFrame(detectFaces);
            };
            
            detectFaces();
            
        } catch (error) {
            console.error("Yuzni aniqlashda xatolik:", error);
            // showError(error.message);
        } finally {
            startBtn.disabled = false;
            startBtn.textContent = "Yuzni tanishni boshlash";
        }
    }

    async function loginWithFace() {
        const startBtn = document.getElementById('start-recognition');
        const video = document.getElementById('video');
        try {
            startBtn.disabled = true;
            startBtn.textContent = "Ishga tushirilmoqda...";
            
            // 1. Modellarni yuklash
            if (!faceapi.nets.ssdMobilenetv1.params) {
                await loadModels();
            }

            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { width: 400, height: 400 } 
            });
            video.srcObject = stream;
            video.play();
            
            // 3. Video yuklanishini kutish
            await new Promise((resolve) => {
                video.onloadeddata = () => {
                    // console.log("Video yuklandi");
                    resolve();
                };
                // 5 soniyadan keyin timeout
                setTimeout(() => {
                    if (video.readyState < 2) {
                        throw new Error("Video yuklash vaqti tugadi");
                    }
                }, 5000);
            });

            // start
            const detection = await faceapi
                .detectSingleFace(video)
                .withFaceLandmarks()
                .withFaceDescriptor();

            if (!detection) return alert("Yuz topilmadi!");

            const faceEncoding = Array.from(detection.descriptor);

            const res = await fetch('/api/users/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ faceEncoding })
            });

            const result = await res.json();

            if (res.ok) {
                alert(`Xush kelibsiz, ${result.name}!`);
            } else {
                alert(result.message || 'Tanimadim...');
            }
        } catch (error) {
            console.error("Yuzni aniqlashda xatolik:", error);
            // showError(error.message);
        } finally {
            startBtn.disabled = false;
            startBtn.textContent = "Yuzni tanishni boshlash";
        }
    }

    const login = document.getElementById('start-recognition');
    let processing = false;
    const detectedUserIds = new Set();
    let btnstatus = true;

    async function startRealTimeLogin() {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if(btnstatus){
            login.innerText = "Kamerani yopish";
            video.srcObject = stream;
            video.style.display = 'block';

            setInterval(async () => {
                if (processing) return;
                processing = true;

                const detection = await faceapi
                    .detectSingleFace(video)
                    .withFaceLandmarks()
                    .withFaceDescriptor();

                if (detection && detection.descriptor.length === 128) {
                    const faceEncoding = Array.from(detection.descriptor);

                    try {
                        const res = await fetch('/api/users/login', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ faceEncoding })
                        });

                        const result = await res.json();
                        console.log(result);
                        
                        if (res.ok && !detectedUserIds.has(result.id)) {
                            detectedUserIds.add(result.id);
                            showUser(result.name); // foydalanuvchini ko‘rsat
                        }
                    } catch (err) {
                        console.error('Login error:', err);
                    }
                }

                processing = false;
            }, 1500); // har 1.5 sekundda tekshiradi
        } else{
            login.innerText = "Kamerani ishga tushurish";
            processing = false;
            stream.getTracks().forEach(track => track.stop());
        }
        btnstatus = !btnstatus;
    }

    function showUser(name) {
        // console.log(name);
        document.getElementById('name').innerText = name;
    }

    // Login tugmasiga ulash
    login.addEventListener('click', startRealTimeLogin);
});