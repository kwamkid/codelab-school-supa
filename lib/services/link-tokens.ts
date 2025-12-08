// lib/services/link-tokens.ts

import { getParent } from './parents';

const COLLECTION_NAME = 'linkTokens';

export interface LinkToken {
  id: string;
  token: string;
  parentId: string;
  createdAt: Date;
  expiresAt: Date;
  used: boolean;
  usedAt?: Date;
  linkedLineUserId?: string;
}

// Generate random token
function generateRandomToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// Generate link token for parent
export async function generateLinkToken(parentId: string): Promise<string> {
  try {
    // Check if parent exists and not already linked
    const parent = await getParent(parentId);
    if (!parent) {
      throw new Error('Parent not found');
    }
    
    if (parent.lineUserId) {
      throw new Error('Parent already linked to LINE');
    }
    
    const token = generateRandomToken();
    
    // Store in Firestore with 24 hour expiry
    await addDoc(collection(db, COLLECTION_NAME), {
      token,
      parentId,
      createdAt: serverTimestamp(),
      expiresAt: Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000)), // 24 hours
      used: false
    });
    
    return token;
  } catch (error) {
    console.error('Error generating link token:', error);
    throw error;
  }
}

// Get token document
export async function getTokenDoc(token: string): Promise<LinkToken | null> {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('token', '==', token)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }
    
    const doc = querySnapshot.docs[0];
    const data = doc.data();
    
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      expiresAt: data.expiresAt?.toDate() || new Date(),
      usedAt: data.usedAt?.toDate()
    } as LinkToken;
  } catch (error) {
    console.error('Error getting token:', error);
    return null;
  }
}

// Verify link token
export async function verifyLinkToken(
  token: string, 
  phone: string
): Promise<{
  valid: boolean;
  error?: string;
  parent?: any;
  tokenDoc?: LinkToken;
}> {
  try {
    // Check token exists
    const tokenDoc = await getTokenDoc(token);
    if (!tokenDoc) {
      return { valid: false, error: 'token_not_found' };
    }
    
    // Check if token is used
    if (tokenDoc.used) {
      return { valid: false, error: 'token_used' };
    }
    
    // Check if token is expired
    if (tokenDoc.expiresAt < new Date()) {
      return { valid: false, error: 'token_expired' };
    }
    
    // Get parent data
    const parent = await getParent(tokenDoc.parentId);
    if (!parent) {
      return { valid: false, error: 'parent_not_found' };
    }
    
    // Check if already linked
    if (parent.lineUserId) {
      return { valid: false, error: 'already_linked' };
    }
    
    // Check phone matches (remove formatting)
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const parentPhone = parent.phone.replace(/[^0-9]/g, '');
    
    if (cleanPhone !== parentPhone) {
      // Also check emergency phone
      const parentEmergencyPhone = parent.emergencyPhone?.replace(/[^0-9]/g, '');
      if (cleanPhone !== parentEmergencyPhone) {
        return { valid: false, error: 'phone_not_match' };
      }
    }
    
    // Get students
    const { getStudentsByParent } = await import('./parents');
    const students = await getStudentsByParent(parent.id);
    
    return { 
      valid: true, 
      parent: {
        ...parent,
        students
      },
      tokenDoc 
    };
  } catch (error) {
    console.error('Error verifying token:', error);
    return { valid: false, error: 'system_error' };
  }
}

// Mark token as used
export async function markTokenAsUsed(
  tokenId: string,
  lineUserId: string
): Promise<void> {
  try {
    await updateDoc(doc(db, COLLECTION_NAME, tokenId), {
      used: true,
      usedAt: serverTimestamp(),
      linkedLineUserId: lineUserId
    });
  } catch (error) {
    console.error('Error marking token as used:', error);
    throw error;
  }
}

// Clean up expired tokens (for maintenance)
export async function cleanupExpiredTokens(): Promise<number> {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('expiresAt', '<', Timestamp.now()),
      where('used', '==', false)
    );
    
    const querySnapshot = await getDocs(q);
    let count = 0;
    
    for (const doc of querySnapshot.docs) {
      await updateDoc(doc.ref, {
        used: true,
        usedAt: serverTimestamp()
      });
      count++;
    }
    
    return count;
  } catch (error) {
    console.error('Error cleaning up tokens:', error);
    return 0;
  }
}

// Get active tokens for parent
export async function getActiveTokensForParent(parentId: string): Promise<LinkToken[]> {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('parentId', '==', parentId),
      where('used', '==', false),
      where('expiresAt', '>', Timestamp.now())
    );
    
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      expiresAt: doc.data().expiresAt?.toDate() || new Date(),
      usedAt: doc.data().usedAt?.toDate()
    } as LinkToken));
  } catch (error) {
    console.error('Error getting active tokens:', error);
    return [];
  }
}