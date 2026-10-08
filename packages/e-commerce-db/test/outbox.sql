\set ON_ERROR_STOP on
BEGIN;
INSERT INTO categories(id, name, slug) VALUES ('00000000-0000-0000-0000-000000000001', 'Outbox category', 'outbox-category');
INSERT INTO brands(id, name, slug) VALUES ('00000000-0000-0000-0000-000000000002', 'Outbox brand', 'outbox-brand');
INSERT INTO products(id, name, category_id, brand_id, is_published) VALUES ('00000000-0000-0000-0000-000000000003', 'Outbox product', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', true);
INSERT INTO product_variants(id, product_id, price) VALUES ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000003', 42.50);
INSERT INTO product_images(id, product_id, url) VALUES ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000003', '/outbox.png');
UPDATE categories SET name = 'New category' WHERE id = '00000000-0000-0000-0000-000000000001';
UPDATE brands SET name = 'New brand' WHERE id = '00000000-0000-0000-0000-000000000002';
DO $$
DECLARE event outbox_events; count_before integer;
BEGIN
  SELECT * INTO event FROM outbox_events WHERE aggregate_id = '00000000-0000-0000-0000-000000000003' ORDER BY event_version DESC LIMIT 1;
  IF event.event_version <> 1000000000004 OR event.payload->'product_variants'->0->>'price' <> '42.50'
     OR event.payload->'categories'->>'name' <> 'New category'
     OR event.payload->'brands'->>'name' <> 'New brand'
     OR jsonb_array_length(event.payload->'product_images') <> 1 THEN
    RAISE EXCEPTION 'Related writes did not create complete, versioned snapshots: %', event;
  END IF;
  SELECT count(*) INTO count_before FROM outbox_events;
  BEGIN
    UPDATE products SET name = 'Rollback me' WHERE id = '00000000-0000-0000-0000-000000000003';
    RAISE EXCEPTION 'force rollback';
  EXCEPTION WHEN raise_exception THEN NULL;
  END;
  IF (SELECT count(*) FROM outbox_events) <> count_before OR
    (SELECT name FROM products WHERE id = '00000000-0000-0000-0000-000000000003') <> 'Outbox product' THEN
    RAISE EXCEPTION 'Business write and event did not roll back together';
  END IF;
END;
$$;
UPDATE products SET is_published = false WHERE id = '00000000-0000-0000-0000-000000000003';
DELETE FROM product_variants WHERE id = '00000000-0000-0000-0000-000000000004';
DELETE FROM product_images WHERE id = '00000000-0000-0000-0000-000000000005';
DELETE FROM products WHERE id = '00000000-0000-0000-0000-000000000003';
DO $$
DECLARE event outbox_events;
BEGIN
  SELECT * INTO event FROM outbox_events WHERE aggregate_id = '00000000-0000-0000-0000-000000000003' ORDER BY event_version DESC LIMIT 1;
  IF event.event_type <> 'deleted' OR event.event_version <> 1000000000008 OR event.payload->>'productId' <> event.aggregate_id THEN
    RAISE EXCEPTION 'Missing deletion tombstone: %', event;
  END IF;
END;
$$;
INSERT INTO products(id, name) VALUES ('00000000-0000-0000-0000-000000000003', 'Recreated');
DO $$
BEGIN
  IF (SELECT max(event_version) FROM outbox_events WHERE aggregate_id = '00000000-0000-0000-0000-000000000003') <> 1000000000009 THEN
    RAISE EXCEPTION 'Version must survive product deletion/recreation';
  END IF;
END;
$$;
-- Lease reclamation and ownership predicates used by the API.
WITH candidate AS (
 SELECT id FROM outbox_events WHERE status = 'PENDING' AND next_attempt_at <= CURRENT_TIMESTAMP
 ORDER BY created_at, id FOR UPDATE SKIP LOCKED LIMIT 1
)
UPDATE outbox_events e SET status = 'PROCESSING', lock_token = '00000000-0000-0000-0000-000000000099',
 locked_until = CURRENT_TIMESTAMP - INTERVAL '1 second', attempts = attempts + 1
FROM candidate c WHERE e.id = c.id;
DO $$
DECLARE claimed integer;
BEGIN
 WITH candidate AS (
  SELECT id FROM outbox_events WHERE status = 'PROCESSING' AND locked_until <= CURRENT_TIMESTAMP
  ORDER BY created_at, id FOR UPDATE SKIP LOCKED LIMIT 1
 ) UPDATE outbox_events e SET lock_token = '00000000-0000-0000-0000-000000000098',
  locked_until = CURRENT_TIMESTAMP + INTERVAL '30 seconds', attempts = attempts + 1
 FROM candidate c WHERE e.id = c.id;
 GET DIAGNOSTICS claimed = ROW_COUNT;
 IF claimed <> 1 THEN RAISE EXCEPTION 'Expired worker lease was not reclaimed'; END IF;
 UPDATE outbox_events SET status = 'PROCESSED' WHERE lock_token = '00000000-0000-0000-0000-000000000099';
 GET DIAGNOSTICS claimed = ROW_COUNT;
 IF claimed <> 0 THEN RAISE EXCEPTION 'Previous worker retained ownership'; END IF;
END;
$$;
ROLLBACK;
