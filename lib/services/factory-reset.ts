// lib/services/factory-reset.ts

// Collections ที่ต้องล้าง (ไม่รวม settings)
const COLLECTIONS_TO_RESET = [
  'branches',
  'parents',
  'students',
  'subjects',
  'teachers',
  'classes',
  'enrollments',
  'promotions',
  'holidays',
  'makeupClasses',
  'trialBookings',
  'notifications'
];

// Subcollections ที่ต้องล้าง
const SUBCOLLECTIONS = {
  'branches': ['rooms'],
  'parents': ['students'],
  'teachers': ['availability'],
  'classes': ['schedules']
};

export interface ResetProgress {
  total: number;
  current: number;
  currentCollection: string;
  status: 'preparing' | 'deleting' | 'completed' | 'error';
  error?: string;
}

// ฟังก์ชันล้างข้อมูลทั้งหมด
export async function factoryReset(
  onProgress?: (progress: ResetProgress) => void
): Promise<void> {
  try {
    // นับจำนวน documents ทั้งหมดก่อน
    const totalCount = await countAllDocuments();
    let currentCount = 0;
    
    if (onProgress) {
      onProgress({
        total: totalCount,
        current: 0,
        currentCollection: 'Preparing...',
        status: 'preparing'
      });
    }
    
    // ล้างแต่ละ collection
    for (const collectionName of COLLECTIONS_TO_RESET) {
      if (onProgress) {
        onProgress({
          total: totalCount,
          current: currentCount,
          currentCollection: collectionName,
          status: 'deleting'
        });
      }
      
      // ล้าง main collection
      const deletedCount = await deleteCollection(collectionName);
      currentCount += deletedCount;
      
      // ล้าง subcollections ถ้ามี
      if (SUBCOLLECTIONS[collectionName]) {
        const subcollections = SUBCOLLECTIONS[collectionName];
        for (const subcollection of subcollections) {
          const subCount = await deleteSubcollections(collectionName, subcollection);
          currentCount += subCount;
        }
      }
    }
    
    if (onProgress) {
      onProgress({
        total: totalCount,
        current: totalCount,
        currentCollection: 'Completed',
        status: 'completed'
      });
    }
    
  } catch (error) {
    console.error('Factory reset error:', error);
    
    if (onProgress) {
      onProgress({
        total: 0,
        current: 0,
        currentCollection: '',
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
    
    throw error;
  }
}

// นับจำนวน documents ทั้งหมด
async function countAllDocuments(): Promise<number> {
  let total = 0;
  
  for (const collectionName of COLLECTIONS_TO_RESET) {
    const snapshot = await getDocs(collection(db, collectionName));
    total += snapshot.size;
    
    // นับ subcollections ด้วย
    if (SUBCOLLECTIONS[collectionName]) {
      for (const docSnap of snapshot.docs) {
        for (const subcollection of SUBCOLLECTIONS[collectionName]) {
          const subSnapshot = await getDocs(
            collection(db, collectionName, docSnap.id, subcollection)
          );
          total += subSnapshot.size;
        }
      }
    }
  }
  
  return total;
}

// ล้าง collection
async function deleteCollection(collectionName: string): Promise<number> {
  const collectionRef = collection(db, collectionName);
  const snapshot = await getDocs(collectionRef);
  
  if (snapshot.empty) return 0;
  
  // ใช้ batch delete สำหรับประสิทธิภาพ
  const batchSize = 500;
  const batches = [];
  let batch = writeBatch(db);
  let count = 0;
  
  for (const docSnap of snapshot.docs) {
    batch.delete(docSnap.ref);
    count++;
    
    if (count % batchSize === 0) {
      batches.push(batch.commit());
      batch = writeBatch(db);
    }
  }
  
  // Commit batch สุดท้าย
  if (count % batchSize !== 0) {
    batches.push(batch.commit());
  }
  
  await Promise.all(batches);
  return snapshot.size;
}

// ล้าง subcollections
async function deleteSubcollections(
  parentCollection: string,
  subcollectionName: string
): Promise<number> {
  const parentSnapshot = await getDocs(collection(db, parentCollection));
  let totalDeleted = 0;
  
  for (const parentDoc of parentSnapshot.docs) {
    const subcollectionRef = collection(
      db,
      parentCollection,
      parentDoc.id,
      subcollectionName
    );
    const snapshot = await getDocs(subcollectionRef);
    
    if (!snapshot.empty) {
      const batch = writeBatch(db);
      
      snapshot.docs.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
      
      await batch.commit();
      totalDeleted += snapshot.size;
    }
  }
  
  return totalDeleted;
}

// ตรวจสอบว่ามีข้อมูลหรือไม่
export async function hasAnyData(): Promise<boolean> {
  for (const collectionName of COLLECTIONS_TO_RESET) {
    const snapshot = await getDocs(collection(db, collectionName));
    if (!snapshot.empty) {
      return true;
    }
  }
  return false;
}

// ดึงสถิติข้อมูลปัจจุบัน
export async function getDataStatistics(): Promise<Record<string, number>> {
  const stats: Record<string, number> = {};
  
  for (const collectionName of COLLECTIONS_TO_RESET) {
    const snapshot = await getDocs(collection(db, collectionName));
    stats[collectionName] = snapshot.size;
  }
  
  return stats;
}