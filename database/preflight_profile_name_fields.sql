USE e_scuela_db;

-- Review these results before running migrate_profile_name_fields.sql.
-- Resolve duplicate or blank names before adding the combined UNIQUE keys.

SELECT full_name, COUNT(*) AS profile_count
FROM students
GROUP BY full_name
HAVING COUNT(*) > 1 OR TRIM(full_name) = '';

SELECT full_name, COUNT(*) AS profile_count
FROM faculty
GROUP BY full_name
HAVING COUNT(*) > 1 OR TRIM(full_name) = '';
