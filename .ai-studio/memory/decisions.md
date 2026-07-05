# Decisions

Este documento almacena decisiones permanentes.

Cada decisión debe explicar:

- qué se decidió

- por qué

- cuándo

Nunca eliminar decisiones antiguas.

---

## 2026-07-05 — Validaciones de mecánicas core (Director Creativo + Game Designer)

Formalizadas hoy; validadas durante la conversación de revisión del GDD v1. Sustituyen a lo que el GDD v1 diga en contra (pendiente GDD v2).

- **Costes de habilidad solo por color/genérico, nunca número mínimo.** La notación ⚫3/🔴3 del GDD v1 queda obsoleta. El valor del Núcleo (1-4) alimenta la fórmula vía Umbral, no la condición de pago. *Por qué:* simplifica la lectura de costes y evita turnos bloqueados por valores bajos.
- **Cooldown baja 1 por vuelta completa** (cuando te vuelve a tocar), no por acción individual.
- **Al relanzar el pool de Núcleos, elige primero quien tenga el turno inmediatamente después del vaciado.**
- **Trama la recibe el Escenario; daño lo recibe el Líder** — habilidades separadas del Enemigo.
- **Habrá habilidades de color neutro** para que ningún color de dado quede sin uso.
- **Plataforma: móvil primero, adaptable a PC, testeo en navegador.** Referencia de feel: forcetable.net, strawtable.net.
- **Alcance MVP: 8 Líderes, 4 Enemigos, 4 Escenarios, 2 universos** (ej. Star Wars, One Piece).
- **Just for fun:** sin monetización, sin restricción por licencias reales.
- **Matriz de completitud Enemigo×Escenario×Nivel persiste entre runs.** Los Créditos compran sobres entre runs, nunca dentro de una run.

## 2026-07-05 — Estructura de la run y meta-progresión (Director Creativo + Fable 5)

### El sorteo cruza, el jugador ordena
- **Qué:** al iniciar una run eliges Líder + mazo y un pool de 3 Enemigos + 3 Escenarios. El juego sortea los 3 cruces Enemigo×Escenario (puede mezclar universos), los revela, y el jugador asigna qué cruce va a N1, N2 y N3.
- **Por qué:** azar en lo táctico, control en lo estratégico. No eliges contra qué luchas, pero planificar el orden de escalada es una decisión rica y hace que la pantalla de inicio de run ya sea juego. Cruzar universos es la fantasía central del Collector y duplica la matriz de completitud (~48 celdas) sin contenido extra. La nota previa de "2 universos independientes" se refiere a sets de contenido, no a un muro mecánico.

### El Líder se elige antes del sorteo
- **Qué:** Líder y mazo se fijan junto con el pool de 3+3, antes de conocer los cruces.
- **Por qué:** la selección del pool ya es estratégica ("elijo rivales que mi mazo maneja bien") y el sorteo pone a prueba la adaptabilidad, que es lo que las mejoras entre combates deben resolver.

### Derrota = fin de run inmediato (roguelite puro)
- **Qué:** perder cualquier combate termina la run. Se conservan las recompensas de objetivos ya cumplidos (regla previa del GDD).
- **Por qué:** máxima tensión; cada combate importa. Convierte Reparación entre combates en una decisión de supervivencia real. Decisión del Director Creativo frente a las alternativas más amables (reintento o continuar con penalización).

### Nivel = slot de la run, sin desbloqueo permanente
- **Qué:** batalla 1 = N1, batalla 2 = N2, batalla 3 = N3. Cualquier enemigo puede aparecer a cualquier nivel sin requisitos previos. La matriz Enemigo×Escenario×Nivel es un registro de logros, no un sistema de puertas. Sustituye al desbloqueo por enemigo del GDD v1 (§5.2).
- **Por qué:** el desbloqueo permanente contradecía el sorteo de la run y añadía fricción sin diversión. La insignia de N3 conserva su prestigio como logro registrado.

### Celdas repetidas: Créditos base; primera completitud da bonus
- **Qué:** completar una celda ya completada da los Créditos base de esa batalla (más sus objetivos secundarios). La primera completitud de una celda da un bonus fijo (orden de +50% Créditos) además del avance hacia insignias.
- **Por qué:** lo nuevo atrae sin que repetir frustre; la batalla jugada siempre paga.

### Mejoras entre combates: Refuerzo o Reparación (sin espionaje, sin Créditos)
- **Qué:** entre combates de una run aparece una pantalla de descanso con 2 vías excluyentes — **Refuerzo** (se ofrecen 3 cartas de tu colección, metes 1 temporalmente en el mazo de esta run) o **Reparación** (curas al Líder). No se puede comprar poder con Créditos a mitad de run. La vía de espionaje/información queda descartada: el sorteo ya revela los cruces al inicio.
- **Por qué:** trade-off poder-vs-supervivencia claro y legible; con fin-de-run inmediato, Reparación tiene peso real. Lo temporal nunca toca la colección permanente.
