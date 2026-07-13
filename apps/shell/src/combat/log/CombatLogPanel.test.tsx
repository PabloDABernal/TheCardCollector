// FIX Reviewer post-H4 — `CombatLogPanel.tsx` no tenía ningún test propio. Cubre el patrón
// peek/expand (spec §3.2: última línea visible por defecto, expandir muestra histórico completo) y
// el pulso `--danger` (`animation: log-peek-pulse`) en la franja peek cuando la línea más reciente
// es una acción del Enemigo.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CombatLogPanel } from './CombatLogPanel';
import type { CombatLogEntry } from './use-combat-log';

function entry(overrides: Partial<CombatLogEntry> & Pick<CombatLogEntry, 'id' | 'text' | 'tone'>): CombatLogEntry {
  return { turnNumber: 1, ...overrides };
}

describe('CombatLogPanel — patrón peek/expand', () => {
  it('sin expandir, muestra solo la última línea (peek) — no el histórico completo', () => {
    const entries: readonly CombatLogEntry[] = [
      entry({ id: '1-0', text: 'Primera línea', tone: 'SYSTEM' }),
      entry({ id: '1-1', text: 'Segunda línea', tone: 'SYSTEM' }),
      entry({ id: '1-2', text: 'Última línea', tone: 'SYSTEM' }),
    ];
    render(<CombatLogPanel entries={entries} />);

    expect(screen.getByText('Última línea')).toBeInTheDocument();
    expect(screen.queryByText('Primera línea')).not.toBeInTheDocument();
    expect(screen.queryByText('Segunda línea')).not.toBeInTheDocument();
  });

  it('sin entradas, la franja peek muestra el texto por defecto "Registro de combate"', () => {
    render(<CombatLogPanel entries={[]} />);
    expect(screen.getByText('Registro de combate')).toBeInTheDocument();
  });

  it('al pulsar la franja peek, expande y muestra el histórico completo', async () => {
    const user = userEvent.setup();
    const entries: readonly CombatLogEntry[] = [
      entry({ id: '1-0', text: 'Primera línea', tone: 'SYSTEM' }),
      entry({ id: '1-1', text: 'Segunda línea', tone: 'SYSTEM' }),
      entry({ id: '1-2', text: 'Última línea', tone: 'SYSTEM' }),
    ];
    render(<CombatLogPanel entries={entries} />);

    await user.click(screen.getByText('Última línea'));

    expect(screen.getByText('Primera línea')).toBeInTheDocument();
    expect(screen.getByText('Segunda línea')).toBeInTheDocument();
    expect(screen.getByText('Última línea')).toBeInTheDocument();
    expect(screen.getByText('Registro de combate')).toBeInTheDocument(); // título del panel expandido
  });

  it('expandido, sin entradas muestra "Sin eventos todavía."', async () => {
    const user = userEvent.setup();
    render(<CombatLogPanel entries={[]} />);

    await user.click(screen.getByText('Registro de combate'));

    expect(screen.getByText('Sin eventos todavía.')).toBeInTheDocument();
  });

  it('al pulsar ✕ en el panel expandido, colapsa de vuelta al peek', async () => {
    const user = userEvent.setup();
    const entries: readonly CombatLogEntry[] = [entry({ id: '1-0', text: 'Línea única', tone: 'SYSTEM' })];
    render(<CombatLogPanel entries={entries} />);

    await user.click(screen.getByText('Línea única'));
    expect(screen.getByText('Registro de combate')).toBeInTheDocument();

    await user.click(screen.getByText('✕'));
    expect(screen.queryByText('Sin eventos todavía.')).not.toBeInTheDocument();
    expect(screen.getByText('Línea única')).toBeInTheDocument();
  });
});

describe('CombatLogPanel — H5.8 §3.2 variant="sidebar"', () => {
  it('renderiza sin franja peek (sin botón de expandir), lista de entradas visible directamente', () => {
    const entries: readonly CombatLogEntry[] = [
      entry({ id: '1-0', text: 'Primera línea', tone: 'SYSTEM' }),
      entry({ id: '1-1', text: 'Última línea', tone: 'SYSTEM' }),
    ];
    render(<CombatLogPanel entries={entries} variant="sidebar" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('Primera línea')).toBeInTheDocument();
    expect(screen.getByText('Última línea')).toBeInTheDocument();
  });

  it('sin variant (o variant="peek"): comportamiento pixel-idéntico al H4 existente (peek, sin histórico completo)', () => {
    const entries: readonly CombatLogEntry[] = [
      entry({ id: '1-0', text: 'Primera línea', tone: 'SYSTEM' }),
      entry({ id: '1-1', text: 'Última línea', tone: 'SYSTEM' }),
    ];
    render(<CombatLogPanel entries={entries} variant="peek" />);

    expect(screen.getByText('Última línea')).toBeInTheDocument();
    expect(screen.queryByText('Primera línea')).not.toBeInTheDocument();
  });
});

describe('CombatLogPanel — pulso --danger en líneas de acción del Enemigo', () => {
  it('la franja peek recibe animation log-peek-pulse cuando la última línea es tone ENEMY_ACTION', () => {
    const entries: readonly CombatLogEntry[] = [
      entry({ id: '1-0', text: 'Juegas una carta', tone: 'LEADER_ACTION' }),
      entry({ id: '1-1', text: 'El Enemigo ataca', tone: 'ENEMY_ACTION' }),
    ];
    render(<CombatLogPanel entries={entries} />);

    const peekButton = screen.getByText('El Enemigo ataca');
    expect(peekButton).toHaveStyle({ animation: 'log-peek-pulse 1.4s ease-in-out' });
  });

  it('la franja peek NO pulsa cuando la última línea no es ENEMY_ACTION', () => {
    const entries: readonly CombatLogEntry[] = [
      entry({ id: '1-0', text: 'El Enemigo ataca', tone: 'ENEMY_ACTION' }),
      entry({ id: '1-1', text: 'Juegas una carta', tone: 'LEADER_ACTION' }),
    ];
    render(<CombatLogPanel entries={entries} />);

    const peekButton = screen.getByText('Juegas una carta');
    expect(peekButton.style.animation).toBe('');
  });
});
