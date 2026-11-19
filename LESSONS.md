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
