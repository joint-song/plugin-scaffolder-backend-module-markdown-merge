import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { handleMissing, mergeSlot } from './merge';

export const createMarkdownMergeAction = () => {
    return createTemplateAction({
        id: 'markdown:merge',
        description:
            'Markdown Slot Injector - Merges multiple fragments into defined slots.',
        schema: {
            input: z =>
                z.object({
                    path: z
                        .string()
                        .describe('Target File Path, e.g., AGENTS.md'),
                    slots: z.array(
                        z.object({
                            name: z.string().describe('Slot Name'),
                            fragmentPath: z
                                .string()
                                .describe('Path to Fragment File'),
                        }),
                    ),
                    mode: z
                        .enum(['replace', 'append'])
                        .optional()
                        .describe(
                            'How to merge the fragment into an existing paired slot. ' +
                                '"replace" (default) overwrites the existing content. ' +
                                '"append" keeps the existing content and inserts the fragment after it. ' +
                                'Has no effect for single-tag (auto-completed) markers.',
                        ),
                    onFragmentMissing: z
                        .enum(['error', 'warn', 'ignore'])
                        .optional()
                        .describe(
                            'Behavior when a fragment file is not found. ' +
                                'Default: "warn" (log a warning and skip the slot).',
                        ),
                    onSlotMissing: z
                        .enum(['error', 'warn', 'ignore'])
                        .optional()
                        .describe(
                            'Behavior when no slot marker is found in the target file. ' +
                                'Default: "warn" (log a warning and continue).',
                        ),
                }),
        },
        async handler(ctx) {
            const {
                path: targetRelPath,
                slots,
                mode = 'replace',
                onFragmentMissing = 'warn',
                onSlotMissing = 'warn',
            } = ctx.input;
            const targetPath = path.resolve(ctx.workspacePath, targetRelPath);

            // Target file: must exist; hard error otherwise.
            let content: string;
            try {
                content = await readFile(targetPath, 'utf-8');
            } catch (e: any) {
                if (e?.code === 'ENOENT') {
                    throw new Error(
                        `Target file ${targetRelPath} not found.`,
                    );
                }
                throw e;
            }

            for (const slot of slots) {
                const fragPath = path.resolve(
                    ctx.workspacePath,
                    slot.fragmentPath,
                );

                // Fragment file: behavior on missing is configurable.
                let fragmentContent: string;
                try {
                    fragmentContent = await readFile(fragPath, 'utf-8');
                } catch (e: any) {
                    if (e?.code === 'ENOENT') {
                        handleMissing(
                            onFragmentMissing,
                            ctx,
                            `Fragment file ${slot.fragmentPath} not found, skipping slot "${slot.name}".`,
                        );
                        continue;
                    }
                    throw e;
                }

                const result = mergeSlot(
                    content,
                    slot.name,
                    fragmentContent,
                    mode,
                );
                content = result.content;

                if (result.match.kind === 'none') {
                    handleMissing(
                        onSlotMissing,
                        ctx,
                        `Slot "${slot.name}" not found in ${targetRelPath}.`,
                    );
                }
            }

            await writeFile(targetPath, content, 'utf-8');
            ctx.logger.info(
                `Successfully injected fragments into ${targetRelPath}`,
            );
        },
    });
};
