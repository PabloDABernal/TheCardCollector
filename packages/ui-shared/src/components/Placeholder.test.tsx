import { describe, it, expect } from 'vitest';
import { Placeholder } from './Placeholder';

/**
 * Único requisito de H2.1 §3.2/§4.3: probar que el tooling JSX/TSX del paquete
 * compila. Sin `react-dom`/Testing Library (no declarados en package.json §2.8) —
 * basta con invocar el componente como función pura y comprobar el árbol de elemento
 * React devuelto, sin montar DOM real.
 */
describe('Placeholder (H2.1)', () => {
  it('renderiza un elemento React con props.label como contenido', () => {
    const element = Placeholder({ label: 'hola combat-scene' });

    expect(element.type).toBe('span');
    expect(element.props.children).toBe('hola combat-scene');
  });
});
