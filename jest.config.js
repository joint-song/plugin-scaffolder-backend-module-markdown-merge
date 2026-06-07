/**
 * Standalone Jest config. Uses @swc/jest for fast TypeScript transformation.
 */
module.exports = {
    testEnvironment: 'node',
    roots: ['<rootDir>/src'],
    testMatch: ['**/*.test.ts'],
    transform: {
        '^.+\\.tsx?$': [
            '@swc/jest',
            {
                jsc: {
                    target: 'es2022',
                    parser: { syntax: 'typescript', decorators: false },
                },
            },
        ],
    },
};
