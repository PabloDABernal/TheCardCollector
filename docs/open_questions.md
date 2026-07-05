# Preguntas abiertas — pendientes de respuesta del Director Creativo

Estado: **ronda 1 cerrada el 2026-07-05.** Las respuestas están formalizadas en `.ai-studio/memory/decisions.md`. Abajo queda la ronda 2 con lo que se derivó de esas decisiones.

## Ronda 2 — abiertas

1. **¿La vida del Líder persiste entre los 3 combates de una run?** Derivada necesaria: si la vida se restaurara sola entre batallas, la vía de Reparación no tendría función. Propuesta sobre la mesa: sí persiste (y Reparación cura una cantidad fija o un %). Pendiente de confirmar, junto con la magnitud de la cura.
2. **Refuerzo: ¿de dónde salen las 3 cartas ofrecidas?** ¿De toda la colección del jugador, filtradas por compatibilidad con el Líder, o incluyen cartas que aún no posee (como "préstamo" de descubrimiento)? Propuesta: solo colección propia, para que coleccionar alimente las runs.
3. **¿Las cartas de Refuerzo temporales pueden superar el límite de 30 del mazo o sustituyen a una carta?** Propuesta: se añaden por encima del límite (mazo de 31-32), más simple y siempre se siente como ganancia.
4. **Level-Up del Líder ganado en batalla: ¿persiste entre los 3 combates de la run?** El GDD v1 (§6.3) dice que persiste "en campaña"; falta confirmar que la run del modo principal cuenta como tal. Propuesta: sí persiste dentro de la run, se resetea al terminarla.

## Ronda 1 — resueltas (2026-07-05, ver decisions.md)

1-3. **Estructura de run:** el sorteo cruza (universos incluidos), el jugador asigna los cruces a N1/N2/N3. Líder y mazo se eligen antes del sorteo, junto con el pool de 3+3.
4. **Derrota a mitad de run:** fin de run inmediato (roguelite puro). Se conservan recompensas de objetivos cumplidos.
5. **Niveles:** nivel = slot de la run, sin desbloqueo permanente. La matriz es registro de logros, no puerta.
6. **Celdas repetidas:** Créditos base siempre; la primera completitud da bonus fijo.
7. **Mejoras entre combates:** elige 1 entre Refuerzo (1 de 3 cartas de tu colección, temporal) o Reparación (curar al Líder). Sin espionaje, sin Créditos a mitad de run.

## Correcciones ya validadas (para referencia, no repreguntar)

- Costes de habilidad: solo color/genérico, nunca número mínimo. Notación ⚫3/🔴3 del GDD v1 queda obsoleta.
- Núcleo (1-4) alimenta la fórmula vía Umbral, no la condición de pago.
- Cooldown baja 1 por vuelta completa (cuando te vuelve a tocar), no por acción individual.
- Al relanzar pool de Núcleos, elige primero quien le toque el turno inmediatamente después del vaciado.
- Trama la recibe el Escenario, daño lo recibe el Líder — habilidades separadas del Enemigo.
- Habrá habilidades de color neutro para que ningún color de dado quede sin uso.
- Plataforma: móvil primero, adaptable PC, testeo en navegador. Referencia de feel: forcetable.net, strawtable.net.
- MVP: 8 Líderes, 4 Enemigos, 4 Escenarios, 2 universos independientes (ej. Star Wars, One Piece).
- Just for fun, sin monetización, sin restricción de licencias reales.
- Run: eliges 3 Enemigos + 3 Escenarios, se sortea el emparejamiento en 3 niveles (N1-N3). Entre combates mejoras. Dentro de cada combate, fases de Enemigo + etapas de Escenario (estilo Marvel Champions).
- Matriz de completitud Enemigo×Escenario×Nivel persiste entre runs. Créditos compran sobres entre runs.
