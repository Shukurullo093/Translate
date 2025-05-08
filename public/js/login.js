
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
            const users = await fetch('/api/users').then(res => res.json());
            async function createFaceMatcher(users) {
                // Filter users with descriptors and fetch them in parallel
                const descriptorPromises = users
                    .filter(user => user.faceDescriptor)
                    .map(async (user) => {
                        const response = await fetch('/faces/' + user.faceDescriptor.split('/').pop());
                        const array = await response.json();
                        const descriptor = new Float32Array(array); // Convert to Float32Array
                        return new faceapi.LabeledFaceDescriptors(
                            user.id,
                            [descriptor] // Wrap in array (can add multiple descriptors per user)
                        );
                    });
            
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
                  
                  // Foydalanish
                  

                if (detections.length > 0) {
                    // console.log(detections[0].descriptor.length);
                    
                    // const bestMatch = faceapi.euclideanDistance(storedDescriptor, newDescriptor);
                    const bestMatch = faceMatcher.findBestMatch(detections[0].descriptor);
                    // console.log(bestMatch);
                    if (bestMatch.label !== 'unknown') {
                        // console.log(bestMatch)
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

    // Login tugmasiga ulash
    document.getElementById('start-recognition').addEventListener('click', startFaceRecognition);
});