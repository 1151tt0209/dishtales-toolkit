# Dự án video hoạt hình ẩm thực (Dish Tales)

Đọc file này trước khi làm việc.

## Nơi làm việc: làm thẳng trên ổ D
- Người dùng dặn tối 18/11/2026 (thay quy tắc "làm trên C rồi chuyển sang D"): **mỗi video làm thẳng trong `D:\DishTales-hoathinh\<tên>\`**, không chuyển C→D nữa. Copy bộ công cụ từ video gần nhất trên D sang thư mục mới, rồi render, xem trước và nén ngay trên D (`finish.sh` dùng được).
- Claude in Chrome chỉ tải lên được file trong thư mục phiên → copy file nén vào `thevideo\_upload\` tạm, đăng xong thì xóa.
- `D:\DishTales-hoathinh\` là kho lưu: bản sao `CLAUDE.md`, `PLAN-*.md`, `SKILL-...txt` và thư mục các video đã xong (`buncha/`, `botchien/`, `mixaogion/`, `pho/`…).

## Cách làm video (bắt buộc đọc)
- Quy trình chi tiết 9 bước: `C:\Users\admin\OneDrive\Desktop\thevideo\SKILL-lam-video-hoat-hinh.txt`, có bản sao ở `D:\DishTales-hoathinh\`.
- Video vẽ hoàn toàn bằng code: Node.js + `@napi-rs/canvas` vẽ từng khung → `ffmpeg-static` ghép video. Nhạc và hiệu ứng âm thanh cũng tạo bằng code (`audio.js`, giao subagent Opus viết).
- Mỗi video một thư mục. Video mới thì copy bộ công cụ từ video gần nhất rồi sửa:
  - `banhmi/`: bánh mì thịt, 30s, khung ngang 16:9 + bản dọc. `lib.js` có camera, ánh sáng, hơi nước, hạt bụi.
  - `bundau/`: bún đậu mắm tôm Hà Nội, 60s dọc. `world.js` đã đổi sang phố cổ Hà Nội buổi trưa (mái ngói, tường vàng, cây bàng lá đỏ); `food.js` (mẹt, lá chuối, đậu rán, chả cốm, thịt luộc, bún lá, rau thơm, bát mắm tôm, vết mắm bắn, đũa, dao).
- `bunmam/`: bún mắm miền Tây, 60s dọc. Có `river.js` (sông, ghe, xuồng, cô Út, nồi, tô, đồ ăn, rổ rau, sóng mùi). Font tựa đề đổi sang Cambria Bold (Georgia không có dấu Ắ/Ề).
- `caphe/`: cà phê đen Sài Gòn, 45s, **dựng thẳng khung dọc 1080×1920**. Dùng làm mẫu cho video mới:
    - `lib.js` (helper chung), `props.js` (phin, ly, đá, ấm, bếp, tay), `world.js` (phố Sài Gòn, xe máy, chú Sáu), `people.js` (nhân vật khách Tây: dáng ngồi/đi, mặt cận, mắt đặc tả, ngón cái).
    - `text.js` (chữ song ngữ, tựa đề, end card), `shotsA.js` + `shotsB.js` (17 cảnh), `shots.js` (mốc thời gian), `render.js`, `audio.js`.
- Lệnh: `node render.js --sheet all` (xem trước 1 khung mỗi cảnh) · `node render.js --sheet 1.5,7.2 ten.png` · `node render.js` (render đủ + ghép `audio.wav`) · `node audio.js`.
- Luôn xem ảnh xem trước, sửa lỗi rồi mới render đủ.
- `banhxeo40/`: bánh xèo bản **40s quảng cáo điện ảnh** (không hài), làm theo prompt 6 cảnh của người dùng (19/11/2026), dùng lại props của `banhxeo/`. Hai điểm mới đáng dùng lại:
  - **`overlay.js`**: toàn bộ chữ vẽ ở một chỗ, sau khi chỉnh màu (shot không tự vẽ chữ). Đổi chữ/thời gian không cần đụng code shot. `render.js --notext` để xem hình không chữ.
  - Shot nhận **"T ảo"** (`shots.js` của `_v2wip/`): kéo dài video, chèn shot mới mà không phải sửa shot cũ.
  - `_v2wip/`: bản ~58s đang dừng (thêm các bước ①–⑨ + 4 cảnh hài khách Tây – Má Tư chỉ cách ăn), xem README trong đó. `BRIEF-shots.md` nhắc `_old70/` = thư mục `banhxeo/`.

## Sau mỗi video: 4 việc (người dùng dặn 19/11/2026, để video sau nhanh và xịn hơn)
1. **Ghi bài học** vào `LESSONS.md` (mục mới trên cùng: khen/chê, lỗi + cách sửa, chỗ chưa đẹp, cách làm nhanh hơn). **Đầu mỗi video mới: đọc `LESSONS.md` + `AUDIO-SYNC-GUIDE.md` trước.**
2. **Cập nhật `CLAUDE.md`**: bảng "Video đã làm", nhạc đã dùng (BPM/nhạc cụ), thư viện nhân vật nếu có nhân vật/pose mới.
3. **Nếu viết được thứ dùng lại** (hàm SFX, helper camera, kiểu chữ): gom vào file chung thay vì copy-paste, ghi vào `LESSONS.md`.
4. **Commit + push** (`git add -A && git commit && git push`) để repo luôn mới nhất. Không đẩy mp4/wav/ảnh preview.

**Ưu tiên cao nhất: âm thanh theo kiểu `banhmi/audio.js`** (người dùng rất thích, 19/11/2026). Mỗi video mới: lập cue sheet từng giây theo sự kiện trên hình, mỗi hành động một tiếng riêng, pan theo chuyển động, duck nhạc dưới SFX, im lặng trước cú cắn, và để người dùng nghe thử trước khi đăng.

## Phong cách người dùng thích
- **Độ dài: 50–70 giây, tự phân phối theo món và theo cảnh** (người dùng dặn 19/11/2026, thay quy tắc "1:00–1:40" cũ). Món ít bước/ít chuyện thì ~50 s; món nhiều bước + có gag hài thì ~60–70 s. Không cần hỏi lại, tự cân đối cho hợp. CTA ~5 giây cuối. Cấu trúc tham khảo `PLAN-CHUNG-90s.md` (rút gọn các hồi). Video 90 s cũ (bún chả, bột chiên, nem nướng…) và 30s/45s/60s chỉ là mẫu code. Kèm theo: kịch bản luôn có **các bước làm món + 1–2 gag hài khách Tây – người bán**.
- **Cuối mọi video có đoạn kêu gọi LIKE + FOLLOW** (84.5–90s: nút tim + nút FOLLOW được bấm, chữ song ngữ "Thấy ngon thì LIKE & FOLLOW nhé!" / "Hungry? LIKE & FOLLOW for more!" + câu hỏi comment).
- Nén để tải lên (giới hạn 10 MB/lần qua Claude in Chrome): 90s dọc → video ~720k + audio aac 96k, `GRAIN = 0.05`.
- Kênh nhắm **người xem nước ngoài** (Mỹ/Âu): tiêu đề/mô tả **tiếng Anh trước**, tiếng Việt sau.
- Điện ảnh: cận/xa, máy quay chuyển động, quay chậm, ngược sáng, hơi nước, lóe sáng ống kính, chỉnh màu cam–xanh, hạt phim.
- **Nhạc mỗi video phải khác** (người dùng dặn 18/11/2026): khác BPM, nhạc cụ, giọng, groove và jingle CTA; lưới cắt cảnh theo phách của BPM đó. Đã dùng: dân gian Bắc bộ 120 BPM (sáo, đàn tranh, mõ: bún chả, bột chiên, mì xào giòn) · lo-fi 80 BPM + đàn bầu + Rhodes (phở) · 8-bit chiptune funk 150 BPM (bánh tráng trộn) · bossa-reggae Mekong 100 BPM (nem nướng) · cumbia + surf guitar 96 BPM (hủ tiếu) · swing manouche gypsy jazz 125 BPM, clarinet + đàn kìm (bánh xèo) · Mekong spaghetti western 90 BPM, huýt sáo + guitar baritone twang + trumpet + đàn bầu (cá lóc) · Saigon city-pop/disco-funk 112.5 BPM, slap bass + Rhodes + synth brass (cơm tấm). Làm từng video một (plan → làm → đăng).
- **Âm thanh: bản ưng nhất là `banhmi/audio.js`** (người dùng dặn 19/11/2026: SFX rất khớp hình). Làm `audio.js` mới theo `AUDIO-SYNC-GUIDE.md` (mỗi hành động một tiếng đặt đúng giây trên hình, pan chạy theo chuyển động, duck nhạc dưới SFX, khoảng lặng trước cú cắn). Brief cho subagent nhạc phải trỏ tới `banhmi/audio.js`.
- Pha chút hài nhẹ ở hồi cuối. Nhân vật **khách Tây tóc vàng** (kính râm cài đầu, áo xanh ngọc, ba lô) là nhân vật xuyên suốt series.
- **Mọi chữ trên video đều song ngữ** (dòng Việt to màu vàng kem, dòng Anh nhỏ màu trắng bên dưới). Chữ đặt trong vùng an toàn: x 70–930, y < 1560 (tránh nút của Shorts/TikTok).
- Lên plan chi tiết (bảng cảnh, thời gian, góc máy, chữ), lưu `PLAN-<tên>.md`. **Tự duyệt rồi làm luôn, không cần hỏi người dùng** (người dùng dặn 18/11/2026).
- **Không hỏi người dùng nữa, tự quyết và chạy tiếp** (người dùng dặn 19/11/2026: "làm j đừng có hỏi nữa… tôi đi ngủ để bạn tự chạy"; rõ hơn: "từ bây giờ đến 6h sáng tự quyết định đừng hỏi tôi"). Khi người dùng ngủ/vắng thì hạn chế hỏi tối đa. Việc trong dự án (đăng, hẹn giờ, sửa/xóa bài trùng của chính kênh) cứ làm rồi báo lại sau.

## Thư viện nhân vật (DÙNG LẠI, chỉ vẽ mới khi nhân vật chưa có)
**Quy tắc (người dùng dặn 19/11/2026):** làm video mới thì *copy file code nhân vật có sẵn từ `D:\DishTales-hoathinh\<video cũ>\`* và gọi lại, chỉ vẽ nhân vật chưa có trong bảng. Nhân vật mới cũng phải vẽ cùng phong cách: không viền đen, đổ bóng gradient mềm, mắt to. Đổi màu áo/tóc/đồ vật qua tùy chọn `o` chứ không viết lại hàm.

| Nhân vật | Video | File + hàm (ổ D) | Ghi chú |
|---|---|---|---|
| **Khách Tây tóc vàng** (series chính) | tất cả | **`caphe/people.js`**: `tourist`, `face`, `eyeMacro`, `thumbsUp` (+ `SKIN, HAIR, SHIRT`) | Bản chuẩn, đẹp trai nhất: mắt xanh to, tóc vàng dựng, kính râm phản chiếu món ăn (`glassesFn`), áo xanh ngọc `#2f8f8a`. **Luôn dùng bản này.** Bản `comtam/ct_chars.js` (viền, mặt tròn, tàn nhang) kém đẹp, không dùng nữa |
| Khách Tây (dáng ngồi xuồng, nhiều biểu cảm) | nem nướng, hủ tiếu, bánh xèo | `nemnuong/nprops.js`: `tourist`, `touristFace`; `banhxeo/bx_chars.js`: `tourist` (pose `knifeFork`, `pointTry`, `dumpBowl`, biểu cảm `foggy`/`crunch`) | Dùng khi cảnh có xuồng/ghế thấp |
| **Cô Út** (miền Tây, bà ba tím, nón lá) | bún mắm, nem nướng, bún chả/bún đậu (đổi màu) | `nemnuong/nprops.js` (mới nhất): `coUt`, `coUtFace`, `coUtBoat`; cũ hơn `bunmam/river.js` | Đổi palette thành Cô Lan (bún chả, `buncha/shotsA.js` `coLan`), Dì Bảy (hủ tiếu, `hutieu/hp_chars.js` `coUt`/`diBay`, áo xanh), Cô Hằng (bún đậu, áo nâu) |
| Chú lái xuồng / người bán chợ nổi | nem nướng, hủ tiếu | `nemnuong/nprops.js`: `boatman`, `vendor`, `crowdBoats`; `hutieu/hp_chars.js`: `vendorH`, `crowdBoatsH` | |
| **Chú Sáu** (bán hàng Sài Gòn) | cà phê, bột chiên, mì xào giòn | `caphe/world.js` / `botchien/world.js`: `uncle` (+ phố Sài Gòn, xe đẩy, xe máy) | Bột chiên thêm khăn vắt vai |
| **Cô Ba** (bánh tráng trộn) + học sinh | bánh tráng trộn | `banhtrangtron/tprops.js`: `coBa`, `coBaFace`, `kidFace`, `kidLook(seed)` | |
| **Ông Tư** (phở Hà Nội, mũ nồi, áo len nâu) | phở | `pho/pprops.js`: `ongTu`, `ongTuFace` | |
| **Chú A Phát** (đầu bếp Chợ Lớn, tạp dề trắng) | mì xào giòn | `mixaogion/` (`cholon.js`, `world.js`) | |
| **Má Tư** (bánh xèo, áo bà ba nâu đỏ, tóc bạc) | bánh xèo | `banhxeo/bx_chars.js`: `maTu`, `maTuFace` (pose pour/swirl/spatula/pick/offer/plate/laugh/wink) | Header file là tài liệu API đầy đủ |
| **Chú Ba** (nông dân, đêm trăng) + ếch, cò | cá lóc nướng trui | `caloc/cl_chars.js`: `chuBa` (pose stand/wade/trapDown/skewer…) | Có sẵn ánh trăng/lửa qua `o.night`, `o.fireLight` |
| **Cô Năm** (cơm tấm Sài Gòn, áo lilac, kẹp càng cua) + mèo, gà trống | cơm tấm | `comtam/ct_chars.js`: `coNam` (pose fan/tongs/plate/pour/eyebrow/laugh/wipe) | Có `o.dawn`, `o.light`, `o.neon` |
| Cô bán hàng phố cổ Hà Nội, quán/mẹt/ghế nhựa | bún đậu, bún chả, phở | `bundau/` → `buncha/` (`river.js`, `world.js`) | Phố cổ, mẹt tre, rau thơm đã có |

**Mẹo:** mỗi file nhân vật có header liệt kê API và pose. Đọc header trước khi gọi (không đoán). Nhân vật có hàm `*Face` dùng cho cận mặt. Mọi hàm đều `(ctx, x, y, s, o)` với (x,y) là giữa hai bàn chân, `o.flip` lật hướng, `o.t` là thời gian.
**Mẫu video điện ảnh 66s** (kịch bản 21 cảnh, 11 chuyển động máy, công thức âm thanh): xem `PLAN-VIDEO-DIEN-ANH.txt`.
**Còn thiếu nhạc đã dùng** của bún mắm, bún đậu, bún chả, bột chiên, mì xào giòn trong bảng video: xem `audio.js` của từng thư mục nếu cần tránh trùng.

## Git (đồng bộ giữa các máy)
- Repo riêng tư: https://github.com/1151tt0209/dishtales-toolkit (nhánh main). Máy mới: `git clone <link>`, rồi `npm install` trong thư mục video cần làm. Repo chỉ chứa code, kịch bản, CLAUDE.md; không có video/wav/ảnh preview/node_modules.
- Làm xong video mới: `git add -A && git commit -m "<tên video>" && git push` trong `D:DishTales-hoathinh` để repo luôn mới nhất.

## Đăng bài
- **Thumbnail (người dùng dặn 19/11/2026): mỗi video đăng YouTube phải có thumbnail cuốn hút, chọn 1 ảnh ấn tượng nhất.** Làm bằng `banhxeo40/thumb.js`: `node render.js --stills <giây> --notext` lấy khung đẹp nhất (món ăn rõ, có hơi nóng/nhân lộ ra, ví dụ khoảnh khắc bẻ bánh), rồi `node thumb.js previews\still_<giây>.png thumbnail` → `thumbnail_vertical.png` (1080×1920, dùng cho Shorts) + `thumbnail_wide.png` (1280×720). Chữ to có viền (tiêu đề ngắn 2–3 từ như "GIÒN RỤM!" + tên món + dải đỏ tiếng Anh), tia sáng lấp lánh quanh món, chữ vừa khung (hàm `outlined` tự thu nhỏ). **Xem ảnh trước khi up** (lần đầu chữ tràn mép, ảnh phóng quá to thành mảng trừu tượng → zoom ≤1.15). Tải lên: trang `studio.youtube.com/video/<id>/edit` → `find` ô "(file input)" ở mục Thumbnail → `file_upload` → Save (hiện "Changes saved"). Ảnh < 2 MB.
- Kênh đã có loạt Shorts khác hẹn mỗi ngày (từ 20/11) và TikTok có bài lúc 6:30/9:30/12:00 hằng ngày → video mới hẹn giờ né các mốc đó, cách video trước 2–3 tiếng, giờ đẹp (11:30, 19:00, 21:00...).
- YouTube: kênh "Dish Tales" @DishTalesShorts (Studio channel id UCqg4Ipce2Li0nn43_1eXwHg). TikTok: @hoainiemxuacu12 ("Những Ngày Xưa Cũ"), đăng qua tiktok.com/tiktokstudio/upload.
- Dùng **Claude in Chrome** (Chrome của người dùng, đã đăng nhập sẵn), không dùng browser pane.
- File tải lên tối đa **10 MB** → nén 2-pass (45s dọc: video ~1620k, audio aac 112k).
- Tiêu đề, mô tả, tag **song ngữ**; đăng **công khai ngay**; YouTube chọn "không dành cho trẻ em", mục AI chọn "Không" (hoạt hình cách điệu).
- TikTok lúc mới đăng có thể hiện "đang xét duyệt / Chỉ mình tôi", đợi ~30s tải lại sẽ thành "Mọi người".
- **Làm xong video nào thì đăng (hẹn giờ) video đó ngay**, không đợi làm xong nhiều video rồi mới up (người dùng dặn 18/11/2026).
- Làm xong: gửi người dùng link + **đóng toàn bộ group tab Chrome**.

## Chia việc cho subagent
- Việc khó (vẽ, nhạc, debug) → `opus`; việc dễ (viết mô tả, nén file, tìm file) → `sonnet`, và kiểm tra lại kết quả.

## Video đã làm
| Video | Thư mục | YouTube | TikTok |
|---|---|---|---|
| Bánh mì Việt Nam (30s) | `banhmi/` | https://youtube.com/shorts/I4p8NNlrLiE | https://www.tiktok.com/@hoainiemxuacu12/video/7709398794533604616 |
| Cà phê đen Sài Gòn (45s) | `caphe/` | https://youtube.com/shorts/GMl7LT5Qk9w | https://www.tiktok.com/@hoainiemxuacu12/video/7709439728931573000 |
| Bún mắm miền Tây (60s) | `bunmam/` | https://youtube.com/shorts/FprtPbHpCVo (hẹn 19:00 18/11) | hẹn 19:00 18/11 trên TikTok Studio (link có sau khi đăng) |
| Bún đậu mắm tôm Hà Nội (60s) | `bundau/` | https://youtube.com/shorts/CtSq4JnxIy8 (hẹn 21:30 18/11) | hẹn 21:30 18/11 trên TikTok Studio (link có sau khi đăng) |
| Bún chả Hà Nội (90s) | `D:\DishTales-hoathinh\buncha\` | https://youtube.com/shorts/uRevM9WRg14 (hẹn 23:00 19/11) | hẹn 23:00 19/11 trên TikTok Studio (link có sau khi đăng) |
| Bột chiên Sài Gòn (90s) | `D:\DishTales-hoathinh\botchien\` | https://youtube.com/shorts/pN5Hlxp8yT8 (hẹn 23:00 20/11) | hẹn 23:00 20/11 trên TikTok Studio (link có sau khi đăng) |
| Mì xào giòn Chợ Lớn (90s) | `D:\DishTales-hoathinh\mixaogion\` | https://youtube.com/shorts/kf3E2QOvCCM (hẹn 23:00 21/11) | hẹn 23:00 21/11 trên TikTok Studio (link có sau khi đăng) |
| Phở bò Hà Nội (90s, lo-fi 80 BPM, đàn bầu) | `D:\DishTales-hoathinh\pho\` | https://youtube.com/shorts/EIjW9Yn8baI (hẹn 23:00 22/11) | hẹn 23:00 22/11 trên TikTok Studio (link có sau khi đăng) |
| Bánh tráng trộn Sài Gòn (90s, 8-bit chiptune funk 150 BPM) | `D:\DishTales-hoathinh\banhtrangtron\` | https://youtube.com/shorts/w3B1t6OSsIc (công khai ngay 19/11) | https://www.tiktok.com/@hoainiemxuacu12/video/7709561968826305813 (đăng ngay 19/11; bản hẹn 19:00 cũ đã xóa) |
| Nem nướng Cái Răng trên chợ nổi (90s, bossa-reggae Mekong 100 BPM) | `D:\DishTales-hoathinh\nemnuong\` | https://youtube.com/shorts/FRQIvKo-o00 (hẹn 23:00 23/11) | hẹn 23:00 23/11 trên TikTok Studio (link có sau khi đăng) |
| Hủ tiếu chợ nổi Cái Răng (70s, cumbia + surf guitar 96 BPM) | `D:\DishTales-hoathinh\hutieu\` | https://youtube.com/shorts/Q9FpblYhgzc (hẹn 23:00 24/11) | hẹn 23:00 24/11 trên TikTok Studio (link có sau khi đăng) |
| Bánh xèo miền Tây (70s, swing manouche gypsy jazz 125 BPM) | `D:\DishTales-hoathinh\banhxeo\` | https://youtube.com/shorts/M6Z5NM3uU-U (hẹn 23:00 25/11) | hẹn 23:00 25/11 trên TikTok Studio (link có sau khi đăng) |
| Cá lóc nướng trui (70s, Mekong spaghetti western 90 BPM) | `D:\DishTales-hoathinh\caloc\` | https://youtube.com/shorts/EZm9oJLY3Bc (hẹn 23:00 26/11) | hẹn 23:00 26/11 trên TikTok Studio (link có sau khi đăng) |
| Cơm tấm Sài Gòn (68s, Saigon city-pop/disco-funk 112.5 BPM) | `D:\DishTales-hoathinh\comtam\` | https://youtube.com/shorts/l-HAUfiq6Eo (công khai ngay 19/11, người dùng dặn "up và public ngay") | chưa đăng (lần này người dùng chỉ yêu cầu YouTube) |
| Bánh xèo miền Tây bản 40s điện ảnh (ethereal folk 72 BPM, đàn tranh + sáo + đàn bầu) | `banhxeo40/` (máy làm: `C:\Users\Admin\OneDrive\Desktop\hh3d\banhxeo40\`) | https://youtube.com/shorts/6FqwrYZXUS8 (công khai ngay 19/11, người dùng dặn "up public") | chưa đăng |

## Ghi chú đăng bài (18/11/2026)
- Giờ hẹn chuẩn cho video 90s: **23:00 giờ VN** (= 11:00 sáng miền Đông Mỹ, 16:00 giờ Anh; né 02:00/07:00/21:00 của loạt Shorts kia và 6:30/9:30/12:00 trên TikTok). Bánh tráng trộn: không kịp đăng 23:00 ngày 18/11. Người dùng chọn làm kỹ rồi hẹn sau, vào giờ đẹp gần nhất không trùng lịch (dự kiến 19:00 ngày 19/11, trước bún chả 23:00). Các video sau vẫn theo quy tắc cũ: mỗi ngày một video lúc 23:00, nối tiếp ngày cuối đã hẹn (phở 22/11). Vậy nem nướng 23/11, rồi hàng chờ từ 24/11.

## Đợt làm đêm 18→19/11/2026
- Làm liên tục đến **6h sáng 19/11**. Hết quota thì dừng, đợi phục hồi rồi làm tiếp.
- Đến 6h mà video còn dở thì làm xong video đó rồi mới nghỉ. Nghỉ thì **tắt máy**.
- Các video còn lại để đợt sau.

## Hàng chờ (người dùng giao 18/11/2026, làm lần lượt từng video)
Kế tiếp: **lẩu mắm miền Tây** (`D:\DishTales-hoathinh\laumam\`, ~70s, nhạc khác spaghetti western và city-pop, hẹn 23:00 27/11). Hủ tiếu (24/11), bánh xèo (25/11) và cá lóc nướng trui (`caloc/`, 70s, hẹn 23:00 26/11) đã xong. Cơm tấm (mục 10, `comtam/`) làm chen ngang 19/11 và đăng công khai ngay, không chiếm ngày hẹn nào → lịch 23:00 vẫn nối tiếp từ 26/11. Làm tiếp theo thứ tự dưới đây (bỏ các mục đã xong). Mỗi video hẹn 23:00, mỗi ngày một video, nối tiếp ngày cuối đã hẹn. Mỗi video: lên plan (tự duyệt) → làm → đăng → làm món kế tiếp luôn. Mỗi video một kiểu nhạc khác, xen kẽ, không trùng video liền trước.
**Ưu tiên món sông nước** (người dùng dặn 18/11/2026: các món này đều rất đặc biệt ở Việt Nam).
- **Bối cảnh:** chợ nổi, ghe, xuồng, bến sông, nhà sàn ven kênh miền Tây.
- **Code dựng lại được:** lấy từ `D:\DishTales-hoathinh\bunmam\river.js` (sông, ghe, xuồng, cô Út).
- **Trong nhóm sông nước:** đổi kiểu cảnh giữa các video để không lặp, ví dụ sáng sớm chợ nổi, trưa trên ghe, hoàng hôn bến sông, đêm đèn lồng.

*Nhóm sông nước (làm trước):*
1. ~~Hủ tiếu chợ nổi Cái Răng~~ (xong)
2. ~~Bánh xèo miền Tây~~ (xong)
3. ~~Cá lóc nướng trui~~ (xong)
4. Lẩu mắm miền Tây (bông điên điển, bông súng)
5. Chè ba màu (bán trên xuồng)
6. Kem dừa Bến Tre (rừng dừa, ghe chở dừa)
7. Bánh canh cua
8. Bún riêu cua đồng
9. Bánh tét lá cẩm Cần Thơ

*Các món khác:*
10. ~~Cơm tấm~~ (xong)
11. Gỏi cuốn
12. Bánh tráng nướng
13. Cá viên chiên
14. Nem chua rán
15. Bắp nướng mỡ hành
16. Xiên nướng
17. Bún bò Huế
18. Cà phê trứng Hà Nội
19. Cao lầu Hội An
20. Mì Quảng
21. Bánh cuốn Thanh Trì
22. Bánh khọt Vũng Tàu
23. Bò lá lốt
24. Chả cá Lã Vọng
25. Cơm gà Hội An
26. Bánh bèo Huế
27. Ốc xào me Sài Gòn
28. Hột vịt lộn
29. Xôi xéo Hà Nội
30. Bánh căn Phan Rang
31. Sinh tố bơ

## Ghi chú đăng bài (tiếp)
- Mỗi thư mục video có `metadata.md` (tiêu đề, mô tả, tag, caption TikTok). `D:\DishTales-hoathinh\finish.sh <thư mục> <tên>` ghép audio + nén 2-pass ra `<tên>-up.mp4` (<10 MB).
- Claude in Chrome chỉ tải lên được file trong thư mục phiên → copy file nén vào `thevideo\_upload\` tạm, đăng xong thì xóa.
- TikTok: **không dùng execCommand** để điền caption (trang báo lỗi) → bấm vào ô, gõ bằng phím; phút hẹn giờ chọn bằng JS `scrollIntoView` + click vào `.tiktok-timepicker-right` có chữ "00".
