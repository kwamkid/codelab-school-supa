# Firebase to Supabase Migration Summary

## Completed Migrations

### 1. `/Users/ampstark/codelab-school-supa/lib/services/settings.ts` ✅ COMPLETE

**Changes Made:**
- Added Supabase client import: `import { getClient } from '@/lib/supabase/client';`
- Removed Firebase imports (doc, getDoc, setDoc, serverTimestamp)
- Converted `getGeneralSettings()`:
  - Firebase: `doc(db, 'settings', 'general')` → Supabase: `.from('settings').eq('key', 'general')`
  - Date conversion: `data.updatedAt?.toDate()` → `new Date(data.updated_at)`
  - Field mapping: camelCase → snake_case (updatedAt → updated_at, updatedBy → updated_by)
- Converted `updateGeneralSettings()`:
  - Firebase: `setDoc()` with merge → Supabase: `.upsert()` with onConflict
  - Firebase: `serverTimestamp()` → Supabase: `new Date().toISOString()`
  - Settings stored in JSONB `value` field
- Converted `getMakeupSettings()` and `updateMakeupSettings()` with same patterns

**Key Pattern:**
```typescript
// Firebase
const docRef = doc(db, 'settings', 'general');
const docSnap = await getDoc(docRef);
const data = docSnap.data();
return { ...data, updatedAt: data.updatedAt?.toDate() };

// Supabase
const { data, error } = await supabase
  .from('settings')
  .select('*')
  .eq('key', 'general')
  .single();
return { ...(data.value as any), updatedAt: new Date(data.updated_at) };
```

### 2. `/Users/ampstark/codelab-school-supa/lib/services/notifications.ts` ✅ COMPLETE

**Changes Made:**
- Added Supabase client import
- Converted `createNotification()`:
  - Firebase: `addDoc(collection(db, 'notifications', userId, 'messages'))`
  - Supabase: `.from('notifications').insert()` (flat structure, no subcollections)
  - Field mapping: userId → user_id, imageUrl → image_url, actionUrl → action_url, isRead → is_read
  - Firebase: `serverTimestamp()` → Supabase: auto-set by DEFAULT NOW()
- Converted `getUnreadNotifications()`:
  - Firebase: `query(collection(), where(), orderBy())`
  - Supabase: `.select('*').eq('user_id', userId).eq('is_read', false).order('sent_at', { ascending: false })`
  - Date conversion in map function
- Converted `markNotificationAsRead()`:
  - Firebase: `updateDoc()` → Supabase: `.update()`
  - Firebase: `serverTimestamp()` → Supabase: `new Date().toISOString()`

**Key Pattern:**
```typescript
// Firebase
const docRef = await addDoc(collection(db, 'notifications', userId, 'messages'), {
  ...data,
  sentAt: serverTimestamp(),
  isRead: false
});

// Supabase
const { data: notification, error } = await supabase
  .from('notifications')
  .insert({
    user_id: data.userId,
    type: data.type,
    title: data.title,
    body: data.body,
    is_read: false
  })
  .select()
  .single();
```

### 3. `/Users/ampstark/codelab-school-supa/lib/services/makeup.ts` ⚠️ PARTIAL

**Completed:**
- Added Supabase client import
- Created helper function `dbRowToMakeupClass(row)` to convert snake_case DB rows to camelCase TypeScript objects
- Converted query functions:
  - `getMakeupClasses()` ✅
  - `getMakeupClassesByStudent()` ✅
  - `getMakeupClassesByClass()` ✅
  - `getMakeupClass()` ✅
  - `getMakeupCount()` ✅

**Still Needs Migration** (see remaining functions below):
- `getMakeupRequestsBySchedules()`
- `checkMakeupExists()`
- `createMakeupRequest()` - Complex, uses writeBatch
- `scheduleMakeupClass()` - Uses updateDoc
- `recordMakeupAttendance()` - Uses updateDoc
- `cancelMakeupClass()` - Uses updateDoc
- `getUpcomingMakeupClasses()` - Complex date queries
- `getMakeupClassesForReminder()` - Complex date queries
- `updateMakeupAttendance()` - Uses updateDoc
- `revertMakeupToScheduled()` - Uses writeBatch and audit logs
- `deleteMakeupClass()` - Uses writeBatch and deletion logs
- `getMakeupByOriginalSchedule()` - Uses query with 'in' operator
- `deleteMakeupForSchedule()`

### 4. `/Users/ampstark/codelab-school-supa/lib/services/trial-bookings.ts` ⚠️ NOT STARTED

**Needs Migration:**
- Import Supabase client
- Convert all trial booking queries
- Convert all trial session queries
- Handle nested student data (birthdate conversion)
- Handle reschedule history array
- Complex conversion function `convertTrialToEnrollment()`

## Migration Patterns Reference

### Common Conversions

#### 1. Basic Query
```typescript
// Firebase
const q = query(
  collection(db, 'makeup_classes'),
  where('student_id', '==', studentId),
  orderBy('created_at', 'desc')
);
const snapshot = await getDocs(q);
const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

// Supabase
const { data, error } = await supabase
  .from('makeup_classes')
  .select('*')
  .eq('student_id', studentId)
  .order('created_at', { ascending: false });
// data is already an array of objects with id included
```

#### 2. Single Document
```typescript
// Firebase
const docRef = doc(db, 'makeup_classes', id);
const docSnap = await getDoc(docRef);
if (docSnap.exists()) {
  return { id: docSnap.id, ...docSnap.data() };
}

// Supabase
const { data, error } = await supabase
  .from('makeup_classes')
  .select('*')
  .eq('id', id)
  .single();

if (error && error.code === 'PGRST116') return null; // Not found
if (error) throw error;
return data;
```

#### 3. Insert
```typescript
// Firebase
const docRef = await addDoc(collection(db, 'makeup_classes'), {
  ...data,
  created_at: serverTimestamp()
});
return docRef.id;

// Supabase
const { data: result, error } = await supabase
  .from('makeup_classes')
  .insert({
    ...data
    // created_at auto-set by DEFAULT NOW()
  })
  .select()
  .single();

if (error) throw error;
return result.id;
```

#### 4. Update
```typescript
// Firebase
const docRef = doc(db, 'makeup_classes', id);
await updateDoc(docRef, {
  status: 'completed',
  updated_at: serverTimestamp()
});

// Supabase
const { error } = await supabase
  .from('makeup_classes')
  .update({
    status: 'completed'
    // updated_at auto-set by trigger
  })
  .eq('id', id);

if (error) throw error;
```

#### 5. Delete
```typescript
// Firebase
const docRef = doc(db, 'makeup_classes', id);
await deleteDoc(docRef);

// Supabase
const { error } = await supabase
  .from('makeup_classes')
  .delete()
  .eq('id', id);

if (error) throw error;
```

#### 6. Batch Operations (Complex)
```typescript
// Firebase
const batch = writeBatch(db);
batch.set(doc(collection(db, 'makeup_classes')), data1);
batch.update(doc(db, 'classes', classId), data2);
await batch.commit();

// Supabase - NO BATCH! Use individual operations or RPC
// Option 1: Sequential operations
await supabase.from('makeup_classes').insert(data1);
await supabase.from('classes').update(data2).eq('id', classId);

// Option 2: Use PostgreSQL function (RPC)
await supabase.rpc('create_makeup_with_updates', {
  makeup_data: data1,
  class_id: classId,
  class_data: data2
});
```

#### 7. Count
```typescript
// Firebase
const snapshot = await getDocs(query);
const count = snapshot.size;

// Supabase
const { count, error } = await supabase
  .from('makeup_classes')
  .select('*', { count: 'exact', head: true })
  .eq('student_id', studentId);
```

#### 8. Date Handling
```typescript
// Firebase Timestamp → JavaScript Date
data.created_at?.toDate()
Timestamp.fromDate(new Date())
serverTimestamp()

// Supabase - ISO8601 strings
new Date(data.created_at)
new Date().toISOString()
// or let PostgreSQL handle it with DEFAULT NOW()
```

#### 9. Field Name Conversion (camelCase → snake_case)
```typescript
// Common mappings:
createdAt → created_at
updatedAt → updated_at
updatedBy → updated_by
branchId → branch_id
studentId → student_id
parentId → parent_id
originalClassId → original_class_id
originalScheduleId → original_schedule_id
originalSessionNumber → original_session_number
originalSessionDate → original_session_date
makeupSchedule.confirmedAt → makeup_confirmed_at
makeupSchedule.confirmedBy → makeup_confirmed_by
parentLineUserId → parent_line_user_id
```

### Complex Patterns

#### Nested Data in Makeup Classes
The makeup_classes table uses flat structure with prefixed fields:
```typescript
// Firebase nested structure
{
  makeupSchedule: {
    date: Timestamp,
    startTime: string,
    teacherId: string,
    ...
  },
  attendance: {
    status: string,
    checkedBy: string,
    ...
  }
}

// Supabase flat structure
{
  makeup_date: date,
  makeup_start_time: time,
  makeup_teacher_id: uuid,
  ...
  attendance_status: string,
  attendance_checked_by: uuid,
  ...
}

// Helper function to reconstruct:
function dbRowToMakeupClass(row: any): MakeupClass {
  return {
    ...
    makeupSchedule: row.makeup_date ? {
      date: new Date(row.makeup_date),
      startTime: row.makeup_start_time,
      ...
    } : undefined,
    attendance: row.attendance_status ? {
      status: row.attendance_status,
      ...
    } : undefined
  }
}
```

## Remaining Work

### High Priority

1. **makeup.ts** - Complete remaining functions (13 functions)
2. **trial-bookings.ts** - Full migration (20+ functions)

### Functions Requiring Special Attention

1. **Batch Operations** - Need to be replaced with sequential operations or RPC
2. **Complex Date Queries** - Makeup classes with date range filters
3. **Audit Logs** - deleteMakeupClass() and revertMakeupToScheduled()
4. **Array Queries** - Using 'in' operator for status arrays

## Testing Checklist

After migration:
- [ ] Test all CRUD operations for makeup classes
- [ ] Test all CRUD operations for trial bookings/sessions
- [ ] Test settings retrieval and updates
- [ ] Test notification creation and retrieval
- [ ] Verify date conversions work correctly
- [ ] Check that denormalized data (branch_name, student_name, etc.) is properly populated
- [ ] Test batch-like operations work sequentially
- [ ] Verify error handling works correctly

## Notes

- Supabase does NOT support subcollections - all notifications are in one flat table
- Supabase auto-handles `created_at` and `updated_at` via DEFAULT NOW() and triggers
- Use `{ count: 'exact', head: true }` for count queries to avoid fetching data
- Error code 'PGRST116' means "not found" in Supabase
- Always use `.single()` when expecting one result to get object instead of array
- Remember to add `.select()` after insert/update if you need the returned data
