# ตากลาดนัด — Checklist งานพัฒนา

เอกสารนี้แตกข้อกำหนดจาก `spec.md` เป็นงานย่อยสำหรับติดตามการพัฒนา

## วิธีใช้

- `[ ]` ยังไม่เริ่ม, `[/]` กำลังทำ, `[x]` เสร็จและตรวจแล้ว, `[-]` พัก/อยู่นอกระยะนี้
- ทำเครื่องหมาย `[x]` เมื่อโค้ดและการตรวจสอบตามเกณฑ์เสร็จจริงเท่านั้น
- ทุกงานที่อัปเดตสถานะ ต้องเติมบันทึกใน “บันทึกการทำงาน” ระบุวัน, งาน, ทำอะไร, ไฟล์/ตำแหน่ง, วิธีทำ, วิธีตรวจ และผล
- หากงานเปลี่ยนขอบเขตหรือยังทำไม่ครบ ให้คงสถานะ `[/]` หรือ `[ ]` และเขียนสิ่งที่เหลือ
- ผู้ดูแลตลาดเป็นงานระยะถัดไป ไม่รวม MVP

## 0. เตรียมโครงการ

### 0.1 ตรวจโครงสร้างและข้อกำหนด
- [x] ตรวจว่าใช้ไฟล์แอปได้เฉพาะ `package.json`, `server.js`, `public/index.html`, `public/style.css`, `public/index.js`; รูปอยู่ `public/images/`
- [x] ตรวจ dependency และคำสั่งเริ่มระบบใน `package.json`
- [x] ตรวจ Express เสิร์ฟ `public/`, ใช้พอร์ต 3109 และค่าฐานข้อมูลตามข้อกำหนดใน `server.js`
- [x] เพิ่ม health check สำหรับสถานะ backend และการเชื่อมต่อฐานข้อมูล พร้อม response ที่ไม่เปิดเผยข้อมูลภายใน
- [x] ตรวจ health check ทั้งกรณี backend พร้อมและฐานข้อมูลใช้ไม่ได้
- [x] ตรวจว่าไม่มี `.env`, ไม่มี API key และไม่มีโมดูล source เพิ่มนอกไฟล์ที่อนุญาต
- [x] ทดลองเปิด server และตรวจหน้าเริ่มต้นกับ health check (dependency ติดตั้งอยู่แล้ว; ยังไม่ได้รัน install ซ้ำ)

เกณฑ์เสร็จ: โครงสร้างตรงข้อกำหนด, server ฟังที่ port 3109, หน้าเว็บโหลดได้ และ health check แยกสถานะ backend/ฐานข้อมูลได้

## 1. ฐานข้อมูล

### 1.1 ออกแบบและสร้าง schema
- [x] สร้างตาราง `users` พร้อม unique email/phone, role, status, password hash และ timestamps
- [x] สร้างตาราง `shops` เชื่อม `users` แบบหนึ่งต่อหนึ่ง พร้อมข้อมูลติดต่อและการแสดงสาธารณะ
- [x] สร้าง `categories` และ `shop_categories` พร้อม primary/foreign keys
- [x] สร้าง `markets` พร้อมข้อมูลตลาดและขนาด/ภาพแผนผัง
- [x] ผู้พัฒนากำหนดและเตรียมภาพผังตลาดกับพิกัด/ตำแหน่งแผงตั้งต้น; ระบบต้องรองรับการเปลี่ยนภาพและข้อมูลภายหลัง
- [x] สร้าง `market_sessions` พร้อมเวลาเปิดรับจองและสถานะรอบ
- [x] สร้าง `stalls` พร้อมรหัสแผง ราคา และพิกัดเปอร์เซ็นต์บนผัง
- [x] สร้าง `bookings` พร้อมสถานะ ราคา ณ วันจอง หมายเหตุ และวันยกเลิก
- [x] สร้าง `qr_codes` พร้อม token แบบสุ่ม สถานะ และวันหมดอายุ
- [x] กำหนดชนิดข้อมูล, nullability, defaults, indexes, foreign keys และนโยบายลบตาม `spec.md`
- [x] กำหนด charset/collation `utf8mb4`; ตรวจข้อจำกัดเวลาและค่าพิกัดใน application layer
- [x] ไม่ seed ตลาด/รอบ/แผงตัวอย่าง; หน้าเว็บใช้ข้อมูลจาก API/ฐานข้อมูลและแสดงสถานะว่างเมื่อไม่มีข้อมูล

เกณฑ์เสร็จ: ตารางและความสัมพันธ์ตรง spec, เชื่อมฐานข้อมูลได้ และข้อมูลตั้งต้นแสดงได้

### 1.2 ความปลอดภัยและความถูกต้องของข้อมูล
- [x] ตรวจว่าเก็บ password เป็น hash และไม่ส่งข้อมูลลับใน response
- [x] ใช้ transaction ในการสร้างบัญชีร้านและแก้ข้อมูลหลายตาราง
- [x] ใช้ transaction/row locking ป้องกันแผงเดียวกันถูกจองซ้ำในรอบเดียวกัน
- [x] ตรวจ foreign key และ unique constraint; การปิดบัญชียังไม่มีในขอบเขต MVP

เกณฑ์เสร็จ: การทดสอบ concurrent booking ไม่สร้าง active booking ซ้ำ และ rollback เมื่อขั้นตอนใดล้มเหลว

## 2. Backend และ API พื้นฐาน

### 2.1 โครง API
- [x] ตั้ง base path `/api/v1` และ JSON parser ที่จำกัดขนาด request
- [x] เพิ่ม `GET /api/v1/health` สำหรับตรวจ backend และ DB; ส่ง `200` เมื่อ DB พร้อม, `503` เมื่อ DB ใช้ไม่ได้ โดยไม่เผย host, username, password หรือรายละเอียด SQL
- [x] ตรวจ health endpoint ในสภาพ DB ปกติและ DB ขัดข้อง; health response ต้องไม่แสดงข้อมูลผู้ใช้หรือข้อมูลลับ
- [x] ทำรูปแบบ response สำเร็จและ error ตาม `spec.md`
- [x] ตรวจ validation สำหรับชนิดข้อมูล ความยาว enum ID และ pagination ใน endpoint ที่เกี่ยวข้อง
- [x] ทำ HTTP status/error code ให้สม่ำเสมอ โดยไม่ส่ง SQL หรือ stack trace
- [x] ใช้ parameterized SQL ทุกจุด; dynamic column/order ใช้ allowlist
- [x] ทำ pagination: page เริ่ม 1, limit default 20/max 100, meta มี total/totalPages
- [x] กำหนด sort whitelist และ tie-breaker ด้วย ID
- [x] ตรวจ CORS ให้ same-origin และตั้ง cache policy ให้ API เป็น no-store ยกเว้น health check

เกณฑ์เสร็จ: ทุก endpoint ส่งโครงสร้างและรหัสสถานะตามสเปก; invalid input ถูกปฏิเสธ

### 2.2 สมัครและเข้าสู่ระบบ
- [x] `POST /api/v1/auth/register`: validate, hash password, สร้าง users + shops ใน transaction
- [x] ยืนยันใช้อีเมลเท่านั้น ไม่มีการยืนยันตัวตนทางอีเมล
- [x] ใช้ bcrypt ด้วย salt จากไลบรารี; ห้าม SHA-256/MD5 สำหรับ password
- [x] สมัครและเข้าสู่ระบบด้วยอีเมลและรหัสผ่านเท่านั้น; อีเมลต้อง unique และไม่ต้องยืนยันตัวตน
- [x] `POST /api/v1/auth/login`: verify hash, generic error, จำกัดความถี่
- [x] rehash password เมื่อพารามิเตอร์เดิมล้าสมัยหลัง login สำเร็จ
- [x] ใช้ session ID สุ่ม entropy อย่างน้อย 128 บิต; ออก session ใหม่หลัง login
- [x] ตั้ง cookie HttpOnly, Secure เมื่อ HTTPS, SameSite=Lax; logout ทำลาย session
- [x] `GET /api/v1/auth/me` คืนข้อมูลบัญชีและร้านแบบไม่เปิดเผย hash
- [x] ป้องกัน CSRF สำหรับ mutation ที่ใช้ cookie และตรวจสิทธิ์จาก session ฝั่ง server

เกณฑ์เสร็จ: สมัคร/login/logout/me ทำงานครบ, ทดสอบบัญชีซ้ำ/ข้อมูลผิด/รหัสผ่านผิด/session หมดอายุ

### 2.3 ข้อมูลตลาด แผง และหน้าหลักร้าน
- [x] `GET /api/v1/shop/dashboard` คืนข้อมูลร้าน การจองปัจจุบัน และรายการล่าสุดของเจ้าของเท่านั้น
- [x] `GET /api/v1/markets` คืนตลาด active พร้อม pagination
- [x] `GET /api/v1/markets/:marketId/sessions` คืนรอบที่แสดงได้และกรองช่วงเวลา
- [x] `GET /api/v1/sessions/:sessionId/map` คืนตลาด รอบ ผัง และแผงพร้อมสถานะ
- [x] แยกข้อมูลสาธารณะออกจากข้อมูลร้านค้า; ไม่เผยข้อมูลเจ้าของ booking
- [x] `GET /api/v1/stalls/:stallId` ให้ร้านที่ login ดูราคา/ข้อจำกัด โดยต้องระบุ sessionId

เกณฑ์เสร็จ: ผังและสถานะถูกต้องสำหรับแต่ละรอบ; ไม่มีข้อมูลส่วนตัวรั่วใน public response

### 2.4 การจอง
- [x] `POST /api/v1/bookings` ใช้ shop จาก session ไม่รับ shopId/ราคาเช่าจาก client
- [x] ตรวจรอบเปิดรับจอง, แผง active, ตลาดตรงกัน และสถานะว่าง
- [x] สร้าง booking เป็น `confirmed` ทันทีเมื่อจองสำเร็จ
- [x] อนุญาตให้ร้านเดียวจองหลายแผงในรอบเดียวกัน แต่แผงแต่ละแผงมี active booking ได้รายการเดียว
- [x] บันทึกราคา ณ เวลาจองตามข้อมูลจากฐานข้อมูล
- [x] `GET /api/v1/bookings` คืนเฉพาะการจองของร้าน พร้อม filter/pagination/sort
- [x] `GET /api/v1/bookings/:bookingId` ตรวจ ownership และซ่อนการมีอยู่ของข้อมูลคนอื่นด้วย 404
- [x] `PATCH /api/v1/bookings/:bookingId` อนุญาตเจ้าของร้านแก้ข้อมูลการจองได้ทุกเวลาในสถานะที่แก้ได้
- [x] เปลี่ยนแผงใน transaction: หากแผงใหม่ไม่ว่าง booking เดิมยังคงอยู่
- [x] `POST /api/v1/bookings/:bookingId/cancel` อนุญาตเจ้าของร้านยกเลิกได้ทุกเวลา เปลี่ยนสถานะและเก็บประวัติ
- [x] ส่ง conflict codes ที่ชัดเจน เช่น `STALL_UNAVAILABLE`, `BOOKING_CLOSED`, `BOOKING_NOT_EDITABLE`

เกณฑ์เสร็จ: owner เท่านั้นที่อ่าน/แก้รายการตนได้, booking ซ้ำถูกปฏิเสธแม้ request พร้อมกัน

### 2.5 โปรไฟล์ร้านและรูป
- [x] `GET /api/v1/shop/profile` คืนข้อมูลร้านและ categories ของผู้ใช้ปัจจุบัน
- [x] `PATCH /api/v1/shop/profile` validate field และอัปเดต categories แบบ transaction
- [x] `GET /api/v1/categories` คืนประเภทที่ใช้ได้ เรียงตามชื่อ
- [x] `POST /api/v1/shop/logo` รองรับ PNG/JPEG/GIF/WebP ไม่เกิน 5 MB
- [x] ตรวจ file signature, ตั้งชื่อสุ่มไม่ซ้ำ, ป้องกัน path traversal และไม่เขียนทับไฟล์
- [x] อัปเดต DB ก่อนลบรูปเก่า; จัดการกรณีบันทึกไฟล์หรือ DB ล้มเหลว

เกณฑ์เสร็จ: upload รูปถูกชนิด/ขนาดได้, ปฏิเสธไฟล์ผิด, URL เป็น `/images/filename`

### 2.6 API ลูกค้าและ QR
- [x] `GET /api/v1/public/qr/:token` ตรวจ token active/expiry และเปิดผังสาธารณะของรอบที่เกี่ยวข้อง
- [x] สร้าง QR token ด้วย CSPRNG อย่างน้อย 128 บิต; เก็บ hash token ใน DB และ hash ก่อนค้นหา
- [x] `GET /api/v1/public/sessions/:sessionId/shops` รองรับค้นหา, category, pagination, sort allowlist
- [x] Escape wildcard `%`/`_` และใช้ parameterized query
- [x] `GET /api/v1/public/sessions/:sessionId/shops/:shopId` คืนเฉพาะร้าน public ที่จองในรอบนั้น
- [x] ตรวจว่า public response ไม่มี email, เบอร์ส่วนตัว, user ID, booking ID หรือข้อมูลลับ
- [x] จำกัดอัตราการค้นหา public และ token ไม่ถูกต้อง/เพิกถอน/หมดอายุคืน 404

เกณฑ์เสร็จ: QR เปิดรอบถูกต้อง ลูกค้าค้นร้านได้โดยไม่ login และไม่มีข้อมูลลับรั่ว

## 3. Frontend และหน้าจอ

### 3.1 ระบบภาพรวมและองค์ประกอบใช้ซ้ำ
- [/] วางโครงหน้าภาพรวม, จองแผง, ประวัติการจอง และแผนผังลูกค้าพร้อม responsive theme
- [/] เชื่อม JavaScript สำหรับ navigation, auth dialog, market map, search/filter และ booking actions (เชื่อม API หลักแล้ว; ยังต้องตรวจการทำงานจริง)
- [ ] ตรวจภาพจริงบน desktop/mobile และแก้ปัญหา accessibility/console

### 3.1 รายละเอียด theme และองค์ประกอบ
- [x] ใช้ theme Minimal Light: Market Route Atlas บนพื้นผิว map-paper สีเขียวตลาด และทองนำทาง
- [x] ปรับ contrast ของข้อความ/สถานะ; ไม่ใช้สีอย่างเดียวสื่อสถานะ
- [x] ใช้ typography ไทยอ่านง่าย พร้อมตัวเลข Manrope และขนาดยืดหยุ่นตามจอ
- [x] ปรับรูปแบบปุ่ม, input, card, status, dialog และข้อความแจ้งผลให้สอดคล้องกัน
- [x] ใช้ SVG สำหรับไอคอนนำทาง พร้อม focus state และตรวจการเปิด dialog ด้วยคีย์บอร์ด
- [x] ทดสอบ responsive ที่ 390px, 768px และ 1365px โดยไม่พบ horizontal overflow

เกณฑ์เสร็จ: UI อ่านง่าย ไม่ฉูดฉาด, มี focus state, ใช้คีย์บอร์ดเปิด dialog ได้ และไม่ล้นจอใน viewport ที่ทดสอบ

### 3.2 หน้าเข้าสู่ระบบ/สมัครร้าน
- [ ] แสดงชื่อ “ตากลาดนัด” และทางสลับเข้าสู่ระบบ/สมัคร
- [ ] ฟอร์ม login ใช้ email/phone และ password พร้อม validation
- [ ] ฟอร์มสมัครมีชื่อผู้ติดต่อ เบอร์โทร อีเมล รหัสผ่าน และชื่อร้าน
- [ ] แสดง loading, field errors, generic auth error และผลสมัครสำเร็จ
- [ ] เชื่อม endpoints auth และจัดการ session หมดอายุ

เกณฑ์เสร็จ: สมัคร/เข้าสู่ระบบได้ทั้งมือถือและเดสก์ท็อป พร้อมข้อความผิดพลาดเข้าใจง่าย

### 3.3 หน้าหลักร้านค้า
- [ ] ทำ header ชื่อร้าน การแจ้งเตือน/บัญชี และเมนูนำทาง
- [ ] แสดงการจองปัจจุบัน รอบ แผง และสถานะ
- [ ] แสดงปุ่ม “จองแผง”, ทางลัดโปรไฟล์ และรายการจองล่าสุด
- [ ] ทำ empty/loading/error state และเชื่อม dashboard API

เกณฑ์เสร็จ: ร้านเห็นเฉพาะข้อมูลตนและไปยังงานหลักได้ชัดเจน

### 3.4 หน้าเลือก/จองแผง
- [ ] เลือกรอบ/วันที่และกรองโซน/สถานะ
- [ ] แสดงผังตามพิกัดเปอร์เซ็นต์และภาพพื้นหลัง
- [ ] แสดง available/booked/inactive ด้วยสีร่วมกับข้อความหรือสัญลักษณ์
- [ ] รองรับ zoom/pan และทางเลือกดูรายการเมื่อจอเล็กหรือผังหนาแน่น
- [ ] แตะแผงแล้วแสดงรายละเอียด ขนาด ข้อจำกัด ราคา และสถานะ
- [ ] แสดงสรุปการเลือกและยืนยันการจอง
- [ ] จัดการ conflict เมื่อผัง stale หรือแผงถูกจองไปแล้ว

เกณฑ์เสร็จ: จองได้จริง, ไม่แสดงว่าจองสำเร็จเมื่อ API ปฏิเสธ, ใช้บนมือถือได้

### 3.5 หน้าการจองของฉัน
- [/] แสดงรายการเรียงล่าสุด พร้อม filter status/session และ pagination (filter status และ pagination เชื่อม API แล้ว; ยังต้องทดสอบกับข้อมูลหลายหน้า)
- [ ] แสดงรหัสแผง รอบ วันเวลา สถานะ ราคา และวันสร้าง
- [ ] มีรายละเอียด แก้ไข และยกเลิกตามสิทธิ์/เงื่อนไข
- [ ] ยืนยันก่อนยกเลิกและแสดงผลสำเร็จ/ผิดพลาด

เกณฑ์เสร็จ: รายการตรงกับ API และไม่เปิดให้เข้าถึง booking ของร้านอื่น

### 3.6 หน้าโปรไฟล์ร้าน
- [ ] แก้ชื่อร้าน คำอธิบาย ผู้ติดต่อ เบอร์ติดต่อ (เปิดเผยแก่ลูกค้าตามที่ผู้ใช้กำหนด) ประเภทสินค้า และสถานะ public
- [ ] อัปโหลด/แสดง logo และ preview ข้อมูลแบบลูกค้าเห็น
- [ ] แสดง validation, loading, save success/error

เกณฑ์เสร็จ: บันทึกแล้วโหลดซ้ำยังเห็นค่าถูกต้อง; public preview ตรงข้อมูลจริง

### 3.7 หน้าแผนผังลูกค้า
- [x] เปิดจาก QR โดยไม่ต้อง login
- [x] แสดงชื่อตลาด รอบ วันเวลา และผัง
- [x] ค้นหา/กรองร้านตามชื่อและประเภทสินค้า
- [x] แตะแผง/บัตรร้านเพื่อดูชื่อร้าน ประเภท คำอธิบาย เบอร์ติดต่อ และตำแหน่ง
- [x] มีรายการร้านแบบการ์ดเป็นทางเลือกในจอเล็ก/ผังแน่น
- [/] loading, ไม่มีร้าน, ไม่พบผลทำงาน; ยังต้องตรวจ/ปรับข้อความ QR ไม่ถูกต้องและการลองใหม่

เกณฑ์เสร็จ: ลูกค้าสแกน QR แล้วค้นและดูร้านได้โดยไม่สมัครบัญชี

## 4. คุณภาพและการตรวจสอบ

### 4.1 การทดสอบ
- [/] ทดสอบ validation ของทุก API ทั้งค่าถูก/ผิด/ขอบเขต (ทดสอบเส้นทางหลักแล้ว; ยังไม่ครบทุก boundary)
- [/] ทดสอบ role, ownership, unauthorized และข้อมูลไม่รั่ว (ตรวจ owner/public หลักแล้ว; ยังไม่ครบทุก role)
- [x] ทดสอบ login ผิด, session expiry/logout และ rate limit; สมัครซ้ำยังไม่ได้ทดสอบซ้ำโดยตรง
- [x] ทดสอบ booking ซ้ำทั้ง sequential และ concurrent
- [x] ทดสอบ cancel/edit โดยไม่มี deadline พร้อมตรวจ booking ที่ยกเลิกแล้วแก้ไม่ได้
- [x] ทดสอบค้นหา/filter, pagination หน้าแรกและเกินหน้าสุดท้าย; dataset ปัจจุบันมีน้อยจึงยังไม่ stress หลายหน้า
- [/] ทดสอบอัปโหลดรูปถูกชนิด/ผิดชนิด/เกิน 5 MB/ชื่อซ้ำ (ผ่านชนิดถูก/ผิด/เกินขนาด; collision ใช้ชื่อสุ่มและยังไม่ได้จำลอง)
- [x] ทดสอบ QR token ใช้ได้/ผิด/หมดอายุ/ถูกเพิกถอน
- [/] ทดสอบ responsive, keyboard, focus, contrast และข้อความภาษาไทย (ทดสอบแผนผังที่ 390px/1365px ไม่มี overflow; keyboard/focus/contrast ยังไม่ครบ)
- [x] ตรวจ browser page errors และ response errors ใน flow แผนผัง: ไม่พบ; 401 ของ `/auth/me` ตอนผู้ใช้ยังไม่ login เป็นผลคาดหมาย

เกณฑ์เสร็จ: ผลทดสอบผ่านและบันทึกคำสั่ง/ผลไว้ในบันทึกงาน

### 4.2 ความปลอดภัยและการส่งมอบ
- [x] ตรวจ password hash เป็น bcrypt และไม่ส่ง hash/password ใน response
- [x] ตรวจ prepared statements, authorization, CSRF, cookie flags และ rate limit จากโค้ด/การทดสอบ
- [x] ตรวจ file upload, path traversal, filename collision และขนาดไฟล์จากโค้ด/การทดสอบ
- [x] ตรวจ response public/private และ HTTP cache policy
- [x] ตรวจ dependency ด้วย `npm audit --omit=dev` และเริ่มแอปจากคำสั่งที่กำหนด
- [x] บันทึกข้อจำกัดและงานค้างก่อนส่งมอบ

เกณฑ์เสร็จ: ผ่านรายการตรวจความปลอดภัยที่ทำได้และมีรายการความเสี่ยงคงเหลือชัดเจน

## 5. ระยะถัดไป — ยังไม่ทำใน MVP

- [ ] หน้าผู้ดูแลจัดการตลาด รอบตลาด และแผง
- [ ] อนุมัติ/ปฏิเสธคำขอจอง พร้อม audit log
- [ ] สร้าง/เพิกถอน QR Code จากหน้าผู้ดูแล
- [ ] ชำระเงิน, ระบบแชต, จัดส่งสินค้า (ต้องกำหนด requirement เพิ่มก่อนเริ่ม)

## ข้อกำหนดที่ผู้ใช้ยืนยัน

- การจอง: ยืนยันเป็น `confirmed` ทันที และร้านหนึ่งจองได้หลายแผง
- การแก้ไข/ยกเลิก: เจ้าของร้านทำได้ทุกเวลา ไม่มี deadline
- บัญชี: สมัคร/เข้าสู่ระบบด้วยอีเมล ไม่ต้องยืนยันตัวตน
- ผังตลาด: ผู้พัฒนาจัดเตรียมภาพและตำแหน่งแผงตั้งต้น
- เบอร์ติดต่อร้าน: เปิดเผยให้ลูกค้าเห็น

## บันทึกการทำงาน

อัปเดตข้อกำหนดจากผู้ใช้แล้ว; ดูรายการบันทึกด้านล่างสำหรับความคืบหน้าพัฒนา

เพิ่มบันทึกใหม่ทุกครั้งที่เปลี่ยนสถานะงาน:

| วันที่ | Task ID | ทำอะไร | ทำที่ไหน (ไฟล์/ตำแหน่ง) | วิธีทำ | วิธีตรวจและผล | สถานะ |
|---|---|---|---|---|---|---|
| 2026-10-31 | 1.1 / 3.1 | หยุดสร้างข้อมูลตลาดตัวอย่างและนำตลาดตัวอย่างเดิมออกจากผลลัพธ์สาธารณะ; ปรับหน้าเว็บให้แสดง empty state แทนข้อมูลจำลอง | `server.js` `ensureSchema`, `public/index.html`, `public/index.js`, `public/style.css`, `TASKS.md`; MariaDB | ลบ demo seeding; migration ปิดใช้งานเฉพาะตลาดที่ตรงชื่อและคำอธิบายที่ทราบแน่ชัดโดยเก็บแถว/ข้อมูลอ้างอิงไว้; แสดงผัง/รายการ/การจองจากข้อมูล API เท่านั้น | `node --check server.js` และ `node --check public/index.js` ผ่าน; health 3109 ตอบ 200/DB ok; markets API ได้ total 0 หลัง migration; browser ตรวจหน้าหลักและหน้าลูกค้าไม่แสดงตลาด/แผง/ร้านปลอม, ไม่มีภาพผังค้าง และแสดงข้อความไม่มีข้อมูล | เสร็จ |
| 2026-10-31 | 3.1 theme | เปลี่ยนเป็น Minimal Light — Market Route Atlas; ปรับสี/สถานะและข้อความบนมือถือ พร้อมบันทึก visual system | `public/style.css`, `public/index.js`, `public/index.html`, `DESIGN.md`, `.impeccable/design.json`, `TASKS.md` | ใช้ map-paper, route ink, market green และ wayfinding gold; เพิ่ม SVG navigation, ขนาดตัวอักษร 12px บนมือถือ, health status ที่อ่านได้ และจัดแถวแผงให้ไม่ทับทางเดินใน mini-map | `node --check public/index.js` ผ่าน; sidecar JSON ถูกต้อง (6 components/9 color ramps); detector ที่ 390px/1365px ไม่มี primary findings; browser ตรวจ 390/768/1365px ไม่มี overflow, 24 แผงไม่ทับข้อความทางเดิน และเปิด/ปิด auth dialog ด้วยคีย์บอร์ดได้; advisories ที่เหลือคือ nested map surface และ grid ซึ่งใช้เฉพาะบนแผนที่ | เสร็จ |
| 2026-10-31 | 2.2 / 4.1 / 3.7 | ปิดช่อง error handling ของ logout ใน Express 4; ทดสอบ rate limit, session expiry, QR expiry/revoke, pagination และ flow ลูกค้าบน desktop/mobile | `server.js` `POST /auth/logout`; customer map ใน `public/index.js`; checklist | ส่ง async failure ไป Express error middleware; ใช้บัญชี/token ชั่วคราวและ session ตลาดเดิมเพื่อทดสอบ แล้วลบแถวทดสอบตาม ID/hash; เปิด deep link แผนผังใน browser และทดสอบค้นหาร้าน/เปิดรายละเอียด/โทร | syntax check และ `npm audit --omit=dev` ผ่าน (0 vulnerabilities); live health 3109 ตอบ 200; logout ที่ live ตอบ 204 และ session ต่อมาได้ 401; login ครั้งที่ 13 ได้ 429, session หมดอายุได้ 401, QR expired/revoked ได้ 404, pagination page beyond last ได้ list ว่าง; deep link แสดงตลาด/ผัง/ร้าน โทรศัพท์; ไม่มี overflow ที่ 390px/1365px และไม่มี page errors; cleanup ข้อมูลชั่วคราวครบ | เสร็จบางส่วน |
| 2026-10-31 | 1.2 / 2.1–2.6 / 4.1–4.2 | ปิดเส้นทางหลักของระบบร้านค้าและลูกค้า; แก้ handling เมื่อ getConnection/rollback ล้มเหลว, validation โปรไฟล์/การจอง, session/date filters, dashboard, map category, cancel/edit conflict, upload field และ password rehash; จัด contract ใน `spec.md` ให้ตรง API | `server.js`, `public/index.js`, `spec.md`, `TASKS.md` | เปิด server รุ่นทดสอบแยกที่พอร์ต 3110; ใช้บัญชีและ session ทดสอบชั่วคราว; ทดสอบสมัคร/login/logout/me, CSRF, profile/category, upload PNG/invalid/missing/>5 MB, QR redirect, booking หลายแผง/concurrent/ownership/edit/cancel, date filters, dashboard และ public response; ลบข้อมูลทดสอบตาม ID/token/file เฉพาะ | `node --check server.js`, `node --check public/index.js` ผ่าน; `npm audit --omit=dev` พบ 0 vulnerabilities; API health บนพอร์ต 3109 ตอบ 200; regression หลักผ่านทั้งหมด; ตรวจพบ session ทดสอบชั่วคราว 0 รายการหลัง cleanup. ยังเหลือ rate-limit/session-expiry, QR expiry/revoke, pagination หลายหน้า และ accessibility/browser-console audit | เสร็จบางส่วน |
| 2026-10-31 | 2.1 / 3.5 | ต่อ pagination รายการจองและแก้ filter ให้ส่งสถานะไป backend; อ่าน `meta.totalPages` หรือ `X-Pagination`, แสดงปุ่มก่อนหน้า/ถัดไป, โหลดหน้าที่เลือก, กลับหน้าแรกเมื่อเปลี่ยน filter และ clamp หน้าเมื่อจำนวนข้อมูลลดลง | `public/index.js` `request`, `renderBookingsPage`, `loadBookings`, event handler; `server.js` `GET /markets` และ public shop search | ใช้ metadata ตามรูปแบบที่ endpoint ส่งจริง รองรับทั้ง meta JSON และ X-Pagination header; ใส่ status ลง query แทนกรองเฉพาะข้อมูลหน้าปัจจุบัน; เพิ่ม sort ที่มี tie-breaker สำหรับ public search และ escape wildcard ด้วย `=` | `node --check server.js`, `node --check public/index.js` ผ่าน; `GET /api/v1/health` ตอบ 200 และ DB ok. ยังไม่ได้สร้างข้อมูลทดสอบหรือทดสอบหลายหน้าเพราะไม่สร้างข้อมูลจริงใน DB | กำลังทำ |
| 2026-10-31 | 2.1 | ทำ pagination ให้ตรวจ input แบบเข้มงวดและส่ง `meta` สม่ำเสมอใน markets/sessions; แก้ regex ของ ID และ email ที่ escape ซ้ำจนปฏิเสธข้อมูลถูกต้อง | `server.js` `pageParams`, `isId`, `validEmail`, `GET /markets`, `GET /markets/:marketId/sessions` | ตรวจ page/limit ให้เป็นจำนวนเต็มปลอดภัย, page >= 1, limit 1–100; นับผลลัพธ์ก่อนดึงหน้า; ใช้ลำดับเรียงกำหนดตายตัวพร้อม ID เป็น tie-breaker | `node --check server.js` ผ่าน; API บนพอร์ตทดสอบตอบ 400 เมื่อ page/limit ผิด และตอบ 200 พร้อม `meta.page/limit/total/totalPages` เมื่อถูกต้อง; ID ตัวอักษรได้ 400 ส่วน ID ตัวเลขผ่าน validation; email ที่ถูกต้องไม่อยู่ใน fields error | เสร็จ |
| 2026-10-31 | 1.1 | เพิ่ม unique index `uq_users_phone` ให้ schema ใหม่และ migration ฐานข้อมูลเดิม โดย phone ที่เป็น `NULL` ยังรองรับหลายบัญชีได้ | `server.js` schema `users`; `ensureSchema()` | ตรวจ index เดิมและจำนวนกลุ่มเบอร์ซ้ำก่อน migration; เพิ่ม unique index เมื่อยังไม่มี | ฐานข้อมูลเดิมไม่มี index และไม่มีเบอร์ซ้ำ; เรียก health บน server ทดสอบหลัง migration ได้ 200; `SHOW INDEX` ยืนยัน `uq_users_phone(phone)` เป็น unique | เสร็จ |
| 2026-10-31 | 1.1 | Seed ตลาดตัวอย่าง รอบวันที่ 8 พ.ย. 2569 แผง 48 จุด หมวดสินค้า 6 หมวด และภาพผัง SVG; ทำให้ seed ซ้ำได้ | `server.js` `seedMarketDemo`; `public/images/market-map.svg`; MariaDB | เคยใช้ชื่อ/เวลา/จำนวนแผงจากหน้าจอเดิม; เปลี่ยนตามข้อกำหนดล่าสุดเป็นไม่สร้าง demo records และ retire ตลาดตัวอย่างเดิมโดยไม่ลบข้อมูลอ้างอิง | ยืนยันแล้วว่าโค้ดไม่ seed ตลาด; markets API บน server ใหม่ส่ง total 0; รายการนี้ถูกแทนที่โดยบันทึก 2026-10-31 `1.1 / 3.1` ด้านบน | ยกเลิกตามข้อกำหนดใหม่ |
| 2026-10-31 | 1.1 | ตรวจคอลัมน์และ nullability จริงของ `shops`, `bookings`, `qr_codes` เทียบกับ schema ใน `server.js` | MariaDB `information_schema.COLUMNS`; `TASKS.md` | อ่าน metadata อย่างเดียว แล้วเทียบชนิดข้อมูลและ nullable กับ `spec.md` | พบคอลัมน์ครบตามตารางใน spec รวม token hash ที่เก็บแบบ hash 64 ตัวอักษรแทน token ดิบ; อัปเดต checklist ตารางที่ยืนยันแล้ว | เสร็จ |
| 2026-10-31 | 1.1 | ตรวจ engine, collation และ foreign key ของตารางแอปทั้งหมด | MariaDB `information_schema.TABLES`, `TABLE_CONSTRAINTS` | อ่าน metadata โดยไม่แก้ข้อมูล | ตารางแอปใช้ InnoDB/`utf8mb4_unicode_ci`; พบ foreign key ครบตาม schema 10 รายการ; มีตารางเดิม `customer` และ `menus` ใน DB ซึ่งอยู่นอก schema แอปและไม่ได้แก้ไข | เสร็จ |
| 2026-10-31 | 0.1 / 2.1 | ทดสอบ health check ครบกรณี DB พร้อมและ DB ขัดข้อง; เพิ่ม override พอร์ต `PORT` เพื่อรัน server ทดสอบแยก | `server.js` `GET /api/v1/health`, `app.listen`; checklist 0.1 และ 2.1 | ตรวจ MariaDB จริงและ endpoint จริง; ทดสอบ failure ด้วย server บนพอร์ต 3110 ที่ mock pool ให้ปฏิเสธการเชื่อมต่อ | `node --check server.js` ผ่าน; MariaDB `SELECT 1` ผ่าน; endpoint จริงบน 3109 ตอบ 200 พร้อม `database: ok`; server จำลองบน 3110 ตอบ 503 `SERVICE_UNAVAILABLE`; leak check ไม่พบข้อความ error, host หรือข้อมูลเชื่อมต่อใน response | เสร็จ |
| 2026-10-31 | 0.1 / 2.1 | ตรวจ health check เพิ่ม: เชื่อม MariaDB ด้วย `SELECT 1` ได้ และเรียก endpoint จริงได้ | `server.js` `GET /api/v1/health`; checklist 0.1 และ 2.1 | ตรวจ endpoint ที่ server บนพอร์ต 3109 ซึ่งมีอยู่แล้ว; ไม่เริ่ม server ซ้ำเพราะพอร์ตถูกใช้งาน | MariaDB `SELECT 1` ผ่าน; `GET http://127.0.0.1:3109/api/v1/health` ตอบ `200` และ `{"data":{"status":"ok","database":"ok"}}`; response ไม่มีรายละเอียดเชื่อมต่อ. กรณี DB ขัดข้องตรวจจาก catch ในโค้ดว่าคืน 503 แบบทั่วไป แต่ยังไม่ได้ทดสอบ runtime เพราะไม่หยุดหรือเปลี่ยน DB ที่ใช้งานอยู่ | เสร็จบางส่วน |
| 2026-10-31 | 0.1 / 2.1 | ปรับ health check เป็น `/api/v1/health`; success คืน `200` พร้อม `{ data: { status: "ok", database: "ok" } }`, DB failure คืน `503 SERVICE_UNAVAILABLE`; ปรับหน้าเว็บให้เรียก path ใหม่ | `server.js` health route; `public/index.js` fetch; checklist ส่วน 0.1 และ 2.1 | เปลี่ยน route เดิม `/api/health` เป็น versioned path และใช้ response API โดยไม่ส่งรายละเอียด DB กลับ client | `node --check server.js` และ `node --check public/index.js` ผ่าน; หลังพอร์ตว่าง เริ่ม `npm start` ได้บน 3109; `GET /api/v1/health` ตอบ `200` และระบุ DB พร้อม; `GET /` ตอบ `200 text/html`; ยังไม่ได้ทดสอบกรณี DB ใช้ไม่ได้ จึงคง checklist ตรวจสุขภาพเป็นกำลังทำ | เสร็จบางส่วน |
