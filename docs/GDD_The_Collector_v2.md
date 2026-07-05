# THE COLLECTOR — GDD v2

> Documento consolidado y autocontenido. Reemplaza al GDD v1 como referencia de trabajo. El v1 se conserva en `docs/GDD_The_Collector_v1.md` como histórico — en caso de conflicto, **este documento gana**.

---

## 0. HISTORIAL DE CAMBIOS v1 → v2

Todas las decisiones citadas están fechadas 2026-07-05 en `.ai-studio/memory/decisions.md`; ese archivo es la fuente de verdad de por qué se decidió cada cosa.

1. **Notación de costes reescrita.** Desaparece la notación con número mínimo (⚫3 / 🔴3). Los costes de habilidad son solo por color o genérico; el valor del Núcleo (1-4) alimenta la fórmula de daño/efecto vía **Umbral**, nunca la condición de pago. Ningún turno vuelve a bloquearse por tener solo Núcleos de valor bajo.
2. **Cooldown por vuelta, no por acción.** El CD baja 1 cada vez que te vuelve a tocar actuar (jugador o enemigo), ya no por cada acción individual dentro del turno.
3. **Trama y daño, fuentes separadas.** La Trama la recibe el Escenario; el daño lo recibe el Líder. Son habilidades distintas del Enemigo, nunca la misma habilidad hace ambas cosas.
4. **Habilidades de color Neutro.** Se añaden para que ningún color de Núcleo quede sistemáticamente sin uso.
5. **Estructura de Run nueva (sección 6).** El sorteo cruza Enemigo×Escenario (incluyendo universos mezclados) y el jugador ordena el resultado en N1/N2/N3. Líder y mazo se fijan antes de conocer los cruces. Sustituye a la idea de "Campaña de sets fijos" del v1.
6. **Derrota = fin de run inmediato.** Roguelite puro: perder cualquier combate de la run la termina, sin reintento ni continuar. Se conservan las recompensas de objetivos ya cumplidos.
7. **Nivel = slot, no desbloqueo permanente.** Se elimina el desbloqueo progresivo de niveles de dificultad del v1 (§5.2). Cualquier Enemigo puede aparecer en cualquier nivel; la matriz Enemigo×Escenario×Nivel es un registro de logros, no una puerta.
8. **Celdas repetidas siempre pagan.** Completar una celda ya completada da los Créditos base de esa batalla; la primera vez que se completa da además un bonus fijo (~+50% Créditos).
9. **Pantalla de descanso rediseñada por completo (sección 7).** Desaparece la idea de "Refuerzo vs. Reparación" como vías excluyentes del v1. Ahora, entre cada combate de la run, ocurren **siempre las tres cosas**: auto-cura del 50% de vida máxima, evolución de una carta del mazo (elige 1 de 3, por plantillas), y Level-Up del Líder (elige 1 de 3). Ninguna compite con las otras.
10. **Evolución de cartas por plantillas, no cartas duplicadas a mano.** El contenido de evolución se implementa como un catálogo pequeño de plantillas parametrizadas por tipo de carta (Ataque, Trama, Equipo, Aliado, Contratiempo), con tope de 1 evolución por carta por run; evolucionar una carta evoluciona todas sus copias.
11. **Level-Up del Líder: contador único por run.** Los niveles ganados por triggers dentro de un combate (v1 §6.3) y los ganados durante el descanso comparten el mismo contador y tope (máx. 2 subidas, 3 niveles totales) — no son dos carriles distintos.
12. **Alcance MVP y plataforma formalizados.** 8 Líderes, 4 Enemigos, 4 Escenarios, 2 universos (ej. Star Wars, One Piece); móvil primero, adaptable a PC, testeo en navegador; referencia de feel forcetable.net / strawtable.net. Just for fun, sin monetización, sin restricción de licencias reales.

---

## 1. VISIÓN Y FILOSOFÍA

### 1.1 Concepto Elevator Pitch
**The Collector** es un juego de cartas PVE donde tú eres un coleccionista de TCGs reales (MTG, Star Wars Destiny, One Piece TCG, Marvel Champions, etc.) que adapta sus cartas favoritas para crear su propio sistema de juego solitario. Cada run enfrenta a tu Líder contra tres batallas asimétricas (Enemigo + Escenario con Trama propia), donde el azar compartido del sistema de Núcleos y la gestión de recursos crean tensión táctica en cada turno.

### 1.2 Filosofía de Diseño
- **Coleccionable honesto:** sin monetización agresiva. Todo se obtiene con moneda del juego (Créditos), entre runs.
- **Meta-consciencia:** el jugador es un coleccionista que adapta cartas de múltiples universos a su propio juego PVE.
- **Temática transversal:** cualquier personaje de cualquier universo puede coexistir mecánicamente, incluso dentro de la misma run.
- **Profundidad accesible:** fácil de aprender, difícil de dominar.
- **Ilusión del coleccionista:** abrir sobres, completar la matriz de completitud, construir mazos óptimos.
- **Arte parodia:** las cartas parecen adaptaciones de juegos reales, con bordes recortados, tachones, notas manuscritas del Collector.
- **Aprovechar el medio digital:** mecánicas que en mesa serían un engorro (cooldowns, Contratiempo, dados virtuales de N caras) se gestionan solas en digital. Es la palanca de diferenciación.
- **Roguelite puro:** perder una batalla termina la run. La tensión es real en cada combate, no solo en el último.
- **Just for fun:** sin monetización, sin restricción por licencias reales.

### 1.3 Identidad Única
> "Marvel Champions (escenarios PVE asimétricos, enemigo + esquema) + Star Wars Destiny (azar controlable, turnos alternos) + Slay the Spire (progresión roguelite dentro de la run) + Meta-juego TCG (colección, construcción de mazos entre runs)"

Nadie ha juntado exactamente estas piezas. La diferenciación clave: **2 acciones por turno, sin rondas, con azar compartido en los Núcleos modificables digitalmente, combos opcionales, mecánicas que solo el digital permite (cooldowns, Contratiempo, dados de N caras), y una run donde el sorteo decide contra quién luchas pero tú decides el orden de la escalada.**

### 1.4 Lore del Collector
Eres un apasionado de los juegos de cartas. Tu habitación está llena de cajas de MTG, sobres de Destiny, cartas dobladas de One Piece, mazos de Marvel Champions. Un día decides que, en vez de buscar oponentes, crearás tu propio sistema para jugar solo. Adaptas las cartas, tachas reglas, añades tus propias mecánicas. Cada carta en tu colección es una "versión Collector" de una carta real, con tu sello personal.

### 1.5 Plataforma
Móvil primero, adaptable a PC, con testeo en navegador durante el desarrollo. Referencia de *feel* de interacción: forcetable.net, strawtable.net.

---

## 2. MECÁNICAS CORE

### 2.1 Estructura del Turno
- **2 acciones por turno**, alternos (jugador → enemigo).
- **No hay rondas.** La partida transcurre en una secuencia continua de turnos.
- **Combo** permite una 3ª acción (ver 2.6). Sigue siendo premium.
- **Duración estimada:** 15-30 minutos por batalla, según dificultad (ver 6.1.bis).

### 2.2 Inicio del Turno del Jugador
1. **Efectos de inicio de turno** (umbrales de Trama activos, etc.).
2. **Cooldowns propios** bajan en 1 (ver 2.5 — por vuelta, no por acción).
3. **Eliges una opción** (rápida, no consume acción):
   - **Generar Energía:** +1 Energía (máximo 5).
   - **Canalizar:** +1 carta (máximo 10 en mano).
   - **Auto-reglas:** con 10 cartas en mano, generas Energía automáticamente; con 5 de Energía, robas automáticamente.
4. **Realizas tus 2 acciones.** En cada acción puedes:
   - Activar una habilidad del Líder (si CD = 0) → gasta Energía si la pide + 1 Núcleo del color/tipo requerido.
   - Activar una habilidad de un Aliado en mesa (si CD = 0) → gasta tu acción + 1 Núcleo.
   - Bajar una carta de mano → gasta Energía. La carta va a mesa o resuelve su efecto.
   - **Canalizar** o **Generar Energía** como acción de emergencia (plan B, siempre disponible).
> **Nunca hay Acción Muerta:** el CD1 del Líder es siempre ⚫ (cualquier Núcleo), y Canalizar/+Energía siempre están disponibles como acción de reserva.

### 2.3 Sistema de Núcleos (Azar Compartido)
- **5 colores base** (mecánica interna), más el color **Neutro** (ver 2.3.2). **Valores base: 1-4.**
- Pool compartido entre jugador y enemigo.
- En cada acción que active una habilidad, gastas **1 Núcleo** del color/tipo requerido.
- Cuando se agotan **todos**, se **relanzan automáticamente**.
- **Quien tenga el turno inmediatamente después del vaciado elige primero** del nuevo pool.
- **No se puede pasar** si hay Núcleos disponibles del color correcto.
- **Gramática del Núcleo (Umbral):** el valor del Núcleo gastado (1-4) alimenta la fórmula del efecto (suma, multiplica, o activa un bonus si es ≥3 — keyword Umbral). El valor **nunca** es una condición para poder pagar el coste; eso lo decide solo el color/tipo requerido (ver 2.4).

#### 2.3.1 Dados Virtuales — Mecánica Digital Exclusiva
El rango de los Núcleos (base 1-4) puede ser **modificado temporalmente** por cartas, habilidades, pasivos o escenarios:
- *"Los Núcleos de 🔴 valen mínimo 3 este turno"* → el dado se trunca por abajo.
- *"El siguiente Núcleo que gastes vale 4"* → fija el valor.
- *"Todos los Núcleos son impares"* → filtra valores.
- *"El pool se relanza con dados de 6"* → expande temporalmente el rango.
- *"Los Núcleos valen máximo 2 este turno"* → comprime el dado.
Esto sería imposible de gestionar en un juego físico. En digital es un número en memoria. **Es una de las palancas de diferenciación clave del juego.**

#### 2.3.2 Habilidades de color Neutro
Existen habilidades (de Líder, Aliado o Enemigo) que piden un Núcleo **Neutro** — no ligado a ninguno de los 5 colores temáticos. Su función es puramente de diseño: garantizan que, en cualquier reparto del pool, ningún color quede sistemáticamente sin uso posible, y dan una vía de pago adicional para mazos que no priorizan un color concreto.

### 2.4 Notación de Costes
Los costes de habilidad se expresan **solo por color o genérico**, nunca por un valor mínimo del Núcleo.

| Notación | Significado |
|----------|-------------|
| **⚫** | Un Núcleo de cualquier color, cualquier valor |
| **🔴** | Un Núcleo rojo, cualquier valor |
| **🔴🟡🟢** | Un Núcleo de cualquiera de esos colores, cualquier valor |
| **⬜ (Neutro)** | Un Núcleo Neutro específicamente |

El valor del Núcleo (1-4) solo importa **después** de pagar el coste, para resolver la keyword **Umbral** u otras fórmulas (ver 2.3 y sección 12). Nunca condiciona si la habilidad es jugable.

### 2.5 Cooldowns y Calentamiento
- Cada habilidad tiene un CD. **CD mínimo = 1, nunca 0.**
- **El CD baja 1 por vuelta completa**: cada vez que vuelve a tocarte actuar (al jugador o al enemigo), no por cada acción individual dentro del turno. Combos no adelantan el descuento por sí solos; lo hace el ciclo de turnos.
- **CD1 del Líder siempre ⚫, y siempre puro** (sin +X/×X/Umbral) → garantiza acción válida en cualquier turno, sin modificador de fábrica. Los modificadores empiezan a aparecer en CD2+. Norma sólida con posible excepción deliberada por identidad.
- **Calentamiento:** al empezar la partida (y al bajar un Aliado/permanente con habilidades), todas las habilidades arrancan **"como recién usadas"** (en cooldown). El enemigo también arranca en cooldown.

### 2.6 Combo (Keyword)
- Algunas habilidades/cartas tienen la keyword **"Combo"** (tooltip: "permite una acción extra este turno").
- Si la acción anterior generó Combo, puedes encadenar una **3ª acción** pagando costes normales.
- No puedes repetir la misma habilidad en la misma cadena.
- **Siempre aprovechable:** Canalizar y +Energía están disponibles como acción de relleno, así que un Combo nunca debería desperdiciarse por falta de jugada válida.
- **Combo es opcional como pieza de mazo.** Mazos sin cartas que generen Combo son perfectamente viables.

### 2.7 Contratiempo (Keyword)
- **Counter diferido.** Carta que juegas como acción en tu propio turno. **Paga Energía.**
- Deshace efectos del **turno enemigo inmediatamente anterior** (1 turno atrás).
- **No restaura el pool de Núcleos.** Deshace efectos (daño, Trama, estado, carta de Dramaturgia).
- **Alcance según la carta:** algunas revierten solo el daño, otras la carta de Dramaturgia entera.
- **Lo cancelado se descarta**, no vuelve al mazo del enemigo.
- **Excepción letal:** si el golpe iba a ser letal, el Contratiempo salta en tiempo real, pero **sigue costando tu acción** y necesitas la Energía disponible.

### 2.8 Defensa y Escudos (proactiva)
- **Defensa X** crea **X fichas de escudo persistentes** (no se evaporan al final del turno).
- Cada punto de daño entrante consume 1 ficha antes de tocar tu vida.
- **El daño no tiene Arrollar por defecto:** si el daño supera las fichas de escudo, el exceso **se pierde** (no pasa a vida). Solo pasa si la habilidad tiene la keyword **Arrollar**.
- **Tope global de escudo del Líder: 5** (punto de partida). Apilar de más rebosa y desperdicia.
- **Los Aliados no generan escudo.** El escudo es del Líder.

---

## 3. SISTEMA DE COMBATE

### 3.1 Personaje (Líder)
- Cada personaje tiene **4 habilidades base** fijas (plantilla por defecto CD 1/2/3/4).
- **CD1 siempre ⚫** (nunca queda sin acción válida).
- **3 niveles de Líder** (Level-Up), ganables dentro de la batalla o en el descanso entre batallas — ver 4.3 y 7.3.
- **Pool de 10 cartas propias** asociadas al personaje.

### 3.2 Mazo del Jugador
- **Tamaño:** 30 cartas.
- **Mínimo:** 5 cartas del personaje. **Máximo:** 20 (10 tipos × 2 copias).
- **Límite de copias:** máximo 2 por carta. **Cartas Únicas:** solo 1 con ese nombre en el mazo.
- **Deck-out:** al agotarse el mazo se **rebaraja el descarte** (mazo infinito). El mill solo es amenaza si un escenario/enemigo lo convierte en condición.
- Este mazo de 30 es la base que evoluciona durante la run (ver 7.2) sin tocar nunca la colección permanente.

### 3.3 Tipos de Cartas
| Tipo | Descripción |
|------|-------------|
| **Equipo** | Permanente: pasivos o habilidades activas. |
| **Aliado** | Personaje con vida que bloquea daño **desde que entra** (sin calentamiento para el bloqueo). Sus habilidades activas arrancan en cooldown. |
| **Evento** | Efecto instantáneo. Usar y descartar. |
| **Contratiempo** | Carta que en tu turno deshace lo que hizo el enemigo el turno anterior. |

> **Aliados y bloqueo:** entran a mesa y pueden bloquear daño inmediatamente. Lo que no pueden hacer en el turno de entrada es activar sus habilidades (están en cooldown). El jugador elige libremente si redirigir el daño al Aliado o no — **sin gastar acción.**
>
> **Arrollar:** keyword que indica que el daño excedente al Aliado/escudo pasa al Líder. Sin esta keyword, el exceso se pierde.

### 3.4 Enemigo
- **Una acción por turno:** siempre empieza **robando la carta superior de Dramaturgia**.
- La carta tiene icono **⚔️** o **📜**:
  - ⚔️ → ejecuta habilidad de **Ataque** (daño al Líder), según IA de prioridades.
  - 📜 → ejecuta habilidad de **Trama** (mueve el contador de Trama del Escenario).
- Ataque y Trama son **habilidades siempre separadas**: una misma habilidad del Enemigo nunca hace daño y mueve Trama a la vez. La carta también resuelve **su propio efecto** (invocar secuaz, daño extra, etc.).
- **No usa Energía. Solo Núcleos.**
- **Calentamiento:** arranca en cooldown. Sin alpha-strike en su primer turno.
- **CD1 doble:** a diferencia del Líder, el Enemigo tiene **2 habilidades en CD1** — una básica de Ataque y una básica de Trama, ambas siempre ⚫. Garantiza que el icono de la carta (⚔️/📜) siempre tiene relleno disponible, sin importar el estado de calentamiento de las habilidades de mayor CD. Modificador opcional ±2 por enemigo (identidad temprana).
- **Fases:** 2-3 (variable). Cambios según vida, turnos o condiciones.
- **Tope blando de vida: ningún enemigo supera 100HP**, en ningún nivel de dificultad. Ritmo lento se corrige ajustando habilidades, no inflando vida.

### 3.5 IA de Prioridades del Enemigo
```
Cuando la carta es ⚔️ (Ataque, daño al Líder):
  1. Habilidad firma  — si tiene Núcleo mínimo disponible
  2. Básica de Ataque — siempre disponible (⚫, CD1)

Cuando la carta es 📜 (Trama, contador del Escenario):
  1. Habilidad de Trama de mayor CD — si está desbloqueada
  2. Básica de Trama — siempre disponible (⚫, CD1)

Capa 2 — qué Núcleo gastar (coste ⚫):
  → Prioriza colores del jugador con valor ≥3 (denegar)
  → Si no los hay: mayor valor disponible
  → Si empate o no hay colores del jugador: cualquiera
```
Patrones aprendibles. Telegrafío parcial. Negar el Núcleo alto degrada al enemigo, no lo apaga.

### 3.6 Trama (Mecánica del Escenario)
- Cada escenario tiene una **Trama** con contador. **No es un timer automático: es un recurso bidireccional.** La Trama pertenece al Escenario, no al Enemigo — el Enemigo solo puede accionarla mediante sus habilidades de tipo 📜.
- **Sube** cuando el enemigo ejecuta habilidad 📜 o cuando cartas de Dramaturgia lo indican.
- **NO sube automáticamente** cada turno del enemigo.
- **Efectos variables por umbrales escalados** (peores cuanto más alto). Umbral final = derrota alternativa.
- **Se frena con:** habilidad de Líder anti-Trama, carta de jugador anti-Trama, u objetivos del escenario.
- **Trama X** como keyword: sin +/-. El contexto indica la dirección (enemigo/Dramaturgia = sube, jugador = baja). Si un escenario invierte esto, lo dice explícitamente.
- **El daño de Trama es inabsorbible** (el muro de Aliados no protege del reloj) — y es conceptualmente distinto del daño de Ataque, que sí recibe el Líder y sí puede absorberse (ver 3.7).

### 3.7 Aliados y Absorción
- El enemigo apunta siempre al **Líder** con sus habilidades de Ataque. Tú rediriges el daño a un Aliado **por elección, sin gastar acción.**
- **Absorbible vs inabsorbible:** propiedad del daño (escrito explícitamente). Por defecto, el daño de Ataque es absorbible; el daño de Trama nunca lo es.
- Vida del Aliado escala con su coste en Energía.
- Sus habilidades cuestan tu acción + Núcleo. CD variable.
- **Berserker:** Aliado incontrolable de mucha vida. Toda la absorción va a él obligatoriamente.
- **Baraja sin Aliados es viable:** defensa proactiva 🟢 + Contratiempo + ritmo agresivo.

### 3.8 Secuaces (del enemigo)
- Iniciativa propia. Daño bajo. Sin límite de presencia. **Solo 1 actúa por turno enemigo.**
- **Presencia pasiva:** mientras están en mesa, cada esbirro aporta un efecto pasivo **definido por el enemigo y/o el escenario** (acumulable entre ambas fuentes, sin tope). La presión escala con cuántos dejes vivos, aunque solo 1 ataque por turno. Esto hace que "estar en mesa" pese sin romper la asimetría de acciones.
- **Selección del que actúa:** aleatorio **con filtro de validez** — entre los que pueden ejecutar su acción (no en CD, Núcleo disponible). Si ninguno tiene acción especial, uno al azar usa su ataque plano.
- **Keyword Defensor:** obliga a recibir/atacar a ese secuaz primero.

---

## 4. PERSONAJES Y MAZOS

### 4.1 Sistema de Colección de Líderes (TCG)
**Sobre de Personaje:**
```
1  × Carta de Líder
5  × Cartas de Personaje (aleatorias del pool de 10)
9  × Cartas Comunes de jugador
─────────────────────────────
15 cartas totales
```
- **5 sobres iniciales** al empezar el juego (aleatorios).
- **Pool de Comunes de jugador:** 50 cartas al lanzamiento (~10 por Líder inicial). Crece con nuevos Líderes.
- **MVP: 8 Líderes** en 2 universos.

### 4.2 Construcción de Mazo
- Preparas el mazo entre runs en tu habitación.
- Mínimo 5 cartas del personaje, máximo 20. Resto hasta 30: cartas comunes.
- Puedes ver las versiones evolucionadas del Líder y sus cartas desde la habitación (registro histórico; no afecta al mazo de la próxima run, que arranca siempre desde la colección base — ver 7.2 y 8.1 sobre por qué la evolución es temporal a la run).
- Llevar 2 copias de una carta tiene ahora una razón mecánica extra: si esa carta evoluciona durante una run (7.2), evolucionan **ambas** copias a la vez.

### 4.3 Progresión del Personaje (Level-Up del Líder)
- **3 niveles:** inicial + máximo 2 subidas.
- **Contador único por run.** Las subidas ganadas por triggers dentro de un combate (ver 6.1.bis y checkpoints de fase/Trama/objetivo/secuaz) y las ganadas explícitamente durante el descanso entre combates (ver 7.3) comparten el mismo contador y el mismo tope de 2 subidas — no son dos sistemas paralelos.
- Efectos posibles: +daño, +1 a una habilidad, −1 coste, perder un backlash, etc. Se definen en el editor al crear el Líder.
- Visibles en la carta desde la habitación.
- Persiste durante toda la run (los 3 combates). **Resetea a Nivel 1 al empezar una run nueva.**

---

## 5. ENEMIGOS Y ESCENARIOS

### 5.1 Escenarios (LCG)
**Sobre de Escenario:**
```
1  × Carta de Escenario (reglas Trama + pasivos siempre activos)
8  × Cartas de Escenario (4 tipos × 2 copias)
2  × Cartas únicas de Escenario
5  × Cartas Comunes de Dramaturgia
─────────────────────────────────────
16 cartas totales
```
- **MVP: 4 Escenarios.**

### 5.2 Enemigos (LCG)
**Sobre de Enemigo:**
```
1  × Carta de Enemigo
8  × Cartas de Enemigo (4 tipos × 2 copias)
2  × Cartas únicas de Enemigo
5  × Cartas Comunes de Dramaturgia
─────────────────────────────────────
16 cartas totales
```
- **MVP: 4 Enemigos.**
- **Sin desbloqueo permanente por nivel de dificultad.** Cualquier Enemigo puede enfrentarse en cualquier nivel (N1/N2/N3) desde el principio — el nivel es un **slot dentro de una run** (ver sección 6), no una puerta que se abre al ganar. La **matriz Enemigo×Escenario×Nivel** es un registro de logros y completitud, nunca un requisito para jugar.
- **La Insignia de N3** conserva su prestigio: se registra la primera vez que se completa una celda con un Enemigo enfrentado en el slot N3 de una run, como logro visible en la colección — no como llave para desbloquear contenido.

### 5.3 Mazo de Dramaturgia — 30 cartas
| Origen | Cartas |
|--------|--------|
| Cartas de Enemigo | 10 (4×2 + 2 únicas) |
| Cartas de Escenario | 10 (4×2 + 2 únicas) |
| Cartas Comunes | 10 (5 del sobre Enemigo + 5 del sobre Escenario) |
| **Total** | **30** |

- El ratio ⚔️/📜 emerge naturalmente de las cartas incluidas.
- **Pool de Comunes de Dramaturgia:** 30 cartas al lanzamiento. Crece con nuevos sets.
- **Modo Constructor (endgame):** intercambia las 10 comunes por otras del pool.

---

## 6. ESTRUCTURA DE LA RUN

La run es la unidad completa de juego: **tres batallas** (N1, N2, N3), cada una un Enemigo + un Escenario. Perder cualquiera de las tres termina la run.

### 6.1 El sorteo cruza, el jugador ordena
1. **Eliges Líder y mazo.**
2. **Eliges un pool de 3 Enemigos + 3 Escenarios** de tu colección.
3. **El juego sortea los 3 cruces Enemigo×Escenario** dentro de ese pool — puede mezclar universos libremente (cruzar universos es la fantasía central del Collector, no un accidente que evitar).
4. **Se revelan los 3 cruces** y **tú decides** cuál va a N1, cuál a N2 y cuál a N3.

No eliges contra qué luchas (eso es azar táctico), pero decides el orden de la escalada (eso es control estratégico) — ya elegiste con qué Líder los enfrentas y qué 3+3 pusiste en el sorteo, así que la pantalla de inicio de run ya es una decisión de diseño, no un mero trámite.

### 6.2 Derrota = fin de run inmediato
Perder cualquiera de los 3 combates termina la run al instante (roguelite puro, sin reintento ni continuar). Se conservan las recompensas de los objetivos ya cumplidos en los combates ganados previamente (ver 9.1). El **descanso entre combates** (sección 7) es la única red de seguridad entre una batalla y la siguiente — y por eso importa jugarlo bien.

### 6.3 Nivel = slot de la run
N1/N2/N3 son posiciones dentro de la run que tú decidiste al ordenar el sorteo (6.1), no niveles de dificultad que se desbloquean ganando. La dificultad de cada slot escala en las condiciones de esa batalla (ver 6.1.bis del sistema de combate), no en requisitos previos.

### 6.4 Celdas repetidas
La **matriz de completitud Enemigo×Escenario×Nivel** persiste entre runs (ver 5.2 y 9). Repetir una celda ya completada da igualmente los Créditos base de esa batalla (más objetivos secundarios cumplidos); la **primera vez** que se completa una celda da además un **bonus fijo** (del orden de +50% Créditos). Así lo nuevo siempre atrae más, pero ninguna batalla jugada deja de pagar.

### 6.5 Dificultad = Tiempo (Principio, heredado de combate)
- La dificultad se mide en **tiempo real de partida, no en turnos**: mega fácil ~5 min · fácil ~10 · normal ~15 · difícil ~20 · reto más.
- El tiempo por turno sube con la dificultad (fácil = automático; difícil = obliga a pensar).
- La duración se alarga con **densidad de decisión**, nunca inflando vida (sin esponjas). Combates más largos = más fases/mecanismos/secuaces con efectos, no más HP.
- **Tope blando de vida de enemigo: 100HP máximo**, sin excepción, en cualquier nivel de dificultad.

---

## 7. DESCANSO ENTRE COMBATES Y EVOLUCIÓN DE LA BARAJA

Entre cada uno de los 3 combates de una run aparece una pantalla de descanso. A diferencia del diseño original (Refuerzo vs. Reparación como vías excluyentes, ya descartado), **ocurren siempre las tres cosas siguientes**, sin elegir entre ellas y sin coste de oportunidad entre sí:

### 7.1 Auto-cura del 50% de vida máxima
- La vida del Líder **persiste entre los 3 combates** de la run (no se resetea al empezar cada batalla).
- Entre cada combate, el Líder recupera automáticamente el **50% de su vida máxima**, con tope en el máximo. Ocurre siempre, sin elección del jugador y sin coste.
- **Por qué es así:** decisión explícita del Director Creativo. El fin-de-run inmediato (6.2) ya castiga con dureza; esta auto-cura evita que una sola mala racha de daño en el combate 1 sentencie la run sin remedio antes de llegar al combate 2. (Nota de diseño conservada: esto vacía de contenido la idea original de "Reparación" como elección — ya no compite con nada, es automática para todos.)

### 7.2 Evolución de cartas: elige 1 de 3
- En cada descanso se ofrecen **3 opciones de evolución de cartas** del mazo actual de la run; el jugador elige 1 (mismo gesto de "elige 1 de 3" que el Level-Up).
- **Contenido por plantillas, no cartas duplicadas a mano.** El catálogo MVP es un pequeño set de **plantillas de mejora genéricas parametrizadas por tipo de carta**, no una versión evolucionada escrita a mano por cada carta del juego:

| Tipo de carta | Plantilla de evolución típica |
|---|---|
| Ataque / Evento de daño | +1 al daño, o −1 al coste de Energía |
| Cartas con Trama X | +1 al valor de Trama que mueve |
| Equipo (pasivo/activo) | −1 al CD, o elimina un backlash |
| Aliado | +X vida máxima, o entra sin calentamiento en una habilidad |
| Contratiempo | −1 al coste de Energía |

- **Tope: máximo 1 evolución por carta por run.** Cartas ya evolucionadas no vuelven a ofrecerse.
- **Evolucionar una carta evoluciona todas sus copias** en el mazo (si llevas 2, evolucionan las 2). Esto da función real a la construcción de mazo previa: llevar 2 copias es una apuesta deliberada.
- **Nunca se elimina cartas.** Solo mejora, transforma o añade valor a lo que ya está en el mazo.
- **Puerta abierta explícita (no MVP):** el modelo de datos deja sitio para migrar, más adelante, a evoluciones únicas escritas a mano por carta (especialmente para Únicas/Líder), sin rehacer el modelo. No es requisito de lanzamiento.
- **Agotamiento del pool: caso descartado por imposible.** Con un mazo de 30 cartas y un máximo de 2 descansos por run, nunca se agotan las cartas elegibles para evolucionar.
- Lo evolucionado es **siempre temporal a la run**: nunca toca la colección permanente ni el mazo base guardado en la habitación.

### 7.3 Level-Up del Líder: elige qué habilidad sube
- El jugador elige explícitamente **qué habilidad del Líder mejora**, con el mismo patrón "elige 1 de 3" — decisión propia del descanso, independiente del pool de evolución de cartas de 7.2.
- **No es excluyente con 7.2.** Ambas ocurren en el mismo descanso, cada una como su propia elección — decisión explícita del Director Creativo frente a mezclarlas en un único pool.
- Comparte contador y tope con el Level-Up ganado por triggers dentro de combate (ver 4.3 y 6.1.bis): máximo 2 subidas por run en total, vengan de donde vengan.
- Si el Líder ya alcanzó el nivel máximo (3) antes de un descanso, este paso se omite (no hay nada que subir).

### 7.4 Estructura final de la pantalla de descanso (resumen)
1. Auto-cura del 50% de vida máxima — automática, sin elección.
2. El jugador elige 1 de 3 evoluciones de carta.
3. El jugador elige qué habilidad del Líder sube de nivel (si quedan niveles disponibles).

Las tres ocurren siempre, en el mismo descanso, sin vías excluyentes entre ellas.

---

## 8. PROGRESIÓN Y META-JUEGO

### 8.1 Qué persiste y qué no
- **Colección permanente** (Líderes, Enemigos, Escenarios, cartas, sobres, Créditos): persiste siempre entre runs. Es lo único que el jugador "posee" de verdad.
- **Evolución de cartas y Level-Up del Líder ganados en una run:** temporales a esa run. Al terminarla (por victoria en N3 o por derrota), el mazo vuelve a su estado base guardado en la habitación.
- **Matriz de completitud Enemigo×Escenario×Nivel:** persiste entre runs (ver 5.2 y 6.4). Es puramente un registro de logros.

### 8.2 Sistema de Objetivos y Recompensas (por batalla)
| Objetivo | Recompensa |
|----------|------------|
| Derrotar enemigo (N1/2/3) | X sobres base + Créditos |
| Objetivo secundario A | Sobre de Oro + Créditos |
| Objetivo secundario B | Sobre de Plata + Créditos |
| Objetivo terciario (oculto) | Créditos extra |

- Puedes perder la run pero conservar recompensas de objetivos ya cumplidos en combates ganados previamente.

---

## 9. ECONOMÍA Y RECOMPENSAS

### 9.1 Moneda: Créditos
- Derrotar enemigo: 100/200/350 según el slot (N1/N2/N3).
- Objetivos secundarios: +50. Terciarios: +25.
- **Celda ya completada:** Créditos base íntegros, siempre (ver 6.4).
- **Primera completitud de una celda:** bonus fijo adicional (~+50% Créditos).
- **Los Créditos compran sobres solo entre runs, nunca a mitad de una run.**

### 9.2 Sobres
| Tipo | Contenido | Modelo |
|------|-----------|--------|
| **Sobre de Personaje** | 1 Líder + 5 cartas personaje + 9 comunes | TCG (aleatorio) |
| **Sobre de Enemigo** | 1 Enemigo + 8 cartas + 2 únicas + 5 comunes Drama. | LCG (set fijo) |
| **Sobre de Escenario** | 1 Escenario + 8 cartas + 2 únicas + 5 comunes Drama. | LCG (set fijo) |
| **Sobre de Oro** | Cartas raras/premium | Recompensa objetivo |
| **Sobre de Plata** | Cartas intermedias | Recompensa objetivo |

---

## 10. MODOS DE JUEGO

### 10.1 Run (Modo Principal)
Eliges Líder + mazo + pool de 3 Enemigos + 3 Escenarios. El juego sortea los cruces, tú los ordenas en N1/N2/N3, y juegas las tres batallas seguidas con descansos entre ellas (secciones 6 y 7). Perder cualquiera termina la run. Es el bucle de juego central de The Collector.

### 10.2 Modo Libre
Elige Líder + Enemigo + Escenario + Nivel directamente, sin sorteo ni estructura de 3 combates. Batalla individual, útil para practicar un enfrentamiento concreto o testear un mazo sin arriesgar una run completa.

### 10.3 Modo Constructor (Endgame)
Personaliza el mazo de Dramaturgia del enemigo con las cartas comunes que tienes coleccionadas (ver 5.3).

### 10.4 Desafíos Diarios/Semanales
Condiciones específicas. Recompensas extra.

---

## 11. TEMÁTICA Y UNIVERSO

### 11.1 Principio Transversal
Cualquier personaje de cualquier universo puede coexistir — incluso dentro de la misma run, gracias al sorteo cruzado (6.1). Los 5 colores de Núcleo (más el color Neutro) se renombran por universo.

### 11.2 Ejemplos de Universos Soportados
| Universo | Colores Núcleos |
|----------|-----------------|
| Superhéroes | Tecnología, Fuerza, Velocidad, Mentira, Orden |
| Star Wars | Fuerza, Sable, Blaster, Tecnología, Oscuridad |
| Anime (DBZ) | Ki, Técnica, Transformación, Destrucción, Redención |
| Piratas (OP) | Aire, Fuego, Agua, Tierra, Haki |
| Original | Brasa, Temple, Yunque, Mena, Crisol |

> Mapeo funcional: 🔴 Agresión · 🔵 Control · 🟢 Defensa · 🟡 Recurso · 🟣 Caos.

### 11.3 Alcance MVP
8 Líderes, 4 Enemigos, 4 Escenarios, en **2 universos** (ej. Star Wars, One Piece). Los universos son sets de contenido, no un muro mecánico — el sorteo cruzado (6.1) puede mezclarlos libremente desde el MVP.

---

## 12. SISTEMA DE KEYWORDS

| Keyword | Significado | Nota |
|---------|-------------|------|
| **Ataque** | Daño = valor del Núcleo gastado | Base sin modificador |
| **Ataque +X** | Daño = Núcleo + X | Más común en Líderes |
| **Ataque ×X** | Daño = Núcleo × X | Premium, posible auto-daño |
| **Ataque -X / /X** | Modificadores negativos | Capa futura |
| **Caos (auto-daño)** | Toda habilidad 🟣 inflige auto-daño = valor del Núcleo gastado | Regla de color, no de carta |
| **Trama X** | Mueve el contador del Escenario X pasos (dirección por contexto) | Enemigo sube, jugador baja |
| **Defensa X** | X fichas de escudo persistentes (tope 5) | Proactiva |
| **Umbral** | Si el Núcleo gastado es ≥3, efecto extra | 50% de frecuencia en base 1-4; nunca condiciona el pago, solo el efecto |
| **Combo** | Permite encadenar una acción extra este turno | Premium, siempre aprovechable |
| **Arrollar** | El daño excedente al Aliado/escudo pasa al Líder | Sin keyword = exceso perdido |
| **Defensor** | (Secuaces enemigos) obliga a recibir/atacar a este primero | Taunt |
| **Berserker** | Aliado incontrolable: toda absorción va a él obligatoriamente | Rareza |
| **Neutro** | Coste de Núcleo no ligado a color temático | Garantiza uso de todo el pool |
| **Evolucionado** | Marca visual/textual de que una carta recibió su evolución de plantilla en esta run | Máx. 1 por carta por run; afecta a todas las copias |

---

## 13. ARTE Y ESTÉTICA

- Parodia/estilo de juegos de cartas reales.
- Bordes recortados, pegatinas, tachones, notas manuscritas del Collector.
- La interfaz simula una "habitación de coleccionista".
- Sobres con logo del universo original + sello "Collector's Edition".
- Cartas evolucionadas durante una run llevan una marca visual distintiva (borde/ícono) para que, incluso en el combate 3 con varias evoluciones acumuladas, el jugador siga leyendo su mano de un vistazo.
