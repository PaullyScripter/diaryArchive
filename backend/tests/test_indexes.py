from pymongo import IndexModel

from app.core.indexes import _index_spec_matches


def test_index_spec_matches_legacy_name_with_same_keys_and_options():
    model = IndexModel(
        [("target_type", 1), ("target_id", 1), ("created_at", -1)],
        name="idx_target_created_at",
    )
    existing = {
        "key": [("target_type", 1), ("target_id", 1), ("created_at", -1)],
        "name": "idx_target_type_target_id_created_at",
        "v": 2,
    }

    assert _index_spec_matches(existing, model)


def test_index_spec_requires_matching_ttl_options():
    model = IndexModel(
        [("expires_at", 1)],
        name="idx_expires_at_ttl",
        expireAfterSeconds=0,
    )
    existing = {
        "key": [("expires_at", 1)],
        "name": "expires_at_ttl",
        "expireAfterSeconds": 3600,
        "v": 2,
    }

    assert not _index_spec_matches(existing, model)


def test_index_spec_requires_matching_sort_direction():
    model = IndexModel(
        [("status", 1), ("created_at", -1)],
        name="idx_status_created_at",
    )
    existing = {
        "key": [("status", 1), ("created_at", 1)],
        "name": "idx_status_created_at",
        "v": 2,
    }

    assert not _index_spec_matches(existing, model)
