import Phaser from 'phaser';

export interface Checkpoint {
    x: number;
    y: number;
    index: number;
}

export interface ParsedStroke {
    curves: Phaser.Curves.Path;
    checkpoints: Checkpoint[];
}

interface PathCommand {
    type: 'M' | 'L' | 'C' | 'Q';
    args: number[];
}

/**
 * Parse an SVG path string into an array of PathCommand objects.
 * Supports M (moveTo), L (lineTo), C (cubic bezier), Q (quadratic bezier).
 * Uppercase only (absolute coordinates).
 */
function tokenize(pathStr: string): PathCommand[] {
    const commands: PathCommand[] = [];
    const regex = /([MLCQ])\s*([\d\s,.\-e]+)/gi;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(pathStr)) !== null) {
        const type = match[1].toUpperCase() as PathCommand['type'];
        const args = match[2]
            .trim()
            .split(/[\s,]+/)
            .map(Number);
        commands.push({ type, args });
    }

    return commands;
}

/**
 * Convert SVG path commands into a Phaser.Curves.Path.
 */
export function parseSvgPath(pathStr: string): Phaser.Curves.Path {
    const commands = tokenize(pathStr);
    let cursorX = 0;
    let cursorY = 0;
    let pathStarted = false;
    let path: Phaser.Curves.Path | null = null;

    for (const cmd of commands) {
        const a = cmd.args;

        switch (cmd.type) {
            case 'M':
                cursorX = a[0];
                cursorY = a[1];
                if (!pathStarted) {
                    path = new Phaser.Curves.Path(cursorX, cursorY);
                    pathStarted = true;
                } else {
                    path!.moveTo(cursorX, cursorY);
                }
                break;

            case 'L':
                path!.lineTo(a[0], a[1]);
                cursorX = a[0];
                cursorY = a[1];
                break;

            case 'C':
                path!.cubicBezierTo(
                    a[4], a[5],  // end point
                    a[0], a[1],  // control point 1
                    a[2], a[3]   // control point 2
                );
                cursorX = a[4];
                cursorY = a[5];
                break;

            case 'Q':
                path!.quadraticBezierTo(
                    a[2], a[3],  // end point
                    a[0], a[1]   // control point
                );
                cursorX = a[2];
                cursorY = a[3];
                break;
        }
    }

    if (!path) {
        path = new Phaser.Curves.Path(0, 0);
    }

    return path;
}

/**
 * Generate evenly-spaced checkpoints along a Phaser.Curves.Path.
 *
 * @param path - The Phaser path to sample
 * @param count - Desired number of checkpoints
 * @param minSpacing - Minimum pixel distance between checkpoints; if placing
 *                     `count` checkpoints would be closer than this, reduce the count.
 * @returns Array of Checkpoint objects with x, y, and index.
 */
export function generateCheckpoints(
    path: Phaser.Curves.Path,
    count: number,
    minSpacing: number
): Checkpoint[] {
    const totalLength = path.getLength();
    const maxBySpacing = Math.max(2, Math.floor(totalLength / minSpacing) + 1);
    const effectiveCount = Math.min(count, maxBySpacing);

    const checkpoints: Checkpoint[] = [];

    for (let i = 0; i < effectiveCount; i++) {
        const t = effectiveCount > 1 ? i / (effectiveCount - 1) : 0;
        const point = path.getPoint(t);
        checkpoints.push({
            x: point.x,
            y: point.y,
            index: i
        });
    }

    return checkpoints;
}

/**
 * Apply a uniform scale and translation to all checkpoints and re-build
 * a scaled Phaser.Curves.Path by sampling the original.
 *
 * @param original - The path in local coordinates
 * @param checkpoints - Checkpoints in local coordinates
 * @param scale - Scale factor
 * @param offsetX - Translation X after scaling
 * @param offsetY - Translation Y after scaling
 * @returns Object with scaled path and transformed checkpoints
 */
export function transformStroke(
    original: Phaser.Curves.Path,
    checkpoints: Checkpoint[],
    scale: number,
    offsetX: number,
    offsetY: number
): { path: Phaser.Curves.Path; checkpoints: Checkpoint[] } {
    // Transform checkpoints
    const transformed: Checkpoint[] = checkpoints.map(cp => ({
        x: cp.x * scale + offsetX,
        y: cp.y * scale + offsetY,
        index: cp.index
    }));

    // Rebuild path by sampling the original at many points and scaling
    const sampleCount = 64;
    const points: Phaser.Math.Vector2[] = [];
    for (let i = 0; i <= sampleCount; i++) {
        const t = i / sampleCount;
        const p = original.getPoint(t);
        points.push(new Phaser.Math.Vector2(
            p.x * scale + offsetX,
            p.y * scale + offsetY
        ));
    }

    // Build a new path from line segments through the sampled points
    const scaledPath = new Phaser.Curves.Path(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        scaledPath.lineTo(points[i].x, points[i].y);
    }

    return { path: scaledPath, checkpoints: transformed };
}
