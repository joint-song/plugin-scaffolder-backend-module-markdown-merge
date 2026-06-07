import escapeRegExp from 'lodash/escapeRegExp';

export type MergeMode = 'replace' | 'append';

export type MissingBehavior = 'error' | 'warn' | 'ignore';

export type SlotMatch =
    | { kind: 'pair' }
    | { kind: 'single' }
    | { kind: 'none' };

export type MergeResult = {
    content: string;
    match: SlotMatch;
};

/**
 * Canonical slot tag name embedded in markdown markers.
 *
 *   Paired:   <!-- MD_SLOT: NAME -->...content...<!-- /MD_SLOT: NAME -->
 *   Single:   <!-- MD_SLOT: NAME -->     (closing tag is auto-added)
 *
 * Exported so consumers and tests can refer to the same constant.
 */
export const SLOT_TAG_NAME = 'MD_SLOT';

/**
 * Pure: merge a fragment into a slot marker in `content`.
 *
 * Pair pattern (preferred):  <!-- MD_SLOT: NAME -->...existing...<!-- /MD_SLOT: NAME -->
 * Single pattern (fallback): <!-- MD_SLOT: NAME -->  (closing tag is auto-added)
 *
 * - `mode: 'replace'` overwrites the existing content between paired markers.
 * - `mode: 'append'`  keeps the existing content and inserts the fragment after it.
 *   Has no effect for the single-tag fallback (no existing content to keep).
 *
 * No filesystem access. `slotName` is regex-escaped via lodash/escapeRegExp.
 */
export function mergeSlot(
    content: string,
    slotName: string,
    fragmentContent: string,
    mode: MergeMode,
): MergeResult {
    const safeName = escapeRegExp(slotName);
    const openTagRe = `<!--\\s*${SLOT_TAG_NAME}\\s*:\\s*${safeName}\\s*-->`;
    const closeTagRe = `<!--\\s*/\\s*${SLOT_TAG_NAME}\\s*:\\s*${safeName}\\s*-->`;
    const pairPattern = new RegExp(
        `(${openTagRe})([\\s\\S]*?)(${closeTagRe})`,
    );
    const singlePattern = new RegExp(openTagRe);

    if (pairPattern.test(content)) {
        if (mode === 'append') {
            const next = content.replace(
                pairPattern,
                (_match, open: string, existing: string, close: string) =>
                    `${open}${existing.replace(
                        /\s+$/,
                        '',
                    )}\n${fragmentContent}\n${close}`,
            );
            return { content: next, match: { kind: 'pair' } };
        }
        return {
            content: content.replace(
                pairPattern,
                `$1\n${fragmentContent}\n$3`,
            ),
            match: { kind: 'pair' },
        };
    }

    if (singlePattern.test(content)) {
        const openTagPlain = `<!-- ${SLOT_TAG_NAME}: ${slotName} -->`;
        const closeTagPlain = `<!-- /${SLOT_TAG_NAME}: ${slotName} -->`;
        return {
            content: content.replace(
                singlePattern,
                `${openTagPlain}\n${fragmentContent}\n${closeTagPlain}`,
            ),
            match: { kind: 'single' },
        };
    }

    return { content, match: { kind: 'none' } };
}

export type LoggerLike = {
    warn: (msg: string) => void;
};

/**
 * Apply the configured behavior when a slot/fragment is missing.
 * - 'error'  → throws an Error with the given message
 * - 'warn'   → logs a warning and returns
 * - 'ignore' → returns silently
 */
export function handleMissing(
    behavior: MissingBehavior,
    ctx: { logger: LoggerLike },
    message: string,
): void {
    if (behavior === 'ignore') return;
    if (behavior === 'error') throw new Error(message);
    ctx.logger.warn(message);
}
