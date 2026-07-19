// LIFF app id ของ parent portal — single source of truth ใช้ได้ทั้ง client และ server.
// env ไม่ได้ตั้งใน .env/Vercel → fallback เป็นค่าเดียวกับ liff-client (อย่าให้ drift:
// ลิงก์เชิญที่สร้างจากที่นี่ต้องเปิดเข้า LIFF app เดียวกับที่ portal init)
export const PARENT_LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID || '2007575627-GmKBZJdo'

export const parentLiffUrl = (query = '') => `https://liff.line.me/${PARENT_LIFF_ID}${query}`
