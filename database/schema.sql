CREATE DATABASE IF NOT EXISTS e_scuela_db;
USE e_scuela_db;

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'faculty', 'student') NOT NULL DEFAULT 'student',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE students (
    student_id VARCHAR(20) PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    fname VARCHAR(100) NOT NULL,
    mname VARCHAR(100) NOT NULL DEFAULT '',
    lname VARCHAR(100) NOT NULL,
    grade_level VARCHAR(20) DEFAULT 'Pending',
    section VARCHAR(50) DEFAULT 'Pending Enrollment',
    academic_status ENUM('Regular', 'Irregular', 'Transferee') DEFAULT 'Regular',
    contact_number VARCHAR(20) DEFAULT 'N/A',
    guardian_name VARCHAR(100) DEFAULT 'N/A',
    CONSTRAINT uq_students_full_name UNIQUE (fname, mname, lname),
    CONSTRAINT fk_students_user FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE faculty (
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

CREATE TABLE school_years (
    id INT AUTO_INCREMENT PRIMARY KEY,
    year_label VARCHAR(20) NOT NULL UNIQUE,
    start_date DATE DEFAULT NULL,
    end_date DATE DEFAULT NULL,
    is_current BOOLEAN NOT NULL DEFAULT FALSE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE subjects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    subject_name VARCHAR(50) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
