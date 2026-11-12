USE e_scuela_db;

-- BACK UP FIRST from a terminal:
-- mysqldump --single-transaction --routines --triggers -u <mysql_user> -p e_scuela_db > e_scuela_db_pre_normalized_backup.sql
--
-- Run preflight_normalized_migration.sql and resolve profile duplicates,
-- username conflicts, and non-student role mismatches first. This one-time
-- migration retains the legacy tables;
-- it does not drop user, student, enrollment, or grade records.

ALTER TABLE students
    ADD UNIQUE KEY uq_students_user_id (user_id);

ALTER TABLE students
    ADD COLUMN fname VARCHAR(100) NOT NULL DEFAULT '',
    ADD COLUMN mname VARCHAR(100) NOT NULL DEFAULT '',
    ADD COLUMN lname VARCHAR(100) NOT NULL DEFAULT '';

UPDATE students
SET fname = SUBSTRING_INDEX(TRIM(full_name), ' ', 1),
    mname = CASE
        WHEN LOCATE(' ', TRIM(full_name)) = 0 THEN ''
        ELSE TRIM(SUBSTRING(
            TRIM(full_name),
            CHAR_LENGTH(SUBSTRING_INDEX(TRIM(full_name), ' ', 1)) + 1,
            CHAR_LENGTH(TRIM(full_name))
                - CHAR_LENGTH(SUBSTRING_INDEX(TRIM(full_name), ' ', 1))
                - CHAR_LENGTH(SUBSTRING_INDEX(TRIM(full_name), ' ', -1))
        ))
    END,
    lname = CASE
        WHEN LOCATE(' ', TRIM(full_name)) = 0 THEN ''
        ELSE SUBSTRING_INDEX(TRIM(full_name), ' ', -1)
    END;

ALTER TABLE students
    ADD CONSTRAINT uq_students_full_name UNIQUE (fname, mname, lname),
    DROP COLUMN full_name;

-- Align student login names with their student IDs without changing passwords.
UPDATE users
JOIN students ON students.user_id = users.id
SET users.username = students.student_id
WHERE users.role = 'student';

CREATE TABLE IF NOT EXISTS faculty (
    id INT AUTO_INCREMENT PRIMARY KEY,
    staff_id VARCHAR(20) NOT NULL UNIQUE,
    user_id INT NOT NULL UNIQUE,
    fname VARCHAR(100) NOT NULL,
    mname VARCHAR(100) NOT NULL DEFAULT '',
    lname VARCHAR(100) NOT NULL,
    CONSTRAINT uq_faculty_full_name UNIQUE (fname, mname, lname),
    CONSTRAINT fk_faculty_user FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO faculty (staff_id, user_id, fname, mname, lname)
SELECT CONCAT('FAC-', LPAD(users.id, 4, '0')), users.id, users.username, '', ''
FROM users
WHERE users.role = 'faculty'
  AND NOT EXISTS (
      SELECT 1 FROM faculty WHERE faculty.user_id = users.id
  );

CREATE TABLE IF NOT EXISTS school_years (
    id INT AUTO_INCREMENT PRIMARY KEY,
    year_label VARCHAR(20) NOT NULL UNIQUE,
    start_date DATE DEFAULT NULL,
    end_date DATE DEFAULT NULL,
    is_current BOOLEAN NOT NULL DEFAULT FALSE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

RENAME TABLE enrollments TO legacy_enrollments, grades TO legacy_grades;

INSERT IGNORE INTO school_years (year_label)
SELECT DISTINCT school_year FROM legacy_enrollments;

CREATE TABLE subject_offerings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_year_id INT NOT NULL,
    subject_id INT NOT NULL,
    faculty_id INT DEFAULT NULL,
    grade_level VARCHAR(20) NOT NULL,
    strand VARCHAR(20) NOT NULL DEFAULT 'N/A',
    section VARCHAR(50) NOT NULL,
    CONSTRAINT uq_subject_offerings
        UNIQUE (school_year_id, subject_id, grade_level, strand, section),
    CONSTRAINT fk_subject_offerings_school_year
        FOREIGN KEY (school_year_id) REFERENCES school_years(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_subject_offerings_subject
        FOREIGN KEY (subject_id) REFERENCES subjects(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_subject_offerings_faculty
        FOREIGN KEY (faculty_id) REFERENCES faculty(id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    INDEX idx_subject_offerings_faculty (faculty_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE enrollments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id VARCHAR(20) NOT NULL,
    subject_offering_id INT NOT NULL,
    enrollment_date DATE NOT NULL,
    enrollment_status ENUM('Enrolled', 'Dropped') NOT NULL DEFAULT 'Enrolled',
    CONSTRAINT uq_student_subject_offering UNIQUE (student_id, subject_offering_id),
    CONSTRAINT fk_enrollments_student FOREIGN KEY (student_id) REFERENCES students(student_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_enrollments_subject_offering
        FOREIGN KEY (subject_offering_id) REFERENCES subject_offerings(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX idx_enrollments_offering (subject_offering_id),
    INDEX idx_enrollments_status (enrollment_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE grades (
    id INT AUTO_INCREMENT PRIMARY KEY,
    enrollment_id INT NOT NULL UNIQUE,
    q1 DECIMAL(5,2) DEFAULT NULL,
    q2 DECIMAL(5,2) DEFAULT NULL,
    q3 DECIMAL(5,2) DEFAULT NULL,
    q4 DECIMAL(5,2) DEFAULT NULL,
    CONSTRAINT fk_grades_enrollment FOREIGN KEY (enrollment_id) REFERENCES enrollments(id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Legacy grades have no year/class key. Migrate only students with exactly
-- one legacy enrollment; ambiguous historical records remain in legacy_grades.
INSERT INTO subject_offerings
    (school_year_id, subject_id, grade_level, strand, section)
SELECT DISTINCT
    school_years.id,
    legacy_grades.subject_id,
    legacy_enrollments.grade_level,
    COALESCE(legacy_enrollments.strand, 'N/A'),
    legacy_enrollments.section
FROM legacy_grades
JOIN (
    SELECT student_id, MIN(id) AS enrollment_id
    FROM legacy_enrollments
    GROUP BY student_id
    HAVING COUNT(*) = 1
) AS one_enrollment ON one_enrollment.student_id = legacy_grades.student_id
JOIN legacy_enrollments
    ON legacy_enrollments.id = one_enrollment.enrollment_id
JOIN school_years ON school_years.year_label = legacy_enrollments.school_year
JOIN students ON students.student_id = legacy_grades.student_id
JOIN subjects ON subjects.id = legacy_grades.subject_id;

INSERT INTO enrollments
    (student_id, subject_offering_id, enrollment_date, enrollment_status)
SELECT
    legacy_grades.student_id,
    subject_offerings.id,
    DATE(legacy_enrollments.enrollment_date),
    legacy_enrollments.enrollment_status
FROM legacy_grades
JOIN (
    SELECT student_id, MIN(id) AS enrollment_id
    FROM legacy_enrollments
    GROUP BY student_id
    HAVING COUNT(*) = 1
) AS one_enrollment ON one_enrollment.student_id = legacy_grades.student_id
JOIN legacy_enrollments
    ON legacy_enrollments.id = one_enrollment.enrollment_id
JOIN school_years ON school_years.year_label = legacy_enrollments.school_year
JOIN subject_offerings
    ON subject_offerings.school_year_id = school_years.id
   AND subject_offerings.subject_id = legacy_grades.subject_id
   AND subject_offerings.grade_level = legacy_enrollments.grade_level
   AND subject_offerings.strand = COALESCE(legacy_enrollments.strand, 'N/A')
   AND subject_offerings.section = legacy_enrollments.section
JOIN students ON students.student_id = legacy_grades.student_id
JOIN subjects ON subjects.id = legacy_grades.subject_id;

INSERT INTO grades (enrollment_id, q1, q2, q3, q4)
SELECT enrollments.id, legacy_grades.q1, legacy_grades.q2, legacy_grades.q3, legacy_grades.q4
FROM legacy_grades
JOIN (
    SELECT student_id, MIN(id) AS enrollment_id
    FROM legacy_enrollments
    GROUP BY student_id
    HAVING COUNT(*) = 1
) AS one_enrollment ON one_enrollment.student_id = legacy_grades.student_id
JOIN legacy_enrollments
    ON legacy_enrollments.id = one_enrollment.enrollment_id
JOIN school_years ON school_years.year_label = legacy_enrollments.school_year
JOIN subject_offerings
    ON subject_offerings.school_year_id = school_years.id
   AND subject_offerings.subject_id = legacy_grades.subject_id
   AND subject_offerings.grade_level = legacy_enrollments.grade_level
   AND subject_offerings.strand = COALESCE(legacy_enrollments.strand, 'N/A')
   AND subject_offerings.section = legacy_enrollments.section
JOIN enrollments
    ON enrollments.student_id = legacy_grades.student_id
   AND enrollments.subject_offering_id = subject_offerings.id;
