const express = require('express');
const {
    getFaculty,
    createFaculty,
    updateFaculty,
    deleteFaculty
} = require('../controllers/facultyController');

const router = express.Router();

router.get('/', getFaculty);
router.post('/', createFaculty);
router.put('/:id', updateFaculty);
router.delete('/:id', deleteFaculty);

module.exports = router;
