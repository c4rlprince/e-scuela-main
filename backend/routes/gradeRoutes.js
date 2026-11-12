const express = require('express');
const {
    getGrades,
    saveGrade,
    saveGrades,
    deleteGrade
} = require('../controllers/gradeController');

const router = express.Router();

router.get('/', getGrades);
router.put('/', saveGrades);
router.put('/:enrollmentId', saveGrade);
router.delete('/:enrollmentId', deleteGrade);

module.exports = router;
