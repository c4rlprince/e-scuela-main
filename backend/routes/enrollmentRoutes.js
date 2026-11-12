const express = require('express');
const {
    getEnrollments,
    saveEnrollment,
    deleteEnrollment
} = require('../controllers/enrollmentController');

const router = express.Router();

router.get('/', getEnrollments);
router.post('/', saveEnrollment);
router.delete('/:id', deleteEnrollment);

module.exports = router;
