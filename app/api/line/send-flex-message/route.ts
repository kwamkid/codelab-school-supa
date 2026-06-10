// app/api/line/send-flex-message/route.ts

import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Flex Message Templates
const FLEX_TEMPLATES = {
  makeupConfirmation: (data: {
    studentName: string;
    className: string;
    subjectName?: string;
    sessionNumber?: number;
    date: string;
    startTime: string;
    endTime: string;
    teacherName: string;
    location: string;
    roomName: string;
  }) => ({
    type: "bubble",
    size: "kilo",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "box",
          layout: "horizontal",
          contents: [
            {
              type: "text",
              text: "✅ ยืนยันการนัด Makeup Class",
              weight: "bold",
              size: "md",
              color: "#ffffff",
              flex: 1
            }
          ]
        }
      ],
      backgroundColor: "#06C755",
      paddingAll: "15px"
    },
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "box",
          layout: "horizontal",
          contents: [
            {
              type: "text",
              text: "👦 นักเรียน",
              size: "sm",
              color: "#555555",
              flex: 0,
              weight: "bold"
            },
            {
              type: "text",
              text: data.studentName,
              size: "sm",
              color: "#111111",
              align: "end"
            }
          ],
          spacing: "sm"
        },
        {
          type: "separator",
          margin: "md"
        },
        {
          type: "box",
          layout: "vertical",
          margin: "md",
          spacing: "sm",
          contents: [
            {
              type: "box",
              layout: "horizontal",
              contents: [
                {
                  type: "text",
                  text: "📚 วิชา",
                  size: "sm",
                  color: "#555555",
                  flex: 0,
                  weight: "bold"
                },
                {
                  type: "text",
                  text: (data.subjectName || data.className) + (data.sessionNumber ? ` (ครั้งที่ ${data.sessionNumber})` : ''),
                  size: "sm",
                  color: "#111111",
                  align: "end",
                  weight: "bold",
                  wrap: true
                }
              ]
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                {
                  type: "text",
                  text: "📅 วันที่",
                  size: "sm",
                  color: "#555555",
                  flex: 0
                },
                {
                  type: "text",
                  text: data.date,
                  size: "sm",
                  color: "#111111",
                  align: "end"
                }
              ]
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                {
                  type: "text",
                  text: "⏰ เวลา",
                  size: "sm",
                  color: "#555555",
                  flex: 0
                },
                {
                  type: "text",
                  text: `${data.startTime} - ${data.endTime}`,
                  size: "sm",
                  color: "#111111",
                  align: "end"
                }
              ]
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                {
                  type: "text",
                  text: "👩‍🏫 ครูผู้สอน",
                  size: "sm",
                  color: "#555555",
                  flex: 0
                },
                {
                  type: "text",
                  text: data.teacherName,
                  size: "sm",
                  color: "#111111",
                  align: "end"
                }
              ]
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                {
                  type: "text",
                  text: "📍 สถานที่",
                  size: "sm",
                  color: "#555555",
                  flex: 0
                },
                {
                  type: "text",
                  text: data.location,
                  size: "sm",
                  color: "#111111",
                  align: "end"
                }
              ]
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                {
                  type: "text",
                  text: "🚪 ห้องเรียน",
                  size: "sm",
                  color: "#555555",
                  flex: 0
                },
                {
                  type: "text",
                  text: data.roomName,
                  size: "sm",
                  color: "#111111",
                  align: "end"
                }
              ]
            }
          ]
        },
        {
          type: "separator",
          margin: "md"
        },
        {
          type: "text",
          text: "หากติดปัญหาหรือต้องการเปลี่ยนแปลง\nกรุณาติดต่อเจ้าหน้าที่",
          size: "xs",
          color: "#aaaaaa",
          wrap: true,
          margin: "md",
          align: "center"
        }
      ],
      paddingAll: "20px"
    }
  }),

  makeupReminder: (data: {
    studentName: string;
    className: string;
    subjectName?: string;
    sessionNumber?: number;
    date: string;
    startTime: string;
    endTime: string;
    teacherName: string;
    location: string;
    roomName: string;
  }) => ({
    type: "bubble",
    size: "kilo",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "box",
          layout: "horizontal",
          contents: [
            {
              type: "text",
              text: "⏰ แจ้งเตือน Makeup Class พรุ่งนี้",
              weight: "bold",
              size: "md",
              color: "#ffffff",
              flex: 1
            }
          ]
        }
      ],
      backgroundColor: "#9B59B6",
      paddingAll: "15px"
    },
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "box",
          layout: "horizontal",
          contents: [
            {
              type: "text",
              text: "👦 นักเรียน",
              size: "sm",
              color: "#555555",
              flex: 0,
              weight: "bold"
            },
            {
              type: "text",
              text: data.studentName,
              size: "sm",
              color: "#111111",
              align: "end"
            }
          ],
          spacing: "sm"
        },
        {
          type: "separator",
          margin: "md"
        },
        {
          type: "box",
          layout: "vertical",
          margin: "md",
          spacing: "sm",
          contents: [
            {
              type: "box",
              layout: "horizontal",
              contents: [
                {
                  type: "text",
                  text: "📚 วิชา",
                  size: "sm",
                  color: "#555555",
                  flex: 0,
                  weight: "bold"
                },
                {
                  type: "text",
                  text: (data.subjectName || data.className) + (data.sessionNumber ? ` (ครั้งที่ ${data.sessionNumber})` : ''),
                  size: "sm",
                  color: "#111111",
                  align: "end",
                  weight: "bold",
                  wrap: true
                }
              ]
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                {
                  type: "text",
                  text: "📅 วันที่",
                  size: "sm",
                  color: "#555555",
                  flex: 0
                },
                {
                  type: "text",
                  text: data.date,
                  size: "sm",
                  color: "#111111",
                  align: "end"
                }
              ]
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                {
                  type: "text",
                  text: "⏰ เวลา",
                  size: "sm",
                  color: "#555555",
                  flex: 0
                },
                {
                  type: "text",
                  text: `${data.startTime} - ${data.endTime}`,
                  size: "sm",
                  color: "#111111",
                  align: "end"
                }
              ]
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                {
                  type: "text",
                  text: "👩‍🏫 ครูผู้สอน",
                  size: "sm",
                  color: "#555555",
                  flex: 0
                },
                {
                  type: "text",
                  text: data.teacherName,
                  size: "sm",
                  color: "#111111",
                  align: "end"
                }
              ]
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                {
                  type: "text",
                  text: "📍 สถานที่",
                  size: "sm",
                  color: "#555555",
                  flex: 0
                },
                {
                  type: "text",
                  text: data.location,
                  size: "sm",
                  color: "#111111",
                  align: "end"
                }
              ]
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                {
                  type: "text",
                  text: "🚪 ห้องเรียน",
                  size: "sm",
                  color: "#555555",
                  flex: 0
                },
                {
                  type: "text",
                  text: data.roomName,
                  size: "sm",
                  color: "#111111",
                  align: "end"
                }
              ]
            }
          ]
        },
        {
          type: "separator",
          margin: "md"
        },
        {
          type: "text",
          text: "แล้วพบกันนะค้า 😊",
          size: "sm",
          color: "#9B59B6",
          wrap: true,
          margin: "md",
          align: "center",
          weight: "bold"
        }
      ],
      paddingAll: "20px"
    }
  }),

  classReminder: (data: {
    studentName: string;
    className: string;
    subjectName?: string;
    sessionNumber?: number;
    date: string;
    startTime: string;
    endTime: string;
    teacherName: string;
    location: string;
    roomName: string;
  }) => ({
    type: "bubble",
    size: "kilo",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "box",
          layout: "horizontal",
          contents: [
            {
              type: "text",
              text: "🔔 แจ้งเตือนคลาสเรียนพรุ่งนี้",
              weight: "bold",
              size: "md",
              color: "#ffffff",
              flex: 1
            }
          ]
        }
      ],
      backgroundColor: "#f05a5a",
      paddingAll: "15px"
    },
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "box",
          layout: "horizontal",
          contents: [
            {
              type: "text",
              text: "👦 นักเรียน",
              size: "sm",
              color: "#555555",
              flex: 0,
              weight: "bold"
            },
            {
              type: "text",
              text: data.studentName,
              size: "sm",
              color: "#111111",
              align: "end"
            }
          ],
          spacing: "sm"
        },
        {
          type: "separator",
          margin: "md"
        },
        {
          type: "box",
          layout: "vertical",
          margin: "md",
          spacing: "sm",
          contents: [
            {
              type: "box",
              layout: "horizontal",
              contents: [
                {
                  type: "text",
                  text: "📚 วิชา",
                  size: "sm",
                  color: "#555555",
                  flex: 0,
                  weight: "bold"
                },
                {
                  type: "text",
                  text: (data.subjectName || data.className) + (data.sessionNumber ? ` (ครั้งที่ ${data.sessionNumber})` : ''),
                  size: "sm",
                  color: "#111111",
                  align: "end",
                  weight: "bold",
                  wrap: true
                }
              ]
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                {
                  type: "text",
                  text: "📅 วันที่",
                  size: "sm",
                  color: "#555555",
                  flex: 0
                },
                {
                  type: "text",
                  text: data.date,
                  size: "sm",
                  color: "#111111",
                  align: "end"
                }
              ]
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                {
                  type: "text",
                  text: "⏰ เวลา",
                  size: "sm",
                  color: "#555555",
                  flex: 0
                },
                {
                  type: "text",
                  text: `${data.startTime} - ${data.endTime}`,
                  size: "sm",
                  color: "#111111",
                  align: "end"
                }
              ]
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                {
                  type: "text",
                  text: "👩‍🏫 ครูผู้สอน",
                  size: "sm",
                  color: "#555555",
                  flex: 0
                },
                {
                  type: "text",
                  text: data.teacherName,
                  size: "sm",
                  color: "#111111",
                  align: "end"
                }
              ]
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                {
                  type: "text",
                  text: "📍 สถานที่",
                  size: "sm",
                  color: "#555555",
                  flex: 0
                },
                {
                  type: "text",
                  text: data.location,
                  size: "sm",
                  color: "#111111",
                  align: "end"
                }
              ]
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                {
                  type: "text",
                  text: "🚪 ห้องเรียน",
                  size: "sm",
                  color: "#555555",
                  flex: 0
                },
                {
                  type: "text",
                  text: data.roomName,
                  size: "sm",
                  color: "#111111",
                  align: "end"
                }
              ]
            }
          ]
        },
        {
          type: "separator",
          margin: "md"
        },
        {
          type: "text",
          text: "แล้วพบกันนะค้า 😊",
          size: "sm",
          color: "#06C755",
          wrap: true,
          margin: "md",
          align: "center",
          weight: "bold"
        }
      ],
      paddingAll: "20px"
    }
  }),
    eventRegistration: (data: {
    eventName: string;
    eventDate: string;
    eventTime: string;
    location: string;
    attendeeCount: number;
    registrationId: string;
    googleCalendarUrl?: string;
  }) => ({
    type: "bubble",
    size: "kilo",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "box",
          layout: "horizontal",
          contents: [
            {
              type: "text",
              text: "✅ ลงทะเบียนสำเร็จ!",
              weight: "bold",
              size: "md",
              color: "#ffffff",
              flex: 1
            }
          ]
        }
      ],
      backgroundColor: "#06C755",
      paddingAll: "15px"
    },
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: data.eventName,
          size: "lg",
          weight: "bold",
          color: "#111111",
          wrap: true,
          margin: "md",
          align: "center"
        },
        {
          type: "separator",
          margin: "md"
        },
        {
          type: "box",
          layout: "vertical",
          margin: "md",
          spacing: "sm",
          contents: [
            {
              type: "box",
              layout: "horizontal",
              contents: [
                {
                  type: "text",
                  text: "📅 วันที่",
                  size: "sm",
                  color: "#555555",
                  flex: 0,
                  weight: "bold"
                },
                {
                  type: "text",
                  text: data.eventDate,
                  size: "sm",
                  color: "#111111",
                  align: "end"
                }
              ]
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                {
                  type: "text",
                  text: "⏰ เวลา",
                  size: "sm",
                  color: "#555555",
                  flex: 0
                },
                {
                  type: "text",
                  text: data.eventTime,
                  size: "sm",
                  color: "#111111",
                  align: "end"
                }
              ]
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                {
                  type: "text",
                  text: "📍 สถานที่",
                  size: "sm",
                  color: "#555555",
                  flex: 0
                },
                {
                  type: "text",
                  text: data.location,
                  size: "sm",
                  color: "#111111",
                  align: "end",
                  wrap: true
                }
              ]
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                {
                  type: "text",
                  text: "👥 จำนวนผู้เข้าร่วม",
                  size: "sm",
                  color: "#555555",
                  flex: 0
                },
                {
                  type: "text",
                  text: `${data.attendeeCount} คน`,
                  size: "sm",
                  color: "#111111",
                  align: "end"
                }
              ]
            }
          ]
        },
        {
          type: "separator",
          margin: "md"
        },
        {
          type: "box",
          layout: "vertical",
          margin: "md",
          spacing: "sm",
          contents: [
            {
              type: "text",
              text: "📋 หมายเลขการลงทะเบียน",
              size: "xs",
              color: "#aaaaaa",
              align: "center"
            },
            {
              type: "text",
              text: data.registrationId,
              size: "xs",
              color: "#666666",
              align: "center",
              weight: "bold"
            }
          ]
        },
        {
          type: "text",
          text: "เจ้าหน้าที่จะติดต่อกลับเพื่อยืนยันการเข้าร่วมงาน",
          size: "xs",
          color: "#06C755",
          wrap: true,
          margin: "md",
          align: "center",
          weight: "bold"
        }
      ],
      paddingAll: "20px"
    },
    footer: data.googleCalendarUrl ? {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        {
          type: "button",
          style: "primary",
          color: "#4285F4",
          action: {
            type: "uri",
            label: "เพิ่มใน Google Calendar",
            uri: data.googleCalendarUrl
          }
        }
      ],
      paddingAll: "10px"
    } : undefined
  }),
  
  trialConfirmation: (data: {
    studentName: string;
    subjectName: string;
    date: string;
    startTime: string;
    endTime: string;
    location: string;
    roomName: string;
    contactPhone: string;
  }) => ({
    type: "bubble",
    size: "kilo",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "box",
          layout: "horizontal",
          contents: [
            {
              type: "text",
              text: "✅ ยืนยันการทดลองเรียน",
              weight: "bold",
              size: "md",
              color: "#ffffff",
              flex: 1
            }
          ]
        }
      ],
      backgroundColor: "#00BCD4",
      paddingAll: "15px"
    },
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "จองสำเร็จแล้ว!",
          size: "lg",
          color: "#00BCD4",
          weight: "bold",
          align: "center",
          margin: "md"
        },
        {
          type: "separator",
          margin: "md"
        },
        {
          type: "box",
          layout: "vertical",
          margin: "md",
          spacing: "sm",
          contents: [
            {
              type: "box",
              layout: "horizontal",
              contents: [
                {
                  type: "text",
                  text: "👦 นักเรียน",
                  size: "sm",
                  color: "#555555",
                  flex: 0,
                  weight: "bold"
                },
                {
                  type: "text",
                  text: data.studentName,
                  size: "sm",
                  color: "#111111",
                  align: "end"
                }
              ]
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                {
                  type: "text",
                  text: "📚 วิชา",
                  size: "sm",
                  color: "#555555",
                  flex: 0,
                  weight: "bold"
                },
                {
                  type: "text",
                  text: data.subjectName,
                  size: "sm",
                  color: "#111111",
                  align: "end",
                  weight: "bold"
                }
              ]
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                {
                  type: "text",
                  text: "📅 วันที่",
                  size: "sm",
                  color: "#555555",
                  flex: 0
                },
                {
                  type: "text",
                  text: data.date,
                  size: "sm",
                  color: "#111111",
                  align: "end"
                }
              ]
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                {
                  type: "text",
                  text: "⏰ เวลา",
                  size: "sm",
                  color: "#555555",
                  flex: 0
                },
                {
                  type: "text",
                  text: `${data.startTime} - ${data.endTime}`,
                  size: "sm",
                  color: "#111111",
                  align: "end"
                }
              ]
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                {
                  type: "text",
                  text: "📍 สถานที่",
                  size: "sm",
                  color: "#555555",
                  flex: 0
                },
                {
                  type: "text",
                  text: data.location,
                  size: "sm",
                  color: "#111111",
                  align: "end"
                }
              ]
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                {
                  type: "text",
                  text: "🚪 ห้องเรียน",
                  size: "sm",
                  color: "#555555",
                  flex: 0
                },
                {
                  type: "text",
                  text: data.roomName,
                  size: "sm",
                  color: "#111111",
                  align: "end"
                }
              ]
            }
          ]
        },
        {
          type: "separator",
          margin: "md"
        },
        {
          type: "text",
          text: `หากต้องการเปลี่ยนแปลง\nกรุณาติดต่อ ${data.contactPhone}`,
          size: "xs",
          color: "#aaaaaa",
          wrap: true,
          margin: "md",
          align: "center"
        }
      ],
      paddingAll: "20px"
    }
  }),

  trialReminder: (data: {
    studentName: string;
    subjectName: string;
    date: string;
    startTime: string;
    endTime: string;
    location: string;
    roomName: string;
    contactPhone: string;
  }) => ({
    type: "bubble",
    size: "kilo",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "box",
          layout: "horizontal",
          contents: [
            {
              type: "text",
              text: "⏰ แจ้งเตือนทดลองเรียนพรุ่งนี้",
              weight: "bold",
              size: "md",
              color: "#ffffff",
              flex: 1
            }
          ]
        }
      ],
      backgroundColor: "#FF9800",
      paddingAll: "15px"
    },
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "พรุ่งนี้มีทดลองเรียนนะคะ 😊",
          size: "lg",
          color: "#FF9800",
          weight: "bold",
          align: "center",
          margin: "md"
        },
        {
          type: "separator",
          margin: "md"
        },
        {
          type: "box",
          layout: "vertical",
          margin: "md",
          spacing: "sm",
          contents: [
            {
              type: "box",
              layout: "horizontal",
              contents: [
                { type: "text", text: "👦 นักเรียน", size: "sm", color: "#555555", flex: 0, weight: "bold" },
                { type: "text", text: data.studentName, size: "sm", color: "#111111", align: "end" }
              ]
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                { type: "text", text: "📚 วิชา", size: "sm", color: "#555555", flex: 0, weight: "bold" },
                { type: "text", text: data.subjectName, size: "sm", color: "#111111", align: "end", weight: "bold" }
              ]
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                { type: "text", text: "📅 วันที่", size: "sm", color: "#555555", flex: 0 },
                { type: "text", text: data.date, size: "sm", color: "#111111", align: "end" }
              ]
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                { type: "text", text: "⏰ เวลา", size: "sm", color: "#555555", flex: 0 },
                { type: "text", text: `${data.startTime} - ${data.endTime}`, size: "sm", color: "#111111", align: "end" }
              ]
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                { type: "text", text: "📍 สถานที่", size: "sm", color: "#555555", flex: 0 },
                { type: "text", text: data.location, size: "sm", color: "#111111", align: "end" }
              ]
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                { type: "text", text: "🚪 ห้องเรียน", size: "sm", color: "#555555", flex: 0 },
                { type: "text", text: data.roomName, size: "sm", color: "#111111", align: "end" }
              ]
            }
          ]
        },
        {
          type: "separator",
          margin: "md"
        },
        {
          type: "text",
          text: `หากต้องการเปลี่ยนแปลง\nกรุณาติดต่อ ${data.contactPhone}`,
          size: "xs",
          color: "#aaaaaa",
          wrap: true,
          margin: "md",
          align: "center"
        }
      ],
      paddingAll: "20px"
    }
  })
};

export async function POST(request: NextRequest) {
  console.log('=== Send Flex Message API called ===');
  
  try {
    const body = await request.json();
    const { userId, template, data, accessToken, altText } = body;
    
    console.log('Request:', { 
      userId, 
      template,
      hasToken: !!accessToken,
      hasData: !!data
    });
    
    if (!userId || !template || !data || !accessToken) {
      return NextResponse.json({
        success: false,
        message: 'Missing required fields'
      }, { status: 400 });
    }
    
    // Get flex template
    const flexTemplate = FLEX_TEMPLATES[template as keyof typeof FLEX_TEMPLATES];
    if (!flexTemplate) {
      return NextResponse.json({
        success: false,
        message: 'Invalid template'
      }, { status: 400 });
    }
    
    // Generate flex message
    const flexMessage = flexTemplate(data);
    
    // Send message using LINE Messaging API
    console.log('Sending flex message to LINE API...');
    
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: userId,
        messages: [{
          type: 'flex',
          altText: altText || 'คุณได้รับข้อความใหม่',
          contents: flexMessage
        }]
      })
    });
    
    console.log('LINE API Response status:', response.status);
    
    if (response.ok) {
      console.log('Flex message sent successfully');
      return NextResponse.json({
        success: true,
        message: 'ส่งข้อความสำเร็จ'
      });
    }
    
    // Handle errors
    const errorText = await response.text();
    console.error('LINE API error response:', errorText);
    
    let errorData;
    try {
      errorData = JSON.parse(errorText);
    } catch {
      errorData = { message: errorText };
    }
    
    let errorMessage = 'ไม่สามารถส่งข้อความได้';
    
    if (response.status === 400) {
      if (errorData.message?.includes('Invalid user')) {
        errorMessage = 'User ID ไม่ถูกต้อง หรือผู้ใช้ยังไม่ได้เพิ่มเพื่อน';
      } else {
        errorMessage = `ข้อมูลไม่ถูกต้อง: ${errorData.message || 'Unknown error'}`;
      }
    } else if (response.status === 401) {
      errorMessage = 'Channel Access Token ไม่ถูกต้อง';
    } else if (response.status === 429) {
      errorMessage = 'ส่งข้อความเกินโควต้าที่กำหนด';
    }
    
    console.error('Error message:', errorMessage);
    
    return NextResponse.json({
      success: false,
      message: errorMessage,
      details: errorData
    });
    
  } catch (error) {
    console.error('Send flex message error:', error);
    return NextResponse.json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการส่งข้อความ',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}