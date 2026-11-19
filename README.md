# DishTales: bộ công cụ làm video hoạt hình món ăn

Node + @napi-rs/canvas (1080x1920, 30 fps) + ffmpeg-static. Âm thanh dựng bằng code (không cần phần mềm ngoài).

- **`CLAUDE.md`**: quy tắc làm video, phong cách, bảng video đã làm và **Thư viện nhân vật** (dùng lại, chỉ vẽ nhân vật mới). Claude đọc file này đầu tiên.
- **`PLAN-VIDEO-DIEN-ANH.txt`**: mẫu video điện ảnh 66 giây (kịch bản, góc máy, âm thanh).
- **`SKILL-lam-video-hoat-hinh.txt`**: quy trình 9 bước.
- Mỗi thư mục (`caphe/`, `banhmi/`, `comtam/`...) là một video: `shots*.js`, `render.js`, `audio.js` và code đồ vật/nhân vật.

Cách chạy một video: `cd <thư mục>`, `npm install`, `node render.js` rồi dựng audio, ghép bằng `finish.sh`. Video, wav, ảnh preview và `node_modules` không đưa lên git (xem `.gitignore`).
