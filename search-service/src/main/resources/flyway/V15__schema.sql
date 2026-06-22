-- This was previously part of V10__schema.sql. It was disabled to defer to the manual data migration from logger-service.
-- This migration will add any of these that remain missing, at the time of update.

INSERT INTO log_event_type (id, name)
VALUES (1000, 'OCCURRENCE_RECORDS_VIEWED'),
       (1001, 'OCCURRENCE_RECORDS_VIEWED_ON_MAP'),
       (1002, 'OCCURRENCE_RECORDS_DOWNLOADED'),
       (2000, 'IMAGE_VIEWED')
ON CONFLICT DO NOTHING;

INSERT INTO log_reason_type (id, rkey, name, default_order, is_deprecated)
VALUES (0, 'logger.download.reason.conservation', 'conservation management/planning', 400, 0),
       (1, 'logger.download.reason.biosecurity', 'biosecurity management/planning', 100, 0),
       (2, 'logger.download.reason.environmental', 'environmental assessment', 700, 0),
       (3, 'logger.download.reason.education', 'education', 600, 0),
       (4, 'logger.download.reason.research', 'scientific research', 1000, 0),
       (5, 'logger.download.reason.collection.mgmt', 'collection management', 300, 0),
       (6, 'logger.download.reason.other', 'other', 8000, 0),
       (7, 'logger.download.reason.ecological.research', 'ecological research', 500, 0),
       (8, 'logger.download.reason.systematic.research', 'systematic research/taxonomy', 1200, 0),
       (9, 'logger.download.reason.other.scientific.research', 'other scientific research', 9900, 1),
       (10, 'logger.download.reason.testing', 'testing', 9000, 0),
       (11, 'logger.download.reason.citizen.science', 'citizen science', 200, 0),
       (12, 'logger.download.reason.restoration.remediation', 'restoration/remediation', 900, 0),
       (13, 'logger.download.reason.species.modelling', 'species modelling', 1300, 0)
ON CONFLICT DO NOTHING;

INSERT INTO log_source_type (id, name)
VALUES (0, 'ALA'),
       (1, 'OZCAM'),
       (2, 'AVH'),
       (3, 'OBIS'),
       (4, 'ASBP'),
       (5, 'AMRIN'),
       (6, 'BVP'),
       (7, 'TEPAPA'),
       (2001, 'ALA4R'),
       (2002, 'BCCVL'),
       (2004, 'galah-R'),
       (2005, 'galah-python'),
       (2006, 'qgis-galah-python'),
       (10000, 'Spatial Portal'),
       (10001, 'List Tool'),
       (10002, 'CSDM')
ON CONFLICT DO NOTHING;
