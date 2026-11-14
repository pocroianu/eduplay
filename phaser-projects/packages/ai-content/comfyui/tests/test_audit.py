"""Tests for audit_green_subjects.py — generalized color-band auditor.

The module is named `audit_green_subjects` for historical reasons (when the
only failure mode being audited was green-subject contamination). It now
supports magenta auditing as well, with per-color allowlists and a CLI
`--color` flag.
"""
from __future__ import annotations

import sys
import types
from unittest.mock import MagicMock

# postprocess is imported by conftest.py; audit_green_subjects imports
# compute_dominant_color_ratio from it. We don't need to stub it here.
import audit_green_subjects as aud


class TestColorHueRanges:
    def test_green_hue_range_constant(self):
        assert aud.GREEN_HUE_RANGE == (75.0, 165.0)

    def test_magenta_hue_range_constant(self):
        assert aud.MAGENTA_HUE_RANGE == (285.0, 335.0)

    def test_resolve_hue_range_green(self):
        assert aud.resolve_hue_range("green") == (75.0, 165.0)

    def test_resolve_hue_range_magenta(self):
        assert aud.resolve_hue_range("magenta") == (285.0, 335.0)

    def test_resolve_hue_range_custom(self):
        assert aud.resolve_hue_range("custom", hue_lo=10.0, hue_hi=40.0) == (10.0, 40.0)

    def test_resolve_hue_range_custom_requires_both_bounds(self):
        import pytest
        with pytest.raises(ValueError):
            aud.resolve_hue_range("custom", hue_lo=None, hue_hi=None)


class TestPerColorAllowlists:
    def test_green_allowlist_contains_frog(self):
        assert aud.is_allowlisted("animals-wild_frog", color="green") is True

    def test_green_allowlist_rejects_random_item(self):
        assert aud.is_allowlisted("fruits_apple", color="green") is False

    def test_magenta_allowlist_contains_flamingo(self):
        """Flamingo is legitimately pink — the magenta allowlist must include it
        so we don't flag genuine pink subjects as contaminated."""
        assert aud.is_allowlisted("animals-wild_flamingo", color="magenta") is True

    def test_magenta_allowlist_contains_pig(self):
        assert aud.is_allowlisted("animals-farm_pig", color="magenta") is True

    def test_magenta_allowlist_rejects_frog(self):
        """Frog is a green-allowlisted item but NOT magenta-allowlisted. A
        magenta-contaminated frog must still be flagged broken."""
        assert aud.is_allowlisted("animals-wild_frog", color="magenta") is False

    def test_magenta_allowlist_rejects_apple(self):
        assert aud.is_allowlisted("fruits_apple", color="magenta") is False


class TestClassifyAcceptsColor:
    def test_classify_uses_per_color_allowlist(self):
        # ratio of 0.95 would normally be 'broken', but frog is green-allowlisted
        assert aud.classify("animals_frog", 0.95, 0.5, color="green") == "ok"
        # same prefix is NOT magenta-allowlisted -> still broken
        assert aud.classify("animals_frog", 0.95, 0.5, color="magenta") == "broken"

    def test_classify_empty_regardless_of_color(self):
        assert aud.classify("anything", 0.0, 0.005, color="magenta") == "empty"

    def test_classify_ok_below_threshold(self):
        assert aud.classify("fruits_apple", 0.1, 0.5, color="magenta") == "ok"

    def test_classify_broken_above_threshold(self):
        assert aud.classify("fruits_apple", 0.6, 0.5, color="magenta") == "broken"


class TestAuditDirectoryPassesHueRange:
    """audit_directory must forward the resolved hue range to
    compute_dominant_color_ratio — otherwise the whole color-band argument
    is inert."""

    def test_audit_directory_uses_hue_range(self, tmp_path, monkeypatch):
        # Create a tiny PNG
        from PIL import Image
        import numpy as np
        img = Image.fromarray(np.zeros((8, 8, 4), dtype=np.uint8), mode="RGBA")
        png = tmp_path / "fruits_apple_00001_.png"
        img.save(png)

        calls = []

        def fake_compute(path, hue_range=(75.0, 165.0), **kw):
            calls.append(hue_range)
            return 0.0, 0

        monkeypatch.setattr(aud, "compute_dominant_color_ratio", fake_compute)
        aud.audit_directory(tmp_path, hue_range=(300.0, 330.0), color="magenta")
        assert calls, "compute_dominant_color_ratio should have been called"
        assert all(h == (300.0, 330.0) for h in calls), (
            f"audit_directory must pass the magenta hue range, got {calls}"
        )
