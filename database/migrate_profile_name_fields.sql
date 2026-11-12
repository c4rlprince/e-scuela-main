USE e_scuela_db;

-- Back up e_scuela_db and run preflight_profile_name_fields.sql first.
-- Run once. Existing full_name values are split into first, middle, and last
-- tokens; all original name text is retained across the three new columns.

ALTER TABLE students
    ADD COLUMN fname VARCHAR(100) NOT NULL DEFAULT '',
    ADD COLUMN mname VARCHAR(100) NOT NULL DEFAULT '',
    ADD COLUMN lname VARCHAR(100) NOT NULL DEFAULT '';

UPDATE students
SET fname = SUBSTRING_INDEX(TRIM(full_name), ' ', 1),
    mname = CASE
        WHEN LOCATE(' ', TRIM(full_name)) = 0 THEN ''
        ELSE TRIM(SUBSTRING(
            TRIM(full_name),
            CHAR_LENGTH(SUBSTRING_INDEX(TRIM(full_name), ' ', 1)) + 1,
            CHAR_LENGTH(TRIM(full_name))
                - CHAR_LENGTH(SUBSTRING_INDEX(TRIM(full_name), ' ', 1))
                - CHAR_LENGTH(SUBSTRING_INDEX(TRIM(full_name), ' ', -1))
        ))
    END,
    lname = CASE
        WHEN LOCATE(' ', TRIM(full_name)) = 0 THEN ''
        ELSE SUBSTRING_INDEX(TRIM(full_name), ' ', -1)
    END;

ALTER TABLE students
    ADD CONSTRAINT uq_students_full_name UNIQUE (fname, mname, lname),
    DROP COLUMN full_name;

ALTER TABLE faculty
    ADD COLUMN fname VARCHAR(100) NOT NULL DEFAULT '',
    ADD COLUMN mname VARCHAR(100) NOT NULL DEFAULT '',
    ADD COLUMN lname VARCHAR(100) NOT NULL DEFAULT '';

UPDATE faculty
SET fname = SUBSTRING_INDEX(TRIM(full_name), ' ', 1),
    mname = CASE
        WHEN LOCATE(' ', TRIM(full_name)) = 0 THEN ''
        ELSE TRIM(SUBSTRING(
            TRIM(full_name),
            CHAR_LENGTH(SUBSTRING_INDEX(TRIM(full_name), ' ', 1)) + 1,
            CHAR_LENGTH(TRIM(full_name))
                - CHAR_LENGTH(SUBSTRING_INDEX(TRIM(full_name), ' ', 1))
                - CHAR_LENGTH(SUBSTRING_INDEX(TRIM(full_name), ' ', -1))
        ))
    END,
    lname = CASE
        WHEN LOCATE(' ', TRIM(full_name)) = 0 THEN ''
        ELSE SUBSTRING_INDEX(TRIM(full_name), ' ', -1)
    END;

ALTER TABLE faculty
    ADD CONSTRAINT uq_faculty_full_name UNIQUE (fname, mname, lname),
    DROP COLUMN full_name;
