const pool = require('../config/db');

function text(value, maxLength) {
    return typeof value === 'string' && value.trim().length <= maxLength
        ? value.trim()
        : '';
}

function id(value) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function handleWriteError(error, res, label) {
    if (error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ message: `${label} already exists or is in use.` });
    }
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
        return res.status(400).json({ message: 'A referenced record does not exist.' });
    }
    console.error(`Error ${label.toLowerCase()}:`, error);
    return res.status(500).json({ message: `Could not ${label.toLowerCase()}.` });
}

exports.getSchoolYears = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM school_years ORDER BY year_label DESC');
        return res.status(200).json(rows);
    } catch (error) {
        console.error('Error fetching school years:', error);
        return res.status(500).json({ message: 'Could not fetch school years.' });
    }
};

exports.createSchoolYear = async (req, res) => {
    const label = text(req.body?.yearLabel, 20);
    if (!/^\d{4}-\d{4}$/.test(label)) {
        return res.status(400).json({ message: 'School year must use YYYY-YYYY format.' });
    }
    try {
        const [result] = await pool.execute(
            'INSERT INTO school_years (year_label, start_date, end_date, is_current) VALUES (?, ?, ?, ?)',
            [label, req.body?.startDate || null, req.body?.endDate || null, Boolean(req.body?.isCurrent)]
        );
        return res.status(201).json({ id: result.insertId, yearLabel: label });
    } catch (error) {
        return handleWriteError(error, res, 'Create school year');
    }
};

exports.updateSchoolYear = async (req, res) => {
    const yearId = id(req.params.id);
    const label = text(req.body?.yearLabel, 20);
    if (!yearId || !/^\d{4}-\d{4}$/.test(label)) {
        return res.status(400).json({ message: 'School year ID or label is invalid.' });
    }
    try {
        const [existing] = await pool.execute('SELECT id FROM school_years WHERE id = ?', [yearId]);
        if (!existing.length) return res.status(404).json({ message: 'School year not found.' });
        await pool.execute(
            `UPDATE school_years
             SET year_label = ?, start_date = ?, end_date = ?, is_current = ?
             WHERE id = ?`,
            [label, req.body?.startDate || null, req.body?.endDate || null, Boolean(req.body?.isCurrent), yearId]
        );
        return res.status(200).json({ message: 'School year updated.' });
    } catch (error) {
        return handleWriteError(error, res, 'Update school year');
    }
};

exports.deleteSchoolYear = async (req, res) => {
    const yearId = id(req.params.id);
    if (!yearId) return res.status(400).json({ message: 'School year ID is invalid.' });
    try {
        const [result] = await pool.execute(
            'DELETE FROM school_years WHERE id = ? AND NOT EXISTS (SELECT 1 FROM subject_offerings WHERE school_year_id = ?)',
            [yearId, yearId]
        );
        if (!result.affectedRows) {
            const [rows] = await pool.execute('SELECT id FROM school_years WHERE id = ?', [yearId]);
            if (!rows.length) return res.status(404).json({ message: 'School year not found.' });
            return res.status(409).json({ message: 'Cannot delete a school year with subject offerings.' });
        }
        return res.status(200).json({ message: 'School year deleted.' });
    } catch (error) {
        return handleWriteError(error, res, 'Delete school year');
    }
};

exports.getSubjects = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM subjects ORDER BY subject_name');
        return res.status(200).json(rows);
    } catch (error) {
        console.error('Error fetching subjects:', error);
        return res.status(500).json({ message: 'Could not fetch subjects.' });
    }
};

exports.createSubject = async (req, res) => {
    const name = text(req.body?.subjectName, 50);
    if (!name) return res.status(400).json({ message: 'Subject name is required.' });
    try {
        const [result] = await pool.execute('INSERT INTO subjects (subject_name) VALUES (?)', [name]);
        return res.status(201).json({ id: result.insertId, subjectName: name });
    } catch (error) {
        return handleWriteError(error, res, 'Create subject');
    }
};

exports.updateSubject = async (req, res) => {
    const subjectId = id(req.params.id);
    const name = text(req.body?.subjectName, 50);
    if (!subjectId || !name) return res.status(400).json({ message: 'Subject ID or name is invalid.' });
    try {
        const [existing] = await pool.execute('SELECT id FROM subjects WHERE id = ?', [subjectId]);
        if (!existing.length) return res.status(404).json({ message: 'Subject not found.' });
        await pool.execute(
            'UPDATE subjects SET subject_name = ? WHERE id = ?',
            [name, subjectId]
        );
        return res.status(200).json({ message: 'Subject updated.' });
    } catch (error) {
        return handleWriteError(error, res, 'Update subject');
    }
};

exports.deleteSubject = async (req, res) => {
    const subjectId = id(req.params.id);
    if (!subjectId) return res.status(400).json({ message: 'Subject ID is invalid.' });
    try {
        const [result] = await pool.execute(
            `DELETE FROM subjects
             WHERE id = ?
               AND NOT EXISTS (SELECT 1 FROM subject_offerings WHERE subject_id = ?)`,
            [subjectId, subjectId]
        );
        if (!result.affectedRows) {
            const [rows] = await pool.execute('SELECT id FROM subjects WHERE id = ?', [subjectId]);
            if (!rows.length) return res.status(404).json({ message: 'Subject not found.' });
            return res.status(409).json({ message: 'Cannot delete a subject used by an offering.' });
        }
        return res.status(200).json({ message: 'Subject deleted.' });
    } catch (error) {
        return handleWriteError(error, res, 'Delete subject');
    }
};

exports.getSubjectOfferings = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT offering.id, offering.school_year_id, years.year_label,
                    offering.subject_id, subjects.subject_name, offering.faculty_id,
                    faculty.staff_id,
                    CONCAT_WS(' ', NULLIF(faculty.fname, ''), NULLIF(faculty.mname, ''), NULLIF(faculty.lname, '')) AS faculty_name,
                    offering.grade_level, offering.strand, offering.section
             FROM subject_offerings offering
             JOIN school_years years ON years.id = offering.school_year_id
             JOIN subjects ON subjects.id = offering.subject_id
             LEFT JOIN faculty ON faculty.id = offering.faculty_id
             ORDER BY years.year_label DESC, offering.grade_level, offering.section, subjects.subject_name`
        );
        return res.status(200).json(rows);
    } catch (error) {
        console.error('Error fetching subject offerings:', error);
        return res.status(500).json({ message: 'Could not fetch subject offerings.' });
    }
};

async function saveOffering(req, res, isUpdate) {
    const offeringId = isUpdate ? id(req.params.id) : null;
    const schoolYearId = id(req.body?.schoolYearId);
    const subjectId = id(req.body?.subjectId);
    const facultyId = req.body?.facultyId === null || req.body?.facultyId === '' ||
        req.body?.facultyId === undefined ? null : id(req.body.facultyId);
    const gradeLevel = text(req.body?.gradeLevel, 20);
    const strand = text(req.body?.strand, 20) || 'N/A';
    const section = text(req.body?.section, 50);

    if ((isUpdate && !offeringId) || !schoolYearId || !subjectId ||
        (req.body?.facultyId != null && req.body.facultyId !== '' && !facultyId) ||
        !gradeLevel || !section) {
        return res.status(400).json({ message: 'Subject offering details are invalid.' });
    }
    try {
        if (isUpdate) {
            const [existing] = await pool.execute(
                'SELECT id FROM subject_offerings WHERE id = ?',
                [offeringId]
            );
            if (!existing.length) return res.status(404).json({ message: 'Subject offering not found.' });
        }
        const statement = isUpdate
            ? `UPDATE subject_offerings
               SET school_year_id = ?, subject_id = ?, faculty_id = ?,
                   grade_level = ?, strand = ?, section = ?
               WHERE id = ?`
            : `INSERT INTO subject_offerings
                   (school_year_id, subject_id, faculty_id, grade_level, strand, section)
               VALUES (?, ?, ?, ?, ?, ?)`;
        const params = [schoolYearId, subjectId, facultyId, gradeLevel, strand, section];
        if (isUpdate) params.push(offeringId);
        const [result] = await pool.execute(statement, params);
        return res.status(isUpdate ? 200 : 201).json({
            message: isUpdate ? 'Subject offering updated.' : 'Subject offering created.',
            id: isUpdate ? offeringId : result.insertId
        });
    } catch (error) {
        return handleWriteError(error, res, isUpdate ? 'Update subject offering' : 'Create subject offering');
    }
}

exports.createSubjectOffering = (req, res) => saveOffering(req, res, false);
exports.updateSubjectOffering = (req, res) => saveOffering(req, res, true);

exports.deleteSubjectOffering = async (req, res) => {
    const offeringId = id(req.params.id);
    if (!offeringId) return res.status(400).json({ message: 'Subject offering ID is invalid.' });
    try {
        const [result] = await pool.execute(
            `DELETE FROM subject_offerings
             WHERE id = ?
               AND NOT EXISTS (SELECT 1 FROM enrollments WHERE subject_offering_id = ?)`,
            [offeringId, offeringId]
        );
        if (!result.affectedRows) {
            const [rows] = await pool.execute('SELECT id FROM subject_offerings WHERE id = ?', [offeringId]);
            if (!rows.length) return res.status(404).json({ message: 'Subject offering not found.' });
            return res.status(409).json({ message: 'Cannot delete an offering with student enrollments.' });
        }
        return res.status(200).json({ message: 'Subject offering deleted.' });
    } catch (error) {
        return handleWriteError(error, res, 'Delete subject offering');
    }
};
