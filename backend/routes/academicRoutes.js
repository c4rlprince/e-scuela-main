const express = require('express');
const academic = require('../controllers/academicController');

const router = express.Router();

router.get('/school-years', academic.getSchoolYears);
router.post('/school-years', academic.createSchoolYear);
router.put('/school-years/:id', academic.updateSchoolYear);
router.delete('/school-years/:id', academic.deleteSchoolYear);

router.get('/subjects', academic.getSubjects);
router.post('/subjects', academic.createSubject);
router.put('/subjects/:id', academic.updateSubject);
router.delete('/subjects/:id', academic.deleteSubject);

router.get('/subject-offerings', academic.getSubjectOfferings);
router.post('/subject-offerings', academic.createSubjectOffering);
router.put('/subject-offerings/:id', academic.updateSubjectOffering);
router.delete('/subject-offerings/:id', academic.deleteSubjectOffering);

module.exports = router;
