# DishTales: bộ công cụ làm video hoạt hình món ăn

Node + @napi-rs/canvas (1080x1920, 30 fps) + ffmpeg-static. Hình và âm thanh đều dựng bằng code (không cần phần mềm ngoài). Mỗi thư mục (`caphe/`, `banhmi/`, `comtam/`, `banhxeo40/`...) là một video: `shots*.js`, `render.js`, `audio.js` và code đồ vật/nhân vật.

## 👉 Dành cho Claude: nhận link repo này là làm theo đúng thứ tự này

1. **Clone repo** (nếu chưa có): `git clone https://github.com/1151tt0209/dishtales-toolkit.git`, rồi `npm install` trong thư mục video cần làm.
2. **Đọc theo thứ tự, trước khi đụng vào code hay giao việc cho subagent:**
   1. `CLAUDE.md`: quy tắc, phong cách, bảng video đã làm, **thư viện nhân vật (dùng lại, chỉ vẽ nhân vật mới)**, quy trình đăng bài.
   2. `LESSONS.md`: bài học và lỗi của các video trước (mục mới nhất ở trên cùng).
   3. `AUDIO-SYNC-GUIDE.md`: cách làm âm thanh khớp hình, theo `banhmi/audio.js`.
   4. `SKILL-lam-video-hoat-hinh.txt` (quy trình 9 bước) và `PLAN-VIDEO-DIEN-ANH.txt` (mẫu kịch bản điện ảnh).
3. **Làm video** theo kịch bản người dùng đưa, copy bộ công cụ từ video gần nhất rồi sửa.
4. **Sau mỗi video, cập nhật tài liệu này** (xem "4 việc sau mỗi video" trong `CLAUDE.md`), rồi commit + push. Tài liệu phải tốt lên sau mỗi video: đó là yêu cầu của người dùng.

## 10 điều quan trọng nhất (tóm tắt, chi tiết trong `CLAUDE.md`)

1. **Âm thanh là ưu tiên số 1, làm theo kiểu `banhmi/audio.js`**: mỗi hành động một tiếng riêng đúng giây trên hình, pan theo chuyển động, nhạc tự hạ khi có SFX, im lặng trước cú cắn. Subagent không nghe được → người dùng nghe thử trước khi đăng.
2. **Mọi chữ trên video song ngữ** (Việt to vàng kem, Anh nhỏ trắng), trong vùng an toàn x 70–930, y < 1560. Chữ vẽ ở `overlay.js` (xem `banhxeo40/`), không vẽ trong shot.
3. **Cuối mọi video có LIKE + FOLLOW** (tim + nút follow được bấm, chữ song ngữ, câu hỏi comment).
4. **Mỗi video một kiểu nhạc khác** (BPM, nhạc cụ, groove); cắt cảnh trên nhịp của nhạc đó.
5. **Độ dài 50–70 giây, tự phân phối theo món và cảnh** (ít bước ~50 s, nhiều bước + gag ~60–70 s).
   **Kịch bản gồm các bước làm món + vài gag hài giữa khách Tây và người bán** (bánh xèo 40s thiếu hai thứ này nên bị đòi làm lại; đưa vào plan ngay từ đầu).
6. **Dùng lại nhân vật có sẵn**, đổi màu qua tùy chọn `o`, đừng viết lại hàm. Khách Tây tóc vàng xuyên suốt, luôn dùng bản `caphe/people.js`.
7. **Xem ảnh xem trước (`--sheet`) và sửa 2–3 vòng trước khi render đủ.** Cảnh cận tay/mặt kiểu cartoon, lá cuốn, tôm thịt là chỗ hay kém đẹp.
8. **Chia việc cho subagent theo độ khó**: vẽ, nhạc, debug → `opus`; việc nhẹ → `sonnet`, luôn kiểm tra lại. Hai agent vẽ chung video phải chốt trước vị trí match cut.
9. **Đăng bài bằng Claude in Chrome** (Chrome của người dùng), tiêu đề/mô tả song ngữ, **tiếng Anh trước**; file tải lên < 10 MB (nén 2-pass).
10. **Git:** repo chỉ chứa code, kịch bản, tài liệu; không có mp4/wav/ảnh/`node_modules`. **Máy mới chưa đăng nhập GitHub thì chạy `git push` trong tab Terminal của người dùng** (Git Credential Manager mở trình duyệt); chạy từ shell của Claude sẽ báo "could not read Username".

## Chạy một video

`cd <thư mục>`, `npm install`, `node render.js --sheet all` (xem trước), `node audio.js`, `node render.js` (render đủ và ghép `audio.wav`), rồi `finish.sh` để nén cho upload. Video, wav, ảnh preview và `node_modules` không đưa lên git (xem `.gitignore`).

## Bản đồ tài liệu

| File | Nội dung |
|---|---|
| `CLAUDE.md` | Quy tắc, phong cách, thư viện nhân vật, bảng video, đăng bài, hàng chờ |
| `LESSONS.md` | Bài học sau mỗi video (mới nhất ở trên) |
| `AUDIO-SYNC-GUIDE.md` | Âm thanh khớp hình theo `banhmi/audio.js` |
| `SKILL-lam-video-hoat-hinh.txt` | Quy trình 9 bước từ kịch bản đến đăng |
| `PLAN-VIDEO-DIEN-ANH.txt` | Mẫu video điện ảnh 66 giây |
| `PLAN-*.md` | Kịch bản từng món |
| `banhxeo40/_v2wip/` | Bản bánh xèo ~58s đang dừng (các bước ①–⑨ + gag), có README |
