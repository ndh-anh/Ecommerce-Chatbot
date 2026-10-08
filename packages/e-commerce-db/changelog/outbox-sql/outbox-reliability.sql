ALTER TABLE outbox_events
  ADD COLUMN event_version bigint NOT NULL DEFAULT 0,
  ADD COLUMN attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN next_attempt_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN locked_until timestamp,
  ADD COLUMN lock_token uuid,
  ADD COLUMN last_error text,
  ADD COLUMN processed_at timestamp;
CREATE INDEX idx_outbox_pending ON outbox_events(status, next_attempt_at, created_at, id);
CREATE INDEX idx_outbox_lease ON outbox_events(status, locked_until);
CREATE INDEX idx_outbox_processed ON outbox_events(processed_at) WHERE status = 'PROCESSED';

-- Keep the version ledger after deletion and cleanup. The starting value is above
-- existing Elasticsearch internal versions and leaves ample JS safe-integer space.
CREATE TABLE product_event_versions (product_id uuid PRIMARY KEY, version bigint NOT NULL);
CREATE FUNCTION enqueue_product_event(pid uuid, kind text DEFAULT 'updated') RETURNS void AS $$
DECLARE snapshot jsonb; revision bigint;
BEGIN
  INSERT INTO product_event_versions VALUES (pid, 1000000000000)
    ON CONFLICT (product_id) DO UPDATE SET version = product_event_versions.version + 1
    RETURNING version INTO revision;
  SELECT to_jsonb(p) || jsonb_build_object(
    'categories', (SELECT to_jsonb(c) FROM categories c WHERE c.id = p.category_id),
    'brands', (SELECT to_jsonb(b) FROM brands b WHERE b.id = p.brand_id),
    'product_images', COALESCE((SELECT jsonb_agg(i ORDER BY i.id) FROM product_images i WHERE i.product_id = pid), '[]'::jsonb),
    'product_variants', COALESCE((SELECT jsonb_agg(v ORDER BY v.id) FROM product_variants v WHERE v.product_id = pid), '[]'::jsonb)
  ) INTO snapshot FROM products p WHERE p.id = pid;
  INSERT INTO outbox_events(id, aggregate_type, aggregate_id, event_type, payload, event_version)
    VALUES (gen_random_uuid(), 'product', pid::text,
      CASE WHEN snapshot IS NULL THEN 'deleted' ELSE kind END,
      COALESCE(snapshot, jsonb_build_object('productId', pid)), revision);
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION product_outbox_trigger() RETURNS trigger AS $$
DECLARE pid uuid;
BEGIN
  IF TG_TABLE_NAME = 'products' THEN
    IF TG_OP = 'DELETE' THEN pid := OLD.id; ELSE pid := NEW.id; END IF;
    PERFORM enqueue_product_event(pid, CASE WHEN TG_OP = 'INSERT' THEN 'created' ELSE 'updated' END);
  ELSIF TG_TABLE_NAME IN ('product_variants', 'product_images') THEN
    IF TG_OP <> 'INSERT' THEN PERFORM enqueue_product_event(OLD.product_id); END IF;
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.product_id IS DISTINCT FROM OLD.product_id) THEN
      PERFORM enqueue_product_event(NEW.product_id);
    END IF;
  ELSE
    -- Deterministic locking order for changes affecting many products.
    FOR pid IN SELECT id FROM products
      WHERE (TG_TABLE_NAME = 'categories' AND category_id = NEW.id)
         OR (TG_TABLE_NAME = 'brands' AND brand_id = NEW.id) ORDER BY id
    LOOP PERFORM enqueue_product_event(pid); END LOOP;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER products_outbox AFTER INSERT OR UPDATE OR DELETE ON products
  FOR EACH ROW EXECUTE FUNCTION product_outbox_trigger();
CREATE TRIGGER variants_outbox AFTER INSERT OR UPDATE OR DELETE ON product_variants
  FOR EACH ROW EXECUTE FUNCTION product_outbox_trigger();
CREATE TRIGGER images_outbox AFTER INSERT OR UPDATE OR DELETE ON product_images
  FOR EACH ROW EXECUTE FUNCTION product_outbox_trigger();
CREATE TRIGGER categories_outbox AFTER UPDATE ON categories
  FOR EACH ROW WHEN (OLD.name IS DISTINCT FROM NEW.name) EXECUTE FUNCTION product_outbox_trigger();
CREATE TRIGGER brands_outbox AFTER UPDATE ON brands
  FOR EACH ROW WHEN (OLD.name IS DISTINCT FROM NEW.name) EXECUTE FUNCTION product_outbox_trigger();

-- Replace legacy unversioned pending snapshots with current, versioned snapshots.
-- Existing processed rows are retained for audit. Also bootstrap existing products.
UPDATE outbox_events SET status = 'SUPERSEDED' WHERE status = 'PENDING';
DO $$
DECLARE pid uuid;
BEGIN
  FOR pid IN SELECT id FROM products UNION SELECT aggregate_id::uuid FROM outbox_events
    WHERE aggregate_type = 'product' ORDER BY 1
  LOOP PERFORM enqueue_product_event(pid); END LOOP;
END;
$$;
