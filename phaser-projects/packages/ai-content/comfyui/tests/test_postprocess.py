"""Tests for postprocess.py — image post-processing pure functions.

These tests use real PIL + numpy (the venv has them). They build tiny
synthetic RGBA images to exercise the color-based logic without depending
on rembg, ComfyUI, or any network/file I/O beyond temp paths.
"""
from __future__ import annotations

import numpy as np
import pytest
from PIL import Image

import postprocess as pp


def _rgba(pixels: np.ndarray) -> Image.Image:
    """Build an RGBA PIL image from a (H, W, 4) uint8 array."""
    assert pixels.dtype == np.uint8
    assert pixels.shape[-1] == 4
    return Image.fromarray(pixels, mode="RGBA")


def _solid(color: tuple[int, int, int, int], size: int = 8) -> Image.Image:
    """Return a size x size solid-color RGBA image."""
    arr = np.zeros((size, size, 4), dtype=np.uint8)
    arr[..., 0] = color[0]
    arr[..., 1] = color[1]
    arr[..., 2] = color[2]
    arr[..., 3] = color[3]
    return _rgba(arr)


class TestRemoveResidualMagenta:
    def test_all_magenta_subject_becomes_fully_transparent(self):
        """If the whole subject is painted hot magenta, the cleanup pass
        should null its alpha so the validator downstream flags it as empty."""
        img = _solid((255, 0, 255, 255))  # pure magenta, fully opaque
        out = pp.remove_residual_magenta(img)
        arr = np.asarray(out)
        assert arr.shape[-1] == 4, "output must still be RGBA"
        assert arr[..., 3].max() == 0, (
            f"expected all alpha zeroed, got max alpha {arr[..., 3].max()}"
        )

    def test_red_subject_is_preserved(self):
        """A solid red subject must not be touched by the magenta filter —
        red hue is ~0°, well outside the 300-330° magenta band."""
        img = _solid((255, 0, 0, 255))
        out = pp.remove_residual_magenta(img)
        arr = np.asarray(out)
        assert arr[..., 3].min() == 255, "red subject must keep full alpha"

    def test_yellow_subject_is_preserved(self):
        img = _solid((255, 230, 0, 255))
        out = pp.remove_residual_magenta(img)
        arr = np.asarray(out)
        assert arr[..., 3].min() == 255

    def test_orange_subject_is_preserved(self):
        """Goldfish/firefighter-style orange must survive (hue ~30°)."""
        img = _solid((255, 128, 0, 255))
        out = pp.remove_residual_magenta(img)
        arr = np.asarray(out)
        assert arr[..., 3].min() == 255

    def test_magenta_bleed_around_red_subject_is_removed(self):
        """Classic failure: red subject with a halo of magenta bleed at the
        edges. After cleanup, red stays opaque, magenta halo becomes
        transparent."""
        arr = np.zeros((8, 8, 4), dtype=np.uint8)
        # Magenta halo everywhere, fully opaque
        arr[..., 0] = 255
        arr[..., 2] = 255
        arr[..., 3] = 255
        # Red subject in the 4x4 center
        arr[2:6, 2:6, 0] = 255
        arr[2:6, 2:6, 1] = 0
        arr[2:6, 2:6, 2] = 0
        out = pp.remove_residual_magenta(_rgba(arr))
        out_arr = np.asarray(out)
        # Center (red subject) must remain fully opaque
        assert out_arr[2:6, 2:6, 3].min() == 255
        # Corner halo pixels (pure magenta) must be transparent
        assert out_arr[0, 0, 3] == 0
        assert out_arr[7, 7, 3] == 0

    def test_already_transparent_pixels_stay_transparent(self):
        """Pixels that already have alpha=0 should not be touched (idempotent)."""
        arr = np.zeros((4, 4, 4), dtype=np.uint8)  # fully transparent black
        out = pp.remove_residual_magenta(_rgba(arr))
        assert np.asarray(out)[..., 3].max() == 0

    def test_low_saturation_magenta_is_spared(self):
        """Near-grey pixels with a faint magenta hue should NOT be removed —
        only vivid magenta (sat >= 0.4). This protects subjects that happen
        to have slightly pink-tinted anti-aliasing edges without being
        fundamentally contaminated."""
        # HSV hue ~315°, but very low saturation: mostly grey
        img = _solid((190, 180, 190, 255))
        out = pp.remove_residual_magenta(img)
        arr = np.asarray(out)
        assert arr[..., 3].min() == 255, (
            "low-saturation near-grey pixels must be kept opaque"
        )

    def test_pink_magenta_hue_325_is_removed(self):
        """Hot pink at hue ~325° (still in the band) must be removed."""
        # HSV(325, 1.0, 1.0) ≈ RGB(255, 0, 149)
        img = _solid((255, 0, 149, 255))
        out = pp.remove_residual_magenta(img)
        arr = np.asarray(out)
        assert arr[..., 3].max() == 0

    def test_returns_rgba_image(self):
        """Return type contract: always RGBA PIL Image."""
        img = _solid((0, 128, 255, 255))
        out = pp.remove_residual_magenta(img)
        assert isinstance(out, Image.Image)
        assert out.mode == "RGBA"
