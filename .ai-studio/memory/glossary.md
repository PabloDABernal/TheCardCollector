# Glossary

Aquí se almacenan los términos oficiales del proyecto.

Su objetivo es que todos los agentes utilicen siempre el mismo vocabulario.

Referencia de diseño vigente: `docs/GDD_The_Collector_v2.md`.

## Términos oficiales

- **Run:** unidad completa de juego. Un Líder + mazo, un pool de 3 Enemigos + 3 Escenarios, y las 3 batallas resultantes (N1, N2, N3) jugadas seguidas con un descanso entre cada una. Perder cualquier batalla de la run la termina de inmediato (roguelite puro).
- **Sorteo cruzado:** al iniciar una run, el juego sortea los 3 emparejamientos Enemigo×Escenario dentro del pool de 3+3 elegido por el jugador (puede mezclar universos). El jugador no elige contra qué lucha, pero decide en qué orden (N1/N2/N3) enfrenta cada cruce revelado.
- **N1 / N2 / N3 (Nivel = slot):** posición de una batalla dentro de la run, asignada por el jugador tras el sorteo cruzado. No es un nivel de dificultad que se desbloquea ganando: cualquier Enemigo puede aparecer en cualquier slot desde el principio.
- **Matriz de completitud:** registro persistente entre runs de qué combinaciones Enemigo×Escenario×Nivel se han completado. Es un logro coleccionable, nunca una puerta de acceso.
- **Descanso (entre combates):** pantalla que aparece entre cada una de las 3 batallas de una run. Ocurren siempre tres cosas, sin elección entre ellas: auto-cura, evolución de carta y Level-Up del Líder.
- **Auto-cura:** recuperación automática y ADITIVA de +50% de la vida máxima del Líder al llegar a cada descanso, con tope en el máximo (no es un suelo que garantice llegar al 50%). Ejemplo: terminar el combate al 70% de vida → +50% = 120% → topa en 100%. Terminar al 30% → +50% = 80%, sin tope. Ocurre siempre, sin coste ni elección del jugador.
- **Evolución de carta:** mejora aplicada a una carta del mazo de la run, elegida en el descanso (formato "elige 1 de 3"). Se implementa mediante una plantilla de evolución según el tipo de carta. Máximo 1 evolución por carta por run; afecta a todas las copias de esa carta en el mazo. Es siempre temporal a la run — nunca toca la colección permanente.
- **Plantilla de evolución:** definición genérica y parametrizada de cómo mejora un tipo de carta (Ataque, Trama, Equipo, Aliado, Contratiempo…) al evolucionar. Sustituye a escribir a mano una versión evolucionada por cada carta del juego; mantiene bajo el coste de contenido del MVP.
- **Level-Up del Líder:** subida de nivel del Líder (máximo 2 subidas, 3 niveles totales por run). Comparte un único contador y tope de run entre las subidas ganadas por triggers dentro de un combate (cambio de fase, umbral de Trama, objetivo cumplido, derrota de secuaces) y las elegidas explícitamente durante el descanso entre combates.
- **Habilidad Neutra:** habilidad cuyo coste de Núcleo no está ligado a ningún color temático (icono ⬜). Garantiza que ningún color del pool de Núcleos quede sistemáticamente sin uso.
- **Vuelta (para Cooldown):** ciclo que determina cuándo baja un cooldown. El CD de una habilidad baja 1 cada vez que vuelve a tocarle actuar a su dueño (jugador o enemigo), no por cada acción individual dentro de un turno.
- **Generar Energía:** acción explícita que el Líder puede elegir en su turno en vez de jugar una carta o activar una habilidad — consume 1 de las 2 acciones del turno y da +1 Energía (tope 5). Es una decisión de ritmo real: "actuar ya" contra "banco Energía para más adelante", no una regeneración automática ni pasiva.
- **Núcleos (dados fijos por color):** ⚠️ sustituye a la entrada previa "Pool de Núcleos" (fichas homogéneas de tamaño 8), obsoleta desde el 2026-07-08 (ver decisions.md, "Cierre del loop jugable de batalla"). En mesa hay 5 dados fijos, uno por cada uno de los 5 colores, compartidos por ambos lados del combate; cada dado muestra un valor 1-4 al tirarse. Cartas/equipo pueden añadir dados EXTRA de un color concreto a la mesa (tope duro sugerido: 10 dados simultáneos, a confirmar en balanceo). En cuanto se gasta el último dado disponible en mesa (por cualquiera de los dos lados), se re-tiran TODOS los dados en mesa a la vez; quien tenga turno inmediatamente después del vaciado elige/actúa primero.
- **Neutro (coste):** etiqueta de coste en una habilidad, no un color de dado propio. Una habilidad de coste Neutro acepta el pago con cualquiera de los 5 dados de color presentes en mesa.