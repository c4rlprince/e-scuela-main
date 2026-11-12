const bcrypt = require('bcryptjs');
const pool = require('../config/db');

const validSubjects = new Set([
    'Mathematics', 'English', 'Science', 'Filipino',
    'History', 'PE', 'ICT', 'Research'
]);

function text(value, maxLength) {
    return typeof value === 'string' && value.trim().length <= maxLength
        ? value.trim()
        : '';
}

exports.getEnrollments = async (req, res) => {
    try {
        const studentId = text(req.query.studentId, 20);
        const query = `SELECT e.id, e.student_id, e.subject_offering_id,
                              e.enrollment_date, e.enrollment_status,
                              so.school_year_id, sy.year_label AS school_year,
                              so.subject_id, subjects.subject_name,
                              so.faculty_id, faculty.staff_id,
                              CONCAT_WS(' ', NULLIF(faculty.fname, ''), NULLIF(faculty.mname, ''), NULLIF(faculty.lname, '')) AS faculty_name,
                              so.grade_level, so.strand, so.section
                       FROM enrollments e
                       JOIN subject_offerings so ON so.id = e.subject_offering_id
                       JOIN school_years sy ON sy.id = so.school_year_id
                       JOIN subjects ON subjects.id = so.subject_id
                       LEFT JOIN faculty ON faculty.id = so.faculty_id
                       WHERE (? = '' OR e.student_id = ?)
                       ORDER BY sy.year_label DESC, e.student_id, subjects.subject_name`;
        const [rows] = await pool.execute(query, [studentId, studentId]);
        return res.status(200).json(rows);
    } catch (error) {
        console.error('Error fetching enrollments:', error);
        return res.status(500).json({ message: 'Could not fetch enrollments.' });
    }
};

exports.saveEnrollment = async (req, res) => {
    const student = req.body?.student;
    const enrollment = req.body?.enrollment;
    const subjects = req.body?.subjects;

    const studentId = text(student?.id, 20);
    const name = text(student?.name, 100);
    const nameParts = name ? name.split(/\s+/) : [];
    const fname = text(student?.fname, 100) || nameParts[0] || '';
    const lname = text(student?.lname, 100) || nameParts[nameParts.length - 1] || '';
    const mname = text(student?.mname, 100) || nameParts.slice(1, -1).join(' ');
    const grade = text(enrollment?.grade, 20);
    const academicStatus = ['Regular', 'Irregular', 'Transferee'].includes(student?.academicStatus)
        ? student.academicStatus
        : 'Regular';
    const schoolYear = text(enrollment?.schoolYear, 20);
    const strand = text(enrollment?.strand, 20) || 'N/A';
    const section = text(enrollment?.section, 50);
    const date = text(enrollment?.date, 10);
    const enrollmentStatus = text(enrollment?.enrollmentStatus, 10);
    const contact = text(student?.contact, 20) || 'N/A';
    const guardian = text(student?.guardian, 100) || 'N/A';

    if (!/^\d{4}-\d{3}$/.test(studentId) || !fname || !lname || !grade || !section ||
        !/^\d{4}-\d{4}$/.test(schoolYear) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !['Enrolled', 'Dropped'].includes(enrollmentStatus) ||
        !Array.isArray(subjects) ||
        subjects.some(subject => typeof subject !== 'string' || !validSubjects.has(subject)) ||
        (enrollmentStatus === 'Enrolled' && subjects.length === 0)) {
        return res.status(400).json({ message: 'Enrollment details are invalid.' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [studentRows] = await connection.execute(
            'SELECT student_id, user_id FROM students WHERE student_id = ? FOR UPDATE',
            [studentId]
        );

        let userId;
        if (studentRows.length === 0) {
            const [userRows] = await connection.execute(
                'SELECT id, role FROM users WHERE username = ? FOR UPDATE',
                [studentId]
            );
            if (userRows.length > 0) {
                if (userRows[0].role !== 'student') {
                    await connection.rollback();
                    return res.status(409).json({ message: 'Student ID belongs to a non-student account.' });
                }
                userId = userRows[0].id;
            } else {
                const passwordHash = await bcrypt.hash(studentId, 10);
                const [userResult] = await connection.execute(
                    'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
                    [studentId, passwordHash, 'student']
                );
                userId = userResult.insertId;
            }

            await connection.execute(
                `INSERT INTO students
                    (student_id, user_id, fname, mname, lname, grade_level, section, academic_status, contact_number, guardian_name)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [studentId, userId, fname, mname, lname, grade, section, academicStatus, contact, guardian]
            );
        } else {
            userId = studentRows[0].user_id;
            const [userRows] = await connection.execute(
                'SELECT id FROM users WHERE id = ? AND role = ? FOR UPDATE',
                [userId, 'student']
            );
            if (userRows.length === 0) {
                await connection.rollback();
                return res.status(409).json({ message: 'Student profile has no student user account.' });
            }
            // Keep the existing password; only align its username to the student ID.
            await connection.execute('UPDATE users SET username = ? WHERE id = ?', [studentId, userId]);
            await connection.execute(
                `UPDATE students
                 SET fname = ?, mname = ?, lname = ?, grade_level = ?, section = ?, academic_status = ?,
                     contact_number = ?, guardian_name = ?
                 WHERE student_id = ?`,
                [fname, mname, lname, grade, section, academicStatus, contact, guardian, studentId]
            );
        }

        const [yearResult] = await connection.execute(
            `INSERT INTO school_years (year_label)
             VALUES (?)
             ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
            [schoolYear]
        );
        const schoolYearId = yearResult.insertId;
        const selectedSubjects = [...new Set(subjects)];

        const [existingEnrollments] = await connection.execute(
            `SELECT e.id, subjects.subject_name, so.grade_level, so.strand, so.section
             FROM enrollments e
             JOIN subject_offerings so ON so.id = e.subject_offering_id
             JOIN subjects ON subjects.id = so.subject_id
             WHERE e.student_id = ? AND so.school_year_id = ?
             FOR UPDATE`,
            [studentId, schoolYearId]
        );

        const selectedSet = new Set(selectedSubjects);
        for (const existing of existingEnrollments) {
            if (!selectedSet.has(existing.subject_name) ||
                enrollmentStatus === 'Dropped' ||
                existing.grade_level !== grade ||
                existing.strand !== strand ||
                existing.section !== section) {
                await connection.execute(
                    `UPDATE enrollments SET enrollment_status = 'Dropped' WHERE id = ?`,
                    [existing.id]
                );
            }
        }

        for (const subjectName of selectedSubjects) {
            const [subjectResult] = await connection.execute(
                `INSERT INTO subjects (subject_name) VALUES (?)
                 ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
                [subjectName]
            );
            const [offeringResult] = await connection.execute(
                `INSERT INTO subject_offerings
                    (school_year_id, subject_id, grade_level, strand, section)
                 VALUES (?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
                [schoolYearId, subjectResult.insertId, grade, strand, section]
            );
            const [enrollmentResult] = await connection.execute(
                `INSERT INTO enrollments
                    (student_id, subject_offering_id, enrollment_date, enrollment_status)
                 VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                    id = LAST_INSERT_ID(id),
                    enrollment_date = VALUES(enrollment_date),
                    enrollment_status = VALUES(enrollment_status)`,
                [studentId, offeringResult.insertId, date, enrollmentStatus]
            );
            await connection.execute(
                `INSERT INTO grades (enrollment_id)
                 VALUES (?)
                 ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
                [enrollmentResult.insertId]
            );
        }

        await connection.commit();
        return res.status(200).json({ message: 'Enrollment and subject grades saved.' });
    } catch (error) {
        if (connection) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error('Error rolling back enrollment transaction:', rollbackError);
            }
        }
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Student ID or full name already exists.' });
        }
        console.error('Error saving enrollment:', error);
        return res.status(500).json({ message: 'Could not save enrollment to the database.' });
    } finally {
        if (connection) connection.release();
    }
};

exports.deleteEnrollment = async (req, res) => {
    try {
        const enrollmentId = Number(req.params.id);
        if (!Number.isSafeInteger(enrollmentId) || enrollmentId <= 0) {
            return res.status(400).json({ message: 'Enrollment ID is invalid.' });
        }
        const [result] = await pool.execute('DELETE FROM enrollments WHERE id = ?', [enrollmentId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Enrollment not found.' });
        }
        return res.status(200).json({ message: 'Enrollment and its grade deleted.' });
    } catch (error) {
        console.error('Error deleting enrollment:', error);
        return res.status(500).json({ message: 'Could not delete enrollment.' });
    }
};
