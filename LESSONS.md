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

## Cút lộn xào me (`cutlonxaome/`, 60.000 s, 20/11/2026): công thức bước + 2 gag, phiên bản làm trên ổ C
- **Cách làm:** plan `PLAN-cut-lon-xao-me.md` (14 cảnh, lưới 128 BPM: 128 phách = đúng 60.000 s, CUTS theo phách) → 3 agent vẽ song song theo chủ sở hữu cảnh (A: s1–s5, B: s6–s9, C: s10–s14, `shots.js` chọn theo số cảnh) + 1 agent âm thanh (`_score.txt` bảng CUES, chỉ cột đầu là giờ). Mốc sự kiện các agent báo về khớp bảng CUES nên âm thanh không phải chỉnh lại. Toàn bộ chữ ở `overlay.js`.
- **Âm thanh (đo bằng `audio_measure.js`):** khoảng lặng tuyệt đối 42.656–43.125, cú cắn 43.125 to nhất, peak −1.8 dBTP, 60.0000 s. Chưa ai nghe bằng tai: người dùng nghe thử trước khi đăng.
- **Nén:** `-b:v 1100k` 2-pass + aac 96k → 9.06 MB (<10 MB). Bản full 55 MB chỉ để xem.
- **Lưu ý quy trình:** `thumb.js` cứng chữ của video trước (KÉO SỢI…); phải sửa chữ + tọa độ lấp lánh mỗi video. Lần sau nên tham số hóa chữ qua argv/json. Khung thumbnail chọn: đĩa trứng s7 ở 25.0 s (rõ món, rau răm), dải đỏ EN "STIR-FRIED BALUT EGGS". Bản ngang 1280×720 bị chữ che phần trên chùm trứng, cân nhắc crop thấp hơn.
- **Chỗ chưa đẹp:** da nhân vật ở cận cảnh còn phẳng, nhân vật s13 nhỏ, đĩa bị cắt đáy ở s14.
- **Tách gọi lại được:** `cl_food.js` (`cutLon`, `eggCap`, `ramLeaf`, `cutLonPlate`, `eggPos`) cho các món trứng/đĩa; `b_props.js` (tay, đũa, chảo, lửa, mèo, sạp).
- **Đã đăng 3 kênh (20/11/2026, người dùng dặn public luôn, không hẹn giờ):** YouTube Shorts https://youtube.com/shorts/VvAiHgvsNnA, TikTok @hoainiemxuacu12, Facebook Reel trang Dish Tales. Cả ba dùng chung `cutlonxaome-up.mp4` (9.06 MB) vì `file_upload` của Claude in Chrome giới hạn ~10 MB.
- **Bẫy YouTube Studio:** (1) đừng để hashtag trong tiêu đề: gõ `#shorts` làm hiện dropdown gợi ý và tự đổi thành `#shortsvideo`; hashtag chỉ để ở mô tả. (2) Gõ mô tả bằng click toạ độ mù đã rơi vào ô Tiêu đề (980/100): luôn dùng `find` lấy ref ô Title và ô Description, kiểm tra bộ đếm ký tự. Tiêu đề thật đã đăng: `Stir-Fried Balut Eggs in Tamarind Sauce | Cút Lộn Xào Me | Saigon Night Street Food` (khác dòng title có emoji + #shorts trong `metadata.md`).
- **Bẫy Facebook Reels** (`facebook.com/reels/create`): ref nút "Thêm video" là `div` nên `file_upload` báo "Element is not a file input"; phải `find "input type=file accept video"` lấy đúng ref thẻ input. Luồng: thêm video → caption → Tiếp → Đăng (đối tượng Công khai, tắt nhãn AI). `javascript_tool` bị chặn khi trả URL có query string, lấy link reel từ `tabs_context_mcp`.
- **TikTok Studio:** bài mới hiện "đang được xét duyệt / Chỉ mình tôi" khoảng 30 giây rồi tự thành "Mọi người"; đã kiểm lại ở trang Bài đăng. Gõ caption bằng phím, không dùng `execCommand`. Lấy link bài bằng `a[href*="/video/"]` trong danh sách.

---

## Bánh bò nướng lá dứa (`banhbo/`, 62 s, 19/11/2026): video đầu tiên làm đúng công thức "bước + 2 gag + cảnh sao"
- **Cách làm (mất ~1 giờ):** viết `PLAN-banh-bo-nuong.md` trước (bảng 14 cảnh trên lưới 104 BPM, **cột "mốc sự kiện" theo giây dùng chung cho hình và tiếng**), rồi 3 agent Opus chạy song song: A = cảnh quy trình (s2–s6), B = bánh + gag + xé + cắn + CTA (s1, s7–s14, tự viết `bb_cake.js`), C = âm thanh. Chữ viết sẵn trong `overlay.js` từ bảng cảnh. A và B chốt trước điểm nối: s6 kết ở khuôn tại (540,1000) bán kính 300, s7 bắt đầu đúng chỗ đó. Gửi cho B thông tin palette Cô Út (`P.PURPLE`) sau khi A xong, nếu không áo đổi màu giữa các cảnh.
- **Agent âm thanh (C) làm tốt:** mọi mốc ở một bảng `CUE` đầu `_score.txt` → hình đổi 0.1 s thì sửa một dòng. Cú cắn 46.731 to nhất phim (khoảng lặng tuyệt đối 46.154–46.731) mà **không cần soft-clip**: limiter chỉ ăn 0.7 dB. Tổng thể −18.3 LUFS (nhỏ hơn mức −14 thường gặp cho Shorts, chấp nhận để giữ cú cắn). Chưa ai nghe bằng tai: người dùng nghe thử file trước giờ hẹn.
- **Lỗi/chỗ chưa đẹp:** (1) hook s1 lần đầu hai cánh tay như hai cây gậy dài → sửa bằng cẳng tay ngắn + khuỷu (`o.upper` trong `C.softHand`); (2) cảnh xé s10 lần đầu dáng đứng dạng chân rộng → cắt khung từ đùi trở lên; (3) tay vẫn như ma-nơ-canh ở cảnh macro; ruột bánh nhìn nghiêng thành vệt thay vì ô tổ ong (nhìn thẳng thì đẹp); (4) cú cắn s12 khi nhìn lại khung 46.8 s chưa thấy miệng cắn rõ, nên làm cận miệng hơn lần sau.
- **Thumbnail:** khung 1.5 s (hook xé bánh, ruột xanh + sợi + hơi nóng), chữ "KÉO SỢI!" + dải đỏ "PANDAN HONEYCOMB CAKE". Dải đỏ phải thu chữ xuống 44 px cho vừa. Tải bản dọc lúc đăng.
- **Đăng YouTube:** hẹn giờ (không công khai ngay) để người dùng nghe thử, theo giờ mới trong CLAUDE.md. Tab "Details" của Studio **tự giữ mặc định "Không dành cho trẻ em" và danh mục Howto & Style** từ cài đặt kênh vừa đặt; nhớ chọn playlist "Vietnamese Street Food Animated" ở ô Playlists; giờ hẹn chọn trong danh sách. Gõ mô tả lần đầu bị nuốt (click lúc trang đang tải), dùng `find` ô Description + `scroll_to` + click rồi gõ lại; vẫn báo timeout CDP nhưng gõ xong.
- **Nhanh hơn nếu:** copy `banhbo/` làm khung (đã có `bb_prep.js`, `bb_cake.js`), tách `sfxlib.js` từ `_score.txt` (SFX mới: chày cối, vắt vải, rây bột, đập trứng, đánh bột, lò than, bong bóng bột, boing lò xo, kéo sợi dính, đứt sợi, nhai), và có thư viện "tay" thật hơn.

---

## Rà kênh YouTube + dời giờ đăng (19/11/2026)
- **Chính sách kiếm tiền: không vi phạm.** Không gậy (3 mức tính năng đều Enabled), không khiếu nại bản quyền, mọi video "không dành cho trẻ em". Mốc: 500 sub + 3M view Shorts/90 ngày (hoặc 3.000 giờ) mở hội viên; 1.000 sub + 10M view Shorts (hoặc 4.000 giờ) mở quảng cáo. Kênh đang 174 sub, ~3.8K view/28 ngày.
- **Rủi ro còn lại:** (1) 20 video học tiếng Anh cũ (2024, Unlisted) + playlist "Full 300 chủ đề tiếng anh" còn Public, lạc chủ đề; (2) loạt Shorts lịch sử Private cùng một khuôn, đừng mở công khai cả loạt một lúc (dễ bị coi là nội dung lặp/sản xuất hàng loạt); (3) chưa chọn quốc gia cư trú; từ khóa kênh trống; danh mục tải lên mặc định "None"; mô tả kênh còn nhắc pizza/tacos.
- **Giờ đăng:** xem mục "Giờ đăng" trong CLAUDE.md. Bài học thao tác: ô giờ lịch hẹn phải chọn trong danh sách, và bố cục hộp thoại đổi theo chiều cao khung (730 → 674 px) nên chụp lại ảnh trước khi bấm theo tọa độ.
- **Đã làm sau khi người dùng đồng ý ("làm hết"):** 20 video học tiếng Anh cũ + playlist "Full 300 chủ đề tiếng anh" → Private; từ khóa kênh (12 từ khóa món Việt); mặc định tải lên: danh mục Howto & Style, ngôn ngữ video + tiêu đề/mô tả English; kênh mặc định "không dành cho trẻ em"; mô tả kênh viết lại (English trước, 1 đoạn Việt); tạo playlist công khai "Vietnamese Street Food Animated | Món Ngon Việt Nam" gồm 8 Shorts món Việt đã đăng + 7 Shorts đang hẹn (tự hiện khi đăng). **Video mới nên thêm vào playlist này ngay khi đăng.**
- **Vẫn chờ người dùng:** quốc gia cư trú (Settings → Channel → Basic info), cần họ tự chọn.
- **Thao tác:** Studio bulk edit hiện hộp "Are you sure?" cần tích ô xác nhận; sau khi chọn hàng loạt thanh công cụ đổi bố cục nên chụp lại ảnh trước khi bấm Edit (lần đầu bấm nhầm "Add to playlist").

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
