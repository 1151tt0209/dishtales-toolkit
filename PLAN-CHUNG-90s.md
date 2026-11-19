# Quy chuẩn chung cho loạt video 90 giây (từ 18/11/2026)

Người dùng dặn 18/11/2026: **mọi video dài 1:20–1:40** (chốt **90 giây**) và **cuối video có đoạn kêu gọi LIKE + FOLLOW**.

## Kỹ thuật
- Khung dọc 1080×1920, 30 fps, `DUR = 90` (2700 khung). 120 BPM → mọi mốc cắt nằm trên lưới 0,5 s.
- Bộ công cụ giống `bundau/` (lib.js, props.js, world.js, people.js, text.js, shotsA.js + shotsB.js, shots.js, render.js, audio.js).
- Chữ song ngữ: dòng Việt to màu vàng kem, dòng Anh nhỏ màu trắng bên dưới. Vùng an toàn x 70–930, y < 1560.
- `GRAIN = 0.05` (thấp hơn bản 60 s để file nén nhẹ hơn).
- Render đủ ra `video_noaudio.mp4`, ghép `audio.wav` ra `<ten>.mp4` (aac 256k).
- Bản tải lên < 10 MB: nén 2-pass, video ~720k, audio aac 96k → `<ten>-up.mp4`.

## Cấu trúc 4 hồi (28 cảnh)
| Hồi | Thời gian | Nội dung |
|---|---|---|
| I – Mở màn | 0–15 | Toàn cảnh thành phố, nhân vật khách Tây xuất hiện, tựa đề ở 12.0 |
| II – Nghi lễ nấu | 15–60.5 | 15 cảnh, mỗi bước 1 cảnh có số thứ tự ①②③… |
| III – Hài + cao trào | 60.5–84.5 | Khách Tây gặp sự cố hài → im lặng 0,5 s → miếng cắn bùng nổ → end card tên món + Dish Tales |
| IV – Kêu gọi | 84.5–90 | **CTA LIKE + FOLLOW** (giống nhau ở mọi video) |

## Cảnh CTA (84.5–90) – giống nhau mọi video
- Nền: cảnh quán mờ (blur) tối dần, khách Tây trung cảnh ở dưới giữa, cười, giơ ngón cái (`thumbsUp`), nháy mắt ở 86.5.
- 84.7: nút **tim LIKE** đỏ nảy vào (outBack) ở x≈330, y≈760, có số "+1" bay lên, tim đập theo nhịp beat (mỗi 0,5 s).
- 85.2: nút **FOLLOW** (viên thuốc đỏ #fe2c55 bo tròn, chữ trắng "FOLLOW / THEO DÕI" ) trượt vào ở x≈700, y≈760; 86.0 một bàn tay hoạt hình nhấn nút → nút đổi thành "✓ ĐÃ THEO DÕI / FOLLOWING" màu xám, lóe sáng nhẹ, pháo giấy nhỏ.
- 85.0–89.4 chữ lớn giữa màn (y≈520): **"Thấy ngon thì LIKE & FOLLOW nhé!"** / "Hungry? LIKE & FOLLOW for more!"
- 86.5–89.4 dòng dưới (y≈1400): **"Món tiếp theo là gì? Comment nhé!"** / "Which dish next? Tell us in the comments!"
- Logo nhỏ "Dish Tales" ở y≈1500. Tối dần về đen 89.4–90.
- Âm thanh: nhạc chủ đề nhắc lại nhẹ, tiếng "pop" khi tim nảy, "ding" khi +1, "click" + "ting" khi nhấn FOLLOW, pháo giấy lách tách, nốt kết ngân rồi tắt hẳn ở 90.

## Lịch đăng
- 3 video, mỗi ngày 1 video: 19/11, 20/11, 21/11/2026, cả YouTube (Dish Tales) và TikTok (@hoainiemxuacu12), cùng giờ.
- Người dùng muốn view nước ngoài → giờ đẹp cho Mỹ/Âu, né mốc của loạt Shorts cũ (02:00/07:00/21:00) và TikTok cũ (6:30/9:30/12:00).
