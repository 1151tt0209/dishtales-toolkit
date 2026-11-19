# Bài học sau mỗi video (đọc trước khi làm video mới, thêm một mục sau mỗi video)

Cách dùng: làm xong video nào thì thêm **một mục ngắn ở TRÊN CÙNG** (mới nhất lên đầu). Chỉ ghi điều *không hiển nhiên từ code*: lỗi đã gặp, cách làm nhanh hơn, chỗ chưa đẹp cần sửa ở video sau, người dùng khen/chê gì. Mục nào đã sửa xong thì gạch bỏ hoặc chuyển vào `CLAUDE.md`.

Mẫu mục:
```
## <tên video> (<độ dài>, <ngày>)
- Làm tốt / người dùng khen:
- Lỗi đã gặp + cách sửa:
- Chỗ chưa đẹp (làm lại ở video sau):
- Làm nhanh hơn nếu:
```

---

## Thumbnail bánh xèo 40s (19/11/2026): quy tắc "mỗi video một ảnh ấn tượng nhất"
- Khung chọn: **23.75 s** (bánh vừa nứt, tôm đỏ + thịt lộ ra, hơi nóng, vụn giòn). Khung 24.2 s (macro quá gần) làm phần nhân thành mảng trừu tượng nên bỏ. Khi chọn: rút contact sheet 6 khung quanh khoảnh khắc "đã nhất" rồi mới chọn.
- Chữ "GIÒN RỤM!" ban đầu 215 px tràn khỏi khung 1080 → `outlined()` giờ tự thu nhỏ theo `maxW`. Luôn Read ảnh sau khi tạo.
- Shorts trên Studio máy tính **có** ô tải thumbnail tùy chỉnh (mục Thumbnail → `(file input)`); đã tải bản dọc 1080×1920 (1.8 MB) và Save thành công. Chưa kiểm tra thumbnail hiển thị thế nào trong feed Shorts trên điện thoại.

## Đăng YouTube bằng Claude in Chrome (19/11/2026, bánh xèo 40s)
- Chạy suôn: `studio.youtube.com/channel/UCqg4Ipce2Li0nn43_1eXwHg/videos/upload?d=ud` → `find` ô `file input` → `file_upload` bản `*-up.mp4` (<10 MB) → tiêu đề (triple_click rồi gõ) → mô tả → bấm vùng trống để tắt popup hashtag → `find` radio "No, it's not made for kids" + "Show more" → `find` "No, AI wasn't used" + ô Tags (gõ có dấu phẩy cuối) → Next ×3 → Public → Publish → link ở hộp "Video published".
- Gõ mô tả dài báo timeout CDP 30 s nhưng **vẫn gõ xong**; đợi vài giây rồi chụp lại kiểm. Cờ 🇬🇧/🇻🇳 hiện thành chữ "GB/VN" trên Windows (không sao).
- Kiểm radio bằng JS: `[...document.querySelectorAll('tp-yt-paper-radio-button')].filter(r=>r.hasAttribute('checked'))`. Mở link Short, `video.pause()` rồi đóng tab.

## Demo 15s bánh xèo, do **Sonnet làm một mình** (`demo15/`, 19/11/2026): thử xem Sonnet có làm được không
- **Kết quả (Claude tự đánh giá, chờ người dùng xem):** làm được trọn vẹn từ code đến MP4 15s (7 shot, chữ song ngữ, âm thanh kiểu Bánh mì) trong một phiên, không dùng subagent Opus. Chất lượng bằng bản 40s ở các cảnh dùng lại props (đổ bột, gấp bánh, đĩa hero, CTA); vẫn có điểm yếu cũ: tay/mặt cartoon, cuộn lá hơi giống ống.
- **Cách làm nhanh:** copy `banhxeo40/` (props + `overlay.js`), viết 1 file `shots.js` gọn cho cả video thay vì A/B/C; âm thanh = `_build_audio.js` ghép **engine + master của `banhmi/audio.js`** (dòng 1–749 và 938–1075) với một `_score.txt` mới → chỉ phải viết phần score (cue theo giây trên hình), ~1 giây render. Cách này nên dùng cho mọi video: không viết lại engine.
- **Lỗi đã gặp:** `L.cam(ctx,cx,cy,…)` đặt (cx,cy) vào giữa màn hình, nên cy ≠ 960 dịch khung lên và lộ **dải đen ở đáy**. Dùng helper `cam()` kẹp tâm camera trong ảnh (xem đầu `demo15/shots.js`). Cuộn lá `leafWrap` scale 2.0 to như ống tre → dùng ~1.45. Tiêu đề đè lên dòng bột đổ → đặt tiêu đề y≈290.
- **Nhịp:** 108 BPM (chưa dùng), 27 beat = đúng 15.0 s; khoảng lặng 10.0–10.45 s rồi cú cắn 10.45 s.

## Quy tắc độ dài (người dùng chốt 19/11/2026)
- **50–70 s, tự phân phối theo món/cảnh.** Gợi ý của Claude: 35–50 s là điểm ngọt cho Shorts món ăn (xem hết nhiều, dễ được xem lại); trên 60 s dễ rớt người xem giữa chừng → gom các bước nhẹ vào một cảnh, giữ 2 gag mạnh nhất. Khi có số liệu giữ chân (YouTube Studio → % xem trung bình) thì ghi vào đây và chỉnh lại khoảng này.

## Bánh xèo miền Tây 40s điện ảnh (`banhxeo40/`, 19/11/2026)
- **Người dùng khen:** chất lượng hình rất tốt. **Ưng nhất vẫn là âm thanh kiểu `banhmi/audio.js`** → xem `AUDIO-SYNC-GUIDE.md`, ưu tiên làm âm thanh theo kiểu đó.
- **Người dùng đòi thêm (chưa làm xong):** các bước làm món (①–⑨) và vài tình huống hài giữa khách Tây và người bán (người bán chỉ cách ăn; khách Tây tới quán thử món). Bản nháp ở `banhxeo40/_v2wip/`. **Lần sau hỏi/đưa ngay các bước + 1–2 gag vào plan từ đầu**, đừng làm bản không bước rồi mới thêm.
- **Nhanh:** chạy 3 subagent Opus song song (shot A, shot B, nhạc), mỗi bên có brief riêng (`BRIEF-shots.md`). Chốt trước vị trí match cut (tâm chảo (540, 1060), bán kính 330) để hai agent nối khớp.
- **Chữ ở `overlay.js`, không ở shot** → đổi chữ không đụng code vẽ. Giữ cách này.
- **Âm thanh:** cú cắn bị soft-clip + limiter hạ ~7 dB, nghe có thể gắt; bed xèo đầu phim dày, dễ rè loa điện thoại. Lần sau: giữ nhạc thưa/im quanh cú cắn thay vì ép; bắt subagent đo ebur128 từng cửa sổ.
- **Chưa đẹp:** lá cải cuốn trông như ống tre; tôm thịt lúc bẻ bánh quá đơn giản; shot thái thịt (0.8s) hơi giả; tay/mặt kiểu cartoon (Má Tư cận mặt, tay khách Tây) kém "cao cấp". Nên làm riêng một bộ tay thật hơn dùng cho cả series.
- **Git:** máy mới chưa có danh tính git và chưa đăng nhập GitHub. Push lần đầu phải chạy `git push` trong **tab Terminal của người dùng** (Git Credential Manager mở trình duyệt đăng nhập); chạy từ shell của Claude sẽ báo "could not read Username". Sau lần đầu thì push bình thường.
