# Âm thanh khớp hình: rút từ `banhmi/audio.js` (bản người dùng ưng nhất)

Người dùng dặn 19/11/2026: **hiệu ứng âm thanh của video Bánh mì (30s) là bản ưng nhất, rất khớp hình.** Mọi `audio.js` mới phải làm theo kiểu này.
Khi giao subagent Opus viết `audio.js`: **bắt nó đọc `banhmi/audio.js` trước** (tái dùng các hàm SFX và master chain), rồi đưa cue sheet từng giây.

## Vì sao nó khớp: 8 nguyên tắc

1. **Mỗi nguyên liệu/hành động một tiếng riêng, đặt đúng giây của sự kiện trên hình, không chỉ đúng nhịp cắt.**
   Bơ `squish` 8.1 · pate `smear` 9.6 · thịt `whoosh` bay vào 11.0/11.5 · `plop` rơi 12.1…13.6 · dao `chop` 14.3/14.8 ·
   rót sốt `pourSizzle` 15.6 · dưa leo `cucumberSnap` 17.3 · đồ chua `rustleCrunch` 19.2 · rau `leafRustle` 20.6 · nước tương `bloopSplash` 24.4 · cối tiêu `pepperMill` 24.8 · giấy gói `paperRustle` 26.0 · xe máy `scooter` 27.0 · cú cắn `biteCrunch`.
   Quy trình: xem `--sheet`, ghi **giây chính xác của từng va chạm** (chạm, rơi, cắt, nứt), rồi mới đặt tiếng.
2. **Cảnh cắt trên nhịp (beat grid) + "cut accent" mỗi lần cắt**: `tick` hoặc `tom` rất nhỏ (gain 0.07–0.16), đổi trái/phải liên tục (`pan ±0.45`). Người xem thấy nhịp mà không nhận ra là tiếng đệm.
3. **Pan chạy theo chuyển động trên màn hình.** `pan` nhận hàm `(t) => …`: whoosh thịt bay từ trái sang phải dùng `-0.7 + 2.4*t`, bay ngược `0.6 - 2.2*t`; whip pan quét `-0.9 + 6*t`; xe máy có doppler + hấp thụ không khí. Tiếng tĩnh thì đặt pan cố định (bơ lắc nhẹ bằng sin).
4. **Sidechain duck nhạc dưới SFX** (đoạn "7a" cuối file): envelope follower trên bus SFX (attack 5 ms, release 250 ms) hạ nhạc tới −38%. Đây là lý do tiếng dao, tiếng giòn nổi rõ mà không phải giảm nhạc bằng tay.
   Thêm **trim nhạc theo hồi** (dawn 0.78 → ritual 0.88 → climax 1.0), ramp 20 ms đúng chỗ cắt.
5. **Khoảng lặng trước cú cắn**: 28.0–28.5 im tuyệt đối. `put()` cắt cứng mọi thứ bắt đầu trước mốc đó (fade 10 ms) + cổng im lặng ở master. Cú cắn (gain 1.5) là tiếng to nhất phim, **vào ngay lúc hết im**, rồi mới tới hợp âm kết ngân.
6. **Dựng căng trước cao trào**: riser kết thúc đúng downbeat (7.0→8.0); snare roll + hat 16 + riser 25.0→26.0; "drop" 23.5–25.0 (bỏ kick, pad lọc xuống 500 Hz, tom thấp 65 Hz) để cao trào 26.0 bùng nổ.
7. **Tiếng "ting" lấp lánh đúng thang âm của nhạc** (`m2f(98…110)`, ngũ cung D): SFX không lệch tông với đàn bầu/đàn tranh.
8. **Cuối chuỗi: reverb Freeverb → limiter true-peak 4× oversample (trần −1.6 dBTP) → cổng im lặng → WAV.** Có `rngFor('tên cue')`: mỗi cue một PRNG có seed, render lại ra đúng tiếng cũ.

## Cấu trúc file (làm theo để subagent không lạc)
1. Hằng số, PRNG, toán · 2. DSP (biquad, noise burst, wavetable) · 3. Nhạc cụ (đàn bầu, đàn tranh Karplus–Strong, pad, drone, trống, bass) · 4. **Một hàm sinh cho mỗi cue SFX** · 5. Bus MUSIC/SFX + `put(bus, t0, sig, {gain, pan, rev, right})` · 6. Score theo hồi · 7. Master (duck → reverb → saturation → limiter → WAV).

## Bài học từ bánh xèo 40s (19/11/2026)
- Subagent không nghe được → **bắt nó đo ebur128 từng cửa sổ** và báo; người dùng nghe thử trước khi đăng.
- Ở `banhxeo40/audio.js`, cú cắn muốn to nhất thì phải **soft-clip rồi để limiter hạ ~7 dB** → dễ nghe gắt/nén. Cách của bánh mì tốt hơn: **giữ nhạc thưa/im quanh cú cắn** (khoảng lặng + duck) để cú cắn tự to mà không cần ép.
- Bed xèo 0–17 s dày và nhiều tần số, limiter phải gánh 2–4 dB → dễ rè trên loa điện thoại. Nên giảm bed, để từng tiếng xèo/cuộn có chỗ thở.
- Cue sheet lập **trước** theo giây trên hình, dùng chung cho cả shot và audio (bảng trong `PLAN-*.md`). Nếu đổi timeline (ví dụ bản dài `_v2wip/`), dịch cue theo shot chứ đừng viết lại.

## Ý tưởng tối ưu cho video sau
- Gom danh sách **mốc sự kiện (chạm, rơi, cắt, nứt…)** vào một file `cues.js` dùng chung: `shots` đọc để chọn đúng frame, `audio.js` đọc để đặt tiếng. Đổi mốc ở một chỗ thì hình và tiếng cùng đổi, hết lệch.
- Tách thư viện SFX của `banhmi/audio.js` thành `sfxlib.js` dùng chung (squish, smear, whoosh, plop, chop, pourSizzle, snap, rustle, ting, bloop, pepperMill, scooter, biteCrunch) để video mới khỏi copy 1000 dòng.
