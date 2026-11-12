const pool = require('../config/db');
const bcrypt = require('bcryptjs');

function text(value, maxLength) {
    return typeof value === 'string' && value.trim().length <= maxLength
        ? value.trim()
        : '';
}

// @desc    Get all students
// @route   GET /api/students
exports.getAllStudents = async (req, res) => {
    try {
        const [students] = await pool.query(
            `SELECT students.*,
                    CONCAT_WS(' ', NULLIF(students.fname, ''), NULLIF(students.mname, ''), NULLIF(students.lname, '')) AS full_name,
                    users.username
             FROM students
             JOIN users ON users.id = students.user_id
             ORDER BY students.student_id`
        );
        res.status(200).json(students);
    } catch (error) {
        console.error('Error fetching students:', error);
        res.status(500).json({ message: 'Server error while fetching students.' });
    }
};

// @desc    Get a single student by ID
// @route   GET /api/students/:id
exports.getStudentById = async (req, res) => {
    try {
        const studentId = req.params.id;
        const [student] = await pool.execute(
            `SELECT students.*,
                    CONCAT_WS(' ', NULLIF(students.fname, ''), NULLIF(students.mname, ''), NULLIF(students.lname, '')) AS full_name,
                    users.username
             FROM students
             JOIN users ON users.id = students.user_id
             WHERE students.student_id = ?`,
            [studentId]
        );
        
        if (student.length === 0) {
            return res.status(404).json({ message: 'Student not found.' });
        }
        
        res.status(200).json(student[0]);
    } catch (error) {
        console.error('Error fetching student:', error);
        res.status(500).json({ message: 'Server error while fetching student.' });
    }
};

// @desc    Register a student and linked user account
// @route   POST /api/students
exports.createStudent = async (req, res) => {
    const studentId = text(req.body?.studentId, 20);
    const fname = text(req.body?.fname, 100);
    const mname = text(req.body?.mname, 100);
    const lname = text(req.body?.lname, 100);
    const gradeLevel = text(req.body?.gradeLevel, 20) || 'Pending';
    const section = text(req.body?.section, 50) || 'Pending Enrollment';
    const academicStatus = text(req.body?.academicStatus, 20) || 'Regular';
    const contact = text(req.body?.contactNumber, 20) || 'N/A';
    const guardian = text(req.body?.guardianName, 100) || 'N/A';
    const password = studentId;

    if (!/^\d{4}-\d{3}$/.test(studentId) || !fname || !lname || password.length < 8 ||
        !['Regular', 'Irregular', 'Transferee'].includes(academicStatus)) {
        return res.status(400).json({ message: 'Student details or password are invalid.' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        const [existingStudent] = await connection.execute(
            'SELECT student_id FROM students WHERE student_id = ? FOR UPDATE',
            [studentId]
        );
        if (existingStudent.length) {
            await connection.rollback();
            return res.status(409).json({ message: 'Student ID already exists.' });
        }

        const [existingUser] = await connection.execute(
            'SELECT id, role FROM users WHERE username = ? FOR UPDATE',
            [studentId]
        );
        if (existingUser.length && existingUser[0].role !== 'student') {
            await connection.rollback();
            return res.status(409).json({ message: 'Student ID is already used by another account.' });
        }

        let userId;
        const passwordHash = await bcrypt.hash(password, 10);
        if (existingUser.length) {
            userId = existingUser[0].id;
            await connection.execute(
                'UPDATE users SET username = ?, password_hash = ? WHERE id = ?',
                [studentId, passwordHash, userId]
            );
        } else {
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
            [studentId, userId, fname, mname, lname, gradeLevel, section, academicStatus, contact, guardian]
        );
        await connection.commit();
        return res.status(201).json({ message: 'Student account created.', studentId });
    } catch (error) {
        if (connection) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error('Error rolling back student registration:', rollbackError);
            }
        }
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Student ID, user account, or full name already exists.' });
        }
        console.error('Error registering student:', error);
        return res.status(500).json({ message: 'Could not register student.' });
    } finally {
        if (connection) connection.release();
    }
};

// @desc    Update a student profile without changing login credentials
// @route   PUT /api/students/:id
exports.updateStudent = async (req, res) => {
    const fname = text(req.body?.fname, 100);
    const mname = text(req.body?.mname, 100);
    const lname = text(req.body?.lname, 100);
    const gradeLevel = text(req.body?.gradeLevel, 20);
    const section = text(req.body?.section, 50);
    const academicStatus = text(req.body?.academicStatus, 20);
    const contact = text(req.body?.contactNumber, 20);
    const guardian = text(req.body?.guardianName, 100);

    if (!fname || !lname || !gradeLevel || !section ||
        !['Regular', 'Irregular', 'Transferee'].includes(academicStatus)) {
        return res.status(400).json({ message: 'Student profile details are invalid.' });
    }

    try {
        const [existing] = await pool.execute(
            'SELECT student_id FROM students WHERE student_id = ?',
            [req.params.id]
        );
        if (!existing.length) return res.status(404).json({ message: 'Student not found.' });
        await pool.execute(
            `UPDATE students
             SET fname = ?, mname = ?, lname = ?, grade_level = ?, section = ?, academic_status = ?,
                 contact_number = ?, guardian_name = ?
             WHERE student_id = ?`,
            [fname, mname, lname, gradeLevel, section, academicStatus, contact || 'N/A', guardian || 'N/A', req.params.id]
        );
        return res.status(200).json({ message: 'Student profile updated.' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'A student with that full name already exists.' });
        }
        console.error('Error updating student:', error);
        return res.status(500).json({ message: 'Could not update student.' });
    }
};

// @desc    Delete a student, related records, and its unshared user account
// @route   DELETE /api/students/:id
exports.deleteStudent = async (req, res) => {
    let connection;

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [students] = await connection.execute(
            'SELECT user_id FROM students WHERE student_id = ? FOR UPDATE',
            [req.params.id]
        );

        if (students.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Student not found in the database.' });
        }

        await connection.execute(
            'DELETE FROM students WHERE student_id = ?',
            [req.params.id]
        );
        await connection.execute(
            `DELETE FROM users
             WHERE id = ?
               AND NOT EXISTS (SELECT 1 FROM students WHERE user_id = ?)`,
            [students[0].user_id, students[0].user_id]
        );

        await connection.commit();
        return res.status(200).json({ message: 'Student and related records deleted.' });
    } catch (error) {
        if (connection) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error('Error rolling back student deletion:', rollbackError);
            }
        }
        console.error('Error deleting student:', error);
        return res.status(500).json({ message: 'Could not delete student from the database.' });
    } finally {
        if (connection) connection.release();
    }
};