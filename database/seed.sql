USE e_scuela_db;

-- Demo-only credentials. Use hashed passwords for production accounts.
INSERT INTO users (id, username, password_hash, role) VALUES
(1, 'admin', 'admin123', 'admin'),
(2, 'faculty', 'faculty123', 'faculty'),
(3, '2026-001', 'cath123', 'student'),
(4, '2026-002', 'ach123', 'student'),
(5, '2026-003', '2026-003', 'student'),
(6, '2026-004', '2026-004', 'student'),
(7, '2026-005', '2026-005', 'student'),
(8, '2026-006', '2026-006', 'student');

INSERT INTO faculty (staff_id, user_id, fname, mname, lname)
VALUES ('FAC-001', 2, 'Maria', '', 'Santos');

INSERT INTO students
    (student_id, user_id, fname, mname, lname, grade_level, section, academic_status)
VALUES
('2026-001', 3, 'CATHERINE', 'A.', 'ROSARIO', 'Grade 12', 'STEM-A', 'Regular'),
('2026-002', 4, 'ACHILLES', 'NERO C.', 'AGUILA', 'Grade 11', 'STEM-A', 'Regular'),
('2026-003', 5, 'PRINCE', 'CARL B.', 'BARTOLOME', 'Grade 12', 'STEM-A', 'Regular'),
('2026-004', 6, 'BLUE', 'BARRON B.', 'BAMBILLA', 'Grade 11', 'HUMSS-A', 'Regular'),
('2026-005', 7, 'JAYSON', 'J.', 'ESQUEJO', 'Grade 12', 'STEM-A', 'Regular'),
('2026-006', 8, 'CARL', 'ANTHONY V. DE', 'VERA', 'Grade 12', 'STEM-A', 'Regular');

INSERT INTO school_years (year_label, is_current)
VALUES ('2026-2027', TRUE);

INSERT INTO subjects (subject_name) VALUES
('Mathematics'), ('English'), ('Science'), ('Filipino'),
('History'), ('PE'), ('ICT'), ('Research');

INSERT INTO subject_offerings
    (school_year_id, subject_id, faculty_id, grade_level, strand, section)
SELECT school_years.id, subjects.id, NULL, classes.grade_level, classes.strand, classes.section
FROM school_years
CROSS JOIN subjects
CROSS JOIN (
    SELECT 'Grade 12' AS grade_level, 'STEM' AS strand, 'STEM-A' AS section
    UNION ALL SELECT 'Grade 11', 'STEM', 'STEM-A'
    UNION ALL SELECT 'Grade 11', 'HUMSS', 'HUMSS-A'
) AS classes
WHERE school_years.year_label = '2026-2027';

INSERT INTO enrollments
    (student_id, subject_offering_id, enrollment_date, enrollment_status)
SELECT students.student_id, subject_offerings.id, '2026-06-15', 'Enrolled'
FROM students
JOIN subject_offerings
    ON subject_offerings.grade_level = students.grade_level
   AND subject_offerings.section = students.section
JOIN school_years ON school_years.id = subject_offerings.school_year_id
WHERE school_years.year_label = '2026-2027';

INSERT INTO grades (enrollment_id)
SELECT enrollments.id
FROM enrollments;

UPDATE grades
JOIN enrollments ON enrollments.id = grades.enrollment_id
JOIN subject_offerings ON subject_offerings.id = enrollments.subject_offering_id
JOIN subjects ON subjects.id = subject_offerings.subject_id
SET grades.q1 = CASE
        WHEN enrollments.student_id = '2026-001' AND subjects.subject_name = 'Mathematics' THEN 88
        WHEN enrollments.student_id = '2026-001' AND subjects.subject_name = 'English' THEN 91
        WHEN enrollments.student_id = '2026-001' AND subjects.subject_name = 'Science' THEN 90
        WHEN enrollments.student_id = '2026-001' AND subjects.subject_name = 'Filipino' THEN 92
        WHEN enrollments.student_id = '2026-001' AND subjects.subject_name = 'History' THEN 78
        WHEN enrollments.student_id = '2026-001' AND subjects.subject_name = 'PE' THEN 95
        WHEN enrollments.student_id = '2026-001' AND subjects.subject_name = 'ICT' THEN 89
        WHEN enrollments.student_id = '2026-001' AND subjects.subject_name = 'Research' THEN 90
        WHEN enrollments.student_id = '2026-002' AND subjects.subject_name = 'Mathematics' THEN 85
        WHEN enrollments.student_id = '2026-002' AND subjects.subject_name = 'English' THEN 90
        WHEN enrollments.student_id = '2026-002' AND subjects.subject_name = 'Science' THEN 88
        WHEN enrollments.student_id = '2026-002' AND subjects.subject_name = 'Filipino' THEN 91
        WHEN enrollments.student_id = '2026-002' AND subjects.subject_name = 'History' THEN 86
        WHEN enrollments.student_id = '2026-002' AND subjects.subject_name = 'PE' THEN 94
        WHEN enrollments.student_id = '2026-002' AND subjects.subject_name = 'ICT' THEN 89
        ELSE NULL
    END,
    grades.q2 = CASE
        WHEN enrollments.student_id = '2026-001' AND subjects.subject_name = 'Mathematics' THEN 90
        WHEN enrollments.student_id = '2026-001' AND subjects.subject_name = 'English' THEN 90
        WHEN enrollments.student_id = '2026-001' AND subjects.subject_name = 'Science' THEN 91
        WHEN enrollments.student_id = '2026-001' AND subjects.subject_name = 'Filipino' THEN 91
        WHEN enrollments.student_id = '2026-001' AND subjects.subject_name = 'History' THEN 80
        WHEN enrollments.student_id = '2026-001' AND subjects.subject_name = 'PE' THEN 94
        WHEN enrollments.student_id = '2026-001' AND subjects.subject_name = 'ICT' THEN 90
        WHEN enrollments.student_id = '2026-001' AND subjects.subject_name = 'Research' THEN 92
        WHEN enrollments.student_id = '2026-002' AND subjects.subject_name = 'Mathematics' THEN 87
        WHEN enrollments.student_id = '2026-002' AND subjects.subject_name = 'English' THEN 91
        WHEN enrollments.student_id = '2026-002' AND subjects.subject_name = 'Science' THEN 89
        WHEN enrollments.student_id = '2026-002' AND subjects.subject_name = 'Filipino' THEN 90
        WHEN enrollments.student_id = '2026-002' AND subjects.subject_name = 'History' THEN 87
        WHEN enrollments.student_id = '2026-002' AND subjects.subject_name = 'PE' THEN 95
        WHEN enrollments.student_id = '2026-002' AND subjects.subject_name = 'ICT' THEN 88
        ELSE NULL
    END,
    grades.q3 = CASE
        WHEN enrollments.student_id = '2026-001' AND subjects.subject_name = 'Mathematics' THEN 89
        WHEN enrollments.student_id = '2026-001' AND subjects.subject_name = 'English' THEN 92
        WHEN enrollments.student_id = '2026-001' AND subjects.subject_name = 'Science' THEN 89
        WHEN enrollments.student_id = '2026-001' AND subjects.subject_name = 'Filipino' THEN 90
        WHEN enrollments.student_id = '2026-001' AND subjects.subject_name = 'History' THEN 79
        WHEN enrollments.student_id = '2026-001' AND subjects.subject_name = 'PE' THEN 96
        WHEN enrollments.student_id = '2026-001' AND subjects.subject_name = 'ICT' THEN 91
        WHEN enrollments.student_id = '2026-001' AND subjects.subject_name = 'Research' THEN 91
        WHEN enrollments.student_id = '2026-002' AND subjects.subject_name = 'Mathematics' THEN 88
        WHEN enrollments.student_id = '2026-002' AND subjects.subject_name = 'English' THEN 92
        WHEN enrollments.student_id = '2026-002' AND subjects.subject_name = 'Science' THEN 90
        WHEN enrollments.student_id = '2026-002' AND subjects.subject_name = 'Filipino' THEN 92
        WHEN enrollments.student_id = '2026-002' AND subjects.subject_name = 'History' THEN 88
        WHEN enrollments.student_id = '2026-002' AND subjects.subject_name = 'PE' THEN 94
        WHEN enrollments.student_id = '2026-002' AND subjects.subject_name = 'ICT' THEN 90
        ELSE NULL
    END,
    grades.q4 = CASE
        WHEN enrollments.student_id = '2026-001' AND subjects.subject_name = 'Mathematics' THEN 91
        WHEN enrollments.student_id = '2026-001' AND subjects.subject_name = 'English' THEN 93
        WHEN enrollments.student_id = '2026-001' AND subjects.subject_name = 'Science' THEN 92
        WHEN enrollments.student_id = '2026-001' AND subjects.subject_name = 'Filipino' THEN 93
        WHEN enrollments.student_id = '2026-001' AND subjects.subject_name = 'History' THEN 81
        WHEN enrollments.student_id = '2026-001' AND subjects.subject_name = 'PE' THEN 95
        WHEN enrollments.student_id = '2026-001' AND subjects.subject_name = 'ICT' THEN 90
        WHEN enrollments.student_id = '2026-001' AND subjects.subject_name = 'Research' THEN 93
        WHEN enrollments.student_id = '2026-002' AND subjects.subject_name = 'Mathematics' THEN 86
        WHEN enrollments.student_id = '2026-002' AND subjects.subject_name = 'English' THEN 91
        WHEN enrollments.student_id = '2026-002' AND subjects.subject_name = 'Science' THEN 91
        WHEN enrollments.student_id = '2026-002' AND subjects.subject_name = 'Filipino' THEN 93
        WHEN enrollments.student_id = '2026-002' AND subjects.subject_name = 'History' THEN 89
        WHEN enrollments.student_id = '2026-002' AND subjects.subject_name = 'PE' THEN 96
        WHEN enrollments.student_id = '2026-002' AND subjects.subject_name = 'ICT' THEN 91
        ELSE NULL
    END;
