-- +goose Up
ALTER TABLE metrics
    ADD COLUMN cls NUMERIC,
    ADD COLUMN speed_index NUMERIC,
    ADD COLUMN tbt INTEGER,
    ADD COLUMN js_byte_weight INTEGER,
    ADD COLUMN css_byte_weight INTEGER,
    ADD COLUMN image_byte_weight INTEGER,
    ADD COLUMN font_byte_weight INTEGER,
    ADD COLUMN render_blocking_req INTEGER,
    ADD COLUMN unused_js_estimate INTEGER;

-- +goose Down
ALTER TABLE metrics
    DROP COLUMN IF EXISTS cls,
    DROP COLUMN IF EXISTS speed_index,
    DROP COLUMN IF EXISTS tbt,
    DROP COLUMN IF EXISTS js_byte_weight,
    DROP COLUMN IF EXISTS css_byte_weight,
    DROP COLUMN IF EXISTS image_byte_weight,
    DROP COLUMN IF EXISTS font_byte_weight,
    DROP COLUMN IF EXISTS render_blocking_req,
    DROP COLUMN IF EXISTS unused_js_estimate;
