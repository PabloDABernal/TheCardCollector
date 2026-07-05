# Design Notes — Evolución de Cartas y Pantalla de Descanso (Ronda 2)

Estado: propuesta del Game Designer, pendiente de validación del Director Creativo. No se ha tocado `decisions.md` ni el GDD.

---

## 1. Vida del Líder — las dos lecturas

**Lectura A — recuperación automática del 50% para todos, entre cada combate, independiente de la elección.**
Consecuencia: si todo el mundo cura 50% gratis al pasar de combate, Reparación solo tiene sentido si cura **más** que ese 50% automático (por ejemplo, cura al 100%). Si Reparación cura exactamente ese mismo 50%, se convierte en una opción sin coste de oportunidad real — dejaría de competir con Refuerzo, porque el jugador ya recibe la cura "gratis" y Reparación no añadiría nada. Esto **diluye directamente** la decisión ya validada en `decisions.md`: *"Reparación tiene peso real"* frente a fin-de-run inmediato.

**Lectura B — el 50% es la magnitud de la cura de la vía Reparación (no hay recuperación automática para nadie).**
Consecuencia: si no eliges Reparación, llegas al siguiente combate con la vida tal cual la dejaste. Reparación cura el 50% de la vida máxima (con tope en el máximo). El trade-off queda intacto: Refuerzo = poder, Reparación = supervivencia, y cada combate castiga de verdad si vas mal.

**Recomendación: Lectura B.** Es la única coherente con la decisión ya tomada de que "derrota = fin de run inmediato" da peso real a Reparación. La lectura A crea una red de seguridad gratuita que compite con la elección diseñada a propósito. Además, curar el 50% de vida **máxima** (no del 50% de lo perdido) hace que Reparación sea muy fuerte cuando vas mal (casi duplica tu vida efectiva a poca vida) y un simple colchón cuando vas bien — escala de forma natural con el riesgo real que corres, sin necesitar una fórmula más compleja.

---

## 2. Valoración del approach "la baraja evoluciona"

### Por qué es mejor que el Refuerzo original (añadir carta de colección)
El razonamiento del Director es sólido: si ya construiste tu mazo de 30 a medida, una carta suelta de tu colección casi nunca compite con lo que ya elegiste — y si compitiera, ya estaría dentro. Es una recompensa que tiende a la irrelevancia por diseño. Evolucionar cartas que **ya llevas** ataca el problema desde el otro lado: no te da algo nuevo que evaluar, profundiza un compromiso que tú mismo ya tomaste en la habitación. Esto tiene tres ventajas de diseño:

- **Refuerza identidad de mazo en vez de diluirla.** Cada evolución es "más de lo que ya eres", no un parche externo. Encaja con la filosofía de coleccionista: tu mazo, tu sello, ahora más afilado.
- **Rejugabilidad sin inflar contenido.** El mismo mazo de 30 puede vivir runs distintas según qué cartas evolucionan y en qué orden aparecen en el pool de elección — variancia real sin necesitar cientos de cartas nuevas.
- **Las copias duplicadas (máx. 2) ganan función.** Si evolucionar una carta afecta a **todas sus copias en el mazo**, llevar 2 copias de una carta se convierte en una apuesta deliberada en el deck-building previo ("si esto evoluciona, lo noto el doble"). Es una capa de decisión que antes no existía en la construcción de mazo.

### Riesgos reales
- **Coste de contenido si cada carta necesita una versión evolucionada escrita a mano.** Con el alcance MVP ya fijado (8 Líderes, 4 Enemigos, 4 Escenarios, ~74+ cartas de jugador entre personaje y comunes), duplicar cada carta con una versión "+1" a mano dobla de facto el trabajo de diseño de contenido justo cuando el estudio ya decidió mantener el MVP ajustado. Es el riesgo que más puede descarrilar el timeline.
- **Legibilidad.** Si las evoluciones se acumulan durante 3 combates, hace falta un lenguaje visual claro (borde/ícono distintivo en la carta evolucionada) para que en combate 3 el jugador siga leyendo su mano de un vistazo, sin tener que recordar "esta versión hace qué exactamente".
- **Balance frente al Level-Up del Líder.** La evolución de cartas y el Level-Up son ahora dos palancas de escalada simultáneas dentro de la misma run. Si ambas son generosas a la vez, N2/N3 puede sentirse fácil pese al tope de vida de enemigo (100HP). Hay que calibrar la evolución como un empujón modesto (del orden de "medio valor de carta"), no como una segunda carta.

### Recomendación de implementación de contenido: plantillas genéricas parametrizadas, no cartas duplicadas a mano
En vez de escribir una carta evolucionada completa por cada carta del juego, se define un pequeño catálogo de **plantillas de mejora por tipo de carta** (contenido cerrado, ~5-8 plantillas totales) y cada carta lleva un único campo de datos que indica qué plantilla aplica y su magnitud. Ejemplos:

| Tipo de carta | Plantilla de evolución típica |
|---|---|
| Ataque / Evento de daño | +1 al daño, o −1 al coste de Energía |
| Cartas con Trama X | +1 al valor de Trama que mueve |
| Equipo (pasivo/activo) | −1 al CD, o elimina un backlash |
| Aliado | +X vida máxima, o entra sin calentamiento en una habilidad |
| Contratiempo | −1 al coste de Energía |

Esto reduce el coste de autoría a "una etiqueta y un número" por carta en vez de un texto nuevo completo, manteniendo la sensación de que cada evolución está pensada para esa carta (la plantilla se elige a mano por diseño, aunque el texto se genere). Cartas Únicas o de Líder podrían, más adelante y fuera de MVP, recibir una evolución bespoke si su identidad lo justifica — pero no es requisito de lanzamiento.

---

## 3. Propuesta concreta para la pantalla de descanso

Mantiene la estructura ya validada (`decisions.md`): dos vías excluyentes, sin Créditos, sin espionaje.

**Refuerzo (poder)** → se ofrecen **3 opciones, elige 1** (mismo patrón "elige 1 de 3" que ya usa el Level-Up en combate, GDD §6.3, para que el jugador reconozca el gesto). Cada opción es la evolución de una carta candidata del mazo actual de la run (30 base + evoluciones previas), **excluyendo cartas ya evolucionadas** — tope de **1 evolución por carta por run**, igual que Slay the Spire, para que la escalada sea predecible y fácil de leer.
- Evolucionar una carta evoluciona **todas sus copias** en el mazo (si llevas 2, evolucionan las 2). Motivo: legibilidad (no conviene tener dos estados distintos de una carta con el mismo nombre circulando a la vez) y recompensa directa a quien decidió llevar 2 copias en la construcción previa.
- Si no quedan cartas elegibles para evolucionar (todo evolucionado ya), el pool de Refuerzo se rellena con Level-Up del Líder (ver punto 4).

**Reparación (supervivencia)** → cura el 50% de la vida máxima del Líder (Lectura B, tope al máximo). Sin evolución esa vez.

No hay recuperación automática de vida entre combates fuera de elegir Reparación.

---

## 4. Cómo encaja el Level-Up del Líder sin saturar la pantalla

El Level-Up ya existe dentro de combate vía los triggers de GDD §6.3 (cambio de fase, umbral de Trama, objetivo cumplido, etc.), con el mismo patrón "elige 1 de 3". Máximo 2 subidas (3 niveles totales), persiste en la run, resetea al terminarla — nada de esto cambia.

Para que también pueda subir **entre batallas** sin añadir una tercera decisión independiente a la pantalla de descanso, la recomendación es **no crear un tercer bloque de elección**, sino integrar el Level-Up dentro del propio pool de Refuerzo:

- El pool de "elige 1 de 3" de Refuerzo puede mezclar **evoluciones de carta** y **Level-Up del Líder** como opciones del mismo tipo de decisión ("mejora mi poder ahora, de alguna forma").
- Si el Líder ya alcanzó el nivel máximo (3), Level-Up deja de aparecer en el pool automáticamente — sin necesidad de una regla especial, simplemente se filtra como cualquier opción no elegible.
- Esto mantiene la pantalla de descanso en exactamente **2 decisiones de nivel** (qué vía general, y dentro de Refuerzo, qué opción de 3) en vez de 3 bloques separados, coherente con el principio de "dificultad = tiempo" y con un juego mobile-first que no quiere fricción de menús entre combates.

Alternativa más simple (fallback si en playtesting el pool mixto se siente confuso): Level-Up entre batallas como mejora automática sin elección ("tu Líder sube de nivel gratis al empezar el siguiente combate, si le quedan niveles"). Es más pobre en agencia de decisión, pero elimina cualquier riesgo de saturación. Se menciona como red de seguridad, no como recomendación principal.

---

## 5. Preguntas abiertas para el Director Creativo

1. **¿Confirmas la Lectura B de la vida del Líder** (sin recuperación automática; Reparación cura 50% de vida máxima, con tope) **frente a la Lectura A**? Bloquea si Reparación conserva peso real en la decisión.
2. **¿Plantillas genéricas parametrizadas por tipo de carta para las evoluciones** (recomendado, coste de contenido bajo) **o evoluciones únicas escritas a mano por carta** (más artesanal, pero duplica de facto el trabajo de contenido del MVP)? Bloquea directamente el dimensionado de trabajo de Coordinator/Architect.
3. **¿Tope de 1 evolución por carta por run** (recomendado, como Slay the Spire) **o se permite reevolucionar la misma carta más de una vez** si reaparece en el pool? Afecta cómo se filtra el pool de Refuerzo.
4. **¿Apruebas integrar el Level-Up entre batallas dentro del mismo pool de Refuerzo** (elige 1 de 3 mezclando evoluciones y Level-Up, recomendado) **o prefieres que sea una subida automática sin decisión** entre combates? Bloquea el diseño de la pantalla de descanso.
