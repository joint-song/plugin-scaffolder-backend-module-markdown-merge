import {
    handleMissing,
    mergeSlot,
    SLOT_TAG_NAME,
} from './merge';

const OPEN = (n: string) => `<!-- ${SLOT_TAG_NAME}: ${n} -->`;
const CLOSE = (n: string) => `<!-- /${SLOT_TAG_NAME}: ${n} -->`;

describe('mergeSlot', () => {
    describe('paired marker', () => {
        it('replaces existing content in replace mode', () => {
            const before = `prefix\n${OPEN('x')}\nold\n${CLOSE('x')}\nsuffix`;
            const result = mergeSlot(before, 'x', 'NEW', 'replace');
            expect(result.match).toEqual({ kind: 'pair' });
            expect(result.content).toBe(
                `prefix\n${OPEN('x')}\nNEW\n${CLOSE('x')}\nsuffix`,
            );
        });

        it('preserves and appends in append mode', () => {
            const before = `${OPEN('x')}\nold\n${CLOSE('x')}`;
            const result = mergeSlot(before, 'x', 'NEW', 'append');
            expect(result.match).toEqual({ kind: 'pair' });
            expect(result.content).toBe(`${OPEN('x')}\nold\nNEW\n${CLOSE('x')}`);
        });

        it('trims trailing whitespace of existing content in append mode', () => {
            const before = `${OPEN('x')}\nold\n\n  \n${CLOSE('x')}`;
            const result = mergeSlot(before, 'x', 'NEW', 'append');
            expect(result.content).toBe(`${OPEN('x')}\nold\nNEW\n${CLOSE('x')}`);
        });

        it('handles multi-line existing content', () => {
            const before = `${OPEN('x')}\nline1\nline2\nline3\n${CLOSE('x')}`;
            expect(mergeSlot(before, 'x', 'NEW', 'replace').content).toBe(
                `${OPEN('x')}\nNEW\n${CLOSE('x')}`,
            );
        });

        it('tolerates extra whitespace around the colon', () => {
            const before = `<!-- ${SLOT_TAG_NAME}  :  x   -->\nold\n<!-- / ${SLOT_TAG_NAME}  :  x -->`;
            const result = mergeSlot(before, 'x', 'NEW', 'replace');
            expect(result.match).toEqual({ kind: 'pair' });
            expect(result.content).toBe(
                `<!-- ${SLOT_TAG_NAME}  :  x   -->\nNEW\n<!-- / ${SLOT_TAG_NAME}  :  x -->`,
            );
        });
    });

    describe('single marker fallback', () => {
        it('auto-completes closing tag', () => {
            const before = `${OPEN('x')}`;
            const result = mergeSlot(before, 'x', 'NEW', 'replace');
            expect(result.match).toEqual({ kind: 'single' });
            expect(result.content).toBe(`${OPEN('x')}\nNEW\n${CLOSE('x')}`);
        });

        it('preserves subsequent content outside the slot', () => {
            const before = `${OPEN('x')}\nfallback content`;
            const result = mergeSlot(before, 'x', 'NEW', 'replace');
            expect(result.content).toBe(
                `${OPEN('x')}\nNEW\n${CLOSE('x')}\nfallback content`,
            );
        });

        it('behaves identically in append mode (no existing content to keep)', () => {
            const before = `${OPEN('x')}`;
            const result = mergeSlot(before, 'x', 'NEW', 'append');
            expect(result.content).toBe(`${OPEN('x')}\nNEW\n${CLOSE('x')}`);
        });
    });

    describe('no marker', () => {
        it('returns content unchanged with kind=none', () => {
            const before = 'plain markdown with no slots';
            const result = mergeSlot(before, 'x', 'NEW', 'replace');
            expect(result.match).toEqual({ kind: 'none' });
            expect(result.content).toBe(before);
        });
    });

    describe('slot name with regex metacharacters', () => {
        it('treats slot name as a literal (no regex injection)', () => {
            // If name weren't escaped, "a.b" would match aXb as well.
            const before = `<!-- ${SLOT_TAG_NAME}: aXb -->\nold\n<!-- /${SLOT_TAG_NAME}: aXb -->`;
            const result = mergeSlot(before, 'a.b', 'NEW', 'replace');
            expect(result.match).toEqual({ kind: 'none' });
            expect(result.content).toBe(before);
        });

        it('still matches the literal escaped name', () => {
            const before = `<!-- ${SLOT_TAG_NAME}: a.b -->\nold\n<!-- /${SLOT_TAG_NAME}: a.b -->`;
            const result = mergeSlot(before, 'a.b', 'NEW', 'replace');
            expect(result.match).toEqual({ kind: 'pair' });
            expect(result.content).toBe(
                `<!-- ${SLOT_TAG_NAME}: a.b -->\nNEW\n<!-- /${SLOT_TAG_NAME}: a.b -->`,
            );
        });

        it('escapes parens, brackets, plus, star', () => {
            const name = '(group)+[v]*';
            const before = `<!-- ${SLOT_TAG_NAME}: ${name} -->\nold\n<!-- /${SLOT_TAG_NAME}: ${name} -->`;
            const result = mergeSlot(before, name, 'NEW', 'replace');
            expect(result.match).toEqual({ kind: 'pair' });
            expect(result.content).toBe(
                `<!-- ${SLOT_TAG_NAME}: ${name} -->\nNEW\n<!-- /${SLOT_TAG_NAME}: ${name} -->`,
            );
        });
    });

    describe('slot isolation', () => {
        it('does not affect other slot names', () => {
            const before = `${OPEN('a')}\nA_OLD\n${CLOSE('a')}\n${OPEN('b')}\nB_OLD\n${CLOSE('b')}`;
            const result = mergeSlot(before, 'a', 'A_NEW', 'replace');
            expect(result.content).toBe(
                `${OPEN('a')}\nA_NEW\n${CLOSE('a')}\n${OPEN('b')}\nB_OLD\n${CLOSE('b')}`,
            );
        });

        it('replaces only the first occurrence in a single pass', () => {
            const before = `${OPEN('x')}\nfirst\n${CLOSE('x')}\n${OPEN('x')}\nsecond\n${CLOSE('x')}`;
            const result = mergeSlot(before, 'x', 'NEW', 'replace');
            expect(result.content).toBe(
                `${OPEN('x')}\nNEW\n${CLOSE('x')}\n${OPEN('x')}\nsecond\n${CLOSE('x')}`,
            );
        });
    });

    describe('edge cases', () => {
        it('handles empty fragment content', () => {
            const before = `${OPEN('x')}\nold\n${CLOSE('x')}`;
            expect(mergeSlot(before, 'x', '', 'replace').content).toBe(
                `${OPEN('x')}\n\n${CLOSE('x')}`,
            );
        });

        it('handles empty content', () => {
            const result = mergeSlot('', 'x', 'NEW', 'replace');
            expect(result.match).toEqual({ kind: 'none' });
            expect(result.content).toBe('');
        });
    });
});

describe('handleMissing', () => {
    const makeCtx = () => {
        const warns: string[] = [];
        return {
            ctx: { logger: { warn: (m: string) => warns.push(m) } },
            warns,
        };
    };

    it('throws and does not warn when behavior is error', () => {
        const { ctx, warns } = makeCtx();
        expect(() => handleMissing('error', ctx, 'oops')).toThrow('oops');
        expect(warns).toEqual([]);
    });

    it('warns with the message and does not throw when behavior is warn', () => {
        const { ctx, warns } = makeCtx();
        handleMissing('warn', ctx, 'warned');
        expect(warns).toEqual(['warned']);
    });

    it('does not throw or warn when behavior is ignore', () => {
        const { ctx, warns } = makeCtx();
        expect(() => handleMissing('ignore', ctx, 'silent')).not.toThrow();
        expect(warns).toEqual([]);
    });
});
