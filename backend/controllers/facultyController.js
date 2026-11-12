const bcrypt = require('bcryptjs');
const pool = require('../config/db');

function text(value, maxLength) {
    return typeof value === 'string' && value.trim().length <= maxLength
        ? value.trim()
        : '';
}

exports.getFaculty = async (req, res) => {
    try {
        const [faculty] = await pool.query(
            `SELECT faculty.id, faculty.staff_id, faculty.user_id,
                    faculty.fname, faculty.mname, faculty.lname,
                    CONCAT_WS(' ', NULLIF(faculty.fname, ''), NULLIF(faculty.mname, ''), NULLIF(faculty.lname, '')) AS full_name,
                    users.username
             FROM faculty
             JOIN users ON users.id = faculty.user_id
             ORDER BY faculty.staff_id`
        );
        return res.status(200).json(faculty);
    } catch (error) {
        console.error('Error fetching faculty:', error);
        return res.status(500).json({ message: 'Could not fetch faculty accounts.' });
    }
};

exports.createFaculty = async (req, res) => {
    const staffId = text(req.body?.staffId, 20);
    const username = text(req.body?.username, 50);
    const fname = text(req.body?.fname, 100);
    const mname = text(req.body?.mname, 100);
    const lname = text(req.body?.lname, 100);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!staffId || !username || !fname || !lname || password.length < 8) {
        return res.status(400).json({ message: 'Staff ID, username, first and last names, and an 8-character password are required.' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        const passwordHash = await bcrypt.hash(password, 10);
        const [userResult] = await connection.execute(
            'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
            [username, passwordHash, 'faculty']
        );
        await connection.execute(
            'INSERT INTO faculty (staff_id, user_id, fname, mname, lname) VALUES (?, ?, ?, ?, ?)',
            [staffId, userResult.insertId, fname, mname, lname]
        );
        await connection.commit();
        return res.status(201).json({
            message: 'Faculty account created.',
            facultyId: userResult.insertId
        });
    } catch (error) {
        if (connection) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error('Error rolling back faculty registration:', rollbackError);
            }
        }
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Staff ID, username, or full name already exists.' });
        }
        console.error('Error creating faculty account:', error);
        return res.status(500).json({ message: 'Could not create faculty account.' });
    } finally {
        if (connection) connection.release();
    }
};

exports.updateFaculty = async (req, res) => {
    const staffId = text(req.body?.staffId, 20);
    const fname = text(req.body?.fname, 100);
    const mname = text(req.body?.mname, 100);
    const lname = text(req.body?.lname, 100);
    const username = req.body?.username === undefined ? null : text(req.body.username, 50);
    const password = req.body?.password;

    if (!staffId || !fname || !lname || (username !== null && !username) ||
        (password !== undefined && (typeof password !== 'string' || password.length < 8))) {
        return res.status(400).json({ message: 'Faculty details or password are invalid.' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        const [facultyRows] = await connection.execute(
            'SELECT user_id FROM faculty WHERE id = ? FOR UPDATE',
            [req.params.id]
        );
        if (facultyRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Faculty member not found.' });
        }

        const userId = facultyRows[0].user_id;
        await connection.execute(
            'UPDATE faculty SET staff_id = ?, fname = ?, mname = ?, lname = ? WHERE id = ?',
            [staffId, fname, mname, lname, req.params.id]
        );
        if (username !== null) {
            await connection.execute('UPDATE users SET username = ? WHERE id = ?', [username, userId]);
        }
        if (password !== undefined) {
            const passwordHash = await bcrypt.hash(password, 10);
            await connection.execute('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId]);
        }
        await connection.commit();
        return res.status(200).json({ message: 'Faculty account updated.' });
    } catch (error) {
        if (connection) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error('Error rolling back faculty update:', rollbackError);
            }
        }
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Staff ID, username, or full name already exists.' });
        }
        console.error('Error updating faculty account:', error);
        return res.status(500).json({ message: 'Could not update faculty account.' });
    } finally {
        if (connection) connection.release();
    }
};

exports.deleteFaculty = async (req, res) => {
    const facultyId = Number(req.params.id);
    if (!Number.isSafeInteger(facultyId) || facultyId <= 0) {
        return res.status(400).json({ message: 'Faculty ID is invalid.' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        const [facultyRows] = await connection.execute(
            'SELECT user_id FROM faculty WHERE id = ? FOR UPDATE',
            [facultyId]
        );
        if (facultyRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Faculty member not found.' });
        }
        await connection.execute('DELETE FROM users WHERE id = ?', [facultyRows[0].user_id]);
        await connection.commit();
        return res.status(200).json({ message: 'Faculty account deleted; subject offerings were retained unassigned.' });
    } catch (error) {
        if (connection) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error('Error rolling back faculty deletion:', rollbackError);
            }
        }
        console.error('Error deleting faculty account:', error);
        return res.status(500).json({ message: 'Could not delete faculty account.' });
    } finally {
        if (connection) connection.release();
    }
};
