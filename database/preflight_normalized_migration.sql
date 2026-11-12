USE e_scuela_db;

-- Review all result sets before running migrate_normalized_academics.sql.
-- Resolve duplicate profiles and username conflicts first. Orphan grades and
-- ambiguous histories remain in the archived legacy tables and are not copied.

SELECT full_name, COUNT(*) AS profile_count
FROM students
GROUP BY full_name
HAVING COUNT(*) > 1 OR TRIM(full_name) = '';

SELECT user_id, COUNT(*) AS profile_count
FROM students
GROUP BY user_id
HAVING COUNT(*) > 1;

SELECT student_id, user_id AS linked_user_id, conflicting_user.id AS conflicting_user_id
FROM students
JOIN users AS conflicting_user ON conflicting_user.username = students.student_id
WHERE conflicting_user.id <> students.user_id;

SELECT students.student_id, users.id AS user_id, users.role
FROM students
JOIN users ON users.id = students.user_id
WHERE users.role <> 'student';

SELECT grades.student_id, grades.subject_id
FROM grades
LEFT JOIN students ON students.student_id = grades.student_id
LEFT JOIN subjects ON subjects.id = grades.subject_id
WHERE students.student_id IS NULL OR subjects.id IS NULL;

SELECT grades.student_id, COUNT(enrollments.id) AS enrollment_count
FROM grades
LEFT JOIN enrollments ON enrollments.student_id = grades.student_id
GROUP BY grades.student_id
HAVING COUNT(enrollments.id) <> 1;
