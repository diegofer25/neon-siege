/**
 * @fileoverview Simple spatial hash grid for O(1) neighbor lookups.
 * Replaces brute-force O(n²) collision checks with O(n + k) where
 * k is the number of nearby entities per query.
 */

export class SpatialGrid {
    /**
     * @param {number} cellSize - Size of each grid cell in pixels
     * @param {number} width - Arena width in pixels
     * @param {number} height - Arena height in pixels
     */
    constructor(cellSize, width, height) {
        this.cellSize = cellSize;
        this.invCellSize = 1 / cellSize;
        this.width = width;
        this.height = height;
        this.cols = Math.ceil(width / cellSize);
        this.rows = Math.ceil(height / cellSize);
        /** @type {Map<number, Array>} */
        this.cells = new Map();
    }

    /** Remove all entities from the grid. */
    clear() {
        this.cells.clear();
    }

    /**
     * Compute a flat key from column and row indices.
     * @param {number} col
     * @param {number} row
     * @returns {number}
     */
    _key(col, row) {
        return row * this.cols + col;
    }

    /**
     * Insert an entity into every cell its bounding circle overlaps.
     * @param {{ x: number, y: number, radius?: number }} entity
     */
    insert(entity) {
        const r = entity.radius || 0;
        const inv = this.invCellSize;
        const minC = Math.max(0, ((entity.x - r) * inv) | 0);
        const maxC = Math.min(this.cols - 1, ((entity.x + r) * inv) | 0);
        const minR = Math.max(0, ((entity.y - r) * inv) | 0);
        const maxR = Math.min(this.rows - 1, ((entity.y + r) * inv) | 0);

        for (let row = minR; row <= maxR; row++) {
            for (let col = minC; col <= maxC; col++) {
                const key = this._key(col, row);
                let bucket = this.cells.get(key);
                if (!bucket) {
                    bucket = [];
                    this.cells.set(key, bucket);
                }
                bucket.push(entity);
            }
        }
    }

    /**
     * Query all entities whose cells overlap the given circle.
     * Returns a Set to deduplicate entities spanning multiple cells.
     * @param {number} x - Query center X
     * @param {number} y - Query center Y
     * @param {number} radius - Query radius
     * @returns {Set<Object>}
     */
    query(x, y, radius) {
        const results = new Set();
        const inv = this.invCellSize;
        const minC = Math.max(0, ((x - radius) * inv) | 0);
        const maxC = Math.min(this.cols - 1, ((x + radius) * inv) | 0);
        const minR = Math.max(0, ((y - radius) * inv) | 0);
        const maxR = Math.min(this.rows - 1, ((y + radius) * inv) | 0);

        for (let row = minR; row <= maxR; row++) {
            for (let col = minC; col <= maxC; col++) {
                const bucket = this.cells.get(this._key(col, row));
                if (bucket) {
                    for (let i = 0; i < bucket.length; i++) {
                        results.add(bucket[i]);
                    }
                }
            }
        }
        return results;
    }

    /**
     * Resize the grid if the arena dimensions have changed.
     * @param {number} width
     * @param {number} height
     */
    resize(width, height) {
        if (this.width !== width || this.height !== height) {
            this.width = width;
            this.height = height;
            this.cols = Math.ceil(width / this.cellSize);
            this.rows = Math.ceil(height / this.cellSize);
        }
    }
}
