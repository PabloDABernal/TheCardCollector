import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';

describe('App routing', () => {
  it('navega entre las 3 pantallas stub end-to-end', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByText('The Collector')).toBeInTheDocument();

    await user.click(screen.getByText('Iniciar run'));
    expect(
      screen.getByText('Inicio de Run — pantalla pendiente de implementación (ver H2.14).')
    ).toBeInTheDocument();

    await user.click(screen.getByText('Ir a combate (placeholder)'));
    expect(
      screen.getByText('Combate — pantalla pendiente de montar Phaser (ver H2.9).')
    ).toBeInTheDocument();
    expect(document.getElementById('phaser-mount')).not.toBeNull();
  });
});
