# Plan: HỦ TIẾU CHỢ NỔI CÁI RĂNG (Cần Thơ): Shorts dọc 70 giây, điện ảnh, có hài

Thư mục làm: `D:\DishTales-hoathinh\hutieu\` (làm thẳng trên D). Đọc kèm `PLAN-CHUNG-90s.md`, nhưng dùng mốc thời gian của file này.

**Bộ công cụ**
- Copy từ `nemnuong/`: lib, props, people, text, render, shots, `nprops.js` (sông, ghe, xuồng, cô Út, khách Tây, chú lái xuồng, chợ nổi). Lấy bản mới nhất trên D; nếu nem nướng chưa chuyển sang D thì lấy ở C.
- Đồ mới viết vào **`hprops.js`** (require `nprops.js`), không sửa lung tung `nprops.js`. Chỉ thêm tùy chọn ban ngày và đổi màu nhân vật (xem mục Đồ mới).

**Ưu tiên sông nước:** cả video diễn ra trên mặt sông, không lên bờ.

**Thời điểm: 8 giờ sáng, nắng gắt, chợ đông.** Phải khác hẳn nem nướng (bình minh hồng 5:30, có sương).
- Trời xanh đậm, mây trắng cumulus, không sương.
- Mặt trời cao chừng 35°, chiếu chéo từ sau lưng chủ thể. Vẫn ngược sáng được nhưng bóng đổ gắt, viền sáng trắng vàng.
- Mặt nước lấp lánh dày đặc. Ghe chen kín, màu bão hòa: thân ghe đỏ, xanh lá; khóm vàng, bí cam, dưa hấu xanh sọc.
- Chỉnh màu cam–xanh nhưng sáng, đậm, tương phản cao. Hơi nước trắng nổi bật trên nền trời xanh, hơi nóng lung linh trên nồi.

**Nhịp: 96 BPM.** 1 phách = 0.625 s, 1 ô nhịp = 2.5 s, 28 ô nhịp = **70.0 s** (2100 khung, 30 fps). Mọi điểm cắt cảnh nằm trên lưới 0.625 s. Cột "phách" ghi số phách tính từ 0.

## Ý tưởng
- Chợ nổi đông nghẹt lúc 8 giờ. Khách Tây ngồi xuồng ba lá, nóng toát mồ hôi, phe phẩy mũ.
- Một làn hơi trắng bốc lên từ chiếc ghe nhỏ của **dì Bảy bán hủ tiếu**. Nồi nước lèo to, ninh xương từ 3 giờ sáng.
- Khách không biết gọi món. Anh học cách chợ nổi treo hàng trên cây bẹo: giơ **gậy selfie gắn tờ giấy "1 TÔ / 1 BOWL"** như một cây bẹo. Dì Bảy bật cười.
- Nghi lễ nấu: trụng hủ tiếu trong vợt, xếp thịt, tôm, gan, trứng cút, hẹ, tỏi phi, chan nước lèo (hơi bùng), giá, chanh, ớt. Rồi trao tô qua mạn ghe.
- **Hài mới: "Cú húp chấn động chợ nổi".** Không lặp cuốn nem trên cây bẹo hay xoạc chân giữa hai thuyền, không dùng sóng ghe máy.
  - Khách Tây ăn kiểu lịch sự: múc từng muỗng nhỏ, ngón út cong lên.
  - Dì Bảy lắc đầu: "Phải húp mới ngon!" rồi làm mẫu một cú "sụp" gọn gàng.
  - Anh kéo kính râm xuống, hít một hơi thật sâu: "Giữ ba lô giùm!".
  - Anh húp một cú **SỤUUUP** khủng khiếp. Sợi hủ tiếu bay vèo vào miệng như dây zipline, nước trong tô cạn sạch. Sóng âm lan thành vòng tròn trên mặt sông làm ghe chao, nón lá bay, cò trắng giật mình bay lên.
  - Cả chợ đứng hình nhìn anh. Sợi hủ tiếu cuối cùng quất "chát" vào kính râm. **Im lặng một phách.**
  - Dì Bảy nhe răng cười, giơ tô lên. **Cả chợ nổi đồng loạt húp "SỤP!" theo phách.**
  - Anh sung sướng giơ tô rỗng: "Thêm tô nữa!".

## Nhân vật
- **Dì Bảy:** dùng lại `coUt` trong `nprops.js`, đổi bảng màu: áo bà ba xanh coban, khăn rằn đỏ–đen, nón lá, quần đen. Thêm vài tư thế nấu (xem Đồ mới).
- **Khách Tây** (`tourist`): áo xanh ngọc, kính râm cài đầu, ba lô, áo phao cam. Thêm mồ hôi lấm tấm, thêm tư thế cầm tô và mặt húp.
- **Chú lái xuồng** (`boatman`): như nem nướng. Trong cảnh hài thì há hốc, rồi cũng húp theo.
- **Nền:** ghe treo bẹo (khóm, bí, khoai, dưa hấu), ghe máy, xuồng nhỏ, người bán hàng (`vendor`, `crowdBoats`) cầm tô thay cho cuốn nem.

## Dùng lại từ `nprops.js`
- `floatingMarket` và `riverSide` (thêm chế độ ban ngày), `water`, `ripples`, `boatWake`, `splash`.
- `ghe`, `motorBoat`, `xuongBaLa`, `beoPole`, `crowdBoats`, `vendor`.
- `coUt`/`coUtFace` (đổi màu), `tourist`/`touristFace`, `boatman`.
- `charcoalStove` (phóng to, làm bếp dưới nồi lèo), `steam`, `embers`, `flavorBurst` (đổi nhãn), `waveWhoosh`, `toppingFall`, `cHand`, `cArm`.

## Đồ mới (`hprops.js`)
**Môi trường**
- `daySky(ctx,y0,y1,o)`: trời xanh đậm 8 giờ sáng, mây cumulus trôi chậm, mặt trời trắng vàng cao có lóe sáng.
- `floatingMarket` / `riverSide` thêm `o.tod:'morning'`: tắt sương, nắng gắt, thân ghe đậm màu, mặt nước lấp lánh dày, bóng đổ gắt. Cache sprite riêng cho bảng màu ngày.
- `heatShimmer(ctx,x,y,w,h,t)`: hơi nóng lung linh trên miệng nồi (dịch dải ảnh, không dùng filter blur).

**Ghe và bếp**
- `hutieuBoat(ctx,x,y,s,o)`: ghe hủ tiếu của dì Bảy, mui che bằng bạt xanh. Các vị trí trả về: bếp + `brothPot` giữa ghe, chồng tô, khay topping, rổ hủ tiếu, ghế dì Bảy. Có `part:'back'|'front'` như `coUtBoat`.
- `brothPot(ctx,x,y,s,o)`: nồi nhôm lớn móp méo, có nắp. `o.lid` 0..1 (nhấc nắp), `o.boil` (sủi lăn tăn), xương ống, củ cải, hành nướng nổi. `o.view` 'side'|'top', `o.steam`.
- `ladle(ctx,x,y,s,rot,o)` + `brothStream(ctx,x0,y0,x1,y1,t,o)`: vá múc và dòng nước lèo **trong, vàng óng, có giọt mỡ lấp lánh**. Khác `sauceStream` (sốt cam sệt).
- `noodleBasket(ctx,x,y,s,rot,o)`: vợt trụng cán dài. `o.fill` (sợi hủ tiếu), `o.dip` 0..1, `o.shake`, `o.drip` (nhỏ giọt ngược sáng).
- `noodles(ctx,x,y,s,o)`: búi sợi hủ tiếu trắng trong, `o.wet`, `o.dry` (sợi khô cứng trước khi trụng), `o.lift` (sợi được gắp lên).

**Tô và topping**
- `huTieuBowl(ctx,x,y,s,o)`: tô sứ trắng viền hoa văn xanh. `o.view` 'top'|'side'|'3q'.
  - `o.layers` 0..7: 1 sợi, 2 thịt xá xíu, 3 tôm, 4 gan, 5 trứng cút bổ đôi, 6 hẹ, 7 tỏi phi. Số lẻ = lớp đang rơi xuống.
  - `o.broth` 0..1 (mực nước lèo), `o.garnish` (giá, chanh, ớt), `o.slosh`, `o.level` (mực nước tụt khi húp).
  - Trả về `rim`, `center`.
- Topping lẻ, đủ đẹp để quay đặc tả: `porkSlice` (viền đỏ xá xíu), `shrimp`, `liverSlice`, `quailEgg` (bổ đôi, lòng đỏ), `chives`, `beanSprouts`, `limeWedge`, `chiliSlices`.
- `toppingFall` thêm `kind:'garlic'` (tỏi phi vàng giòn) và `'chives'`.
- `garnishPlate(ctx,x,y,s,o)`: dĩa giá, chanh, ớt, rau quế.
- `spoon(ctx,x,y,s,rot,o)` (muỗng sứ) + `chopsticks`.

**Tư thế nhân vật mới**
- `coUt` thêm: `o.palette` (bảng màu dì Bảy), tư thế `'basket'` (lắc vợt theo phách), `'ladle'` (chan nước), `'slurp'` (bưng tô húp gọn), `'handBowl'` (đưa tô qua mạn, `k`).
- `tourist` thêm: `'sip'` (muỗng nhỏ, ngón út cong), `'bowl'` (bưng tô sát miệng), `'slurp'` (má hóp, `o.k`), `'sign'` (giơ gậy selfie gắn giấy), `'fanHat'` (phe phẩy vì nóng), mồ hôi `o.sweat`.
- `touristFace` thêm: `'determined'` (kính kéo xuống mắt, phồng má), `'slurp'`, `'noodleSlap'` (sợi dính trên kính), `'bliss'` (đã có).
- `vendor` / `crowdBoats` thêm `o.item:'bowl'` + `o.slurp` 0..1 (giơ tô húp đồng loạt).

**Hiệu ứng và đạo cụ hài**
- `selfieSign(ctx,x,y,s,rot,o)`: gậy selfie gắn tờ giấy viết tay "1 TÔ / 1 BOWL" (song ngữ), lắc lư như cây bẹo.
- `slurpRings(ctx,x,y,s,k,o)`: các vòng sóng âm lan trên mặt nước (phối cảnh elip), kèm vệt chữ hoạt hình.
- `noodleZip(ctx,x0,y0,x1,y1,k,o)`: dải sợi hủ tiếu bay vèo vào miệng, đuôi quất lại.
- `heron(ctx,x,y,s,o)`: cò trắng bay lên, vỗ cánh theo `o.t`.
- `steamBurst(ctx,t,x,y,s,k,o)`: cột hơi bùng lớn khi chan nước lèo, ngược sáng, sáng viền.

## Kịch bản 22 cảnh

### HỒI I: Chợ nổi giữa nắng (0–11.25s)
| # | Thời gian (phách) | Cỡ cảnh / máy | Nội dung | Chữ |
|---|---|---|---|---|
| 1 | 0–3.75 (0–6) | Toàn rất xa, drone lướt nhanh rồi hạ dần | Trời xanh, mây trắng, sông lấp lánh, ghe chen kín, cây bẹo lố nhố, ghe máy rẽ sóng | CHỢ NỔI CÁI RĂNG · 8:00 SÁNG / Cai Rang Floating Market · 8:00 AM |
| 2 | 3.75–6.25 (6–10) | Trung, máy trôi cùng xuồng | Khách Tây ngồi xuồng len giữa ghe, mồ hôi nhễ nhại, lấy mũ phe phẩy, nheo mắt vì nắng | |
| 3 | 6.25–8.75 (10–14) | Cận, ngược sáng | Nắp nồi nhôm nhấc lên, cột hơi trắng bốc vào nắng. Máy lia: khách Tây hít hà, quay phắt lại | |
| 4 | 8.75–11.25 (14–18) | Đặc tả, slow-mo | Vá nước lèo vàng óng đổ xuống, tia bắn lấp lánh dưới nắng, lóe sáng ống kính. **Flash 8.75** + tựa đề | **HỦ TIẾU CHỢ NỔI** · Floating Market Noodle Soup |

### HỒI II: Nghi lễ nấu trên ghe (11.25–40.0s)
| # | Thời gian (phách) | Cỡ cảnh / máy | Nội dung | Chữ |
|---|---|---|---|---|
| 5 | 11.25–13.75 (18–22) | Cận, máy chúi xuống nồi | Nồi xương sôi lăn tăn: xương ống, củ cải, hành nướng. Hơi nóng lung linh. Đồng hồ nhỏ góc khung chỉ 3:00 rồi quay tới 8:00 | ① Ninh xương từ 3 giờ sáng · Bone broth simmering since 3 AM |
| 6 | 13.75–17.5 (22–28) | Trung, hai ghe | Ghe dì Bảy áp sát, móc xuồng bằng móc tre: "Hủ tiếu hông?" Khách Tây lúng túng, rồi giơ gậy selfie gắn giấy như cây bẹo. Dì Bảy bật cười | "Hủ tiếu hông con?" · "Noodle soup?" — giấy: **1 TÔ / 1 BOWL** |
| 7 | 17.5–20.0 (28–32) | Đặc tả | Búi hủ tiếu khô thả vào vợt, nhúng nồi nước sôi, lắc 3 lần đúng phách | ② Trụng hủ tiếu · Blanch the noodles |
| 8 | 20.0–22.5 (32–36) | Đặc tả, slow-mo, ngược sáng | Nhấc vợt, nước rỏ thành giọt lấp lánh, trút sợi vào tô | ③ Ráo nước, vào tô · Drain & into the bowl |
| 9 | 22.5–26.25 (36–42) | Top-down, bày theo phách | Thịt xá xíu xòe quạt, tôm, rồi gan, trứng cút bổ đôi, hẹ xanh. Mỗi món rơi xuống đúng một phách | ④ Thịt, tôm · Pork & shrimp → ⑤ Gan, trứng cút, hẹ · Liver, quail eggs, chives |
| 10 | 26.25–28.75 (42–46) | Đặc tả | Tỏi phi vàng rắc xuống, hạt tỏi lấp lánh như kim tuyến | ⑥ Tỏi phi · Fried garlic |
| 11 | 28.75–32.5 (46–52) | Cận góc thấp, slow-mo | Dì Bảy chan vá nước lèo lớn. **Hơi bùng** thành cột trắng ngược nắng, có tia sáng xuyên qua. **Flash 30.0** | ⑦ Chan nước lèo · Ladle the broth |
| 12 | 32.5–35.0 (52–56) | Đặc tả | Giá trụng, lát ớt đỏ rơi xuống, vắt chanh, tia nước chanh bắn lấp lánh | ⑧ Giá, chanh, ớt · Sprouts, lime & chili |
| 13 | 35.0–37.5 (56–60) | Cận, máy xoay quanh tô | Tô hoàn chỉnh, hơi bốc, váng mỡ lấp lánh, ngược sáng, lóe sáng ống kính | |
| 14 | 37.5–40.0 (60–64) | Trung, hai mạn ghe | Dì Bảy đưa tô qua khe nước giữa hai thuyền, khách Tây đỡ hai tay, nước trong tô sóng sánh mà không đổ | ⑨ Trao tô qua ghe · Boat-to-boat delivery |

### HỒI III: Cú húp chấn động (40.0–65.0s)
| # | Thời gian (phách) | Cỡ cảnh / máy | Nội dung | Chữ |
|---|---|---|---|---|
| 15 | 40.0–45.0 (64–72) | Trung, hai người ở hai thuyền | Khách Tây múc từng muỗng nhỏ, ngón út cong. Dì Bảy lắc đầu, bưng tô làm mẫu một cú "sụp" gọn gàng, sợi vèo vào miệng | "Phải húp mới ngon!" · "You gotta SLURP it!" → "Sụp!" · "Slurp!" |
| 16 | 45.0–47.5 (72–76) | Cận mặt, máy đẩy vào | Khách Tây kéo kính râm xuống mắt, tháo ba lô dúi cho chú lái xuồng, hít căng lồng ngực | "Giữ ba lô giùm!" · "Hold my backpack!" |
| 17 | 47.5–50.0 (76–80) | Cận → toàn rộng | **SỤUUUP:** sợi bay vèo như zipline, nước trong tô cạn sạch. Vòng sóng âm lan khắp mặt sông, ghe chao, nón lá bay, cò trắng bay lên. **Flash 47.5** | **SỤUUUP!** · **SLUUURP!** |
| 18 | 50.0–52.5 (80–84) | Toàn, máy đứng yên | Cả chợ đứng hình nhìn anh. Sợi cuối quất "chát" vào kính râm (51.25). **Im lặng 51.875–52.5**, chỉ còn tiếng nước vỗ | |
| 19 | 52.5–55.0 (84–88) | Trung → toàn, máy giật lùi | Dì Bảy nhe răng cười, giơ tô. Cả chợ nổi đồng loạt húp "SỤP!" theo 4 phách. **Flash 52.5** | Cả chợ cùng húp! · The whole market slurps! |
| 20 | 55.0–58.75 (88–94) | Cận mặt khách Tây | Mặt sung sướng, vòng hương vị bùng quanh mặt. Anh giơ tô rỗng, dì Bảy giơ 2 ngón | Ngọt xương! Dai! Thơm tỏi! Cay! · Rich! Chewy! Garlicky! Spicy! → "Thêm tô nữa!" · "One more bowl!" |
| 21 | 58.75–65.0 (94–104) | Drone rút cao | Chợ nổi rực nắng, mặt sông lấp lánh, hơi từ ghe dì Bảy bay lên. End card ở **60.0** | **HỦ TIẾU CHỢ NỔI** · Nóng hổi. Ngọt xương. Húp thật to! · Hot. Rich. Slurp loud! + Dish Tales |

### HỒI IV: Kêu gọi (65.0–70.0s)
| # | Thời gian (phách) | Nội dung |
|---|---|---|
| 22 | 65.0–70.0 (104–112) | Cảnh CTA chung, rút gọn theo lưới 0.625 s. Nền là chợ nổi mờ dưới nắng, khách Tây giơ ngón cái, nháy mắt ở 66.875. 65.0 tim LIKE nảy vào, tim đập mỗi phách. 65.625 nút FOLLOW trượt vào. **66.25** tay bấm FOLLOW, nút đổi thành "✓ ĐÃ THEO DÕI / FOLLOWING". 65.625–69.375 chữ lớn **"Thấy ngon thì LIKE & FOLLOW nhé!"** / "Hungry? LIKE & FOLLOW for more!". 66.875–69.375 câu hỏi **"Bạn húp to hay ăn nhỏ nhẹ? Comment nhé!"** / "Loud slurper or quiet sipper? Tell us!". 69.375–70 tối dần về đen |

**Flash:** 8.75 (0.5) · 30.0 (0.3) · 40.0 (0.25) · 47.5 (0.4) · 52.5 (0.7) · 60.0 (0.25) · 66.25 (0.2). Tất cả đều nằm trên phách: 14 · 48 · 64 · 76 · 84 · 96 · 106.

**Chữ:** mọi dòng song ngữ (Việt vàng kem to, Anh trắng nhỏ). Vùng an toàn x 70–930, y < 1560. Chữ bước ①–⑨ đặt y ≈ 300–420 để không che tô (tô thường nằm giữa–dưới khung). Giấy "1 TÔ / 1 BOWL" cũng song ngữ.

## Âm thanh: phong cách MỚI, "Cumbia sông nước + surf twang"
**Khác hẳn các video trước**
- Dân gian 120 BPM (sáo, đàn tranh, mõ).
- Lo-fi 80 BPM (đàn bầu, Rhodes).
- Chiptune funk 150 BPM.
- Bossa-reggae 100 BPM (guitar nylon, ukulele, contrabass, đàn kìm, steel pan).
- Không dùng lại nhạc cụ đặc trưng nào ở trên.

**Nhịp và hòa âm**
- 96 BPM, groove cumbia: bass "tumbao" nốt gốc–nốt năm ở phách 1 và 3, accordion đánh phách lệch, güira cào đều nốt móc đơn "chucu-chucu".
- Giọng La thứ, vòng Andalusia Am – G – F – E (chất surf/cumbia, khác Sol trưởng của nem nướng).

**Nhạc cụ**
- **Guitar điện surf:** tiếng twang, spring reverb, tremolo picking, cần rung (whammy). Đây là nhạc cụ dẫn chính.
- **Đàn sến** (đàn hai dây miền Nam): đối đáp giai điệu ngũ cung, luyến láy kiểu cải lương.
- Accordion, bass điện ngón, güira/guacharaca, timbales, cowbell.
- **Song lang** gõ "cắc" đầu ô nhịp: nét Nam bộ.
- Âm bếp làm bộ gõ: vá gõ thành nồi như cowbell, lắc vợt như shaker, tỏi phi rơi như güira.

**Xen kẽ trong video**
- **Hồi I (0–10):** tiếng chợ đông: máy ghe "tắc ráng", rao "Hủ tiếu đâyyy!", nước vỗ, mái chèo. Guitar surf solo hợp âm Am rung tremolo, song lang gõ nhẹ. 8.75: timbales dồn 2 phách + tiếng "drip" spring reverb. Cả ban vào ở 10.0.
- **Hồi II (10–40):**
  - Groove cumbia đầy đủ. Đàn sến và guitar surf thay nhau dẫn, mỗi người 4 ô nhịp.
  - Lắc vợt 3 cú đúng phách ở cảnh 7. Mỗi topping rơi là một tiếng cowbell/timbale ở cảnh 9.
  - 28.75→30.0: reverse cymbal kéo lên, 30.0 crash + tiếng hơi "phììì" khi chan nước.
- **Hồi III (40–65):**
  - 40.0 breakdown: chỉ còn bass + güira. Đàn sến gảy staccato rón rén theo động tác múc muỗng nhỏ.
  - 45.0: timbales vê crescendo, guitar tremolo leo cao.
  - 47.5: cú húp là tiếng "SỤUUUP" tổng hợp (noise lọc band-pass quét lên) + guitar cần rung lặn xuống + "bloop" vòng sóng + tiếng vỗ cánh cò.
  - 50.0: nhạc tắt hẳn. Chỉ còn nước vỗ, "chát" ở 51.25. **Im lặng 51.875–52.5.**
  - 52.5: cả ban đập mạnh. Tiếng "SỤP!" của cả chợ ở 52.5 · 53.125 · 53.75 · 54.375 làm bộ gõ.
  - 55–65: điệp khúc đầy đủ có accordion. Hit ở end card 60.0, guitar surf chạy câu kết.
- **CTA (65–70):** jingle riêng, không dùng lại steel pan, đàn kìm, 8-bit, lo-fi hay dân gian.
  - 65.0 tim nảy: guitar surf vuốt dây từ cao xuống ("piu").
  - +1: cowbell "ting".
  - 66.25 bấm FOLLOW: song lang "cắc" + đàn sến nhấn luyến.
  - Pháo giấy: güira lách tách.
  - Kết bằng hợp âm Am ngân với spring reverb "drip", tắt hẳn ở 70.0.

**Cách làm:** giao subagent Opus viết `audio.js` **từ đầu** với giọng mới. Chỉ giữ hàm tiện ích (lọc, trộn, chuẩn hóa -1.45 dBTP, khoảng -15 LUFS). `DUR = 70`.

## Kỹ thuật
- `DUR = 70` (2100 khung), `GRAIN = 0.05`.
- Nén < 10 MB: 70 s cho phép bitrate cao hơn bản 90 s. Dùng video ~950k + audio aac 96k (2-pass, `finish.sh`). Kiểm tra dung lượng, vượt thì hạ xuống 850k.
- Kiểm tra lưới phách: mọi mốc trong `shots.js` chia hết cho 0.625.

## Đăng bài
- Hẹn **23:00 ngày 24/11/2026** (giờ VN), YouTube + TikTok.
- Tiêu đề dự kiến (tiếng Anh trước): "Noodle Soup Cooked on a BOAT 🛶🍜 Cai Rang Floating Market Hu Tieu | Hủ Tiếu Chợ Nổi #shorts".
- Câu hỏi comment: "Loud slurper or quiet sipper?" / "Bạn húp to hay ăn nhỏ nhẹ?"
- Đăng xong: cập nhật Drive (chỉ `CLAUDE.md` + zip code), làm món kế tiếp: bánh xèo miền Tây.
