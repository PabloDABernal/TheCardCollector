export interface PlaceholderProps {
  readonly label: string;
}

/**
 * Componente trivial de verificación (spec H2.1 §3.2) — no es un componente de
 * producto, solo demuestra que el tooling JSX/TSX de `ui-shared` compila y es
 * importable de forma aislada, sin arrastrar `phaser` ni nada de `combat-scene`.
 */
export function Placeholder(props: PlaceholderProps): JSX.Element {
  return <span>{props.label}</span>;
}
