require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const enrollmentRoutes = require('./routes/enrollmentRoutes');
const studentRoutes = require('./routes/studentRoutes');
const facultyRoutes = require('./routes/facultyRoutes');
const academicRoutes = require('./routes/academicRoutes');
const gradeRoutes = require('./routes/gradeRoutes');
const pool = require('./config/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Security and Utility Middleware
app.use(helmet());
app.use(cors());
app.use(express.json()); // Parses incoming JSON payloads

app.use('/api/enrollments', enrollmentRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/faculty', facultyRoutes);
app.use('/api', academicRoutes);
app.use('/api/grades', gradeRoutes);

// Root test route
app.get('/api/health', (req, res) => {
    pool.getConnection()
        .then(async connection => {
            try {
                const [[databaseRow]] = await connection.query('SELECT DATABASE() AS database_name');
                const [tableRows] = await connection.execute(
                    `SELECT COUNT(*) AS table_count
                     FROM information_schema.TABLES
                     WHERE TABLE_SCHEMA = DATABASE()
                       AND TABLE_NAME IN (
                           'users', 'students', 'faculty', 'school_years',
                           'subjects', 'subject_offerings', 'enrollments', 'grades'
                       )`
                );
                const [foreignKeyRows] = await connection.execute(
                    `SELECT COUNT(*) AS foreign_key_count
                     FROM information_schema.KEY_COLUMN_USAGE
                     WHERE TABLE_SCHEMA = DATABASE()
                       AND REFERENCED_TABLE_NAME IS NOT NULL
                       AND (TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME) IN (
                           ('students', 'user_id', 'users', 'id'),
                           ('faculty', 'user_id', 'users', 'id'),
                           ('subject_offerings', 'school_year_id', 'school_years', 'id'),
                           ('subject_offerings', 'subject_id', 'subjects', 'id'),
                           ('subject_offerings', 'faculty_id', 'faculty', 'id'),
                           ('enrollments', 'student_id', 'students', 'student_id'),
                           ('enrollments', 'subject_offering_id', 'subject_offerings', 'id'),
                           ('grades', 'enrollment_id', 'enrollments', 'id')
                       )`
                );
                const [uniqueRows] = await connection.execute(
                    `SELECT COUNT(*) AS unique_count
                     FROM (
                         SELECT TABLE_NAME, INDEX_NAME,
                                GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS indexed_columns
                         FROM information_schema.STATISTICS
                         WHERE TABLE_SCHEMA = DATABASE() AND NON_UNIQUE = 0
                         GROUP BY TABLE_NAME, INDEX_NAME
                     ) AS indexes_found
                     WHERE (TABLE_NAME = 'students' AND indexed_columns = 'user_id')
                        OR (TABLE_NAME = 'faculty' AND indexed_columns = 'user_id')
                        OR (TABLE_NAME = 'students' AND indexed_columns = 'fname,mname,lname')
                        OR (TABLE_NAME = 'faculty' AND indexed_columns = 'fname,mname,lname')
                        OR (TABLE_NAME = 'subject_offerings'
                            AND indexed_columns = 'school_year_id,subject_id,grade_level,strand,section')
                        OR (TABLE_NAME = 'enrollments'
                            AND indexed_columns = 'student_id,subject_offering_id')
                        OR (TABLE_NAME = 'grades' AND indexed_columns = 'enrollment_id')`
                );
                const schemaReady = tableRows[0].table_count === 8 &&
                    foreignKeyRows[0].foreign_key_count === 8 &&
                    uniqueRows[0].unique_count === 7;
                if (!schemaReady) {
                    return res.status(503).json({
                        status: 'error',
                        message: 'MySQL is connected, but required E-SCUELA tables or relationships are missing.',
                        database: databaseRow.database_name
                    });
                }
                res.status(200).json({
                    status: 'success',
                    message: 'E-SCUELA backend, MySQL, and relational schema are connected.',
                    database: databaseRow.database_name
                });
            } finally {
                connection.release();
            }
        })
        .catch(error => {
            console.error('Database health check failed:', error);
            res.status(503).json({ status: 'error', message: 'MySQL is unavailable.' });
        });
});

// Centralized 404 Error Handling for unknown routes
app.use((req, res) => {
    res.status(404).json({ message: 'API Endpoint not found.' });
});

app.listen(PORT, () => {
    console.log(`🚀 Server initialized on port ${PORT}`);
});