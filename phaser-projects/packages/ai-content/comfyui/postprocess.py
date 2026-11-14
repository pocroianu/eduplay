"""Background removal post-processing for generated educational assets.

Uses rembg + u2net to convert RGB PNGs with solid colored backgrounds
into RGBA PNGs with transparent backgrounds. Assets are generated on a
bright magenta chroma-key background to maximize contrast with subjects
(especially white/light subjects like polar bears or doctor's coats),
then the background is removed here.

A second pass (`remove_residual_magenta`) then zeroes alpha on any pixels
still inside the magenta hue band — this eats the halo/bleed that rembg
leaves behind (e.g. magenta between fork tines, pink halo around
subjects) and, crucially, turns fully-magenta-painted subjects into empty
alpha so the validator downstream flags them as `empty` and retries.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image
from rembg import new_session, remove


def create_session(model_name: str = "u2net"):
    """Create a rembg session. Reuse across many images to avoid reloading the model."""
    return new_session(model_name)


def remove_background(
    image_path: str | Path,
    output_path: str | Path,
    session,
    alpha_matting: bool = False,
) -> Path:
    """Remove background from a single image, writing an RGBA PNG.

    Args:
        image_path: source image path
        output_path: destination path (can be the same as input to overwrite)
        session: rembg session from create_session()
        alpha_matting: enable alpha matting for cleaner edges (~2x slower)

    Returns:
        Path to the written output file.
    """
    image_path = Path(image_path)
    output_path = Path(output_path)

    with Image.open(image_path) as img:
        img.load()

    # Skip if already RGBA (assume already processed)
    if img.mode == "RGBA":
        if image_path != output_path:
            img.save(output_path, "PNG")
        return output_path

    result = remove(img, session=session, alpha_matting=alpha_matting)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    result.save(output_path, "PNG")
    return output_path


def remove_residual_magenta(
    img: Image.Image,
    hue_range: tuple[float, float] = (300.0, 330.0),
    sat_min: float = 0.4,
) -> Image.Image:
    """Zero alpha on pixels whose color is vivid magenta.

    Intended to run AFTER rembg's semantic background removal. rembg is a
    semantic segmenter: it preserves chroma-key pixels that end up inside
    the subject silhouette (magenta between fork tines, pink stripe down
    a figure, orange-disk halo around a subject). This pass cleans up
    that residual bleed by targeting the chroma-key hue directly.

    A pixel's alpha is set to 0 iff ALL of:
      - its current alpha is > 0
      - its HSV hue is in `hue_range` (degrees, 0-360)
      - its HSV saturation >= `sat_min` (guards against near-grey
        pixels that only coincidentally land in the magenta hue band)

    Args:
        img: an RGBA PIL image (must have an alpha channel).
        hue_range: inclusive HSV hue band in degrees. Default is the
            magenta/pink band used by the Duolingo generation pipeline.
        sat_min: minimum saturation (0..1) required for a pixel to be
            treated as "truly magenta" rather than a near-grey coincidence.

    Returns:
        A new RGBA PIL image; the input is not mutated.
    """
    if img.mode != "RGBA":
        img = img.convert("RGBA")
    arr = np.asarray(img, dtype=np.uint8).copy()

    alpha = arr[..., 3]
    opaque = alpha > 0

    rgb = arr[..., :3].astype(np.float32) / 255.0
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    delta = mx - mn
    sat = np.where(mx > 0, delta / np.maximum(mx, 1e-6), 0.0)

    hue = np.zeros_like(mx)
    nonzero = delta > 1e-6
    # Red is max
    mask_r = nonzero & (mx == r)
    hue[mask_r] = (60.0 * ((g[mask_r] - b[mask_r]) / delta[mask_r])) % 360.0
    # Green is max
    mask_g = nonzero & (mx == g) & ~mask_r
    hue[mask_g] = (60.0 * ((b[mask_g] - r[mask_g]) / delta[mask_g]) + 120.0) % 360.0
    # Blue is max
    mask_b = nonzero & (mx == b) & ~mask_r & ~mask_g
    hue[mask_b] = (60.0 * ((r[mask_b] - g[mask_b]) / delta[mask_b]) + 240.0) % 360.0

    lo, hi = hue_range
    magenta = opaque & (hue >= lo) & (hue <= hi) & (sat >= sat_min)
    arr[..., 3] = np.where(magenta, 0, alpha)
    return Image.fromarray(arr, mode="RGBA")


def postprocess_image(
    image_path: str | Path,
    output_path: str | Path,
    session,
) -> dict:
    """Wrapper that catches errors and returns a result dict.

    Runs `remove_background` (rembg semantic segmentation) followed by
    `remove_residual_magenta` to clean up chroma-key bleed that rembg
    preserved inside the subject silhouette.

    Returns:
        {"path": Path, "ok": bool, "error": str | None}
    """
    try:
        out = remove_background(image_path, output_path, session)
        with Image.open(out) as img:
            cleaned = remove_residual_magenta(img)
        cleaned.save(out, "PNG")
        return {"path": out, "ok": True, "error": None}
    except Exception as e:
        return {"path": Path(image_path), "ok": False, "error": str(e)}


# ---------------------------------------------------------------------------
# Quality validation — detect when the subject itself is the wrong color
# ---------------------------------------------------------------------------
#
# Qwen Image occasionally misinterprets the "solid bright green background"
# instruction and colors the subject itself green. rembg u2net is a semantic
# segmenter, not a chromakey, so it preserves the green subject as foreground —
# producing an all-green output that still looks "ok" to the pipeline.
#
# These helpers let the batch runner (and a standalone audit script) detect
# those outputs by measuring how much of the non-transparent area falls inside
# a given HSV hue band.


def compute_dominant_color_ratio(
    image_path: str | Path,
    hue_range: tuple[float, float] = (75.0, 165.0),
    sat_min: float = 0.35,
    val_min: float = 0.25,
    alpha_min: int = 32,
    bg_luma_min: int = 240,
    bg_sat_max: float = 0.08,
    border_px: int = 2,
) -> tuple[float, int]:
    """Return (ratio, subject_pixel_count) for pixels whose HSV hue falls inside
    `hue_range` (in degrees, 0-360) AND whose saturation/value exceed the given
    minimums.

    Works on both RGB and RGBA images:
      - RGBA: "subject" pixels are those with alpha > alpha_min.
      - RGB:  "subject" pixels are those that are NOT near-white background,
              i.e. luma < bg_luma_min OR saturation > bg_sat_max. This matches
              the white-background outputs that Qwen Image produces when the
              chroma-key instruction is ignored.

    The outermost `border_px` pixels are ignored to avoid halo artifacts from
    rembg or compression edges. If there are no subject pixels, returns (0.0, 0).
    """
    path = Path(image_path)
    with Image.open(path) as img:
        mode_is_rgba = img.mode == "RGBA"
        img = img.convert("RGBA") if mode_is_rgba else img.convert("RGB")
        arr = np.asarray(img, dtype=np.uint8)

    if border_px > 0 and arr.shape[0] > 2 * border_px and arr.shape[1] > 2 * border_px:
        arr = arr[border_px:-border_px, border_px:-border_px]

    # Build subject mask
    if mode_is_rgba:
        alpha = arr[..., 3]
        mask_subject = alpha > alpha_min
        rgb_all = arr[..., :3]
    else:
        rgb_all = arr
        rgb_f = arr.astype(np.float32) / 255.0
        r_a, g_a, b_a = rgb_f[..., 0], rgb_f[..., 1], rgb_f[..., 2]
        # Rec.709 luma (0..1)
        luma = 0.2126 * r_a + 0.7152 * g_a + 0.0722 * b_a
        mx_all = np.maximum(np.maximum(r_a, g_a), b_a)
        mn_all = np.minimum(np.minimum(r_a, g_a), b_a)
        sat_all = np.where(mx_all > 0, (mx_all - mn_all) / np.maximum(mx_all, 1e-6), 0.0)
        # Subject = not near-white background
        near_white = (luma * 255.0 >= bg_luma_min) & (sat_all <= bg_sat_max)
        mask_subject = ~near_white

    subject_count = int(mask_subject.sum())
    if subject_count == 0:
        return 0.0, 0

    # Convert RGB channels of subject pixels to HSV (vectorized)
    rgb = rgb_all[mask_subject].astype(np.float32) / 255.0
    r, g, b = rgb[:, 0], rgb[:, 1], rgb[:, 2]
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    v = mx
    delta = mx - mn
    s = np.where(mx > 0, delta / np.maximum(mx, 1e-6), 0.0)

    # Hue computation (degrees, 0-360)
    h = np.zeros_like(mx)
    nonzero = delta > 1e-6
    # r is max
    mask_r = nonzero & (mx == r)
    h[mask_r] = (60.0 * ((g[mask_r] - b[mask_r]) / delta[mask_r])) % 360.0
    # g is max
    mask_g = nonzero & (mx == g) & ~mask_r
    h[mask_g] = (60.0 * ((b[mask_g] - r[mask_g]) / delta[mask_g]) + 120.0) % 360.0
    # b is max
    mask_b = nonzero & (mx == b) & ~mask_r & ~mask_g
    h[mask_b] = (60.0 * ((r[mask_b] - g[mask_b]) / delta[mask_b]) + 240.0) % 360.0

    lo, hi = hue_range
    in_band = (h >= lo) & (h <= hi) & (s >= sat_min) & (v >= val_min)
    matching = int(in_band.sum())
    return matching / subject_count, subject_count


def validate_not_dominant_color(
    image_path: str | Path,
    hue_range: tuple[float, float] = (75.0, 165.0),
    threshold: float = 0.55,
) -> dict:
    """Return a dict describing whether the image's subject region is dominated
    by the given hue band. Works for both RGBA (transparent bg) and RGB
    (white bg) images.

    Returns:
        {
            "ok": bool,          # True when ratio <= threshold and not empty
            "ratio": float,      # fraction of subject pixels inside the hue band
            "subject_pixels": int,
            "empty": bool,       # True when <1% of image is detected as subject
        }
    """
    ratio, subject = compute_dominant_color_ratio(image_path, hue_range=hue_range)
    with Image.open(Path(image_path)) as img:
        w, h = img.size
    total = max(w * h, 1)
    empty = (subject / total) < 0.01
    ok = (not empty) and (ratio <= threshold)
    return {"ok": ok, "ratio": float(ratio), "subject_pixels": subject, "empty": empty}
