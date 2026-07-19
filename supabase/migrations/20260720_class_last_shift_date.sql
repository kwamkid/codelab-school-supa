-- Records the cancelled-session date of the most recent "ลายกคลาส" shift
-- (shiftClassFromSession) so the admin can undo it while that date hasn't
-- passed yet. Cleared on undo; overwritten by a newer shift.
alter table classes add column if not exists last_shift_date date;
