const pool = require('../config/db');

function gradeValue(value) {
    if (value === null || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 && number <= 100 ? number : undefined;
}

exports.getGrades = async (req, res) => {
    const studentId = typeof req.query.studentId === 'string' ? req.query.studentId.trim() : '';
    try {
        const [rows] = await pool.execute(
            `SELECT grades.id, grades.enrollment_id, enrollments.student_id,
                    subjects.id AS subject_id, subjects.subject_name,
                    years.year_label AS school_year, offering.grade_level,
                    offering.strand, offering.section,
                    grades.q1, grades.q2, grades.q3, grades.q4
             FROM grades
             JOIN enrollments ON enrollments.id = grades.enrollment_id
             JOIN subject_offerings offering ON offering.id = enrollments.subject_offering_id
             JOIN school_years years ON years.id = offering.school_year_id
             JOIN subjects ON subjects.id = offering.subject_id
             WHERE (? = '' OR enrollments.student_id = ?)
             ORDER BY enrollments.student_id, subjects.subject_name`,
            [studentId, studentId]
        );
        return res.status(200).json(rows);
    } catch (error) {
        console.error('Error fetching grades:', error);
        return res.status(500).json({ message: 'Could not fetch grades.' });
    }
};

exports.saveGrade = async (req, res) => {
    const enrollmentId = Number(req.params.enrollmentId);
    const values = ['q1', 'q2', 'q3', 'q4'].map(key => gradeValue(req.body?.[key]));
    if (!Number.isSafeInteger(enrollmentId) || enrollmentId <= 0 ||
        values.some(value => value === undefined)) {
        return res.status(400).json({ message: 'Enrollment ID or grade values are invalid.' });
    }

    try {
        const [enrollments] = await pool.execute(
            'SELECT id FROM enrollments WHERE id = ?',
            [enrollmentId]
        );
        if (!enrollments.length) return res.status(404).json({ message: 'Enrollment not found.' });
        await pool.execute(
            `INSERT INTO grades (enrollment_id, q1, q2, q3, q4)
             SELECT id, ?, ?, ?, ? FROM enrollments WHERE id = ?
             ON DUPLICATE KEY UPDATE
                q1 = VALUES(q1), q2 = VALUES(q2), q3 = VALUES(q3), q4 = VALUES(q4)`,
            [...values, enrollmentId]
        );
        return res.status(200).json({ message: 'Grade saved.' });
    } catch (error) {
        console.error('Error saving grade:', error);
        return res.status(500).json({ message: 'Could not save grade.' });
    }
};

exports.saveGrades = async (req, res) => {
    const grades = req.body?.grades;
    if (!Array.isArray(grades) || grades.length === 0) {
        return res.status(400).json({ message: 'At least one grade record is required.' });
    }

    const normalized = grades.map(grade => ({
        enrollmentId: Number(grade?.enrollmentId),
        values: ['q1', 'q2', 'q3', 'q4'].map(key => gradeValue(grade?.[key]))
    }));
    const enrollmentIds = normalized.map(grade => grade.enrollmentId);
    if (normalized.some(grade =>
        !Number.isSafeInteger(grade.enrollmentId) ||
        grade.enrollmentId <= 0 ||
        grade.values.some(value => value === undefined)
    ) || new Set(enrollmentIds).size !== enrollmentIds.length) {
        return res.status(400).json({ message: 'Grade records contain invalid or duplicate enrollment IDs.' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        const placeholders = enrollmentIds.map(() => '?').join(', ');
        const [enrollments] = await connection.execute(
            `SELECT id FROM enrollments WHERE id IN (${placeholders}) FOR UPDATE`,
            enrollmentIds
        );
        if (enrollments.length !== enrollmentIds.length) {
            await connection.rollback();
            return res.status(404).json({ message: 'One or more enrollments do not exist.' });
        }

        for (const grade of normalized) {
            await connection.execute(
                `INSERT INTO grades (enrollment_id, q1, q2, q3, q4)
                 VALUES (?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                    q1 = VALUES(q1), q2 = VALUES(q2), q3 = VALUES(q3), q4 = VALUES(q4)`,
                [grade.enrollmentId, ...grade.values]
            );
        }
        await connection.commit();
        return res.status(200).json({ message: 'Grades saved.' });
    } catch (error) {
        if (connection) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error('Error rolling back grade update:', rollbackError);
            }
        }
        console.error('Error saving grades:', error);
        return res.status(500).json({ message: 'Could not save grades.' });
    } finally {
        if (connection) connection.release();
    }
};

exports.deleteGrade = async (req, res) => {
    const enrollmentId = Number(req.params.enrollmentId);
    if (!Number.isSafeInteger(enrollmentId) || enrollmentId <= 0) {
        return res.status(400).json({ message: 'Enrollment ID is invalid.' });
    }
    try {
        const [result] = await pool.execute('DELETE FROM grades WHERE enrollment_id = ?', [enrollmentId]);
        if (!result.affectedRows) return res.status(404).json({ message: 'Grade not found.' });
        return res.status(200).json({ message: 'Grade deleted.' });
    } catch (error) {
        console.error('Error deleting grade:', error);
        return res.status(500).json({ message: 'Could not delete grade.' });
    }
};
