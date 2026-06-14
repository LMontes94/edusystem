-- Backfill fromLevelGradeId from CourseStudent -> Course -> levelGradeId chain
-- This handles legacy records where fromLevelGradeId was not set during creation
UPDATE "promotion_results" pr
SET "from_level_grade_id" = c.level_grade_id
FROM "course_students" cs
JOIN "courses" c ON c.id = cs.course_id
WHERE pr.from_course_student_id = cs.id
  AND pr.from_level_grade_id IS NULL
  AND c.level_grade_id IS NOT NULL;

-- Verification: records where Course.levelGradeId was null remain with fromLevelGradeId = null
-- This is accepted technical debt for legacy pre-LevelGrade data (F6)
