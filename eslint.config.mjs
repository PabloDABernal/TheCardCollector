// eslint.config.mjs — flat config raíz, única fuente de reglas de lint
import boundaries from 'eslint-plugin-boundaries';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/coverage/**']
  },
  ...tseslint.configs.recommended,
  {
    plugins: { boundaries },
    settings: {
      'boundaries/elements': [
        { type: 'domain-shared', pattern: 'packages/domain/shared/**' },
        { type: 'domain-catalog', pattern: 'packages/domain/catalog/**' },
        { type: 'domain-combat', pattern: 'packages/domain/combat/**' },
        { type: 'data', pattern: 'packages/data/**' },
        { type: 'cli', pattern: 'packages/cli/**' }, // NUEVO H1.19 — ver spec §0.1
        { type: 'combat-scene', pattern: 'packages/combat-scene/**' }, // NUEVO H2.1
        { type: 'ui-shared', pattern: 'packages/ui-shared/**' }, // NUEVO H2.1
        { type: 'shell', pattern: 'apps/shell/**' }, // NUEVO H2.2
        { type: 'combat-bridge', pattern: 'packages/combat-bridge/**' } // NUEVO H2.3
      ]
    },
    rules: {
      'boundaries/element-types': ['error', {
        default: 'disallow',
        rules: [
          { from: 'domain-shared', allow: [] },
          { from: 'domain-catalog', allow: ['domain-shared', 'data'] },
          { from: 'domain-combat', allow: ['domain-shared', 'domain-catalog'] },
          { from: 'data', allow: [] },
          { from: 'cli', allow: ['domain-shared', 'domain-catalog', 'domain-combat'] }, // NUEVO H1.19
          { from: 'combat-scene', allow: ['domain-shared', 'domain-catalog', 'domain-combat', 'combat-bridge'] }, // AMPLIADA H2.3
          { from: 'ui-shared', allow: [] },
          { from: 'shell', allow: ['domain-shared', 'domain-catalog', 'domain-combat', 'combat-scene', 'combat-bridge', 'ui-shared'] }, // AMPLIADA H2.3
          { from: 'combat-bridge', allow: ['domain-shared', 'domain-combat'] } // NUEVO H2.3
        ]
      }]
    }
  },
  {
    // override: el cinturón de seguridad de react/phaser solo aplica dentro de domain/data
    files: ['packages/domain/**/*.ts', 'packages/data/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { paths: [{ name: 'react' }, { name: 'phaser' }] }]
    }
  }
);
